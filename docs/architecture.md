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
        QGen["questions/* — pool select, refill worker, S3 archive"]
        FrqLib["frq/* — FRQ select, grade, worker generation"]
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
    alt POST /api/question only
        Note over H: Skip Better Auth session lookup<br/>(public MCQ hot path)
    else All other routes
        H->>BA: getSession(headers)
        BA->>DB: authSessions lookup
        BA-->>H: session + user (or null)
        H->>H: locals.userId / user / session
    end
    H->>R: resolve(event)
    R-->>H: Response
    H->>H: security headers, CORS, no-cache on /api
    H-->>B: Response
```

`POST /api/question` is the only session-bypass exception. FRQ (`/api/question/frq`), `/api/me/*`, and cron/admin routes still resolve sessions or their own auth helpers.

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
        CRON["/api/cron/question-pool<br/>CRON_SECRET"]
        ADMINQ["/api/admin/question-pool<br/>enqueue only"]
    end

    AuthPages --> AUTH
    App --> ME
    App --> Q
    App --> T
    App --> ADMINQ
    PR --> Q
    P4 --> Q
    P5 --> PR
    CRON -.->|"Vercel cron */5"| CRON
```

Public SEO landings use `QuestionShell` (MCQ-only thin wrapper over `PracticeShell`). Authenticated `/app/practice` uses `PracticeShell` with `allowFrq` when the FRQ flag is on. Admin Pool tab enqueues refill jobs only — it never generates synchronously.

---

## 4. Question pool and generation (core feature)

**Roles**

| Store / path                              | Role                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **S3** (`questions/`, `frqs/`)            | Canonical archive and ID source. History/bookmarks keep working even if Mongo rows are retired. |
| **Mongo active library**                  | Serving library: full question bodies inline, indexed random selection per class/unit.          |
| **User request path**                     | Selection only — never calls the LLM, never writes S3, never waits on a generation lock.        |
| **Refill workers** (cron + admin enqueue) | Only place that generates: S3-first write, then insert/upsert an active Mongo row.              |

Targets default to demand-scaled MCQ floors (JSON in `src/lib/data/question-pool-targets.json`: Biology preferred **35**, default preferred **20**, min **10** from generation-stats share) and **8 active FRQs** per class/unit. Refill starts below 90% of target and fills back to target. Targets are **floors, not caps**: buckets already above target are left alone (no auto-trim). Serving does not consume or delete rows.

```mermaid
flowchart TD
    Start(["POST /api/question or /api/question/frq"]) --> Validate["validateQuestionRequest<br/>AP class · unit"]
    Validate -->|invalid| Err400["400 / 410 response"]
    Validate -->|ok| Pool["getQuestion / getFrqQuestion<br/>selection-only pool"]

    Pool --> Select{"Indexed random Mongo select<br/>active rows · session excludes"}
    Select -->|hit| LoadInline["Read body from Mongo<br/>inline library fields"]
    Select -->|empty| Warming["503 POOL_WARMING<br/>enqueue refill request"]
    Select -->|db error| Unavailable["503 POOL_UNAVAILABLE<br/>no LLM fallback"]

    LoadInline --> Return(["JSON payload + questionId"])
    Warming --> RefillReq["Upsert PoolRefillState"]
    Unavailable --> ReturnErr(["JSON error"])

    Cron["Vercel cron / admin"] --> Worker["Bounded refill worker<br/>lease · daily budget"]
    RefillReq --> Worker
    Worker --> S3First["Import or generate<br/>S3 canonical object"]
    S3First --> MongoInsert["Insert active Mongo row<br/>randomKey + contentHash"]

    Return --> UI["QuestionCard or FrqCard"]
    UI --> Attempt["User answers"]
    Attempt --> Record["MCQ: POST /api/me/record-attempt<br/>FRQ: POST /api/question/frq/grade"]
    Record --> Profile["MCQ → UserProfile history/progress<br/>FRQ → FrqAttempt collection"]
