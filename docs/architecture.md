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
        Components["Feature UI under $lib/components<br/>PracticeShell · QuestionCard · FrqCard<br/>Tutor · Sidebar · Data tables"]
    end

    subgraph Vercel["SvelteKit on Vercel"]
        direction TB
        Hooks["hooks.server.ts<br/>session · PostHog proxy · CORS · security headers · logging"]
        Pages["SSR / CSR routes<br/>+layout.server.ts guards /app"]
        API["API routes /api/*"]
    end

    subgraph Lib["Server libraries ($lib)"]
        AuthLib["auth/* — Better Auth + API helpers"]
        QGen["questions/* — cache, pool, generation, S3"]
        FrqLib["frq/* — FRQ generate, grade, attempts"]
        PracticeExp["practice/* — multi-attempt experiment"]
        AI["ai/service.server.ts — Vercel AI SDK"]
        TutorLib["tutor/*"]
        UsersLib["users/* — profile, stats, progress, history, delete-app-data"]
        Referrals["referrals/*"]
        Catalog["catalog/* — AP classes, practice pages, validation"]
        BlogLib["blog/* — markdown posts"]
        SiteUrl["site-url.ts — canonical origin"]
    end

    subgraph Data["Persistence"]
        MongoDB[("MongoDB")]
        S3[("AWS S3<br/>questions/ + frqs/")]
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
    AuthLib --> UsersLib
    UsersLib --> MongoDB
    UsersLib --> FrqLib
    UsersLib --> Referrals
    QGen --> MongoDB
    QGen --> S3
    QGen --> AI
    FrqLib --> MongoDB
    FrqLib --> S3
    FrqLib --> AI
    PracticeExp --> UsersLib
    AI --> OpenAI
    TutorLib --> AI
    Catalog --> StaticJSON
    BlogLib --> BlogMD
    Referrals --> MongoDB
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
    H->>H: OPTIONS / favicon / PostHog proxy /api/*
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
        PR["/app/practice<br/>MCQ + optional FRQ"]
        PG["/app/progress"]
        HI["/app/history"]
        RS["/app/resources"]
        ST["/app/settings"]
        AD["/app/admin"]
    end

    subgraph API["API"]
        AUTH["/api/auth/*<br/>Better Auth"]
        Q["/api/question<br/>/api/question/frq · /frq/grade<br/>/generation-stats"]
        ME["/api/me/*<br/>stats · progress · history<br/>record-attempt · bookmarks<br/>practice-experiment · frq-attempt"]
        T["/api/tutor/chat · greeting · frq"]
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

Public SEO landings use `QuestionShell` (MCQ-only thin wrapper over `PracticeShell`). Authenticated `/app/practice` uses `PracticeShell` with `allowFrq` when the FRQ flag is on.

---

## 4. Question generation pipeline (core feature)

MCQ and FRQ share the same hot-pool / cache-miss machinery (`createQuestionPool` + cluster lock). Bodies live under S3 prefixes `questions/` and `frqs/`.

```mermaid
flowchart TD
    Start(["POST /api/question or /api/question/frq"]) --> Validate["validateQuestionRequest<br/>AP class · unit"]
    Validate -->|invalid| Err400["400 / 410 response"]
    Validate -->|ok| Pool["getQuestion / getFrqQuestion → shared pool"]

    Pool --> Select{"MongoDB pool<br/>select reusable doc<br/>excluding this session's seen IDs"}
    Select -->|hit| LoadInline["Read body from Mongo<br/>inline hot-cache fields"]
    Select -->|miss| MissFlow["cache-miss cluster flow<br/>distributed lock + wait/retry"]
    MissFlow --> GenPool["MCQ or FRQ live generation"]

    GenPool --> UnitCtx["Lookup unit context<br/>unit-descriptionsrevised.json"]
    UnitCtx --> Recent["Recent topics<br/>avoid duplicate topics"]
    Recent --> AI["AI structured completion"]
    AI --> S3Write["Persist to S3<br/>questions/ or frqs/"]
    S3Write --> HotDoc["Insert body + s3QuestionId<br/>in Mongo hot pool"]

    LoadInline --> Return(["JSON payload + questionId"])
    HotDoc --> Return

    Return --> UI["QuestionCard or FrqCard"]
    UI --> Attempt["User answers"]
    Attempt --> Record["MCQ: POST /api/me/record-attempt<br/>FRQ: POST /api/question/frq/grade"]
    Record --> Profile["MCQ → UserProfile history/progress<br/>FRQ → FrqAttempt collection"]
```

**Pool behavior notes**

- Signed-in and anonymous users share the same reusable Mongo hot pool (per question type).
- The browser sends current-session `excludeQuestionIds` for standard questions so one session does not see the same question ID twice.
- Multiple users can receive the same cached question at the same time; cached docs are not claimed, locked, or deleted after a serve count.
- `contentHash` (SHA-256 of normalized question text) deduplicates entries **inside the hot pool** only — it prevents the same MCQ body from being inserted twice during generation.
- On a standard-unit miss, `CacheMissLock` coordinates one live generation across Vercel serverless instances. Ops script: `bun scripts/clear-cache.ts`.

There is **no** application-level AI rate limiter on `/api/question` or `/api/tutor/chat` after the process-local / Upstash experiments were removed. Cost and abuse controls, if needed again, should be added deliberately (edge/WAF or a shared store), not as process-local maps.

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

    subgraph Delete["Account cleanup"]
        Del["deleteAppDataForUsers<br/>UserProfile · FrqAttempt · Referral"]
    end

    Profile --> UserData["progress[] · questionHistory[]<br/>bookmarkedQuestions[] · practiceExperiments[]"]
    BA --> Del
```

Canonical site origin for emails, sitemaps, and discovery lives in `$lib/site-url.ts`. Auth callbacks use `$lib/auth/urls.ts` (`authCallbackUrl`). Authenticated API routes use `withAuthedHandler` in `$lib/auth/route-helpers.server.ts`.

---

## 6. Practice session (signed-in user journey)

```mermaid
sequenceDiagram
    participant U as Student
    participant App as /app/practice
    participant PS as PracticeShell
    participant Card as QuestionCard / FrqCard
    participant Sess as question-card-session
    participant API as API
    participant AI as OpenAI / LM Studio
    participant DB as MongoDB + S3
    participant Tutor as Tutor panel

    U->>App: Pick AP class + unit · optional MCQ/FRQ mode
    App->>PS: requestVersion++
    alt MCQ
        PS->>Card: QuestionCard
        Card->>Sess: loadQuestion
        Sess->>API: POST /api/question
        API->>DB: hot pool hit or generate
        API-->>Sess: question payload
        Sess-->>U: Render question + choices
        opt After answer
            U->>Sess: Check answer / multi-attempt hints
            Sess->>API: POST /api/me/record-attempt
            API->>DB: UserProfile progress + history
        end
    else FRQ
        PS->>Card: FrqCard
        Card->>API: POST /api/question/frq
        API->>DB: FRQ pool hit or generate
        API-->>Card: FRQ payload
        U->>API: POST /api/question/frq/grade
        API->>AI: rubric grading
        API->>DB: FrqAttempt
    end

    opt Tutor
        U->>Tutor: Ask for help
        Tutor->>API: POST /api/tutor/greeting, /chat, or /frq
        API->>AI: streaming tutor prompt (no answer leakage)
        AI-->>Tutor: streamed guidance
    end

    opt Bookmark
        U->>API: POST /api/me/bookmarks
        API->>DB: bookmarkedQuestions[]
    end
```

`QuestionShell` is a thin public MCQ-only wrapper around `PracticeShell`. MCQ answer/load/experiment state lives in `createQuestionCardSession` (`question-card-session.svelte.ts`); markup stays in `question-card.svelte`.

`$lib/practice/*` is the **multi-attempt A/B experiment**, not practice routing. Practice page catalog + SEO live in `$lib/catalog` and `$lib/components/practice`.

---

## 7. Data model (MongoDB)

```mermaid
erDiagram
    AUTH_USERS ||--o{ AUTH_SESSIONS : has
    AUTH_USERS ||--o{ AUTH_ACCOUNTS : has
    AUTH_USERS ||--|| USER_PROFILE : "1:1 via userId"
    AUTH_USERS ||--o{ FRQ_ATTEMPT : has
    AUTH_USERS ||--o{ REFERRAL : "referrer or referred"

    USER_PROFILE {
        string userId PK
        array progress
        array questionHistory
        array bookmarkedQuestions
        array practiceExperiments
    }

    FRQ_ATTEMPT {
        string userId
        string questionId
        string status
        object grade
    }

    REFERRAL {
        string referrerUserId
        string referredUserId
        string code
    }

    QUESTION_POOL {
        string s3QuestionId UK
        string apClass
        string unit
        string contentHash UK
        string question
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
    FRQ_ATTEMPT }o--o{ S3_OBJECT : "FRQ questionId"
```

---

## How the pieces fit together

| Layer              | Role                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public site**    | Marketing, blog, SEO practice pages, and generation stats — mostly static or read-only                                                                                 |
| **/app**           | Core product: MCQ (+ optional FRQ) practice, progress, history, bookmarks, settings                                                                                    |
| **Question cache** | Shared pool for MCQ and FRQ: one generation writes S3 once, then stores body + `s3QuestionId` in Mongo; `CacheMissLock` coordinates misses across serverless instances |
| **Better Auth**    | Sessions, OAuth, email verification; creates `UserProfile` on signup; `deleteAppDataForUsers` cleans app rows on account delete                                        |
| **AI layer**       | One OpenAI-compatible provider for generation, FRQ grading, and tutor chat                                                                                             |
| **Referrals**      | Invite cookie → claim → activate on first meaningful attempt                                                                                                           |
| **Vercel**         | Hosting, `waitUntil` for background auth tasks, optional Analytics/Speed Insights                                                                                      |
