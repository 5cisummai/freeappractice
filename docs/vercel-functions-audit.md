# Vercel Functions pattern audit

Reviewed September 13, 2026. Scope: SvelteKit deployment configuration, hooks and request policy, data loading, database/client lifetime, Redis controls, AI streaming and workers, memory, authentication, flags, analytics, and scheduled work. This is a code-and-integration review, not a production load test or a certification of every route.

The referenced task, “Find Vercel SvelteKit optimizations,” was read for context. Its earlier MCP cache-header and timezone-invalidation exclusions remain untouched.

## Conclusion

The app does not need a different deployment architecture. The largest remaining risks are external work outliving its caller, incomplete cancellation, and broad memory scans. Existing durable jobs, stateless database access, and request-local caching are generally appropriate. Increasing every function duration or moving everything to Edge would not address these risks.

## Small fixes made

1. **Redis transport cancellation** (`src/lib/redis/server.ts`). The existing `withRedisTimeout` bounds the caller with a race but does not cancel HTTP work. Configure the SDK with a fresh 750 ms abort signal per request and disable automatic retries. Retain the wrapper because it also bounds aggregate operations. This uses the provider's [documented timeout API](https://upstash.com/docs/redis/sdks/ts/advanced). Aborting transport cannot undo a command already committed by Redis.
2. **Coach startup cleanup** (`src/lib/super/agent-runtime.server.ts`). Await `createAgentUIStreamResponse` inside the existing `try` so asynchronous initialization failures reach its cleanup handler. Previously they could escape without releasing the lock, unused quota reservation, timers, or streaming message state. This awaits response construction, not completion of the response stream; the installed AI SDK implementation returns a promise.
3. **Prior timeout investigation retained** (`src/lib/server/posthog.ts`). Bound best-effort PostHog capture to a one-second request timeout with no retries. A fast HTTP response does not mean the function's registered background promises have settled: [`waitUntil` shares the function timeout](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package). PostHog was a plausible lingering-work source, not a span-proven explanation for both reported incidents. The retrieved logs established a timeout on the 31 ms request; the adjacent 34 ms request did not include a timeout line in the retrieved evidence.
4. **Default Function bundling restored** (`src/routes/api/question/+server.ts`, `src/routes/api/questions/batch/+server.ts`). Removed the two `split: true` overrides. Vercel and SvelteKit recommend the default bundled Function unless measured bundle-size or abnormal cold-start evidence justifies route isolation.
5. **Framework-native asset reads** (`src/lib/server/agent-discovery/markdown.ts`). Replaced a `process.cwd()` and `node:fs` static-file assumption with SvelteKit's `read` API and an imported asset, which lets the adapter include and locate the file correctly.
6. **Explicit question-quality recovery contract** (`src/routes/api/cron/question-quality/+server.ts`). Removed the orphaned recovery cron endpoint and its recovery-only helpers; durable review jobs and the manual admin refresh flow remain the supported path until an actual scheduler is introduced.

## Prioritized follow-ups, not implemented

### 1. Propagate actual cancellation through worker generation

`src/lib/question-bank/pool-refill.server.ts` checks the worker deadline before starting work. `src/lib/ai/service.server.ts` calls `agent.generate({ prompt: user })` without an abort signal. The deadline therefore limits admission, not the duration of an in-flight provider request. A slow generation can still consume the remaining function lifetime.

Pass the remaining deadline through the generation call chain, leaving time to record results and release leases. Keep the durable lease/recovery mechanism. Do not substitute another `Promise.race` or simply raise `maxDuration`.

### 2. Bound optional memory work independently

Coach context waits for memory retrieval; catching rejection does not provide a latency bound when the provider stalls. Post-response memory writes also consume the same function lifetime. Review timeout/cancellation support across Mem0's embedding, model, and vector clients, then set explicit budgets. If a write must eventually finish, persist it as a retryable job instead of relying solely on `waitUntil`.

### 3. Avoid transferring the entire memory namespace for one user

