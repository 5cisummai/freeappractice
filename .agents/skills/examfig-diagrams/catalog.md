# examfig type catalog

Runtime discriminants (`DiagramType`). Prefer fixtures under `packages/examfig/tests/fixtures/` as the source of truth for field names.

## Math & charts

| Type                    | Use for                                        | Key fields                                                     |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `function-graph`        | Curves y=f(x), piecewise, annotations, shading | `xDomain`, `yDomain`, `functions[]`, `shadedRegions?`, `axes?` |
| `data-plot`             | Stats plots                                    | `plotType`, `series` / plot-specific data, axes                |
| `polar-graph`           | r(θ)                                           | `rExpression`, `thetaDomain`, `shadedSectors?`                 |
| `parametric-graph`      | x(t), y(t)                                     | parametric expressions + domain                                |
| `slope-field`           | dy/dx field                                    | `dydxExpression`, `xDomain`, `yDomain`, `grid?`, `solutions?`  |
| `matrix-transformation` | Linear maps / vectors                          | matrix + vectors (isotropic)                                   |
| `complex-plane`         | Complex points / loci                          | points, optional unit circle                                   |
| `unit-circle`           | Angle on unit circle                           | `angleDegrees`, `showReferenceTriangle?`                       |
| `cross-section-volume`  | Solids / disks                                 | `baseExpression`, `xDomain`, cross-section style               |
| `supply-demand`         | Econ S/D                                       | `supply`, `demand`, `xDomain`, `yDomain`, `equilibrium?`       |
| `table`                 | Tables / matrices                              | `variant`, `headers`, `rows`, `cellAnnotations?`               |

### `data-plot` variants

Use `plotType` (see fixtures `data-plot-*.json`): boxplot, scatter, line, bar, histogram, dot, residual, error-bar, stem-and-leaf, mosaic, distribution, etc.

## Physics

| Type                     | Use for                       | Key fields                                                |
| ------------------------ | ----------------------------- | --------------------------------------------------------- |
| `free-body`              | Force diagram                 | `object`, `forces[]` (`direction`, `label`, `magnitude?`) |
| `inclined-plane`         | Ramp + object + forces        | `angle`, `surfaceLabel?`, `object?`, `forces?`            |
| `motion-map`             | Position ticks over time      | positions / times                                         |
| `mechanics-scene`        | Multi-object mechanics sketch | scene objects                                             |
| `vector-scene`           | Named vectors from anchors    | `vectors[]`                                               |
| `energy-chart`           | Bar energy                    | series / categories                                       |
| `momentum-chart`         | Momentum bars / before-after  | series                                                    |
| `circuit`                | Simple circuits               | components, nodes                                         |
| `field-map`              | E/B field lines               | sources, polarity                                         |
| `equipotential-map`      | Equipotentials                | sources / levels                                          |
| `gaussian-surface`       | Gauss surface                 | surface + enclosed charge label                           |
| `induction-diagram`      | Faraday / flux                | loops, field                                              |
| `ray-diagram`            | Refraction / reflection       | `layers[]` (`n`), `incidentAngle`                         |
| `wave-diagram`           | Waves                         | wavelength / amplitude style fields                       |
| `thermodynamics-diagram` | P–V paths                     | `paths[]` with `points`, `process?`                       |
| `fluid-diagram`          | Fluids / pressure             | vessels / levels                                          |

Force `direction` values: `"up"` \| `"down"` \| `"left"` \| `"right"` \| `"normal"` \| `"up-slope"` \| `{ "angle": <deg> }`. On inclines, pass incline context via the diagram’s `angle` so `normal` / `up-slope` resolve correctly.

## Chemistry

| Type                   | Use for                    | Key fields                                                        |
| ---------------------- | -------------------------- | ----------------------------------------------------------------- |
| `particle-diagram`     | Particle views / solvation | `particles[]` (`element`, `charge?`, `count?`), `solvationShell?` |
| `lewis-structure`      | Lewis dots                 | atoms, bonds, lone pairs                                          |
| `molecular-geometry`   | VSEPR shapes               | central atom, attachments                                         |
| `energy-profile`       | Reaction coordinate        | reactants/products/Ea or `points`, `catalyzed?`, `deltaH?`        |
| `titration-curve`      | Acid–base titration        | acid/base types, `equivalence?`, `halfEquivalence?`               |
| `spectra-plot`         | Mass/IR/PES-style peaks    | `kind`, `peaks[]`                                                 |
| `electrochemical-cell` | Galvanic / electrolytic    | `kind`, `anode`, `cathode`, `saltBridge?`                         |
| `apparatus-schematic`  | Lab glassware layout       | apparatus parts + labels                                          |

## Biology & environment

| Type                          | Use for                   | Key fields                              |
| ----------------------------- | ------------------------- | --------------------------------------- |
| `process-diagram`             | Signaling / pathways      | `nodes[]`, `edges[]` (`kind`, `label?`) |
| `pedigree`                    | Inheritance chart         | generations / individuals               |
| `phylogenetic-tree`           | Cladogram                 | tree tips / branches                    |
| `cell-diagram`                | Cell schematic            | compartments / organelles               |
| `genetic-cross`               | Punnett / cross table     | parents, offspring grid                 |
| `gel-blot`                    | Gel / blot lanes          | lanes, bands                            |
| `experimental-setup`          | Labeled experiment boxes  | components                              |
| `population-curve`            | N vs t, carrying capacity | growth model / `K`                      |
| `age-structure`               | Population pyramid        | `cohorts[]` (male/female)               |
| `environmental-cross-section` | Soil / earth layers       | layers                                  |
| `map`                         | Simple geo schematic      | regions, markers                        |
| `resource-flow`               | Reservoir cycles          | round reservoirs + flow edges           |
| `food-web`                    | Trophic links             | producers/consumers + edges             |

### Process edge kinds

`activation` \| `inhibition` \| `conversion` \| `feedback` \| `flow` \| `trophic` (as accepted by schema). Short labels `"-"`, `"−"`, `"+"` render as compact signed badges on feedback-style edges.

## Schema

```ts
import { getDiagramJsonSchema } from 'examfig/schema';

const schema = getDiagramJsonSchema(); // implemented types only
```

Use this schema in tool definitions / constrained decoding. Do not ask the model for SVG.
