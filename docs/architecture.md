# Free AP Practice — Architecture

High-level overview of how the app is structured, how requests flow, and how the main features connect.

---

## 1. System overview

```mermaid
flowchart TB
    subgraph Client["Browser — Svelte 5 + Tailwind"]
        direction TB
        PubUI["Public pages<br/>/, /about, /subjects, /summer,<br/>/blog, /stats, /privacy, /terms, /changelog"]
        AuthUI["Auth pages<br/>/login, /signup, /verify-email,<br/>/forgot-password, /reset-password"]
        PracticeSEO["SEO practice landings<br/>/practice/[...slug]"]
        AppUI["Authenticated app /app/*<br/>dashboard · practice · progress<br/>history · resources · settings"]
        Components["Shared UI<br/>QuestionShell · QuestionCard · Tutor<br/>Sidebar · Data tables"]
    end

    subgraph Vercel["SvelteKit on Vercel"]
        direction TB
        Hooks["hooks.server.ts<br/>session · rate limit · CORS · security headers · logging"]
        Pages["SSR / CSR routes<br/>+layout.server.ts guards /app"]
        API["API routes /api/*"]
    end

    subgraph Lib["Server libraries ($lib)"]
        AuthLib["auth/server.ts — Better Auth"]
        QGen["questions/* — cache, pool, generation, S3"]
        AI["ai/service.server.ts — Vercel AI SDK"]
        TutorLib["tutor/service.server.ts"]
        UsersLib["users/* — profile, stats, progress, history"]
        Catalog["catalog/* — AP classes, practice pages, validation"]
        BlogLib["blog/service.server.ts — markdown posts"]
    end

    subgraph Data["Persistence"]
        MongoDB[("MongoDB")]
        S3[("AWS S3<br/>private question batches")]
        StaticJSON["Static data<br/>unit-descriptionsrevised.json<br/>practice-pages.json"]
        BlogMD["Markdown<br/>src/content/blog/*.md"]
    end

    subgraph External["External services"]
        OpenAI["OpenAI-compatible API<br/>OpenAI or LM Studio"]
        Resend["Resend — transactional email"]
        Google["Google OAuth / One Tap"]
        GitHub["GitHub Issues API<br/>bug reports"]
    end

    Client --> Hooks
    Hooks --> Pages
    Hooks --> API
    Pages --> Lib
    API --> Lib

    AuthLib --> MongoDB
    AuthLib --> Resend
    AuthLib --> Google
    UsersLib --> MongoDB
    QGen --> MongoDB
    QGen --> S3
    QGen --> AI
    AI --> OpenAI
    TutorLib --> AI
    Catalog --> StaticJSON
    BlogLib --> BlogMD
    API --> GitHub

    PracticeSEO -.->|"CTA → /app/practice?apClass&unit"| AppUI
    PubUI -.->|"signed-in user redirected"| AppUI
```



---

## 2. Request lifecycle (every HTTP request)

```mermaid
sequenceDiagram
    participant B as Browser
    participant H as hooks.server.ts
    participant BA as Better Auth
    participant R as Route handler
    participant DB as MongoDB

    B->>H: HTTP request
    H->>H: OPTIONS / favicon / rate-limit /api/*
    H->>BA: getSession(headers)
    BA->>DB: authSessions lookup
    BA-->>H: session + user (or null)
    H->>H: locals.userId / user / session
    H->>R: resolve(event)
    R-->>H: Response
    H->>H: security headers, CORS, no-cache on /api
    H-->>B: Response
```



---

## 3. Route map

