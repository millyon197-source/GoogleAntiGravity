# Layout Analysis & Generation

This directory contains analytical tools, algorithms, and utilities for inspecting and generating X4 station layouts.

## Files

- **`index.js`**: Barrel export exposing all layout analysis functions for programmatic consumption in the app or test suites.
- **`analyze_planar_paranid.js`**: High-level macro distribution, category Y-axis elevation envelopes, and initial module sequences.
- **`analyze_spine.js`**: Detects vertical structural spines (e.g. cross and vertical connector columns), vertical bounds, and connector spacing along $Y$.
- **`analyze_production.js`**: Analyzes production module distribution, grouping factories by discrete $Y$ levels, and row snap patterns.
- **`analyze_deltas.js`**: Computes elevation steps ($\Delta Y$) between consecutive tiers and the category composition of each tier.
- **`analyze_level.js`**: Deep-dives into a specific elevation level (e.g., $Y = -4570$) to inspect row connections and module predecessor chains.

## Blueprint Structural Analysis ("Planar - Paranid.xml")

Analysis of the 567-module mega-station blueprint revealed the architectural foundations for generative layout:

### 1. The Central Vertical Spine
- A continuous vertical backbone spanning **18.8 km** along $X \approx -1391\text{m}$, $Z \approx 887\text{m}$.
- Composed of Argon cross and vertical connector structures snapped at regular $200\text{m}$ and $400\text{m}$ intervals.
- The root module (`#1 pier_arg_harbor_03_macro`, Argon 3-Dock E Pier) sits at the apex ($Y = +1230\text{m}$).

### 2. Category Elevation Hierarchy
Modules are partitioned into vertical zones:
- **Piers & Docks** ($Y = +1230\text{m}$ to $-1000\text{m}$): Positioned at the station top apex for unobstructed flight paths. All Pier Harbors share the same orientation concerns as the Argon 3 Dock E-Pier, automatically aligning docking prongs outward towards closest bounding box dimensions with synchronized magnetic snap points.
- **Storage** ($Y = -368\text{m}$ to $-1168\text{m}$): Container, solid, and liquid tanks clustered directly beneath dock facilities.
- **Habitation** ($Y = -170\text{m}$): 46x Large Argon Habitats clustered symmetrically.
- **Production** ($Y = +430\text{m}$ down to $-17557\text{m}$): 156 factories organized across **31 discrete horizontal tiers**.
- **Defense Platforms** ($Y = +1230\text{m}$ down to $-13157\text{m}$): Strategic bridge defense tubes distributed along the perimeter.
- **Structures** ($Y = +1230\text{m}$ down to $-17157\text{m}$): 342 cross, base, and vertical connectors establishing planar rows.

### 3. Planar Horizontal Row Snapping
- Each production tier extends horizontally along $X$ and $Z$ with consistent grid steps:
  - $\Delta X = 400\text{m}$ (connectors) / $800\text{m}$ (production modules).
  - $\Delta Z = 800\text{m}$ or $1600\text{m}$ between parallel production wings.

---

## The Decorator Pipeline Architecture

The layout analytical tools directly feed the **Decorator Pipeline** in the UI:

```
[ Base Station Seed / Spine ]
            │
            ▼
┌───────────────────────────────┐
│ 1. Decorator: Order of Layout │ ──> Placement sequence (Apex Pier → Spine → Wings → Habitats → Prod → Def)
└───────────────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 2. Decorator: Layers          │ ──> Elevation zones (Docks @ Top, Storage @ Mid, Production @ Base)
└───────────────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 3. Decorator: Spacing & Offset│ ──> Snapping deltas (ΔX=800m, ΔY=200/400m, ΔZ=800/1600m, margins)
└───────────────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 4. Decorator: Layout Mode     │ ──> Spatial arrangement (Planar horizontal rows, grid, clusters)
└───────────────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 5. Decorator: Alignment Anchor│ ──> Coordinate anchoring, symmetry, and bounding-box collision margins
└───────────────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ 6. Decorator: Module Scope    │ ──> Target module filters (Production only, Docks only, etc.)
└───────────────────────────────┘
```

