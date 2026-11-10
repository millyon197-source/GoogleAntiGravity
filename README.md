# X4 Station Visualizer

Interactive Three.js + Vite web app for loading and inspecting **X4: Foundations** station construction plan XML files.

## What it does

- Parses station plan XML (`<plans><plan>...`) and loads modules in build order.
- Renders station modules in 3D with lighting, shadows, camera presets, and selection.
- Uses hashed asset lookup (`dae_hash_table.json`) to find module mesh files.
- Attempts fast binary mesh loading (`.bin` + `.json`) and falls back to Collada (`.dae`).
- Shows module/category stats, estimated bounding envelope, and estimated construction resources.
- Includes visibility filtering and build-sequence timeline playback.
- Ships with built-in sample plans and supports uploading/pasting custom XML.

## Requirements

1. **Node.js 18+** (recommended current LTS).
2. **Unpacked X4 assets** available in paths referenced by `dae_hash_table.json`.

## Local development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Project scripts

- `npm run dev` - start Vite dev server
- `npm run build` - create optimized production build in `dist/` with chunk splitting
- `npm run preview` - preview built app locally
- `npm test` - run automated test suite across all 99 test suites
- `npm run sync:dlc-components` - sync and update DLC component definitions
- `npm run generate:macro-refs` - rebuild macro to component reference tables
- `npm run generate:scene-cache` - generate precomputed binary scene cache files

## ⚡ Performance & Large-Plan Optimizations

Engineered to smoothly handle massive industrial plans (500+ modules) without UI lockups or frame freezing:

- **Asynchronous Shader Precompilation**: Precompiles materials ahead of time using `renderer.compileAsync` (`KHR_parallel_shader_compile`) against the bloom composer's render target. Module lights are held off until plan insertion completes, standardizing shader variations and preventing synchronous mid-render compilation spikes.
- **Render Throttling & Frame Pacing (`renderHeld`)**: Instead of rendering complete scenes for every added module, the render loop throttles intermediate draws (minimum 250 ms spacing or 4x previous frame duration). This reduces first-load times on large blueprints (such as the 585-module Prod Max) from **~138 s down to ~22 s**.
- **Concurrent Module & Part Ingestion**: Module sub-parts are fetched, decoded, and textured in parallel before file-order assembly, while pipelining the loading of upcoming modules ahead of placement.
- **Raw UV Sharing (`cloneSharingRawUvs`)**: Detaches `userData.rawUvs` before cloning template parts so typed arrays are shared by reference rather than undergoing costly JSON stringification/parsing during Three.js `Object3D.clone()`.
- **Precomputed Binary Scene Cache & Off-Thread Decoding**: Binary geometry caches (`generate:scene-cache`) are unpacked and decoded off the main thread via dedicated Web Workers (`scene-cache-worker`, `mesh-worker`, `bc-decode-worker`).
- **Dynamic Resource & Memory Management**:
  - Automatically caps active module point lights on large blueprints to maintain target framerates.
  - Shares matching materials and shader keys across module instances.
  - Explicitly releases discarded module geometries, unused part templates, and textures upon blueprint reset/reloading.
- **Responsive Viewport & Freeze Diagnostics**:
  - Continuous canvas resizing powered by `ResizeObserver`, ensuring stable rendering with graceful stacking on narrower viewports (<820 px).
  - Built-in freeze recorder diagnostic tool (`tools/diagnostics/freeze-recorder.js`) to capture main-thread stalls, frame hitches, and compilation pauses.

## 🎯 Fit & Alignment Controls

The visualizer provides precision tools for sizing the station's construction plot and framing the 3D scene:

### 1. Fit Plot to Blueprint
Automatically shrink or expand the holographic Plot Bounding Box to tightly envelop all visible modules:
1. **Left-Click** any module to attach the 3D Transform Gizmo (press `T` for Move or `G` for Combined mode if needed).
2. **Right-Click the Center Diamond (XYZ handle)** located at the center of the gizmo.
3. The engine automatically recalculates the minimum whole-kilometer extents along all three axes (`+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`) anchored at the origin, applying a 0.5 m violation tolerance. The updated dimensions display on the floating HUD overlay and persist for the active blueprint in `localStorage`.

### 2. Center Blueprint within Plot
Translate all modules so that their collective center aligns with the geometric center of the plot:
1. **Left-Click the Center Diamond (XYZ handle)** on the 3D Transform Gizmo.
2. In the **Center Modules in Plot BB** modal dialog, confirm by clicking **Center in Plot** (or choose **FEFB** to designate the module as the First Element For Branching).

