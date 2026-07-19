# Research: HTML sanitization without jsdom (SvelteKit × Vercel)

**Date:** 2026-07-19  
**Primary sources:** [DOMPurify README — server](https://github.com/cure53/DOMPurify?tab=readme-ov-file#running-dompurify-on-the-server), [isomorphic-dompurify](https://www.npmjs.com/package/isomorphic-dompurify) / [#394](https://github.com/kkomelin/isomorphic-dompurify/issues/394), [html-encoding-sniffer #25](https://github.com/jsdom/html-encoding-sniffer/issues/25), [Vercel advanced Node config](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration), [AWS Lambda Node experimental features](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html#nodejs-experimental-features), [Marked docs](https://marked.js.org/), [KaTeX security](https://katex.org/docs/security.html), [sanitize-html](https://www.npmjs.com/package/sanitize-html), [rehype-sanitize](https://unifiedjs.com/explore/package/rehype-sanitize/), [js-xss / xss](https://www.npmjs.com/package/xss), [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

## Verdict

For Free AP Practice, **drop `isomorphic-dompurify` / jsdom** and harden the markdown pipeline the same way the blog already does: **deny raw HTML in marked, allowlist link/image URLs, escape attribute values**, then trust **KaTeX** and **highlight.js** as the only HTML emitters before `{@html}`.

That is option **F** (blog-style allowlist). It matches the real threat model (LLM markdown → `{@html}`, not a WYSIWYG HTML editor), removes the Vercel Lambda `ERR_REQUIRE_ESM` crash class entirely, and stays YAGNI.

If you want a short-term unblock without rewriting RichText: either pin `jsdom@25.0.1` (**A**, documented but weakens the TCB) or set `NODE_OPTIONS=--experimental-require-module` on Vercel (**A′**, restores Lambda’s disabled Node feature). Prefer migrating to **F** (or **B** as a belt-and-suspenders client sanitize) over living on a pinned old jsdom.

---

## Current app shape

| Piece         | Where                                         | Behavior                                                                                               |
| ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| RichText      | `src/lib/components/content/rich-text.svelte` | marked → KaTeX HTML → hljs HTML → `isomorphic-dompurify` → `{@html}`                                   |
| Blog markdown | `src/lib/blog/render-markdown.server.ts`      | marked + custom renderers (`html()` → `''`, safe URLs) + hljs via `marked-highlight`; **no DOMPurify** |
| Dep           | `package.json`                                | `isomorphic-dompurify@^3.19.0` (pulls `dompurify` + `jsdom@^29`)                                       |
| Tutor UX      | `tutor-widget.svelte`                         | User messages: plain text; assistant: `<RichText>`                                                     |

RichText is used for questions, explanations, FRQ prompts, history, admin quality preview, and tutor **assistant** replies — not for arbitrary user-authored HTML.

---

## Crash root cause (why we’re here)

`isomorphic-dompurify` ≥ 3.0 depends on modern jsdom. From jsdom@28 onward, `html-encoding-sniffer@6` `require()`s ESM-only `@exodus/bytes`. On Vercel / AWS Lambda that fails with `ERR_REQUIRE_ESM` because Lambda **disables** Node’s `require(esm)` by default (`--no-experimental-require-module`).

Sources:

- [isomorphic-dompurify #394](https://github.com/kkomelin/isomorphic-dompurify/issues/394) — root cause + `jsdom@25.0.1` override workaround; maintainers document the same on [npm](https://www.npmjs.com/package/isomorphic-dompurify) / [GitHub README](https://github.com/kkomelin/isomorphic-dompurify).
- [html-encoding-sniffer #25](https://github.com/jsdom/html-encoding-sniffer/issues/25) — same failure on Vercel; notes Lambda/Vercel disable experimental `require` of ESM.
- [Vercel: Experimental Node.js require() of ES Module](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration) — enable with `NODE_OPTIONS=--experimental-require-module`.
- [AWS Lambda: Experimental Node.js features](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html#nodejs-experimental-features) — table confirms Lambda applies `--no-experimental-require-module` on Node 20/22/24; re-enable via `NODE_OPTIONS`.

---

## 1. Threat model: do we need DOMPurify?

### What `{@html}` faces here

Inputs are mostly **model-generated markdown** (AP questions, explanations, tutor assistant replies), plus trusted first-party content. There is **no** rich-text HTML editor. Tutor **user** turns are already rendered as text, not `{@html}`.

Attack surface is still real:

1. **Raw HTML in markdown** — Marked does **not** sanitize. It explicitly warns that output must be filtered for XSS, recommending DOMPurify / sanitize-html / js-xss / insane. Source: [marked.js.org](https://marked.js.org/), [marked README](https://github.com/markedjs/marked).
2. **Unsafe URLs** — `javascript:` / `data:` links and images via markdown link/image syntax.
3. **KaTeX / hljs output** — KaTeX states generated HTML should be safe from script injection, but still recommends sanitizing with a **generous** MathML/SVG-aware whitelist if you sanitize at all; control risk with `trust` / `maxSize` / `maxExpand`. Source: [KaTeX security](https://katex.org/docs/security.html). RichText already uses `output: 'html'` and `throwOnError: false` (default `trust` is off).
4. **Post-sanitize mutation** — OWASP and DOMPurify both warn: sanitizing then mutating HTML can void protection. Source: [OWASP XSS Prevention — HTML Sanitization](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#html-sanitization), [DOMPurify foot-guns](https://github.com/cure53/DOMPurify?tab=readme-ov-file#is-there-any-foot-gun-potential).

### OWASP framing

OWASP recommends **DOMPurify** when the product must **render user-authored HTML** (e.g. WYSIWYG). Prefer **output encoding** when you only need text. Source: [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

This app is closer to “markdown → controlled HTML emitters” than “store and redisplay user HTML.” So:

| Need                                     | Verdict                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Full DOMPurify on every RichText render? | **Not required** if marked never emits raw HTML and links are allowlisted                            |
| Some defense before `{@html}`?           | **Yes** — either allowlist renderers (F) and/or a non-jsdom sanitizer (C/E) or browser DOMPurify (B) |
| Trust KaTeX/hljs HTML?                   | **Reasonable** if `trust` stays false and hljs only wraps escaped code in `<span class="hljs-*">`    |

**Bottom line:** You need XSS defense; you do **not** need isomorphic-dompurify/jsdom specifically. The blog path already proves a workable pattern without it.

---

## 2. Options ranked for this app

### A) Pin `jsdom@25.0.1` via overrides (keep isomorphic-dompurify)

| Dimension             | Assessment                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel fit            | Unblocks the known crash; documented by isomorphic-dompurify.                                                                                                                                                                                                            |
| MathML / KaTeX / hljs | Keeps current DOMPurify config (`ADD_TAGS` MathML + `class` for hljs).                                                                                                                                                                                                   |
| Maintenance           | Override fights upstream (`jsdom@^29` today). Revisit every isomorphic-dompurify bump.                                                                                                                                                                                   |
| Security              | **Weakened TCB.** DOMPurify **strongly recommends latest jsdom**; older jsdom has known XSS vectors even when DOMPurify is correct. Source: [DOMPurify — Running on the server](https://github.com/cure53/DOMPurify?tab=readme-ov-file#running-dompurify-on-the-server). |
| Bundle / cold start   | Still ships jsdom into serverless — heavy for SvelteKit SSR.                                                                                                                                                                                                             |

**A′ (related):** `NODE_OPTIONS=--experimental-require-module` on Vercel without pinning. Sources: [Vercel docs](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration), [AWS Lambda experimental features](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html#nodejs-experimental-features). Keeps current jsdom but relies on an experimental flag Lambda/Vercel disable by default; AWS notes experimental features are outside SLA.

**Rank for us:** Acceptable **hotfix only**, not the destination.

---

### B) Client-only `dompurify` (browser import; SSR skip or escape-only)

| Dimension             | Assessment                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel fit            | Excellent — no jsdom on the server. Use `import DOMPurify from 'dompurify'` only in browser (`browser` condition / `onMount` / `import.meta.env.SSR` guard).                                                             |
| MathML / KaTeX / hljs | Best-in-class: DOMPurify natively supports HTML + MathML + SVG. Source: [DOMPurify](https://github.com/cure53/DOMPurify).                                                                                                |
| Maintenance           | Low — OWASP’s recommended library in the browser.                                                                                                                                                                        |
| Security              | Strong **after hydration**. SSR must not emit unsanitized HTML into the document if crawlers/users see first paint. Pair with F on SSR (deny raw HTML) so SSR HTML is already safe; client sanitize is defense-in-depth. |
| Hydration             | Must avoid SSR HTML ≠ client HTML (Svelte hydration mismatch). Pattern: SSR + client both run the same marked→katex→hljs pipeline with F; optionally client also runs DOMPurify (idempotent if already clean).           |

**Rank for us:** Strong if you want DOMPurify without jsdom. Prefer combining with **F** rather than “unsanitized SSR + sanitize on client.”

---

### C) `sanitize-html` (htmlparser2; no jsdom)

| Dimension             | Assessment                                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel fit            | Excellent — “All of its npm dependencies are pure JavaScript,” built on `htmlparser2`. Source: [sanitize-html npm](https://www.npmjs.com/package/sanitize-html). Marked lists it as a server-side option. Source: [marked.js.org](https://marked.js.org/). |
| MathML / KaTeX / hljs | Defaults are **not** MathML-aware. You must extend `allowedTags` / `allowedAttributes` for KaTeX spans, `style`, MathML tags, and `hljs-*` classes — easy to get wrong or over-permit `style`.                                                             |
| Maintenance           | Medium — config is the product. Active ApostropheCMS package.                                                                                                                                                                                              |
| Security              | Solid allowlist sanitizer, but **not** what OWASP names first (DOMPurify). Parser differences vs browser DOM → residual risk for exotic markup.                                                                                                            |

**Rank for us:** Best **server** drop-in if you insist on a post-pass sanitizer without jsdom. Still YAGNI-heavier than F for this content type.

---

### D) `rehype-sanitize` / unified pipeline

| Dimension             | Assessment                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel fit            | Fine (ESM, no jsdom). Source: [rehype-sanitize](https://unifiedjs.com/explore/package/rehype-sanitize/).                                                                                                                                                                                                                                                                                             |
| MathML / KaTeX / hljs | Official docs: sanitizing **after** rehype-katex **strips** most KaTeX markup; recommended pattern is sanitize **before** katex/highlight with class allowlists, then run those plugins. Post-sanitize MathML schemas are “complex” and often require unsafe broad `style`. Source: [rehype-sanitize — Example: math / syntax highlighting](https://unifiedjs.com/explore/package/rehype-sanitize/). |
| Maintenance           | High — replace marked+extensions with remark/rehype stack.                                                                                                                                                                                                                                                                                                                                           |
| Security              | Good when schema is correct; defaults follow GitHub (no MathML/SVG).                                                                                                                                                                                                                                                                                                                                 |

**Rank for us:** Overkill. Wrong migration cost for an existing marked+KaTeX+hljs component.

---

### E) `xss` (js-xss)

| Dimension             | Assessment                                                                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel fit            | Excellent — pure JS whitelist filter; no DOM. Source: [xss npm](https://www.npmjs.com/package/xss). Marked lists js-xss as an option. DOMPurify maintainers have pointed at it for non-DOM environments (e.g. workers). Source: [DOMPurify #278](https://github.com/cure53/DOMPurify/issues/278). |
| MathML / KaTeX / hljs | Default whitelist is HTML-oriented; MathML/KaTeX needs custom `whiteList` + careful `style`/`class` handling via `cssfilter`.                                                                                                                                                                     |
| Maintenance           | Medium; last npm publish Mar 2024 (slower cadence than DOMPurify).                                                                                                                                                                                                                                |
| Security              | Useful allowlist tool; not OWASP’s primary recommendation; fewer browser-parity guarantees than DOMPurify.                                                                                                                                                                                        |

**Rank for us:** Viable server alternative to C; slightly less attractive ecosystem fit than sanitize-html for a marked-centric stack.

---

### F) Marked renderer allowlist + `escapeHtml` (blog path); drop post-sanitize

| Dimension             | Assessment                                                                                                                                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel fit            | Best — delete `isomorphic-dompurify` and jsdom from the serverless graph.                                                                                                                                                                                                                                              |
| MathML / KaTeX / hljs | KaTeX/hljs keep emitting HTML **after** markdown parsing; you do **not** run their output through a strip-happy sanitizer. Rely on [KaTeX security](https://katex.org/docs/security.html) + hljs escaping. Mirror blog: `html()` → `''`, safe `http(s)                                                                 | mailto | /   | #`URLs,`escapeHtml`on attrs (already in`src/lib/escape-html.ts`+`render-markdown.server.ts`). |
| Maintenance           | Lowest — one shared markdown security policy for blog + RichText.                                                                                                                                                                                                                                                      |
| Security              | Correct for “markdown, not HTML editor.” Gaps if someone later enables marked raw HTML, KaTeX `trust: true`, or feeds RichText untrusted HTML strings. Mitigate with CSP (defense in depth). Source: [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html). |

**Rank for us:** **Recommended default.**

Concrete RichText changes (conceptual):

1. Add marked renderer `html() { return ''; }` (and safe `link` / `image` like the blog).
2. Keep KaTeX + hljs renderers as today.
3. Remove `isomorphic-dompurify` import/config/`DOMPurify.sanitize`.
4. Optionally extract shared helpers with the blog to avoid drift.

---

### G) Newer “DOMPurify without jsdom” / WASM / linkedom / happy-dom

| Approach                          | Finding                                                                                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official server path              | DOMPurify requires a DOM; **jsdom is the supported choice**; keep it up to date. Source: [DOMPurify — Running on the server](https://github.com/cure53/DOMPurify?tab=readme-ov-file#running-dompurify-on-the-server).                     |
| happy-dom                         | Explicitly **not considered safe**; combining with DOMPurify “will likely lead to XSS.” Same source; also cited in [isomorphic-dompurify #394](https://github.com/kkomelin/isomorphic-dompurify/issues/394) when happy-dom was suggested. |
| linkedom / other lightweight DOMs | Not endorsed by DOMPurify as a safe TCB; server DOM is part of the trusted computing base ([Attack Classes & Bypass History](https://github.com/cure53/DOMPurify/wiki/Attack-Classes-&-Bypass-History)).                                  |
| WASM DOMPurify                    | No first-party WASM sanitizer product from cure53; DOMPurify remains DOM-API-based.                                                                                                                                                       |
| Browser HTML Sanitizer API        | Emerging standard inspired by DOMPurify ([WHATWG / WICG notes in DOMPurify README](https://github.com/cure53/DOMPurify)); not a drop-in Node/SSR solution for this app today.                                                             |

**Rank for us:** Do **not** pursue happy-dom/linkedom for sanitization. Prefer browser DOMPurify (B) or non-DOM allowlist libs (C/E/F).

---

## 3. Comparison matrix (this app)

| Option                 | Serverless / Vercel          | KaTeX + hljs preserve | Maintenance   | Security posture                                  |
| ---------------------- | ---------------------------- | --------------------- | ------------- | ------------------------------------------------- |
| **A** pin jsdom 25     | Fixes crash; keeps heavy dep | Yes (current config)  | Override debt | ⚠️ Old jsdom vs DOMPurify guidance                |
| **A′** `NODE_OPTIONS`  | Fixes crash; experimental    | Yes                   | Env flag      | OK if flag stable; AWS: experimental / out of SLA |
| **B** client DOMPurify | No jsdom on server           | Excellent             | Low           | Strong in browser; SSR needs F                    |
| **C** sanitize-html    | Excellent                    | Needs large allowlist | Medium        | Good allowlist; not DOM-parity                    |
| **D** rehype-sanitize  | Fine                         | Awkward post-katex    | High rewrite  | Good if schema right                              |
| **E** xss              | Excellent                    | Custom whitelist      | Medium        | OK; less preferred than DOMPurify                 |
| **F** marked allowlist | Best (delete dep)            | Trust katex/hljs      | Lowest        | Right for LLM markdown                            |
| **G** happy-dom etc.   | Tempting                     | —                     | —             | ❌ Rejected by DOMPurify                          |

---

## 4. Recommendation (YAGNI × Free AP Practice)

**Do this:**

1. **Implement F on RichText** — align with `render-markdown.server.ts`: drop raw HTML, allowlist URLs, escape attributes; remove `isomorphic-dompurify`.
2. **Keep KaTeX `trust` off**; keep hljs as the only code HTML producer.
3. **Optional belt:** client-side `dompurify` (**B**) after the same pipeline, or a strict CSP — not required to ship the fix.
4. **If production is crashing today and F is not ready:** temporary **A** (`overrides: { "jsdom": "25.0.1" }`) _or_ **A′** (`NODE_OPTIONS=--experimental-require-module`), then remove the workaround when F lands.

**Do not:**

- Switch to happy-dom for DOMPurify.
- Rewrite the whole markdown stack to rehype just to sanitize.
- Keep isomorphic-dompurify forever “because OWASP says DOMPurify” — OWASP’s DOMPurify advice targets **HTML authoring** sinks; your sink is **markdown → trusted emitters → `{@html}`**.

---

## Bottom line

The crash is a **Lambda/jsdom ESM packaging** problem, not a product requirement for isomorphic sanitization. For AI markdown with math and code, the clean modern answer is **deny raw HTML at marked** (like the blog), trust KaTeX/hljs, and **delete jsdom** — not pin an old jsdom forever.
