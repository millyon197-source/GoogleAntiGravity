#!/usr/bin/env python3
import os
import sys
import argparse
import shutil
import subprocess

# Import functions from our existing converter script
try:
    import xmf_converter
except ImportError:
    # If not in path, add current directory
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import xmf_converter

def main():
    parser = argparse.ArgumentParser(description="Recursive batch XMF to DAE converter and copier for X4 structures.")
    parser.add_argument("--src-dir", default=r"D:\Ai\X4\GoogleAntiGravity\assets\structures", 
                        help="Source structures directory.")
    parser.add_argument("--dest-dir", default=r"D:\Ai\X4\GoogleAntiGravity\assets1\structures", 
                        help="Destination structures directory.")
    parser.add_argument("--all", action="store_true", 
                        help="Convert ALL .xmf files instead of just 'part_main-lod0.xmf'.")
    parser.add_argument("--dry-run", "-n", action="store_true", 
                        help="Perform a dry run (scan and log without converting or copying).")
    parser.add_argument("--game-dir", help="Path to your main 'X4 Foundations' game directory.")
    parser.add_argument("--converter-path", help="Direct path to XRConvertersMain.exe.")
    
    args = parser.parse_args()
    
    src_dir = os.path.abspath(args.src_dir)
    dest_dir = os.path.abspath(args.dest_dir)
    
    if not os.path.isdir(src_dir):
        print(f"[-] Error: Source directory does not exist: {src_dir}")
        sys.exit(1)
        
    print(f"[*] Source directory: {src_dir}")
    print(f"[*] Destination directory: {dest_dir}")
    if args.all:
        print("[*] Target files: All *.xmf files")
    else:
        print("[*] Target files: Only 'part_main-lod0.xmf'")
        
    if args.dry_run:
        print("[*] MODE: DRY RUN (no files will be converted or copied)")
        
    # 1. Resolve converter tools
    converter_exe, _, game_dir = xmf_converter.find_tools(args.game_dir)
    if args.converter_path:
        converter_exe = os.path.abspath(args.converter_path)
        
    if not args.dry_run:
        if not converter_exe or not os.path.isfile(converter_exe):
            print("[-] Error: XRConvertersMain.exe not found. Please provide it via --converter-path or --game-dir.")
            sys.exit(1)
        print(f"[+] Found XRConvertersMain: {converter_exe}")
        
    # 2. Determine loose assets root for material library checks
    unpacked_root = xmf_converter.find_unpacked_root(src_dir)
    if not unpacked_root:
        # Fallback to the parent of the assets folder if not found directly
        current = src_dir
        while True:
            parent = os.path.dirname(current)
            if parent == current:
                break
            if os.path.basename(current).lower() == 'assets':
                unpacked_root = parent
                break
            current = parent
            
    if not unpacked_root:
        # Fallback to current directory of script
        unpacked_root = os.path.dirname(os.path.abspath(__file__))
        
    print(f"[+] Identified Unpacked Assets Root: {unpacked_root}")
    
    # Check material library if not dry run
    if not args.dry_run:
        mat_lib_path = os.path.join(unpacked_root, "libraries", "material_library.xml")
        if not os.path.isfile(mat_lib_path):
            print(f"[-] libraries/material_library.xml is missing at: {mat_lib_path}")
            # Try to locate cat tool and game dir to extract it
            _, cat_tool_exe, game_dir_resolved = xmf_converter.find_tools(args.game_dir)
            if cat_tool_exe and game_dir_resolved:
                extracted = xmf_converter.extract_material_library(cat_tool_exe, game_dir_resolved, unpacked_root)
                if not extracted:
                    print("[-] Error: Material library extraction failed.")
                    sys.exit(1)
            else:
                print("[-] Error: Cannot extract material library because game directory or catalog tool was not found.")
                sys.exit(1)
        else:
            print("[+] material_library.xml is present.")

    # 3. Scan directory recursively
    print("[*] Scanning directory recursively...")
    xmf_files = []
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            if f.lower().endswith(".xmf"):
                if args.all or f.lower() == "part_main-lod0.xmf":
                    xmf_files.append(os.path.join(root, f))
                    
    print(f"[+] Found {len(xmf_files)} target XMF file(s).")
    
    # 4. Process each file
    to_convert = []
    skipped_existing = 0
    
    for xmf_path in xmf_files:
        base_dir = os.path.dirname(xmf_path)
        base_name = os.path.splitext(os.path.basename(xmf_path))[0]
        dae_name = f"{base_name}.dae"
        dae_path = os.path.join(base_dir, dae_name)
        
        # Check if DAE already exists in the source folder
        if os.path.isfile(dae_path):
            skipped_existing += 1
        else:
            to_convert.append(xmf_path)
            
    print(f"[+] Already converted (DAE present in source): {skipped_existing}")
    print(f"[+] Need to convert: {len(to_convert)}")
    
    if len(to_convert) == 0:
        print("[+] All files are already converted. Nothing to do!")
        sys.exit(0)
        
    succeeded = 0
    failed = 0
    copied = 0
    
    for i, xmf_path in enumerate(to_convert, 1):
        rel_path = os.path.relpath(xmf_path, src_dir)
        rel_dir = os.path.dirname(rel_path)
        base_name = os.path.splitext(os.path.basename(xmf_path))[0]
        dae_name = f"{base_name}.dae"
        
        src_dae_path = os.path.join(os.path.dirname(xmf_path), dae_name)
        dest_dae_path = os.path.join(dest_dir, rel_dir, dae_name)
        
        print(f"[{i}/{len(to_convert)}] Processing: {rel_path}")
        
        if args.dry_run:
            succeeded += 1
            copied += 1
            continue
            
        # Convert single file
        # Note: xmf_converter.convert_single_file copies the file to temp_mesh-lod0.xmf in place,
        # generates a wrapper XML, runs the converter, renames the output to dae_path, and cleans up.
        success = xmf_converter.convert_single_file(xmf_path, converter_exe, unpacked_root)
        
        if success:
            succeeded += 1
            # Copy to destination folder maintaining directory structure
            try:
                os.makedirs(os.path.dirname(dest_dae_path), exist_ok=True)
                shutil.copy2(src_dae_path, dest_dae_path)
                copied += 1
                print(f"    [+] Copied to: {dest_dae_path}")
            except Exception as e:
                print(f"    [-] Error copying generated DAE to destination: {e}")
        else:
            failed += 1
            print(f"    [-] Conversion failed for: {xmf_path}")
            
    # Print final summary
    print("\n--- Summary ---")
    print(f"Total target files: {len(xmf_files)}")
    print(f"Skipped (already converted): {skipped_existing}")
    print(f"Attempted conversion: {len(to_convert)}")
    print(f"Successful conversions: {succeeded}")
    print(f"Failed conversions: {failed}")
    print(f"Copied to destination folder: {copied}")
    
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
