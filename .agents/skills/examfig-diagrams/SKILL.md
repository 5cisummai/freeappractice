---
name: examfig-diagrams
description: Create educational diagrams with examfig via semantic DiagramSpec JSON, validateDiagram, and renderDiagram — never hand-authored SVG. Use when generating figures, worksheets, AP-style diagrams, math/science visuals, or when the user asks for an examfig diagram, SVG figure, unit circle, free-body, circuit, or similar.
---

# examfig diagrams

Agents describe **meaning**; examfig computes layout and emits deterministic SVG.

## Hard rules

1. **Never** invent SVG paths, pixel coordinates, or freehand drawing instructions as the primary artifact.
2. Emit a **`DiagramSpec`** JSON object (or TypeScript object of that shape).
3. Every spec **must** include `accessibleDescription`.
4. Prefer **semantic fields** (`direction: "up"`, `expression: "x^2"`, quartile values, `angleDegrees`) over layout hints.
5. Always **`validateDiagram` → `renderDiagram`**. Fail closed on validation errors; fix the spec, do not patch SVG.
6. Copy from fixtures first: `packages/examfig/tests/fixtures/*.json`.

## Workflow

```text
Pick diagram type → draft DiagramSpec → validateDiagram → renderDiagram → (optional) gallery check
```

### 1. Choose the type

Match the educational goal to a discriminant in [catalog.md](catalog.md). Prefer the narrowest type that fits (e.g. `unit-circle` over a generic `function-graph` for trig angles).

### 2. Draft the spec

Minimal shape:

```ts
{
  type: "<DiagramType>",
  accessibleDescription: "<one sentence for screen readers / alt>",
  // type-specific semantic fields…
}
```

Optional shared fields: `title`, `width`, `height`, `theme` (`"monochrome"`).

### 3. Validate and render

```ts
import { renderDiagram, validateDiagram } from 'examfig';
// or, for schema-guided LLM prompts:
import { getDiagramJsonSchema } from 'examfig/schema';

const result = validateDiagram(spec);
if (!result.success) {
	// Fix result.errors — do not render
} else {
	const svg = renderDiagram(result.spec, { theme: 'monochrome' });
}
```

`renderDiagram` is sync, DOM-free, and safe for Node/Bun SSR.

### 4. Verify visually (in this repo)

```bash
pnpm dev
# open demo → Verification gallery (often http://localhost:5173 or :5174 #gallery)
```

Filter by type name. Check overlaps, clipping, and math scale (especially unit circles / polar / complex).

## Type selection cheat sheet

| Need                                   | Type                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| y = f(x), piecewise, shade under curve | `function-graph`                                           |
| boxplot, scatter, histogram, bar, …    | `data-plot` (+ `plotType`)                                 |
| Forces on a mass                       | `free-body`                                                |
| Block on a ramp                        | `inclined-plane`                                           |
| Trig angle on circle                   | `unit-circle`                                              |
| r(θ)                                   | `polar-graph`                                              |
| dy/dx field + solutions                | `slope-field`                                              |
| Supply & demand                        | `supply-demand`                                            |
| Circuits / rays / waves                | `circuit` / `ray-diagram` / `wave-diagram`                 |
| Lewis / particles / titration          | `lewis-structure` / `particle-diagram` / `titration-curve` |
| Pathways / food webs                   | `process-diagram` / `food-web` / `resource-flow`           |

Full list and required fields: [catalog.md](catalog.md). Concrete JSON: [examples.md](examples.md).

## Expression and math notes

- Safe expression strings only (no JS). Examples: `x^2`, `sin(x)`, `e^x`, `cos(2 * theta)`.
- Types that need **equal x/y scale** (already handled by the renderer when using these types): `unit-circle`, `polar-graph`, `parametric-graph`, `complex-plane`, `matrix-transformation`.
- Angles: prefer degrees fields like `angleDegrees` / `incidentAngle` where the schema provides them.
- Charges in particle diagrams: numeric `charge` (e.g. `1`, `-1`); the renderer formats superscripts.

## Label and layout notes

- Do **not** micromanage label x/y. The library places labels to avoid collisions.
- Keep labels short (`N`, `mg`, `eq`, `½ eq`). Long prose belongs in `accessibleDescription` / question text.
- For process/resource edges, use semantic `kind` (`activation`, `feedback`, `flow`, …). Use `"-"` / `"+"` only for short signed feedback marks.

## Anti-patterns

| Bad                                      | Good                                        |
| ---------------------------------------- | ------------------------------------------- |
| Hand-written `<svg><path d="M…">`        | `DiagramSpec` + `renderDiagram`             |
| Pixel positions for forces               | `direction: "normal"` / `"up"` + `label`    |
| Skipping validation                      | `validateDiagram` first                     |
| Overstuffed first viewport of labels     | One job per diagram; split panels if needed |
| Using `function-graph` for a unit circle | `type: "unit-circle"`                       |

## Package boundaries

- **Default:** `examfig` facade (registers all renderers).
- Narrow imports when bundling selectively: `@examfig/core`, `@examfig/charts`, `@examfig/science`.
- Schema for tool/LLM constraints: `getDiagramJsonSchema()` from `examfig/schema`.

## After changing renderers (maintainers)

```bash
pnpm build
UPDATE_SNAPSHOTS=1 pnpm exec vitest run tests/render-all-fixtures.test.ts   # in packages/examfig
pnpm --filter examfig test
```

Do not run snapshot update in parallel with dist compatibility tests.