### 3. Interactive Corner Gizmo (Manual Axis Sizing)
1. Move the cursor near any of the 8 corners of the holographic plot bounding box to reveal red corner handles.
2. **Click and Drag** a corner handle. The drag locks onto the dominant axis and resizes the boundary in discrete **1 km** increments.
3. Releasing the mouse button saves the configuration and triggers an automatic camera **FIT**.

### 4. Camera Viewport Fit
- Click the **`FIT`** button on the viewport HUD (or click on any category header in the sidebar) to smoothly center and zoom the camera to frame all visible modules.

### Quick Reference: Hotkeys & Gizmo Shortcuts

| Key / Mouse Action | Function |
| :--- | :--- |
| **Right-Click Center Diamond** | **Fit Plot to Blueprint** (shrink/grow plot BB to modules) |
| **Left-Click Center Diamond** | Open **Center Modules in Plot BB** dialog |
| **Drag Red Corner Dot** | Manually resize plot boundary on locked axis (1 km steps) |
| **`T`** | Toggle **Move (Translate)** gizmo mode |
| **`R`** | Toggle **Rotate (Yaw, Pitch, Roll)** gizmo mode |
| **`G`** | Toggle **Combined (All: Move + Rotate)** gizmo mode |
| **`D`** | Toggle component **Bounding Box Dimensions** overlay |
| **`S`** | Toggle **Magnetic Snap Points** display |
| **`Ctrl + Z`** | **Undo** last action (module moves, rotations, diamond center, fit plot, FEFB) |
| **`Esc`** | Detach 3D gizmo / clear active module selection |

## 🧩 Draggable Decorator Pipeline for Station Layout Progression

The **Layout** panel provides an actionable pipeline architecture where layout rules act as **draggable decorators**. Rather than presenting static configurations simultaneously, the panel empowers users to compose a custom station generation pipeline:

- **Empty State Baseline**: The actionable panel starts empty at first (`0 / 6 Active`), ready to be populated.
- **Decorator Palette / Tray**: Top drawer featuring chips for the 6 core layout decorators:
  1. **Order of Layout**: Sequenced module build hierarchy (Apex Pier $\to$ Vertical Spine $\to$ Wings $\to$ Habitats $\to$ Production $\to$ Defense).
  2. **Layout Mode**: Spatial arrangement geometry (Planar horizontal rows, 3D grid matrix, category clusters, compact core).
  3. **Layers**: Discrete elevation tiers ($Y$-axis zones) and category stacking orders.
  4. **Spacing & Offset**: Connector snapping intervals ($\Delta X=800\text{m}, \Delta Y=200/400\text{m}, \Delta Z=800/1600\text{m}$) and safety clearance padding.
  5. **Alignment Anchor**: Spatial reference frames (origin, bounding center, ground floor, bilateral X-reflection symmetry) — strictly allows only one selection (all elements are mutually exclusive).
  6. **Module Scope**: Filter decorators to specific module categories (e.g., target only Production or Docks).
- **Element Selection via `＋` Dropdown**: Clicking the `＋` on any decorator palette displays a dropdown of its selectable elements. Selecting an element adds **only that single element** into the Actionable Panel (carrying its parent decorator heading and active element badge).
- **Proactive Conflict Decision & Resolution**: Each added element proactively evaluates conflicts against existing members in the Actionable Panel:
  - **Mutual Exclusivity**: Categories including *Layout Mode*, *Spacing & Offset*, *Order of Layout*, *Alignment Anchor*, and *Module Scope* permit only one active element at a time; all elements are strictly mutually exclusive. Adding an alternate element detects the conflict and automatically replaces the conflicting member.
  - **Unified Layers Decorator Heading**: For the *Layers* Decorator Palette, any Layers added exist within that **one single heading**. The order is `-` appended to the order name (e.g., `LAYERS - Docks-1 - Storage-2 - Production-3`).
  - **Strictly Only the Five Categories**: Layers elements strictly consist of the five canonical categories (`Docks`, `Storage`, `Production`, `Habitats`, `Defense`). Additional elements or non-canonical categories are disallowed.
  - **Zero Duplicate Names Guarantee**: Layers elements never have duplicate names across the application—neither in `displayValues` (`layersRow.checkboxes`), nor in the Decorator Palette dropdown, nor in the Actionable Panel. Category switching inside the unified card swaps assignments, and additions/reordering continuously preserve the exact 5 canonical categories uniquely numbered 1 through 5.
  - **Drag and Release Re-ordering**: Dragging and releasing any layer position within the unified Layers card reorders the Layers instantly, dynamically updating layer numbers, heading order string, and module category evaluation sequence.
  - **Cross-Decorator Exclusivity**: Selecting *Blueprint* in Order of Layout conflicts with and cleanly replaces procedural *Layout Mode* selections (e.g. Planar Row or Grid Matrix), and vice-versa.
  - **Blueprint Mode Reload & Skipped Decorators in Yellow**: When *Order of Layout* is set to *Blueprint*, the active blueprint name is reloaded into `#plan-name`, `#sample-dropdown-current-label`, and the actionable card badge (`.blueprint-reloaded-name`). All other actionable decorators in the pipeline (Layers, Spacing & Offset, Alignment Anchor, Module Scope, etc.) are skipped from procedural placement. Skipped items in the Actionable Decorators panel are styled with glowing yellow colors (`.is-skipped-by-blueprint` with yellow border, yellow glow, and a `.badge-skipped-yellow` stating `Skipped by Blueprint`). Switching away from Blueprint restores normal cyan styling and reactivates decorator execution.
  - **Pier Harbor Outward Orientation Parity & One Dock Pier Alignment**: All Pier Harbors (Argon, Paranid, Teladi, Split, Terran, Boron across 1-Dock, 3-Dock E-Pier, T-Pier, and 4-Dock variants) share the same orientation concerns as the Argon 3 Dock E-Pier, automatically aligning docking prongs outward towards the closest bounding box boundary and keeping magnetic snap points in sync. For One Dock Piers (`harbor_02`), base dock direction extends along local $-X$ (`(-1, 0, 0)`), ensuring outward space orientation. Snapped pier chains (such as the back-to-back One Dock Piers in "Tiny Shipyard") preserve mutual snap alignment (`connectionsnap002`), ensuring zero disconnect and proper dual-outward space docking.
