# Free AP Practice

Free AP Practice is a student-built SvelteKit app for generating AP practice questions, tracking progress, and studying with instant feedback. The project is founded and maintained by Ajay Saravanan.

The goal is straightforward: make AP prep feel faster, more personalized, and more accessible for students who do not want to pay for another prep subscription just to get quality practice.

## What's included

- Public marketing pages: landing, about, subjects, summer study guide, blog, stats, privacy, terms, and changelog.
- Authenticated app at `/app` for dashboard, practice, progress, question history, resources, and settings.
- SEO practice landing pages under `/practice/[...slug]` (class, unit, and topic pages with internal linking).
- AI-generated MCQs with optional custom topics, an in-app tutor, bookmarks, and attempt history.
- Public generation stats at `/stats` (backed by `/api/question/generation-stats`).
- Better Auth for email/password and Google sign-in (including Google One Tap when configured).
- SvelteKit API routes for questions, signed-in user data, tutoring, and bug reports.
- Markdown blog posts in `src/content/blog/`; private question batches stored in S3 for bookmarks and history.

## Tech stack

- SvelteKit + Svelte 5
- TypeScript
- Tailwind CSS
- MongoDB + Mongoose
- [Better Auth](https://www.better-auth.com/) for sessions, email flows, and OAuth
- [Vercel AI SDK](https://sdk.vercel.ai/) with an OpenAI-compatible API for question generation and tutor responses (OpenAI or [LM Studio](https://lmstudio.ai/) locally)
- Resend for transactional email
- AWS S3 for private question storage
- Vercel for deployment (`@sveltejs/adapter-vercel`)

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- MongoDB (Atlas or local via Docker Compose)

### Setup

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Copy the example env file and fill in your values:

   ```sh
   cp .env.example .env
   ```

3. (Optional) Start a local MongoDB instance with `compose.yaml`:

   ```sh
   docker compose up -d
   ```

   Then set `DATABASE_URI=mongodb://root:password@localhost:27017/freeappractice?authSource=admin` in `.env`.

4. Start the dev server:

   ```sh
   pnpm dev
   ```

5. Build for production:

   ```sh
   pnpm build
   ```

6. Run the Playwright smoke suite (builds the app and tests public pages, sitemap, robots, and `/health`):

   ```sh
   pnpm test
   ```

### Useful scripts

| Command                                       | Purpose                                             |
| --------------------------------------------- | --------------------------------------------------- |
| `pnpm check`                                  | Type-check with `svelte-check`                      |
| `pnpm lint` / `pnpm format`                   | ESLint and Prettier                                 |
| `pnpm cache:clear` / `pnpm cache:warm`        | Manage the question cache                           |
| `pnpm auth:indexes`                           | Create Better Auth MongoDB indexes                  |
| `pnpm scaffold:practice-pages`              | Regenerate `practice-pages.json` from AP catalog    |
| `pnpm audit:internal-links`                 | Audit internal links across public and practice pages |

## Environment variables

Copy `.env.example` to `.env`. Required for a working local setup:

| Variable             | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URI`       | MongoDB connection string                                                      |
| `BETTER_AUTH_SECRET` | Session signing secret (min 32 chars; generate with `openssl rand -base64 32`) |
| `BETTER_AUTH_URL`    | App base URL for auth callbacks (e.g. `http://localhost:5173`)                 |
| `OPEN_AI_KEY`        | API key for the configured provider (any value works for local LM Studio)      |
| `OPENAI_BASE_URL`    | OpenAI-compatible API base URL (defaults to `https://api.openai.com/v1`)       |

Optional model overrides (defaults are set in `src/lib/ai/service.server.ts`):

| Variable          | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `ADVANCED_MODEL`  | Model for STEM and other advanced subjects                     |
| `BASIC_MODEL`     | Model for humanities and lighter subjects                      |
| `TUTOR_MODEL`     | Model for the in-app tutor chat                                |

Commonly needed for full functionality:

| Variable                                                                       | Purpose                                  |
| ------------------------------------------------------------------------------ | ---------------------------------------- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                    | Google OAuth                             |
| `PUBLIC_GOOGLE_CLIENT_ID`                                                      | Google One Tap on the client             |
| `RESEND_API_KEY` / `RESEND_FROM`                                               | Transactional email                      |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET` | Private S3 bucket for question batches   |
| `AWS_SESSION_TOKEN`                                                              | Optional temporary/assumed-role credentials |
| `PUBLIC_BASE_URL`                                                              | Canonical site URL                       |
| `GITHUB_BUG_REPORT_TOKEN`                                                      | GitHub Issues API for in-app bug reports |
| `PUBLIC_DESMOS_API_KEY`                                                        | Desmos calculator embeds                 |

Optional tuning: `CACHE_POOL_SIZE`, `CACHE_MISS_LOCK_TTL_MS`, and rate-limit vars. See `.env.example` for defaults and comments.

### Local AI with LM Studio

To run question generation and tutoring against a local model instead of OpenAI:

1. Start LM Studio and load a model with the local server enabled (default `http://localhost:1234/v1`).
2. Set in `.env`:

   ```env
   OPENAI_BASE_URL=http://localhost:1234/v1
   OPEN_AI_KEY=lm-studio
   ADVANCED_MODEL=your-loaded-model-id
   BASIC_MODEL=your-loaded-model-id
   TUTOR_MODEL=your-loaded-model-id
   ```

   Use the model identifier shown in LM Studio for the `*_MODEL` values.

## API overview

Routes live under `src/routes/api` as SvelteKit server endpoints.

### Authentication (Better Auth)

All auth flows are handled by Better Auth at `/api/auth/*` (sign-up, sign-in, sign-out, email verification, password reset, Google OAuth, session management, account deletion, and email change). Use the Better Auth client in `src/lib/auth/client.ts` from the browser; do not call legacy `/api/auth/register` or `/api/auth/login` endpoints — those were removed in v1.4.1.

### Signed-in user data (`/api/me/*`)

These routes require an active Better Auth session:

| Method | Route                    | Description                                                                                                        |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/me/stats`          | User practice statistics                                                                                           |
| `GET`  | `/api/me/progress`       | Progress by subject/unit                                                                                           |
| `GET`  | `/api/me/history`        | Paginated MCQ attempt history. Query params: `page` (default 1), `limit` (default 50, max 200), optional `apClass` |
| `POST` | `/api/me/record-attempt` | Record an answer attempt                                                                                           |
| `GET`  | `/api/me/bookmarks`      | List bookmarked questions                                                                                          |
| `POST` | `/api/me/bookmark`       | Add or remove a bookmark                                                                                           |

### Questions

| Method | Route                            | Description                             |
| ------ | -------------------------------- | --------------------------------------- |
| `POST` | `/api/question`                  | Generate or return a cached AP question |
| `POST` | `/api/question/cache/generate`   | Prime the question cache                |
| `GET`  | `/api/question/generation-stats` | Public read-only generation counters    |

### Other

| Method | Route                                    | Description                                               |
| ------ | ---------------------------------------- | --------------------------------------------------------- |
| `POST` | `/api/tutor/chat`, `/api/tutor/greeting` | AI tutor assistant                                        |
| `POST` | `/api/bug-report`                        | Submit bug reports as GitHub Issues (rate-limited per IP) |
| `GET`  | `/health`                                | Health check                                              |

Optional Vercel Analytics and Speed Insights load only after a user opts in inside the app.

## Bug reports

The in-app bug report form creates GitHub Issues in this repository via the GitHub Issues API.

- Reports are labeled automatically with `bug` and a severity label.
- A server-side per-IP rate limit reduces spam.
- Set `GITHUB_BUG_REPORT_TOKEN` with **Issues: Read & Write** access scoped to this repository.

## Deployment

Deploy to [Vercel](https://vercel.com/) as a SvelteKit app:

1. Connect the repository to Vercel.
2. Set production environment variables (at minimum `DATABASE_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `OPEN_AI_KEY`).
3. Vercel runs `pnpm build` via the default SvelteKit integration.

`BETTER_AUTH_URL` and `PUBLIC_BASE_URL` must match your production domain. If you change hosting, update the SvelteKit adapter and these notes together.

## Branding & usage

The **Freeappractice** name, logo, and brand identity are proprietary and are exclusively reserved for Ajay Saravanan. The source code is open, but the brand is not.

### What you are welcome to do

- Star or like the repository
- Fork the repository and use the code as a starting point for your own project
- Open pull requests, report bugs, and contribute improvements back to this repository

### What is not permitted

- Launching any public site, app, or service under the name **Freeappractice**, **Free AP Practice**, or any confusingly similar name or branding
- Creating a derivative product that implies it is Freeappractice or a related official product
- Claiming any affiliation, endorsement, or partnership with Freeappractice or Ajay Saravanan without explicit written permission

If you fork the code to build something of your own, give it a completely different name and make it clear that it is an independent project unrelated to Freeappractice.

## Notes

- Question generation and grading are API-driven; the UI is fully SvelteKit.
- The landing page routes authenticated users into `/app`.
- The blog and summer study guide are meant to bridge reading content with active practice.
- Practice landing pages and the stats page are public; signed-in features live under `/app`.
