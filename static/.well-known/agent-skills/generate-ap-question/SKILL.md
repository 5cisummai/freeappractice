---
name: generate-ap-question
description: Generate AP practice multiple-choice questions by subject and unit via the Free AP Practice API.
---

# Generate AP Practice Questions

Use the Free AP Practice question API to generate multiple-choice questions for supported AP subjects.

## API

`POST /api/question`

```json
{
  "className": "AP Biology",
  "unit": "Unit 1: Chemistry of Life"
}
```

Optional custom topic:

```json
{
  "className": "AP Biology",
  "customTopic": "Cell membrane transport"
}
```

## Response

Returns `answer`, `provider`, `model`, `cached`, and `questionId`. The full question payload is delivered separately in the app UI flow.

## Authentication

Anonymous use is supported for basic generation. Signed-in users get progress tracking via session cookies.

## Health

`GET /health` — service status check.
