#!/usr/bin/env python3
import os
import sys
import xml.etree.ElementTree as ET
import glob
import shutil

try:
    import xmf_converter
except ImportError:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import xmf_converter

def main():
    xml_root = r"C:\SteamLibrary\steamapps\common\X4 Foundations\assets\EgosoftBlenderModTools_v0.7.0\p1data\assets\01_cat\assets\structures"
    workspace_root_dir = r"D:\Ai\X4\GoogleAntiGravity\assets\structures"
    dest_root_dir = r"D:\Ai\X4\GoogleAntiGravity\assets1\structures"
    
    if not os.path.isdir(xml_root):
        print(f"[-] Error: XML source directory not found: {xml_root}")
        sys.exit(1)
        
    # Find tools
    converter_exe, _, game_dir = xmf_converter.find_tools()
    if not converter_exe or not os.path.isfile(converter_exe):
        print("[-] Error: XRConvertersMain.exe not found.")
        sys.exit(1)
        
    unpacked_root = r"D:\Ai\X4\GoogleAntiGravity"
    
    print(f"[*] Converter EXE: {converter_exe}")
    print(f"[*] Unpacked root: {unpacked_root}")
    
    subdirs = [d for d in os.listdir(xml_root) if os.path.isdir(os.path.join(xml_root, d)) and d.lower() != 'macros']
    to_convert = []
    
    print("[*] Scanning XML files to determine all missing DAE files...")
    for subdir in subdirs:
        xml_dir = os.path.join(xml_root, subdir)
        workspace_dir = os.path.join(workspace_root_dir, subdir)
        
        if not os.path.isdir(workspace_dir):
            continue
            
        xml_files = glob.glob(os.path.join(xml_dir, "*.xml"))
        for xml_file in xml_files:
            comp_name = os.path.splitext(os.path.basename(xml_file))[0]
            data_dir_name = f"{comp_name}_data"
            dest_data_dir = os.path.join(workspace_dir, data_dir_name)
            
            # Case insensitive directory match
            if os.path.isdir(workspace_dir):
                subdirs_ws = [d for d in os.listdir(workspace_dir) if os.path.isdir(os.path.join(workspace_dir, d))]
                matching = [d for d in subdirs_ws if d.lower() == data_dir_name.lower()]
                if matching:
                    dest_data_dir = os.path.join(workspace_dir, matching[0])
                else:
                    continue
                    
            try:
                tree = ET.parse(xml_file)
                root = tree.getroot()
                
                parts = root.findall(".//part")
                for part in parts:
                    part_name = part.attrib.get("name")
                    if not part_name:
                        continue
                        
                    lod0 = part.find(".//lod[@index='0']")
                    if lod0 is not None:
                        xmf_name = f"{part_name}-lod0.xmf"
                        dae_name = f"{part_name}-lod0.dae"
                        
                        # Case insensitive file check
                        actual_xmf_name = None
                        if os.path.isdir(dest_data_dir):
                            for f in os.listdir(dest_data_dir):
                                if f.lower() == xmf_name.lower():
                                    actual_xmf_name = f
                                    break
                                    
                        if actual_xmf_name:
                            # Check if DAE exists in source folder
                            actual_dae_name = None
                            for f in os.listdir(dest_data_dir):
                                if f.lower() == dae_name.lower():
                                    actual_dae_name = f
                                    break
                                    
                            if not actual_dae_name:
                                to_convert.append({
                                    "subdir": subdir,
                                    "component": comp_name,
                                    "part": part_name,
                                    "xmf_path": os.path.join(dest_data_dir, actual_xmf_name),
                                    "dae_name": dae_name,
                                    "src_dir": dest_data_dir,
                                    "rel_dir": os.path.basename(dest_data_dir)
                                })
            except Exception as e:
                print(f"[-] Error parsing {xml_file}: {e}")
                
    print(f"[+] Found {len(to_convert)} total missing DAE(s) to convert.")
    
    if len(to_convert) == 0:
        print("[+] All additional DAEs are already converted and present.")
        sys.exit(0)
        
    # Execute conversion
    succeeded = 0
    failed = 0
    copied = 0
    
    for i, item in enumerate(to_convert, 1):
        xmf_path = item["xmf_path"]
        dae_name = item["dae_name"]
        src_dir = item["src_dir"]
        rel_dir = item["rel_dir"]
        subdir = item["subdir"]
        
        src_dae_path = os.path.join(src_dir, dae_name)
        dest_dae_path = os.path.join(dest_root_dir, subdir, rel_dir, dae_name)
        
        print(f"[{i}/{len(to_convert)}] Converting [{subdir}]: {item['component']} -> {dae_name}")
        
        success = xmf_converter.convert_single_file(xmf_path, converter_exe, unpacked_root)
        if success:
            succeeded += 1
            # Copy to assets1/structures/<category>/...
            try:
                os.makedirs(os.path.dirname(dest_dae_path), exist_ok=True)
                shutil.copy2(src_dae_path, dest_dae_path)
                copied += 1
                print(f"    [+] Copied to: {dest_dae_path}")
            except Exception as e:
                print(f"    [-] Error copying to dest: {e}")
        else:
            failed += 1
            print(f"    [-] Conversion failed for {xmf_path}")
            
    print("\n--- Summary ---")
    print(f"Attempted: {len(to_convert)}")
    print(f"Succeeded: {succeeded}")
    print(f"Failed: {failed}")
    print(f"Copied to assets1: {copied}")
    
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