```

**Pool behavior notes**

- Signed-in and anonymous users share the same Mongo serving library (per question type).
- The browser sends current-session `excludeQuestionIds` (capped at 100). If every active ID is excluded but the bucket is non-empty, selection resets exclusions and returns a random active question.
- Multiple users can receive the same question at the same time; rows are not claimed or deleted on serve.
- `contentHash` (SHA-256 of normalized question text) deduplicates inserts into the library; duplicate keys during refill are skipped and counted toward the run budget (S3 objects may remain as archive orphans).
- Empty buckets return typed `POOL_WARMING` immediately and request asynchronous population — there is no synchronous generation fallback.
- **Refill leases:** warming/admin enqueue never demotes a live `running` lease to `pending`. The cron worker claims due jobs, renews the lease before each generation, and stops on per-run / daily LLM budget. Full-catalog reconcile (`bun run pool:reconcile` → `reconcilePoolRefillJobs`) is an ops tool — it is **not** run on every cron tick (that N+1 would starve generation inside the serverless time budget).
- Ops: `bun run pool:backfill-s3`, `bun run pool:retire` (replaces the old clear-cache script), `bun run pool:verify-indexes`. See [question-pool-runbook.md](./question-pool-runbook.md).

User-facing `/api/question` has **no** LLM rate limiter because it never calls the LLM. Cost controls live on the refill worker (`QUESTION_POOL_DAILY_LLM_GENERATION_BUDGET` in `src/lib/questions/pool-constants.ts` with atomic reserve, per-run generation cap, leases). Tutor chat remains a separate path.

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

    subgraph Session["Most requests"]
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

`POST /api/question` skips `auth.api.getSession` in hooks (public MCQ hot path). FRQ and `/api/me/*` still resolve the session; FRQ also uses `withAuthedHandler`.

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
    participant DB as MongoDB
    participant Tutor as Tutor panel

    U->>App: Pick AP class + unit · optional MCQ/FRQ mode
    App->>PS: requestVersion++
    alt MCQ
        PS->>Card: QuestionCard
        Card->>Sess: loadQuestion
        Sess->>API: POST /api/question
        API->>DB: indexed random select from active library
        alt hit
            API-->>Sess: question payload
            Sess-->>U: Render question + choices
        else empty bucket
            API-->>Sess: 503 POOL_WARMING
            Sess-->>U: Warming UI · bounded auto-retry
        end
        opt After answer
            U->>Sess: Check answer / multi-attempt hints
            Sess->>API: POST /api/me/record-attempt
            API->>DB: UserProfile progress + history
        end
    else FRQ
        PS->>Card: FrqCard
        Card->>API: POST /api/question/frq
        API->>DB: indexed random select from active FRQ library
        alt hit
            API-->>Card: FRQ payload
        else empty bucket
            API-->>Card: 503 POOL_WARMING
            Card-->>U: Warming UI · bounded auto-retry
        end
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

Practice serve paths never call the LLM or read S3 for the question body — only Mongo. Generation happens asynchronously via `/api/cron/question-pool` (and admin enqueue). History/bookmark loads still resolve canonical bodies from S3 by `questionId` when needed.

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
        boolean active
        number randomKey
        string question
    }

    POOL_REFILL_STATE {
        string questionType
        string apClass
        string unit
        string status
        number target
        number observedCount
        string leaseOwner
        date leaseExpiresAt
    }

    POOL_GENERATION_BUDGET {
        string dayKey UK
        number generations
    }

    QUESTION_RECENT_TOPICS {
        string apClass
        string unit
        string topicsCovered
    }

    GEN_STATS {
        counters for public /stats
    }

    QUESTION_POOL }o--|| S3_OBJECT : "s3QuestionId from archive/generation"
    USER_PROFILE }o--o{ S3_OBJECT : "history references questionId"
    FRQ_ATTEMPT }o--o{ S3_OBJECT : "FRQ questionId"
    POOL_REFILL_STATE }o--|| QUESTION_POOL : "maintains active counts"
```

---

## How the pieces fit together

| Layer                | Role                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public site**      | Marketing, blog, SEO practice pages, and generation stats — mostly static or read-only                                                      |
| **/app**             | Core product: MCQ (+ optional FRQ) practice, progress, history, bookmarks, settings                                                         |
| **Question library** | S3 = canonical archive; Mongo = active serving library; refill workers generate; request path is selection-only (`POOL_WARMING` when empty) |
| **Better Auth**      | Sessions, OAuth, email verification; creates `UserProfile` on signup; `deleteAppDataForUsers` cleans app rows on account delete             |
| **AI layer**         | One OpenAI-compatible provider for **worker** generation, FRQ grading, and tutor chat — not for `/api/question` serves                      |
| **Referrals**        | Invite cookie → claim → activate on first meaningful attempt                                                                                |
| **Vercel**           | Hosting, cron refill route, `waitUntil` for background auth tasks, Flags SDK, optional Analytics/Speed Insights                             |

---

## Latency and region co-location

Question pool hits are Mongo-bound. **Vercel serverless functions and MongoDB Atlas must share the same region** (verify in Vercel project settings and the Atlas cluster region). Cross-region RTT shows up as elevated `db_connect_ms` / `pool_query_ms` on `question_request` metrics and cannot be papered over in code.

Operational checks and alert thresholds live in [`docs/question-request-metrics.md`](question-request-metrics.md). Index health: `bun run pool:verify-indexes`. Public MCQ `POST /api/question` skips Better Auth session lookup in `hooks.server.ts` to avoid auth round-trips on the hot path; FRQ and `/api/me/*` retain full session resolution.