```mermaid
flowchart LR
    subgraph Public["Public (no login)"]
        P1["/ Landing"]
        P2["/about · /subjects · /summer"]
        P3["/blog · /blog/[slug]"]
        P4["/stats"]
        P5["/practice/[...slug]"]
        P6["/privacy · /terms · /changelog"]
        P7["/health · /sitemap.xml"]
    end

    subgraph AuthPages["Auth pages"]
        A1["/login · /signup"]
        A2["/verify-email · /email-sent"]
        A3["/forgot-password · /reset-password"]
    end

    subgraph App["/app — session required"]
        D["/app Dashboard"]
        PR["/app/practice"]
        PG["/app/progress"]
        HI["/app/history"]
        RS["/app/resources"]
        ST["/app/settings"]
    end

    subgraph API["API"]
        AUTH["/api/auth/*<br/>Better Auth"]
        Q["/api/question<br/>/cache/generate<br/>/generation-stats"]
        ME["/api/me/*<br/>stats · progress · history<br/>record-attempt · bookmarks"]
        T["/api/tutor/chat · greeting"]
        BR["/api/bug-report"]
    end

    AuthPages --> AUTH
    App --> ME
    App --> Q
    App --> T
    PR --> Q
    P4 --> Q
    P5 --> PR
```



---

## 4. Question generation pipeline (core feature)

```mermaid
flowchart TD
    Start(["POST /api/question"]) --> Validate["validateQuestionRequest<br/>AP class · unit · optional custom topic"]
    Validate -->|invalid| Err400["400 response"]
    Validate -->|custom topic| Live["generateLiveCustomTopicMcq<br/>always live AI — no cache pool"]
    Validate -->|standard unit| Pool["getQuestion → question pool"]

    Pool --> Claim{"MongoDB pool<br/>claim next available doc<br/>(same logic for all users)"}
    Claim -->|hit| LoadInline["Read full MCQ body from Mongo<br/>inline hot-cache fields"]
    Claim -->|miss| MissFlow["cache-miss cluster flow<br/>distributed lock + wait/retry"]
    MissFlow --> GenPool["generateQuestionForPool"]

    Replenish["Background replenish pool<br/>target CACHE_POOL_SIZE"] --> GenPool
    GenPool --> UnitCtx["Lookup unit context<br/>unit-descriptionsrevised.json"]
    UnitCtx --> Recent["getRecentTopics<br/>avoid duplicate topics"]
    Recent --> AI["AI structured completion<br/>ADVANCED_MODEL or BASIC_MODEL"]
    AI --> S3Write["persistMcqQuestionToS3<br/>single durable write"]
    S3Write --> HotDoc["Insert full MCQ + s3QuestionId<br/>in Mongo hot pool"]

    LoadInline --> Return(["JSON: answer, questionId,<br/>provider, model, cached"])
    HotDoc --> Return
    Live --> Return

    Return --> UI["QuestionCard renders MCQ<br/>LaTeX · KaTeX · Desmos optional"]
    UI --> Attempt["User answers"]
    Attempt --> Record["POST /api/me/record-attempt"]
    Record --> Profile["UserProfile in MongoDB<br/>questionHistory + progress + mastery"]
```



**Pool behavior notes**

- Signed-in and anonymous users share the same claim path: oldest available doc for `(apClass, unit)` by `lastServedAt`, with no per-user repeat filtering.
- `contentHash` (SHA-256 of normalized question text) deduplicates entries **inside the hot pool** only — it prevents the same MCQ body from being inserted twice while replenishing.
- Pool docs are ephemeral: after `maxServeCount` serves (default 50), the Mongo doc is deleted. S3 remains the durable copy for history and bookmarks.
- Background replenish targets `CACHE_POOL_SIZE` per class/unit bucket. Ops scripts: `pnpm cache:clear`, `pnpm cache:warm`.

---

## 5. Authentication and user profile

