# Free AP Practice

Free AP Practice is a student-built SvelteKit app for generating AP practice questions, tracking progress, and helping students study with instant feedback. The project was refactored from the older backend-first implementation into a full SvelteKit application, and it is now intended to be deployed on Vercel.

The project is founded and maintained by Ajay Saravanan. The goal is straightforward: make AP prep feel faster, more personalized, and more accessible for students who do not want to pay for another prep subscription just to get quality practice.

## What’s included

- A public landing page with AP practice entry points, FAQ, and onboarding.
- Authenticated app pages for dashboard, practice, progress, and settings.
- A public blog and blog API for study guides, site updates, and exam-prep content.
- SvelteKit server routes for auth, question generation, tutoring, bug reports, S3 upload/download signing, account history, and blog content management.
- The same core API surface as the previous version, but implemented as route handlers inside SvelteKit.

## Project background

- Built from the perspective of a student who wanted practice to be immediate instead of buried behind paywalls or slow classroom tools.
- Designed to support both quick random practice and more intentional unit-based review.
- Focused on keeping the product lightweight: fast question generation, minimal friction, and a clear path from reading content to actually practicing.

## Tech stack

- SvelteKit + Svelte 5
- TypeScript
- Tailwind CSS
- MongoDB + Mongoose
- OpenAI for question generation and tutor responses
- Resend for email flows
- AWS S3 for question storage and file transfer helpers
- Vercel for deployment

## Getting started

1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Create a local env file and add your secrets.
3. Start the dev server:
   ```sh
   pnpm dev
   ```
4. Build for production:
   ```sh
   pnpm build
   ```
5. Run the smoke test suite:
   ```sh
   pnpm test
   ```

## Environment variables

The server code reads private env values through SvelteKit. At minimum, you will need:

- `DATABASE_URI` for MongoDB
- `JWT_SECRET` for auth tokens
- `OPEN_AI_KEY` for OpenAI access
- `OPENAI_BASE_URL` or `OPENAI_URL` if you use a non-default OpenAI-compatible endpoint
- `RESEND_API_KEY` for transactional email
- `GITHUB_BUG_REPORT_TOKEN` for creating GitHub Issues from the in-app bug report form

Depending on your deployment and storage setup, you may also need S3 credentials and any related storage settings used by the upload/download routes.

## API overview

The main API routes now live under `src/routes/api` and are handled by SvelteKit server endpoints.

- `POST /api/question` generates or returns a cached AP question.
- `POST /api/question/frq` generates FRQ questions.
- `POST /api/question/frq/grade` grades FRQ answers.
- `POST /api/question/cache/generate` primes the question cache.
- `GET /api/question/cache/stats` reports cache status.
- `GET /api/question/[id]` fetches a stored question by ID.
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout` handle authentication.
- `GET /api/auth/current-user`, `/api/auth/stats`, `/api/auth/progress`, `/api/auth/progress-detailed`, `/api/auth/history` expose user state and analytics.
- `PATCH /api/auth/update-account` updates a signed-in user's name and email.
- `POST /api/auth/bookmark`, `/api/auth/bookmarks` manage saved questions.
- `POST /api/auth/record-attempt`, `/api/auth/record-frq-attempt` store answer history.
- `POST /api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, `/api/auth/verification/update-email` support account recovery and verification flows.
- `POST /api/auth/delete-account` removes a user account.
- `GET /api/blog`, `GET /api/blog/[slug]` expose published blog data.
- `POST /api/tutor/chat`, `POST /api/tutor/greeting` provide the tutor assistant.
- `POST /api/bug-report` submits bug reports as GitHub Issues and applies a low per-IP rate limit.
- `POST /api/s3/presign-upload`, `POST /api/s3/presign-download` create S3 signed URLs.

## Bug reports

The in-app bug report form no longer writes to a local JSON file. It now creates GitHub Issues in the main repository using the GitHub Issues API.

- Reports are labeled automatically with `bug` and a severity label.
- A simple server-side per-IP rate limit is applied to reduce spam.
- To enable this in development or production, set `GITHUB_BUG_REPORT_TOKEN` with `Issues: Read & Write` access to this repository.

## Deployment

This project is meant to deploy to Vercel as a SvelteKit app. The current SvelteKit adapter setup is Vercel-compatible, so the usual flow is:

1. Connect the repository to Vercel.
2. Set the production environment variables in Vercel.
3. Let Vercel build the app with the standard SvelteKit build command.

If you change hosting later, update the adapter and deployment notes together so the README stays accurate.

## Branding & usage

The **Freeappractice** name, logo, and brand identity are proprietary and are exclusively reserved for Ajay Saravanan. The source code is open, but the brand is not.

### What you are welcome to do

- ⭐ Star or like the repository
- 🍴 Fork the repository and use the code as a starting point for your own project
- 🛠 Open pull requests, report bugs, and contribute improvements back to this repository

### What is not permitted

- Launching any public site, app, or service under the name **Freeappractice**, **Free AP Practice**, or any confusingly similar name or branding
- Creating a derivative product that implies it is Freeappractice or a related official product
- Claiming any affiliation, endorsement, or partnership with Freeappractice or Ajay Saravanan without explicit written permission

If you fork the code to build something of your own, give it a completely different name and make it clear that it is an independent project unrelated to Freeappractice.

## Notes

- AP content, question generation, and grading are still API-driven, even though the UI now lives in SvelteKit.
- The landing page automatically routes authenticated users into the app.
- The blog is meant to bridge passive study reading with active question practice.
- The repo includes changelog, privacy, terms, and password recovery pages alongside the core app.
- `pnpm test` runs a Playwright smoke suite against the built app and checks the public pages, sitemap, robots file, and health endpoint.
