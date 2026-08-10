# examfig DiagramSpec examples

Copy and adapt. Always keep `accessibleDescription`. Validate before render.

## Unit circle

```json
{
  "type": "unit-circle",
  "accessibleDescription": "Unit circle at 60 degrees.",
  "angleDegrees": 60,
  "showReferenceTriangle": true
}
```

## Free-body

```json
{
  "type": "free-body",
  "accessibleDescription": "A block with three forces.",
  "object": { "shape": "block", "label": "m" },
  "forces": [
    { "direction": "up", "label": "N", "magnitude": 20 },
    { "direction": "down", "label": "mg", "magnitude": 20 },
    { "direction": "left", "label": "f", "magnitude": 5 }
  ]
}
```

## Inclined plane

```json
{
  "type": "inclined-plane",
  "accessibleDescription": "Block on a rough 30 degree incline.",
  "angle": 30,
  "surfaceLabel": "rough",
  "object": { "shape": "block", "label": "m" },
  "forces": [
    { "direction": "normal", "label": "N" },
    { "direction": "down", "label": "mg" }
  ]
}
```

## Function graph with shading

```json
{
  "type": "function-graph",
  "accessibleDescription": "f(x)=x^2 with shaded region under the curve.",
  "xDomain": [-2, 2],
  "yDomain": [0, 4],
  "functions": [
    { "id": "f", "label": "f(x)", "expression": "x^2", "stroke": "primary" }
  ],
  "shadedRegions": [{ "between": "f", "xRange": [-1, 1], "baseline": 0 }],
  "axes": {
    "xLabel": "x",
    "yLabel": "y",
    "xTicks": [-2, -1, 0, 1, 2],
    "yTicks": [0, 1, 2, 3, 4]
  }
}
```

## Slope field

```json
{
  "type": "slope-field",
  "accessibleDescription": "Slope field for dy/dx = y with solution y = e^x.",
  "dydxExpression": "y",
  "xDomain": [-2, 2],
  "yDomain": [-2, 2],
  "grid": 8,
  "solutions": [{ "x0": 0, "y0": 1, "label": "y=e^x" }]
}
```

## Supply and demand

```json
{
  "type": "supply-demand",
  "title": "Market equilibrium",
  "accessibleDescription": "Supply and demand curves for a competitive market.",
  "xDomain": [0, 10],
  "yDomain": [0, 10],
  "supply": [
    { "q": 1, "p": 2 },
    { "q": 3, "p": 3 },
    { "q": 5, "p": 5 },
    { "q": 7, "p": 7 },
    { "q": 9, "p": 9 }
  ],
  "demand": [
    { "q": 1, "p": 9 },
    { "q": 3, "p": 7 },
    { "q": 5, "p": 5 },
    { "q": 7, "p": 3 },
    { "q": 9, "p": 2 }
  ],
  "equilibrium": { "q": 5, "p": 5 }
}
```

## Particle diagram

```json
{
  "type": "particle-diagram",
  "accessibleDescription": "NaCl lattice beside a hydrated sodium ion.",
  "particles": [
    { "element": "Na", "charge": 1, "count": 3 },
    { "element": "Cl", "charge": -1, "count": 3 }
  ],
  "solvationShell": {
    "centerElement": "Na",
    "charge": 1,
    "solvent": "water",
    "coordinationNumber": 4
  }
}
```

## Process pathway

```json
{
  "type": "process-diagram",
  "accessibleDescription": "Signal pathway with activation and inhibition.",
  "nodes": [
    { "id": "lig", "label": "Ligand", "compartment": "extra" },
    { "id": "rec", "label": "Receptor", "compartment": "membrane" },
    { "id": "kin", "label": "Kinase", "compartment": "cytoplasm" },
    { "id": "tf", "label": "TF", "compartment": "nucleus" }
  ],
  "edges": [
    { "from": "lig", "to": "rec", "kind": "activation" },
    { "from": "rec", "to": "kin", "kind": "conversion" },
    { "from": "kin", "to": "tf", "kind": "activation" },
    { "from": "tf", "to": "kin", "kind": "feedback", "label": "-" }
  ]
}
```

## TypeScript usage

```ts
import { renderDiagram, validateDiagram } from "examfig";
import { getDiagramJsonSchema } from "examfig/schema";

const spec = {
  type: "unit-circle" as const,
  accessibleDescription: "Unit circle at 60 degrees.",
  angleDegrees: 60,
  showReferenceTriangle: true,
};

const checked = validateDiagram(spec);
if (!checked.success) throw new Error(JSON.stringify(checked.errors));
const svg = renderDiagram(checked.spec);

// For LLM / tool schemas:
const jsonSchema = getDiagramJsonSchema();
```

More fixtures: `packages/examfig/tests/fixtures/`.
