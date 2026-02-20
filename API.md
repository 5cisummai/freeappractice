# API Reference

This file documents the server API endpoints for this project. Base URL is the server root (e.g., `https://freeappractice.org` or `http://localhost:3000`).

---

## Authentication / User APIs 🔐

All authenticated endpoints require an Authorization header:

`Authorization: Bearer <JWT_TOKEN>`

Environment: JWTs are signed with `process.env.JWT_SECRET` (default: `your-secret-key-change-in-production`).

### POST /api/auth/register
- Description: Register a new user and send a verification email.
- Body (application/json):
  - name (string, required)
  - email (string, required)
  - password (string, required)
- Success (201):
```json
{ "message": "User registered successfully. Please verify your email before logging in.", "token": "<jwt>", "user": { "userId": "...", "name": "...", "email": "..." } }
```

### GET /api/auth/verify-email?token=<token>
- Description: Verify an email using token (sent by email).
- Query:
  - token (string, required)
- Success (200): returns a JWT and user info.

### POST /api/auth/login
- Description: Log in user.
- Body: { email, password }
- Success (200): returns a token and user object.

### POST /api/auth/forgot-password
- Description: Initiate a password reset (sends email with token).
- Body: { email }
- Success: 200 with generic message for security.

### POST /api/auth/reset-password
- Description: Complete password reset using token.
- Body: { token, newPassword }
- Success: message on success.

### GET /api/auth/current-user
- Description: Get current authenticated user profile.
- Auth: Required
- Success: user object (without password)

### POST /api/auth/logout
- Description: Client-side logout (server responds OK).
- Auth: Required

### POST /api/auth/record-attempt
- Description: Record a user's answer attempt and update progress.
- Auth: Required
- Body: { question, questionId, apClass, unit, selectedAnswer, wasCorrect (boolean), timeTakenMs }
- Success: { message, questionId, mastery, totalAttempts }

### GET /api/auth/history
- Description: Get paginated question history (includes question data pulled from storage)
- Auth: Required
- Query: limit (default 50), offset (default 0)
- Success: { history: [ ... ], total }

### GET /api/auth/progress
- Description: Brief progress array for the user
- Auth: Required

### POST /api/auth/bookmark
- Description: Toggle bookmark for a question
- Auth: Required
- Body: { questionId }
- Success: { message, bookmarked }

### GET /api/auth/bookmarks
- Description: Get full question data for bookmarked questions
- Auth: Required
- Success: { bookmarks: [ ... ] }

### GET /api/auth/stats
- Description: Return computed user statistics (accuracy, streak, breakdowns)
- Auth: Required
- Success: { overview, recentPerformance, subjectBreakdown, dailyActivity }

### GET /api/auth/progress-detailed
- Description: Full profile + detailed progress + history
- Auth: Required

---

## Question APIs ❓

### POST /api/question
- Description: Generate or fetch a cached AP question (uses AI provider).
- Body: { className: string (required), unit?: string, provider?: 'openai'|'local', skipCache?: boolean }
- Behavior: When skipCache is false, returns cached question; when true uses AI directly.
- Rate limiting: OpenAI provider is rate-limited to ~20 requests/minute per IP.
- Success (200):
```json
{ "answer": "<string or JSON-stringified object>", "provider": "openai|local", "model": "...", "cached": true|false, "questionId": "<s3 key>" }
```

### GET /api/question/cache/stats
- Description: Get cache metrics
- Success: cache stats object

### POST /api/question/cache/generate
- Description: Force-generate and cache a question
- Body: { className: string, unit?: string, provider?: string }
- Success: { success: true, message, data }

### GET /api/question/:id
- Description: Get a single question by ID (stored in S3)
- Auth: Required (token in Authorization header)
- Success: the question object or 404

---

## Tutor APIs 💬

### POST /api/tutor/greeting
- Description: Get an initial tutor greeting or short explanation
- Body: { question: string }
- Success: { message: "..." }

### POST /api/tutor/chat
- Description: Chat with streaming AI tutor (SSE)
- Body: { question, message, answer?, explanation?, apClass?, unit?, answerChoices?, conversationHistory? }
- Response: Server-Sent Events stream; chunks contain delta content as JSON: { content }

---

## S3 Presigned URLs (file upload/download) 🗂️

All endpoints under `/api/s3` use body validation via Zod.

### POST /api/s3/presign-upload
- Body: { key: string, contentType: string, expiresIn?: number, bucket?: string }
- Success: { url: '<presigned-url>', fields?: null, key, bucket }

### POST /api/s3/presign-download
- Body: { key: string, expiresIn?: number, bucket?: string }
- Success: { url: '<presigned-url>', key, bucket }

---

## Bug Reports 🐞

### POST /api/bug-report
- Description: Submit a bug report
- Body: { title: string, description: string, steps?: string, expected?: string, severity?: 'low'|'medium'|'high', email?: string }
- Success (201): { ok: true, id: "BR-<timestamp>" }

---

## Health & Misc

### GET /health
- Description: Simple server health check (root server)
- Success: { status: 'ok', timestamp: '...' }

### GET /api/health
- Description: Local AI provider health check (in `routes/api/question`)
- Success: { status: 'ok'|'unavailable', provider: 'local', available: boolean }

---

## Error Handling & Notes ⚠️
- Auth errors return 401 for missing/invalid tokens, 403 for unverified users.
- Validation errors return 400 with error message(s).
- Rate limited OpenAI requests return 429 with `resetIn` seconds and rate-limit headers.
- Many responses include `details` in non-production for easier debugging.

---

## Environment / Important Keys 🔑
- JWT_SECRET - secret for signing JWT tokens
- ~~PROVIDER - 'local' or 'openai'~~ Important note: local model is depricated and the code is in the process of being removed
- LOCAL_BASE_URL / LOCAL_AI_URL - local LM Studio URL
- LOCAL_MODEL - default local model id
- OPENAI_API_KEY / OPEN_AI_KEY - API key for OpenAI provider
- AWS_S3_BUCKET - default S3 bucket

---

_Last updated: Feb 20, 2026_
