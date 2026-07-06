# X4: Foundations XMF to DAE Converter

This repository provides an automated command-line tool written in Python 3 to convert X4: Foundations `.xmf` (static mesh) files into standard `.dae` (Collada) format for editing in Blender and other 3D modeling programs.

It automates and extends Egosoft's official catalog extractor (`XRCatTool.exe`) and the community's legacy `XRConvertersMain.exe` to enable direct conversion of loose mesh files.

## Features

- **Direct Conversion**: Convert individual `.xmf` files (LODs, wreckages, or collision meshes) directly into `.dae` format.
- **Batch Processing**: Point to a folder to convert all `.xmf` files in it in a single command.
- **Auto-Detection**: Scans default Steam libraries to locate your game directory, `XRConvertersMain.exe`, and `XRCatTool.exe`.
- **Automatic Material Library Extraction**: If the unpacked folder lacks the essential `libraries/material_library.xml`, the tool automatically extracts it using `XRCatTool.exe` from your game catalogs (`01.cat`-`09.cat`).
- **Clean Node Names**: Post-processes generated Collada files to rename standardized `temp_mesh` references back to their original filenames, ensuring clean node structures in Blender.

## Prerequisites

1. **Python 3**: Make sure Python 3.x is installed and in your environment path.
2. **X4: Foundations Game Files**: The game must be installed via Steam.
3. **XRConverters**: The converter package (`XRConverters-v0.2.1` or similar) containing `XRConvertersMain.exe` and `XRConverters.dll` must be present in the game directory (e.g. `C:\SteamLibrary\steamapps\common\X4 Foundations\XRConverters-v0.2.1\`).
4. **Loose Assets**: You must have unpacked the game assets into a loose folder (e.g. using `XRCatTool` or Steam Tools) retaining the `assets/` subfolder structure.

## Usage

Run the converter by passing the path to the file or directory you want to convert.

### Convert a Single File
```bash
python xmf_converter.py "C:\SteamLibrary\steamapps\common\X4FoundationsDAE\assets\structures\dock\dockarea_arg_m_ship_01_data\part_main_wreck-lod0.xmf"
```
The resulting `part_main_wreck-lod0.dae` will be created in the same directory.

### Batch Convert a Folder
```bash
python xmf_converter.py "C:\SteamLibrary\steamapps\common\X4FoundationsDAE\assets\structures\dock\dockarea_arg_m_ship_01_data"
```
This converts every `.xmf` file in the folder to its corresponding `.dae` file in place.

### Custom Paths and Overrides
If your game files or tools are installed in non-standard directories, you can specify them manually:
```bash
python xmf_converter.py "path/to/mesh.xmf" --game-dir "D:\CustomGames\X4" --converter-path "D:\Tools\XRConvertersMain.exe" --cat-tool-path "D:\CustomGames\X4\XRCatTool.exe"
```

## How It Works

1. **Root Detection**: The script walks up the path of the input file to detect the root of your loose assets directory (indicated by the parent of the `assets` folder).
2. **Material Verification**: It checks if `<unpacked_root>/libraries/material_library.xml` exists. If not, it uses `XRCatTool.exe` to extract it from the game catalogs.
3. **XML Wrapping**: Since `XRConvertersMain.exe` can only process meshes with the context of a scene component, the script copies the target `.xmf` to a temporary mesh (`temp_mesh-lod0.xmf`) and dynamically generates a temporary `temp_mesh_comp.xml` referencing it.
4. **Conversion Execution**: It executes the converter to compile the temporary component XML into a `.dae` file.
5. **Node Restoration**: The script parses the output Collada XML and replaces `temp_mesh` with the original asset filename so it imports into Blender with the correct object names.
6. **Cleanup**: Finally, it deletes the temporary `.xmf` copy and the XML wrapper, leaving only your finished `.dae` file.
