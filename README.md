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
- `npm test` - run automated test suite across all 30 test modules

## 📂 Project Structure

```
GoogleAntiGravity/
├── index.html                    # Main 3D viewport HTML5 entry point & UI controls
├── package.json                  # Node dependencies (Three.js, Vite) & build scripts
├── package-lock.json             # Dependency lockfile
├── vite.config.js                # Vite server configuration & manual chunk code-splitting
├── README.md                     # Primary application guide & documentation
├── README1.md                    # Legacy converter notes & alternate workflow documentation
├── Installation.md               # Environment setup & game asset extraction guide
├── setup_x4_vite_explorer.ps1    # Automated PowerShell environment configuration script
├── dae_hash_table.json           # Collada mesh hash index mapping macro names to 3D assets
├── convert_structures.py         # Asset conversion utility for game station modules
├── dae_vulkan_compact.py         # Mesh optimization & Vulkan vertex compaction script
├── xmf_converter.py              # X4 raw binary .xmf geometry extractor & converter
├── assets/                       # Extracted loose game assets, textures & binary meshes
├── docs/                         # Technical specifications (e.g. X4 construction plan blueprint spec)
├── tests/                        # Automated unit and integration test suite (30 test suites)
│   └── run-all.js                # Test runner script
└── src/
    ├── main.js                   # App initialization, UI bindings & file upload handlers
    ├── viewer.js                 # Three.js scene graph, lighting, camera & render loop
    ├── three-coordinator.js      # Three.js engine coordination & scene lifecycle management
    ├── parser.js                 # Station construction plan XML parser
    ├── blueprint-exporter.js     # Station XML construction blueprint exporter & DLC patch detector
    ├── module-display-panel.js   # Module display panel, layer ordering & visibility controller
    ├── module-bounds-hashtable.js# Fast bounding box lookups across station modules
    ├── snap-points-db.js         # Magnetic connection & snapping point database
    ├── modules.js                # Module definitions, macro categorization & bounding calculation
    ├── modules-cost-db.js        # Verified module construction resource requirements database
    ├── mesh-loader.js            # Binary mesh / Collada .dae loader with fallback resolution
    ├── mesh-worker.js            # Dedicated Web Worker for off-thread geometry processing
    ├── samples.js                # Built-in sample station construction plans
    └── style.css                 # Dark glassmorphic HUD & control overlay styling
```

## Notes

- `README1.md` documents an older/alternate converter workflow and is not the primary app guide for this repository.