```mermaid
flowchart TD
    subgraph SignUp["Sign up / sign in"]
        Email["Email + password"]
        Google["Google OAuth / One Tap"]
    end

    SignUp --> BA["Better Auth /api/auth/*"]
    BA --> AuthDB[("MongoDB auth collections<br/>authUsers · authSessions<br/>authAccounts · authVerifications")]
    BA --> EmailSend["Resend emails<br/>verify · reset · existing-user notice"]
    BA --> Hook["databaseHooks.user.create.after"]
    Hook --> Profile["ensureUserProfile → UserProfile doc"]

    subgraph Session["Every request"]
        Cookie["Session cookie"]
        Cookie --> GetSession["auth.api.getSession"]
        GetSession --> Locals["event.locals.userId"]
    end

    subgraph AppGuard["/app layout"]
        Locals --> Check{session?}
        Check -->|no| Redirect["redirect → /login"]
        Check -->|yes| AppPages["/app/* pages"]
    end

    Profile --> UserData["progress[] · questionHistory[]<br/>bookmarkedQuestions[]"]
```



---

## 6. Practice session (signed-in user journey)

```mermaid
sequenceDiagram
    participant U as Student
    participant App as /app/practice
    participant QS as QuestionShell / QuestionCard
    participant API as API
    participant AI as OpenAI / LM Studio
    participant DB as MongoDB + S3
    participant Tutor as Tutor panel

    U->>App: Pick AP class + unit (or custom topic)
    App->>QS: requestVersion++
    QS->>API: POST /api/question
    API->>DB: claim from hot pool (auth does not change selection)
    API->>AI: generate on cache miss or custom topic
    AI-->>API: structured MCQ
    API->>DB: S3 + pool doc
    API-->>QS: question payload
    QS-->>U: Render question + choices

    opt After answer
        U->>QS: Select A/B/C/D
        QS->>API: POST /api/me/record-attempt
        API->>DB: update UserProfile progress + history
    end

    opt Tutor
        U->>Tutor: Ask for help
        Tutor->>API: POST /api/tutor/greeting or /chat
        API->>AI: streaming tutor prompt (no answer leakage)
        AI-->>Tutor: streamed guidance
    end

    opt Bookmark
        U->>API: POST /api/me/bookmark
        API->>DB: bookmarkedQuestions[]
    end
```



---

## 7. Data model (MongoDB)

```mermaid
erDiagram
    AUTH_USERS ||--o{ AUTH_SESSIONS : has
    AUTH_USERS ||--o{ AUTH_ACCOUNTS : has
    AUTH_USERS ||--|| USER_PROFILE : "1:1 via userId"

    USER_PROFILE {
        string userId PK
        array progress
        array questionHistory
        array bookmarkedQuestions
    }

    QUESTION_POOL {
        string s3QuestionId UK
        string apClass
        string unit
        string contentHash UK
        string question
        string status
        int serveCount
        int maxServeCount
    }

    CACHE_MISS_LOCK {
        string key UK
        date expiresAt
    }

    QUESTION_RECENT_TOPICS {
        string apClass
        string unit
        string topicsCovered
    }

    GEN_STATS {
        counters for public /stats
    }

    QUESTION_POOL }o--|| S3_OBJECT : "s3QuestionId from generation"
    USER_PROFILE }o--o{ S3_OBJECT : "history references questionId"
```



---

## How the pieces fit together


| Layer              | Role                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public site**    | Marketing, blog, SEO practice pages, and generation stats — mostly static or read-only                                                                                                                                                                              |
| `**/app`**         | Core product: generate questions, track progress, history, bookmarks, settings                                                                                                                                                                                      |
| **Question cache** | One generation path writes S3 once, then stores full MCQ bodies plus `s3QuestionId` in the Mongo hot pool; serves read Mongo only. Pool-level `contentHash` dedup; no per-user seen tracking. `CacheMissLock` coordinates cache misses across serverless instances. |
| **Better Auth**    | Sessions, OAuth, email verification; creates a `UserProfile` on signup                                                                                                                                                                                              |
| **AI layer**       | One OpenAI-compatible provider (cloud or LM Studio) for generation, grading context, and tutor chat                                                                                                                                                                 |
| **Vercel**         | Hosting, `waitUntil` for background auth tasks, optional Analytics/Speed Insights                                                                                                                                                                                   |

