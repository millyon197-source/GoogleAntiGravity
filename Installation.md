# Environment & Installation Guide

This document provides step-by-step setup and installation instructions for running the **X4 Station Visualizer** and related X4 tooling, covering **Node.js**, **Vite**, **Three.js**, and all third-party dependencies and game asset extraction pipelines.

---

## 1. System Requirements

| Component | Minimum Requirement | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11 (64-bit), macOS 12+, or Linux | Windows 11 (64-bit) |
| **Memory (RAM)** | 8 GB RAM | 16 GB+ (for handling complex station models) |
| **GPU** | Integrated Graphics with WebGL 2.0 | Dedicated GPU (NVIDIA GTX 1060+ / AMD RX 580+) |
| **Browser** | Chromium 109+, Firefox 115+, Safari 16+ | Google Chrome or Microsoft Edge (Hardware Acceleration ON) |
| **Node.js** | Node.js 18.x LTS | Node.js 20.x or 22.x LTS (Node 26.x supported) |
| **Game (Optional)** | X4: Foundations (version 6.00 – 9.00+) | Installed via Steam or GOG for raw asset extraction |

---

## 2. Core Environment Setup (Node.js & Vite)

### Step 2.1: Install Node.js & npm

Node.js provides the JavaScript runtime, and npm handles package installation.

#### Option A: Windows Package Manager (`winget`) — Recommended
Open **PowerShell** or **Command Prompt** as Administrator and run:
```powershell
winget install OpenJS.NodeJS.LTS
```

