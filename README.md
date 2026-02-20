# FreeAPPractice.org

AI-powered practice question generator and tutoring backend tailored to AP® courses. OpenAI models create authentic, scope-driven questions, questions are cached + stored on S3, and student attempt history is tracked for review and analytics.

Currently deployed on **Render.com** (backend service runs the Express API with MongoDB and S3-backed storage configured through Render environment variables).

## Highlights
- **Curriculum-aware question generation** via OpenAI (gpt-5-mini + gpt-4.1-mini for humanities classes) with JSON schema enforcement and proactive retry logic.
- **Question cache service** keeps recently requested AP class/type material warm, supports manual regeneration, and attaches metadata (provider/model/cached flag).
- **Tutor chat service** maintains a single OpenAI client instance, streams responses for on-demand guidance, and scaffolds a friendly, course-aware assistant.
- **Persistent storage** keeps full questions in S3, only question IDs in MongoDB, and records each user attempt (answer, time taken, correctness) along with per-class progress.
- **Rate limiting, logging, and health monitoring** protect OpenAI usage while capturing request metrics via the built-in logger.

## Tech stack
- Node.js 18+ / Express
- MongoDB + Mongoose (configured through `config/dbConn.js`)
- OpenAI (chat completions via the `openai` SDK)
- AWS S3 (question storage and pre-signed upload/download support)
- Render.com for hosting, with health checks hitting `/health`

## Getting started

1. Copy and populate environment variables:
   ```bash
   cp .env.example .env
   ```
   Required values: `OPEN_AI_KEY` (or `OPENAI_API_KEY`), `DATABASE_URI`, `JWT_SECRET`, `AWS_REGION`, `AWS_S3_BUCKET`, plus optional S3 credentials or IAM role.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run locally:
   ```bash
   npm run dev
   ```
   (or `npm start` for production mode). The app listens on `PORT` (default 3000).

## Environment overview
- `PORT` – server port (defaults to 3000)
- `NODE_ENV` – `development`, `production`, or `test`
- `OPEN_AI_KEY` / `OPENAI_API_KEY` – OpenAI API key for both question generation and tutor chat
- `DATABASE_URI` – MongoDB connection string
- `JWT_SECRET` – signing secret for `/api/auth` flows
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE` – control S3 uploads/downloads
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` – credentials (or rely on instance role / Render secrets)
- email credentials for user flows (`RESEND_API_KEY`, `TEST_EMAIL`)

## API summary
- `POST /api/question` – generate or fetch cached AP question (uses rate limiting to protect OpenAI). Responds with `{ answer, provider, model, cached, questionId }`.
- `POST /api/question/cache/generate` – manually prime cache for a class/unit.
- `GET /api/question/cache/stats` – inspect cache hits/misses/age.
- `POST /api/question/by-id` – fetch a stored question by its S3-backed ID.
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/record-attempt` – standard auth + record attempts (records questionId, selected answer, correctness, duration).
- `POST /api/tutor/chat` & `POST /api/tutor/greeting` – tutor assistant streaming chat and quick greeting.
- `POST /api/s3/presign-upload` / `/api/s3/presign-download` – secure client uploads/downloads directly to/from S3.
- `POST /api/bug-report` – capture runtime bug reports with metadata.
- `GET /health` – health check for Render and load balancers.

## Storage + caching
- Questions are persisted to S3 with unique IDs; Mongo stores only references (`questionId`) inside users, attempts, and bookmarks.
- `services/questionCache.js` refreshes cached questions in the background and falls back to OpenAI when cache misses occur.
- AWS credentials follow the default provider chain to keep secrets out of source control.

## Security & reliability
- Production config enforces `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, and HSTS.
- Body payloads capped at 1 MB, request logging writes to `logs/` via `utils/logger`.
- Rate limit layer tracks IPs (15 OpenAI requests/min) and exposes `X-RateLimit-*` headers.
- Global error handler sanitizes responses in production and writes full details to the logger.
- Graceful shutdown is wired to `SIGINT`/`SIGTERM`.

## Deployment (Render.com)
1. This repo is deployed as a Render Web Service (Node environment).
2. Set Render environment variables to match `.env` fields (`OPEN_AI_KEY`, `DATABASE_URI`, `AWS_*`, `JWT_SECRET`, etc).
3. Configure the service to run `npm start` and expose the desired `PORT`.
4. Add health check URL `/health` so Render restarts unhealthy instances automatically.
5. (Optional) Connect Render to the same AWS VPC or use secure IAM role for MongoDB access.

All live traffic currently routes through the Render-hosted service name for this project.

## Observability
- Logs stream to `logs/{combined,error,rejections}.log` and surface in Render’s log tail.
- Health check endpoint ensures load balancers see `200` when ready.
- Use `/api/question/cache/stats` for caching visibility and `/api/s3/presign-*` for S3 activity verification.

## Next steps
- Run `npm test` before opening PRs.
- Check `package.json` for more tests, as well as dependencies and versions.
- Update Render environment variables when secrets rotate.
- Keep the OpenAI key scoped to only necessary models for billing control.

## Additional notes
- Feel free to provide me any suggestions to improve this resource for students. I'm open to feedback and contributions! 🚀

## License
MIT