- **Hand Appearance & Placement**:
  - Actionable cards, handles, and layer items feature a tactile hand cursor (`cursor: grab` 🖐️), switching to grabbing (`cursor: grabbing` ✊) on drag.
  - Dragging a layer element over other elements renders glowing cyan placement indicator lines (`.drag-placement-top` / `.drag-placement-bottom`) identifying exact drop insertion position.
- **Carried Headings & Organization**: When added to the active pipeline, each decorator retains its distinct parent title heading, glowing state dot, drag handle (`⠿`), progression up/down buttons (`▲`/`▼`), and removal controls (`✕`). For Layer elements, each item includes an inline category selector and evaluation tier badge (`#1`, `#2`, etc.).
- **Ordered Execution**: The top-to-bottom sequence of active elements in the panel determines how the procedural layout synthesis evolves.

## 📂 Project Structure

```
GoogleAntiGravity/
├── index.html                    # Main 3D viewport HTML5 entry point & UI controls
├── package.json                  # Monorepo workspaces & build scripts
├── package-lock.json             # Dependency lockfile
├── vite.config.js                # Vite server configuration & manual chunk code-splitting
├── README.md                     # Primary application guide & documentation
├── README1.md                    # Legacy converter notes & alternate workflow documentation
├── Installation.md               # Environment setup & game asset extraction guide
├── dae_hash_table.json           # Collada mesh hash index mapping macro names to 3D assets
├── packages/                     # Monorepo Clean Architecture domain & adapter packages
│   ├── domain/                   # Pure entities, spatial math, value objects (zero deps)
│   ├── application/              # Use cases, interactors, and ports (inbound/outbound)
│   ├── adapter-xml/              # Station plan XML parser, blueprint exporter, DLC patch handler
│   ├── adapter-three/            # Three.js rendering, shaders, materials, gizmos, UV animators
│   └── catalog/                  # Module costs, macro mappings, and bounding databases
├── src/                          # Application presentation, composition & UI controls
│   ├── app/                      # App components (export modals, build animator, undo history)
│   ├── layout/                   # Layout rules, spacing deltas, and progression analyzers
│   ├── composition-root.js       # Monorepo package wiring & dependency injection
│   ├── main.js                   # Composition root, UI events & file upload controllers
│   ├── viewer.js                 # Three.js rendering engine, camera, post-processing & lights
│   ├── module-display-panel.js   # Module hierarchy, visibility, and category controls
│   ├── samples.js                # Built-in sample station construction plans
│   └── style.css                 # Dark glassmorphic HUD & responsive control styling
├── tools/                        # Diagnostic and asset maintenance utilities
│   ├── diagnostics/              # 40+ scripts for geometry, snap, and freeze analysis
│   ├── freeze-recorder.js        # Console hitch & main-thread stall diagnostic tool
│   ├── generate-scene-cache.js   # Precomputed binary scene cache generator
│   └── sync-dlc-components.js    # Game DLC component synchronization
├── assets/                       # Extracted loose game assets, textures & binary meshes
├── docs/                         # Technical specifications (e.g. X4 construction plan blueprint spec)
└── tests/                        # Automated test suite (99 test suites)
    └── run-all.js                # Test runner script
```

## Notes

- `README1.md` documents an older/alternate converter workflow and is not the primary app guide for this repository.