#### Option B: Direct Installer
1. Visit the official download page: [https://nodejs.org/](https://nodejs.org/).
2. Download the **LTS (Long Term Support)** installer.
3. Run the installer, accept the license agreement, and ensure the checkbox **"Add to PATH"** is selected.

#### Option C: Node Version Manager (`nvm-windows`)
If you manage multiple Node versions on your workstation:
```powershell
winget install CoreyButler.NVMforWindows
nvm install 20.18.0
nvm use 20.18.0
```

#### Verification
Restart your terminal and confirm both tools are accessible:
```powershell
node -v
# Expected: v18.x.x, v20.x.x, v22.x.x, or v26.x.x

npm -v
# Expected: 9.x.x, 10.x.x, or 11.x.x
```

> [!TIP]
> **PowerShell Execution Policy Note**:
> If you encounter an error like `File ...\npm.ps1 cannot be loaded because running scripts is disabled on this system`, run:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

---

### Step 2.2: Clone or Open the Repository

Navigate to your working directory:
```powershell
cd D:\Ai\X4\GoogleAntiGravity
```
*(Or your specific cloned project folder).*

---

### Step 2.3: Install Project Dependencies

The project uses modern ECMAScript modules (ESM) managed by Vite and npm. Run:

```powershell
npm install
```

#### What is installed:
- **`vite`** (`^8.1.3` / `^8.2.1`): Blazing fast development server with instant Hot Module Replacement (HMR) and optimized Rollup production bundling.
- **`three`** (`^0.160.0`): Three.js 3D WebGL rendering engine used to load and render station meshes, materials, lighting, cameras, bounding boxes, and raycasting interactions.
- **`tsx`** (`^4.23.1`): Ultra-fast TypeScript & ESM execution tool for running offline Node.js scripts and tests without manual transpilation.

---

### Step 2.4: Running the Local Development Server

To launch the interactive application in development mode:

```powershell
npm run dev
```

- Vite will boot the local server (default configured port is **`http://localhost:3000`** or **`http://localhost:5173`**).
- Vite will automatically open your default browser.
- Changes made to files in `src/`, HTML, or CSS will immediately hot-reload in the browser without dropping WebGL state.

To stop the server, press `Ctrl + C` in the terminal.

---

### Step 2.5: Building for Production

To create a minified, production-ready distribution:

```powershell
npm run build
```

The output bundle is generated in the `dist/` directory.

To preview the production build locally:
```powershell
npm run preview
```

---

## 3. Third-Party Requirements & Asset Pipeline

The 3D Visualizer can run using built-in sample plans and mock geometries, but full visual fidelity requires loose 3D assets extracted from **X4: Foundations**.

### 3.1: Python 3.10+ (For Offline Converters)

Python is required if you plan to run batch converter scripts (`convert_structures.py`, `xmf_converter.py`, `dae_vulkan_compact.py`).

#### Installation:
```powershell
winget install Python.Python.3.12
```
*Alternatively, download from [python.org](https://www.python.org/downloads/) and ensure **"Add python.exe to PATH"** is checked.*

#### Verification:
```powershell
python --version
# Expected: Python 3.10.x, 3.11.x, or 3.12.x
```

---

### 3.2: Egosoft X4 Modding Tools

To extract and convert native Egosoft `.cat`/`.dat` game archives and `.xmf` geometry files into standard `.dae` (Collada) or binary meshes:

1. **XRCatTool (`XRCatTool.exe`)**:
   - Available via Steam under **Library > Tools > X4: Foundations - Modding Tools**, or from the official Egosoft forums.
   - Used to unpack `.cat`/`.dat` archives into loose files.
2. **XR Converters (`XRConvertersMain.exe`)**:
   - Converts native Egosoft binary `.xmf` meshes into standard `.dae` Collada meshes.
   - Typically placed under `XRConverters-v0.2.1/XRConvertersMain.exe` in the game directory or project path.

#### Unpacking Structure Assets Command Example:
```powershell
# Extracting game catalog files into loose assets
XRCatTool.exe -in "C:\SteamLibrary\steamapps\common\X4 Foundations\01.cat" -out "D:\Ai\X4\GoogleAntiGravity\assets"
```

---

### 3.3: Running the Structure Converter Scripts

Once loose assets and converter executables are in place, the included scripts automate batch conversion:

```powershell
# Test converter detection
python xmf_converter.py --help

# Batch convert structure meshes to Collada (.dae)
python convert_structures.py --src-dir "assets/assets/structures" --dest-dir "assets1/structures"
```

---

### 3.4: Blender & Collada Importer (Optional / Modding)

If you wish to view, modify, or debug `.dae` and `.xmf` meshes directly in 3D modeling software:
- **Blender**: Version 3.6 LTS or 4.x ([https://www.blender.org/](https://www.blender.org/)).
- **Collada Importer Add-on**: The repository includes `simple_collada_importer-0.7.2.zip` in the root folder.
  - In Blender: Go to **Edit > Preferences > Add-ons > Install...**
  - Select `simple_collada_importer-0.7.2.zip` and enable the checkbox.

---

## 4. Quick Reference / Cheat Sheet

```powershell
# --- 1. Clone & Enter ---
git clone <repository-url>
cd GoogleAntiGravity

# --- 2. Install Dependencies ---
npm install

# --- 3. Start Dev Server ---
npm run dev

# --- 4. Build Production Bundle ---
npm run build

# --- 5. Run Offline Node Tests ---
npm test # or node test_planar_paranid.js
```

---

## 5. Troubleshooting

### Issue: `Port 3000 is in use`
Vite will automatically try the next available port (e.g. `3001`, `5173`). If you want to specify a custom port:
```powershell
npx vite --port 8080
```

### Issue: `WebGL context lost` or black canvas
- Check that **Hardware Acceleration** is enabled in your browser settings:
  - In Chrome/Edge: Settings > System > *Use graphics acceleration when available* (Toggle ON and relaunch).
- Verify WebGL 2.0 support by visiting: [https://get.webgl.org/webgl2/](https://get.webgl.org/webgl2/).

### Issue: `dae_hash_table.json not found` or mesh 404 errors
- The visualizer maps macro mesh lookups via `dae_hash_table.json`.
- Ensure `dae_hash_table.json` exists in the project root.
- If assets were placed in a custom folder, update the path mapping or run `audit_lod_entries.js`.
