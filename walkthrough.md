# Walkthrough - Batch conversion and recursive copy of assets

I have completed the batch conversion of `.xmf` geometry files to `.dae` format and copied them under the new `assets1` directory while maintaining the original directory structure.

## Actions Taken

1. **Found Source Files**: Located **379** `part_main-lod0.xmf` files recursively under the [assets/structures/](file:///d:/Ai/X4/GoogleAntiGravity/assets/structures) directory.
2. **Batch Conversion**: 
   - Invoked `xmf_converter.py` for each file to produce a matching `.dae` mesh file in the same directory.
   - The script successfully interfaced with the catalog extractor (`XRCatTool.exe`) to pull the required `material_library.xml` configuration, then ran the game-compatible mesh importer (`XRConvertersMain.exe`).
3. **Directory Structure Copy**:
   - Recreated matching subdirectory trees under [assets1/structures/](file:///d:/Ai/X4/GoogleAntiGravity/assets1/structures).
   - Transferred the converted `part_main-lod0.dae` files to their respective target paths.
4. **Verification**: Confirmed that exactly **379** files named `part_main-lod0.dae` were successfully created and copied.
