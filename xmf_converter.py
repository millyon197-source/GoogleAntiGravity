#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
import shutil
import re

DEFAULT_STEAM_PATHS = [
    r"C:\SteamLibrary\steamapps\common\X4 Foundations",
    r"C:\Program Files (x86)\Steam\steamapps\common\X4 Foundations",
    r"D:\SteamLibrary\steamapps\common\X4 Foundations",
    r"E:\SteamLibrary\steamapps\common\X4 Foundations"
]

def find_tools(game_dir=None):
    """Detect paths to XRConvertersMain.exe and XRCatTool.exe."""
    converter_exe = None
    cat_tool_exe = None
    detected_game_dir = None

    # Check potential game directories
    search_dirs = []
    if game_dir:
        search_dirs.append(os.path.abspath(game_dir))
    search_dirs.extend(DEFAULT_STEAM_PATHS)

    for d in search_dirs:
        if os.path.isdir(d):
            # Check for XRCatTool
            possible_cat_tool = os.path.join(d, "XRCatTool.exe")
            if os.path.isfile(possible_cat_tool):
                cat_tool_exe = possible_cat_tool
                detected_game_dir = d
            
            # Check for XRConvertersMain.exe
            converter_dir = os.path.join(d, "XRConverters-v0.2.1")
            possible_converter = os.path.join(converter_dir, "XRConvertersMain.exe")
            if os.path.isfile(possible_converter):
                converter_exe = possible_converter
                if not detected_game_dir:
                    detected_game_dir = d
            else:
                # Look for other XRConverters folders in game directory
                for item in os.listdir(d):
                    if item.lower().startswith("xrconverters") and os.path.isdir(os.path.join(d, item)):
                        possible_conv = os.path.join(d, item, "XRConvertersMain.exe")
                        if os.path.isfile(possible_conv):
                            converter_exe = possible_conv
                            if not detected_game_dir:
                                detected_game_dir = d
                            break
        if converter_exe and cat_tool_exe:
            break

    return converter_exe, cat_tool_exe, detected_game_dir

def find_unpacked_root(path):
    """Walk up parent folders to locate the root containing 'assets'."""
    current = os.path.abspath(path)
    if os.path.isfile(current):
        current = os.path.dirname(current)
    
    while True:
        parent = os.path.dirname(current)
        if parent == current:
            break
        if os.path.basename(current).lower() == 'assets':
            return parent
        current = parent
    return None