`src/lib/mem0/service.server.ts` implements listing and deletion by paging through the shared vector namespace and filtering `metadata.user_id` locally. Cost and network round trips grow with all users' memories, not just the requested user's.

Upstash supports [deletion by metadata filter](https://upstash.com/docs/vector/api/endpoints/delete), which can eliminate the application's scan-and-delete round trips. It is still a provider-side scan, not an indexed constant-time operation. Efficient listing needs a user-scoped index/ID strategy or namespaces; that requires a migration and coordination with Mem0's ID generation. Do not invent unsupported metadata filtering on `range`.

### 4. Reconcile request policy with refill intent

The anonymous pool request policy skips session lookup for question-serving routes. Those routes nevertheless derive `allowRefill` from `locals.userId`. On that hook path, a signed-in cookie alone cannot make this true. Tests injecting authenticated locals do not establish that real requests can reach the authenticated-refill branch.

Decide whether these routes intentionally rely exclusively on scheduled refill. If so, simplify/document that contract. If not, restore a narrowly scoped authenticated path and verify it through the hook, accounting for the latency tradeoff.

### 5. Secondary performance opportunities

- App/root server layouts still serialize some independent feature/access reads. Parallelize only after preserving organization selection and authorization dependencies.
- Sentry uses 100% trace sampling. Measure telemetry volume and latency before choosing a lower production rate; this is an operational tradeoff, not inherently a correctness bug.
- Confirm function region against Neon and verify Fluid Compute in deployment settings. The project API confirmed Node 24, but did not establish region alignment, plan, or Fluid status. Absence of a `fluid` key in repository configuration is not evidence that Fluid is disabled.

## Patterns to retain

| Pattern                                                           | Assessment                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SvelteKit Vercel adapter and Node runtime                         | Native deployment path. Keep the default bundled Function and only the route duration settings that describe real workload limits. See [adapter documentation](https://svelte.dev/docs/kit/adapter-vercel). |
| Neon HTTP/Drizzle singleton                                       | Stateless client reuse is appropriate. There is no TCP connection pool here for `attachDatabasePool` to manage. Do not add pool shutdown per request.                                                       |
| Request-local profile/access memoization                          | Appropriate isolation for concurrent invocations. Do not replace it with global user/session caches. See [SvelteKit state guidance](https://svelte.dev/docs/kit/state-management).                          |
| Better Auth minimal entrypoint and native background-task handler | Existing integration avoids a needless custom auth execution layer. Preserve durable cleanup records and database-backed rate limiting.                                                                     |
| Refill leases and persisted cleanup jobs                          | Necessary recovery semantics, not redundant wrappers around background promises. Runtime Cache and process memory are not durable queues or lock stores.                                                    |
| Mem0 history disabled                                             | Avoids depending on local SQLite history in ephemeral serverless storage.                                                                                                                                   |
| Lazy Vercel Flags adapter wrapper                                 | Retain for the installed SDK: adapter construction accesses client configuration eagerly. Removing the wrapper can regress build/import behavior without credentials.                                       |
| SvelteKit manifest-order patch                                    | Keep until its mixed Bun/Node reproducibility issue is retested. It is a build determinism workaround, not evidence that Functions require a custom runtime.                                                |
| Free tutor's custom SSE protocol                                  | The client consumes its specific content and completion events. Switching to AI SDK UI streams is a coordinated protocol migration, not a drop-in server simplification.                                    |

## Verification and limits

Focused verification: seven test files, fifteen passing tests, including a real Upstash SDK transport test with mocked fetch and an asynchronous Coach startup failure test. The transport test verifies cancellation and reuse with a fresh signal. The startup test verifies error persistence, quota/lock release, and zero remaining timers. `bun run check` reports zero errors and warnings.

No production settings, schedules, data, or deployments were changed. Deployment-level confirmation should compare total invocation duration, not only response latency, and exercise slow-provider failure paths in a preview environment before attributing production recovery to these patches.
