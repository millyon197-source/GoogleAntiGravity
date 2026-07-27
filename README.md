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
- `npm run build` - create production build in `dist/`
- `npm run preview` - preview built app locally

## Notes

- `README1.md` documents an older/alternate converter workflow and is not the primary app guide for this repository.