- **Empty State Start**: The actionable decorator panel starts completely empty.
- **Decorator Palette**: Available decorators are presented as chips in the palette with `＋` dropdown selectors.
- **Single-Element Addition**: Selecting an item from the `＋` dropdown adds **only that single element** into the Actionable Panel.
- **Unified Layers Heading**: Any Layers added exist within that **one single heading**. The order is `-` appended to the order name (e.g. `LAYERS - Docks-1 - Storage-2 - Production-3`).
- **Strictly Only the Five Layer Categories**: Layers decorator elements strictly maintain the five canonical categories (`Docks`, `Storage`, `Production`, `Habitats`, `Defense`). Extra categories and custom additions are disallowed.
- **Zero Duplicate Names**: Layers elements never have duplicate names across the application—whether in `displayValues` (`layersRow.checkboxes`), the Decorator Palette dropdown, or the Actionable Panel. Category switching inside the unified card swaps assignments, and additions/reordering continuously preserve the exact 5 canonical categories uniquely numbered 1 through 5.
- **Alignment Anchor Mutual Exclusivity**: Alignment Anchor strictly permits only one selection at a time; all elements (Origin, Ground Floor, Bounding Center, X-Reflection, Compact Core) are mutually exclusive.
- **Drag and Release Re-ordering**: Dragging and releasing any layer position reorders the Layers instantly, dynamically updating layer numbers, heading order, and category evaluation sequence.
- **Hand Appearance & Placement**: Actionable cards and layer items feature a tactile hand cursor (`cursor: grab` / `cursor: grabbing`). Dragging a layer reveals glowing placement insertion lines (`.drag-placement-top` / `.drag-placement-bottom`).
- **Proactive Conflict Resolution**: Evaluates duplicate category assignments, intra-category mutual exclusivity, and cross-decorator conflicts (e.g. *Blueprint* mode vs procedural *Layout Mode*), automatically replacing conflicting members.
- **Blueprint Mode Reload & Skipped Decorators in Yellow**: When *Order of Layout* is set to *Blueprint*, the active blueprint name is reloaded into `#plan-name`, `#sample-dropdown-current-label`, and the actionable card badge (`.blueprint-reloaded-name`). All other actionable decorators in the pipeline (Layers, Spacing & Offset, Alignment Anchor, Module Scope, etc.) are bypassed in execution. In the Actionable Panel, skipped items are rendered in yellow colors (`.is-skipped-by-blueprint` with yellow border, yellow glow, and a `.badge-skipped-yellow` stating `Skipped by Blueprint`). Switching away from Blueprint restores normal cyan styling and reactivates decorator execution.
- **Pier Harbors & One Dock Pier Alignment Parity**: All Pier Harbors across all factions automatically align outward facing space boundaries with magnetic snap points in sync. For One Dock Piers (`harbor_02`), base dock direction extends along local $-X$ (`(-1, 0, 0)`). Snapped pier chains (such as the back-to-back One Dock Piers in "Tiny Shipyard") maintain continuous snap interface alignment with parent piers (`connectionsnap002`), guaranteeing zero disconnect and proper dual-outward docking orientation.
- **Carried Headings**: When added to the actionable panel, each element card carries its bold parent heading, glowing dot, element badge, evaluation order tag (`Eval #1`), drag handle (`⠿`), and up/down progression controls.
- **Dynamic Progression**: Reordering element cards in the pipeline changes the top-to-bottom layout synthesis order.

---

## Usage

Each script can be run standalone from Node or imported programmatically.

### Standalone CLI Execution:
```bash
node src/layout/analyze_planar_paranid.js [optional_path_to_blueprint.xml]
node src/layout/analyze_spine.js [optional_path_to_blueprint.xml]
node src/layout/analyze_production.js [optional_path_to_blueprint.xml]
node src/layout/analyze_deltas.js [optional_path_to_blueprint.xml]
node src/layout/analyze_level.js [optional_path_to_blueprint.xml] [targetY]
```

### Programmatic Import:
```javascript
import {
  analyzePlanarParanid,
  analyzeSpine,
  analyzeProduction,
  analyzeDeltas,
  analyzeLevel
} from './src/layout/index.js';

const xml = fs.readFileSync('blueprint.xml', 'utf8');
const analysis = analyzePlanarParanid(xml);
console.log('Total modules:', analysis.totalModules);
```