def extract_material_library(cat_tool, game_dir, unpacked_root):
    """Extract material_library.xml from game catalogs if missing."""
    print("[*] Extracting libraries/material_library.xml from catalog files...")
    
    # Collect available catalog files (01.cat to 09.cat)
    cats = []
    for i in range(1, 10):
        cat_file = os.path.join(game_dir, f"{i:02d}.cat")
        if os.path.isfile(cat_file):
            cats.append(cat_file)
            
    if not cats:
        print("[-] Error: No catalog files found in game directory:", game_dir)
        return False

    cmd = [cat_tool] + ["-in"] + cats + ["-out", unpacked_root, "-include", "^libraries/material_library\\.xml$"]
    print(f"[*] Running command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print("[+] Catalog tool output:")
        print(result.stdout)
        
        target_path = os.path.join(unpacked_root, "libraries", "material_library.xml")
        if os.path.isfile(target_path):
            print("[+] Successfully extracted material library!")
            return True
        else:
            print("[-] Error: Catalog tool completed but material_library.xml was not created at:", target_path)
            return False
    except subprocess.CalledProcessError as e:
        print("[-] Error running Catalog Tool:")
        print(e.stderr)
        return False

def convert_single_file(xmf_path, converter_exe, unpacked_root):
    """Convert a single XMF file to DAE in the same folder."""
    xmf_path = os.path.abspath(xmf_path)
    if not os.path.isfile(xmf_path):
        print(f"[-] Error: File not found: {xmf_path}")
        return False

    data_dir = os.path.dirname(xmf_path)
    base_name = os.path.splitext(os.path.basename(xmf_path))[0]
    dest_dae_path = os.path.join(data_dir, f"{base_name}.dae")

    print(f"[*] Starting conversion for: {base_name}.xmf")

    # Determine parent directory for temporary XML wrapper
    parent_dir = os.path.dirname(data_dir)
    rel_geometry_path = os.path.relpath(data_dir, unpacked_root)

    # 1. Copy source XMF file to temporary name 'temp_mesh-lod0.xmf' in the data directory
    temp_xmf_name = "temp_mesh-lod0.xmf"
    temp_xmf_path = os.path.join(data_dir, temp_xmf_name)
    shutil.copy2(xmf_path, temp_xmf_path)

    # 2. Write temporary XML wrapper file in the parent folder
    temp_xml_name = "temp_mesh_comp.xml"
    temp_xml_path = os.path.join(parent_dir, temp_xml_name)
    
    # Format paths with forward slashes for the XML
    xml_geom_path = rel_geometry_path.replace('\\', '/')
    
    xml_content = f"""<?xml version="1.0"?>
<components>
	<component name="temp_mesh_comp" class="dockarea">
		<source geometry="{xml_geom_path}"/>
		<connections>
			<connection name="Connection_temp" tags="part">
				<parts>
					<part name="temp_mesh">
						<lods>
							<lod index="0">
								<materials>
									<material id="1" ref="generic.generic_p1_hullpattern"/>
								</materials>
							</lod>
						</lods>
					</part>
				</parts>
			</connection>
		</connections>
	</component>
</components>
"""
    with open(temp_xml_path, 'w', encoding='utf-8') as f:
        f.write(xml_content)

    # 3. Invoke the converter
    cmd = [converter_exe, "importxmf", unpacked_root, temp_xml_path]
    converter_working_dir = os.path.dirname(converter_exe)
    
    success = False
    try:
        # Run process in its own folder to ensure DLLs load correctly
        result = subprocess.run(cmd, cwd=converter_working_dir, capture_output=True, text=True)
        if result.returncode == 0:
            gen_dae_path = os.path.join(parent_dir, "temp_mesh_comp.dae")
            if os.path.isfile(gen_dae_path):
                # 4. Post-process: rename node names inside DAE XML
                with open(gen_dae_path, 'r', encoding='utf-8') as f:
                    dae_content = f.read()

                # Clean up "temp_mesh" strings in XML with the original base_name
                dae_content = dae_content.replace("temp_mesh", base_name)

                with open(dest_dae_path, 'w', encoding='utf-8') as f:
                    f.write(dae_content)
                
                print(f"[+] Successfully converted to: {dest_dae_path}")
                success = True
            else:
                print("[-] Error: Converter returned 0 but no output DAE was found.")
                if result.stdout:
                    print("Stdout:", result.stdout)
                if result.stderr:
                    print("Stderr:", result.stderr)
        else:
            print(f"[-] Converter exited with code {result.returncode}")
            if result.stdout:
                print("Stdout:", result.stdout)
            if result.stderr:
                print("Stderr:", result.stderr)
    except Exception as e:
        print(f"[-] Exception during conversion: {e}")
    finally:
        # 5. Cleanup temporary files
        if os.path.exists(temp_xmf_path):
            os.remove(temp_xmf_path)
        if os.path.exists(temp_xml_path):
            os.remove(temp_xml_path)
        gen_dae_path = os.path.join(parent_dir, "temp_mesh_comp.dae")
        if os.path.exists(gen_dae_path):
            os.remove(gen_dae_path)
            
    return success

def main():
    parser = argparse.ArgumentParser(description="X4: Foundations XMF to DAE static mesh converter.")
    parser.add_argument("path", help="Path to a single .xmf file, or a directory containing .xmf files to convert.")
    parser.add_argument("--game-dir", help="Path to your main 'X4 Foundations' game directory.")
    parser.add_argument("--converter-path", help="Direct path to XRConvertersMain.exe.")
    parser.add_argument("--cat-tool-path", help="Direct path to XRCatTool.exe.")
    
    args = parser.parse_args()
    
    input_path = os.path.abspath(args.path)
    if not os.path.exists(input_path):
        print(f"[-] Error: Input path does not exist: {input_path}")
        sys.exit(1)

    # 1. Resolve converter and catalog tools
    converter_exe, cat_tool_exe, game_dir = find_tools(args.game_dir)
    
    if args.converter_path:
        converter_exe = os.path.abspath(args.converter_path)
    if args.cat_tool_path:
        cat_tool_exe = os.path.abspath(args.cat_tool_path)
        
    if not converter_exe or not os.path.isfile(converter_exe):
        print("[-] Error: XRConvertersMain.exe not found. Please provide it via --converter-path.")
        sys.exit(1)
        
    print(f"[+] Found XRConvertersMain: {converter_exe}")
    if cat_tool_exe:
        print(f"[+] Found XRCatTool: {cat_tool_exe}")
    if game_dir:
        print(f"[+] Found Game Directory: {game_dir}")

    # 2. Find unpacked assets root
    unpacked_root = find_unpacked_root(input_path)
    if not unpacked_root:
        print("[-] Error: Could not determine loose assets root folder (needs an 'assets' parent directory).")
        sys.exit(1)
    print(f"[+] Identified Unpacked Assets Root: {unpacked_root}")

    # 3. Ensure material library is available
    mat_lib_path = os.path.join(unpacked_root, "libraries", "material_library.xml")
    if not os.path.isfile(mat_lib_path):
        print("[-] libraries/material_library.xml is missing in unpacked assets folder.")
        if not cat_tool_exe or not game_dir:
            print("[-] Error: Cannot extract material library because game_dir or XRCatTool was not found.")
            print("    Please provide --game-dir pointing to your 'X4 Foundations' folder containing .cat files.")
            sys.exit(1)
        extracted = extract_material_library(cat_tool_exe, game_dir, unpacked_root)
        if not extracted:
            print("[-] Error: Material library extraction failed. Conversion cannot proceed.")
            sys.exit(1)
    else:
        print("[+] material_library.xml is present.")

    # 4. Perform conversions
    if os.path.isfile(input_path):
        if not input_path.lower().endswith(".xmf"):
            print("[-] Error: Input file must have .xmf extension.")
            sys.exit(1)
        success = convert_single_file(input_path, converter_exe, unpacked_root)
        sys.exit(0 if success else 1)
    else:
        # It's a directory, batch convert all .xmf files
        xmf_files = [os.path.join(input_path, f) for f in os.listdir(input_path) if f.lower().endswith(".xmf")]
        if not xmf_files:
            print(f"[-] No .xmf files found in folder: {input_path}")
            sys.exit(0)
            
        print(f"[*] Found {len(xmf_files)} .xmf file(s) to convert.")
        succeeded = 0
        for f in xmf_files:
            if convert_single_file(f, converter_exe, unpacked_root):
                succeeded += 1
                
        print(f"[+] Batch conversion finished: {succeeded}/{len(xmf_files)} file(s) converted successfully.")
        sys.exit(0 if succeeded == len(xmf_files) else 1)

if __name__ == "__main__":
    main()
