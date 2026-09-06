/**
 * The model cannot read `.agents/skills` at runtime. Keep the operational
 * Examfig reference in the prompt so generated specs use the installed
 * renderer's semantic fields instead of inventing SVG or object shapes.
 */
export const EXAMFIG_DIAGRAM_SKILL = `
EXAMFIG DIAGRAM REFERENCE - FOLLOW THIS EXACTLY:

Examfig consumes semantic DiagramSpec JSON and renders the SVG itself. Never output SVG, SVG paths, pixel coordinates, arbitrary image URLs, photographs, or hand-authored drawing instructions. Always return a JSON object with:
- type: one supported diagram type listed below
- accessibleDescription: a concise description for screen readers
- type-specific semantic fields from the reference below
Use short labels, semantic values, and monochrome-safe content. Do not invent fields. Do not micromanage layout.

WORKFLOW:
1. Choose the narrowest diagram type that directly supports the tested concept.
2. Build the semantic DiagramSpec.
3. JSON.stringify the spec and call validateExamfigDiagram with it before finalizing when the tool is available.
4. If validation fails, repair the JSON using the returned error and validate again.
5. Return the JSON-encoded DiagramSpec string in the diagram field. Return null when a diagram does not add clear instructional value.
The application validates and renders the final spec again. Fail closed on validation errors; never patch SVG.

SUPPORTED TYPES AND REQUIRED SEMANTIC FIELDS:
Math and charts:
- function-graph: xDomain, yDomain, functions[] or piecewise[]; functions use id, expression, and optional label/stroke/domain. Optional shadedRegions, axes, points, annotations, discontinuities.
- data-plot: plotType plus plot-specific data. Supported plotType values include boxplot, bar, histogram, dot, scatter, line, residual, error-bar, stem-leaf, mosaic, and distribution. Use the matching series/points/bins fields and axes where required.
- polar-graph: rExpression and thetaDomain; optional axes and shadedSectors.
- parametric-graph: xExpression, yExpression, and tDomain; optional xDomain/yDomain/axes.
- slope-field: dydxExpression, xDomain, and yDomain; optional grid and solutions.
- matrix-transformation: matrix; optional showUnitSquare and vectors.
- complex-plane: points; optional domain and showUnitCircle.
- unit-circle: angleDegrees; optional showReferenceTriangle and label.
- cross-section-volume: baseExpression, xDomain, and method; washer also needs outerExpression.
- supply-demand: xDomain, yDomain, supply[], and demand[]; optional equilibrium.
- table: headers[] and rows[][]; optional variant, caption, and cellAnnotations.

Physics:
- free-body: object { shape: "block" or "circle" } and forces[]; each force needs direction and label. Directions are up, down, left, right, normal, up-slope, or { angle: degrees }.
- inclined-plane: angle; optional object, forces[], surfaceLabel, and angleLabel.
- motion-map: dots[] with t and x; optional velocityArrows.
- mechanics-scene: objects[]; optional forces[] and vectors[].
- vector-scene: vectors[] with direction and magnitude; optional showOrigin.
- energy-chart: categories[] with id, label, and value.
- momentum-chart: before[] and after[] bodies with id, label, and signed momentum.
- circuit: components[] and connections[].
- field-map: sources[] and mode (fieldVectors or fieldLines).
- equipotential-map: potentialExpression and levels[]; optional xDomain/yDomain.
- gaussian-surface: shape (sphere, cylinder, or pillbox); optional chargeEnclosed and showFluxArrows.
- induction-diagram: fieldRegion (into or out); optional loop and velocity.
- ray-diagram: layers[] with id and n, plus incidentAngle.
- wave-diagram: kind, wavelength, and amplitude; optional cycles.
- thermodynamics-diagram: paths[]; each path may use points and process.
- fluid-diagram: kind (tank or pipe); optional liquidLevel, label, and flowArrows.

Chemistry:
- particle-diagram: particles[] with element and optional charge/count/phase; optional solvationShell.
- lewis-structure: formula or atoms[]/bonds[]; atoms use id and element, bonds use from/to.
- molecular-geometry: geometry, centralLabel, and terminalLabels[].
- energy-profile: reactants/products or points; optional activationEnergy, deltaH, labels, and catalyzed.
- titration-curve: optional points, acidType/baseType, equivalence, and halfEquivalence.
- spectra-plot: kind (mass, pes, or absorbance) and peaks[].
- electrochemical-cell: kind, anode, and cathode; optional saltBridge and solutions.
- apparatus-schematic: components[] with id, kind, and label.

Biology and environment:
- process-diagram, resource-flow, or food-web: nodes[] with id and label plus edges[] with from/to; optional kind (activation, inhibition, conversion, feedback, flow, or trophic), label, and layout.
- pedigree: individuals[] with id, generation, and sex; optional phenotype, partners, parents, and legend.
- phylogenetic-tree: kind, tips[], and branches[]; optional root, outgroup, and traits.
- cell-diagram: kind; optional organelles[] and labels[].
- genetic-cross: kind, parent1Alleles[], and parent2Alleles[]; optional grid[].
- gel-blot: lanes[] with label and bands[].
- experimental-setup: components[] with label and role.
- population-curve: kind and series[]; optional xDomain/yDomain.
- age-structure: cohorts[] with ageLabel and male/female or value.
- environmental-cross-section: layers[] with label and depthFraction.
- map: regions[] is REQUIRED, even when markers are present. Each region needs id, label, and pathPoints as an array of normalized [x, y] pairs. Optional markers[], legend[], and compass.

VALID MAP EXAMPLE:
{"type":"map","accessibleDescription":"A schematic map showing three regions and two migration markers.","regions":[{"id":"north","label":"North","pathPoints":[[0.1,0.1],[0.5,0.1],[0.45,0.45],[0.1,0.4]]},{"id":"south","label":"South","pathPoints":[[0.1,0.5],[0.45,0.55],[0.5,0.9],[0.1,0.85]]}],"markers":[{"id":"route","label":"Migration route","x":0.6,"y":0.5}]}

VALID TABLE EXAMPLE:
{"type":"table","accessibleDescription":"A table comparing rates for two conditions.","headers":["Condition","Rate"],"rows":[["A","1"],["B","2"]]}

VALID FUNCTION-GRAPH EXAMPLE:
{"type":"function-graph","accessibleDescription":"The graph of f(x)=x^2 from x=-2 to x=2.","xDomain":[-2,2],"yDomain":[0,4],"functions":[{"id":"f","label":"f(x)","expression":"x^2","stroke":"primary"}]}

VALID FREE-BODY EXAMPLE:
{"type":"free-body","accessibleDescription":"A block with upward normal force and downward weight.","object":{"shape":"block","label":"m"},"forces":[{"direction":"up","label":"N","magnitude":20},{"direction":"down","label":"mg","magnitude":20}]}

Use safe math expressions only, such as x^2, sin(x), or e^x. Prefer degrees fields such as angleDegrees and incidentAngle. Keep the diagram directly within the requested AP unit and do not repeat information in the stem that the diagram already communicates. Every included diagram must be validated before finalizing.`;
