#!/usr/bin/env python3
"""
Offline Vulkan-Aligned Compaction Tool for Collada (.dae) Meshes.

Converts .dae files into an Interleaved Binary Blob (.bin) matching Vulkan's
VkVertexInputBindingDescription and VkVertexInputAttributeDescription.

Vertex Layout (32 bytes total, 4-byte aligned):
  - Position: Float32 x 3 (X, Y, Z)     [Offset 0,  12 bytes]
  - Normal:   Float32 x 3 (Nx, Ny, Nz)  [Offset 12, 12 bytes]
  - UV:       Float32 x 2 (U, V)        [Offset 24, 8 bytes]

Unified Index Buffer:
  - Uint16Array (if vertex count <= 65535) or Uint32Array (otherwise).
"""

import os
import sys
import struct
import json
import argparse
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple, Optional, Any

# Binary Header Constants
MAGIC_BYTES = b"VKDA"  # 4 bytes magic: Vulkan DAE
HEADER_VERSION = 1
HEADER_FORMAT = "<4sIIIIIII"  # Magic, Version, VertexCount, Stride, IndexCount, IndexType, VertexOffset, IndexOffset
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)  # 32 bytes

INDEX_TYPE_UINT16 = 0
INDEX_TYPE_UINT32 = 1


def strip_namespaces(elem: ET.Element) -> None:
    """Recursively strip XML namespaces for simplified element access."""
    for child in elem.iter():
        if "}" in child.tag:
            child.tag = child.tag.split("}", 1)[1]


def parse_float_array(source_elem: ET.Element) -> List[float]:
    """Extract float array from a Collada <source> element."""
    float_array_elem = source_elem.find("float_array")
    if float_array_elem is not None and float_array_elem.text:
        return [float(x) for x in float_array_elem.text.split()]
    return []


def parse_int_array(text: str) -> List[int]:
    """Parse space-separated integer string."""
    if not text:
        return []
    return [int(x) for x in text.split()]


def compact_dae_mesh(dae_path: str) -> Tuple[bytes, Dict[str, Any]]:
    """
    Parses a Collada .dae file, collapses per-attribute index streams into a unified index stream,
    interleaves vertex attributes into a 32-byte stride layout (X,Y,Z, Nx,Ny,Nz, U,V),
    and generates Vulkan binary blob data & metadata.
    """
    tree = ET.parse(dae_path)
    root = tree.getroot()
    strip_namespaces(root)

    # Collect all sources by ID
    sources: Dict[str, List[float]] = {}
    for source in root.findall(".//source"):
        sid = source.attrib.get("id")
        if sid:
            sources[sid] = parse_float_array(source)

    # Collect <vertices> definitions mapping semantic -> source_id
    # e.g. vertices_map["meshId0-vertices"] = {"POSITION": "meshId0-positions", "NORMAL": "meshId0-normals", ...}
    vertices_map: Dict[str, Dict[str, str]] = {}
    for vertices in root.findall(".//vertices"):
        vid = vertices.attrib.get("id")
        if vid:
            v_inputs = {}
            for inp in vertices.findall("./input"):
                sem = inp.attrib.get("semantic")
                src_id = inp.attrib.get("source", "").lstrip("#")
                if sem and src_id:
                    # If first time or primary
                    if sem not in v_inputs:
                        v_inputs[sem] = src_id
            vertices_map[vid] = v_inputs

    unique_vertex_map: Dict[Tuple[str, int, int, int], int] = {}
    interleaved_vertices: List[float] = []
    unified_indices: List[int] = []

    min_bounds = [float("inf"), float("inf"), float("inf")]
    max_bounds = [float("-inf"), float("-inf"), float("-inf")]

    # Find all geometries
    geometries = root.findall(".//geometry")
    if not geometries:
        # Fallback: search root for primitives directly if no <geometry>
        geometries = [root]

    for geom in geometries:
        mesh = geom.find("mesh")
        if mesh is None and geom.tag != "COLLADA":
            continue

        search_root = mesh if mesh is not None else geom

        # Find primitive sets (<triangles> or <polylist>)
        primitives = search_root.findall("./triangles") + search_root.findall("./polylist")

        for prim in primitives:
            inputs = prim.findall("./input")
            if not inputs:
                continue

            stride = max(int(inp.attrib.get("offset", 0)) for inp in inputs) + 1

            pos_offset: Optional[int] = None
            norm_offset: Optional[int] = None
            uv_offset: Optional[int] = None

            pos_src_id: Optional[str] = None
            norm_src_id: Optional[str] = None
            uv_src_id: Optional[str] = None

            for inp in inputs:
                semantic = inp.attrib.get("semantic")
                offset = int(inp.attrib.get("offset", 0))
                src_id = inp.attrib.get("source", "").lstrip("#")

                if semantic == "VERTEX":
                    v_dict = vertices_map.get(src_id, {})
                    if "POSITION" in v_dict and pos_offset is None:
                        pos_offset = offset
                        pos_src_id = v_dict["POSITION"]
                    if "NORMAL" in v_dict and norm_offset is None:
                        norm_offset = offset
                        norm_src_id = v_dict["NORMAL"]
                    if "TEXCOORD" in v_dict and uv_offset is None:
                        uv_offset = offset
                        uv_src_id = v_dict["TEXCOORD"]

                elif semantic == "POSITION" and pos_offset is None:
                    pos_offset = offset
                    pos_src_id = src_id
                elif semantic == "NORMAL" and norm_offset is None:
                    norm_offset = offset
                    norm_src_id = src_id
                elif semantic == "TEXCOORD" and uv_offset is None:
                    uv_offset = offset
                    uv_src_id = src_id

            pos_src = sources.get(pos_src_id, []) if pos_src_id else []
            norm_src = sources.get(norm_src_id, []) if norm_src_id else []
            uv_src = sources.get(uv_src_id, []) if uv_src_id else []

            p_elem = prim.find("p")
            if p_elem is None or not p_elem.text:
                continue

            raw_indices = parse_int_array(p_elem.text)

            # Handle polygon counts if polylist
            vcount_elem = prim.find("vcount")
            vertex_counts: List[int] = []
            if vcount_elem is not None and vcount_elem.text:
                vertex_counts = parse_int_array(vcount_elem.text)

            # Build list of polygon vertex tuples
            poly_vertices: List[List[Tuple[int, int, int]]] = []
            idx_cursor = 0

            if vertex_counts:
                for count in vertex_counts:
                    poly_verts = []
                    for _ in range(count):
                        p_idx = raw_indices[idx_cursor + pos_offset] if pos_offset is not None else 0
                        n_idx = raw_indices[idx_cursor + norm_offset] if norm_offset is not None else -1
                        u_idx = raw_indices[idx_cursor + uv_offset] if uv_offset is not None else -1
                        poly_verts.append((p_idx, n_idx, u_idx))
                        idx_cursor += stride
                    poly_vertices.append(poly_verts)
            else:
                # Triangles element (3 vertices per primitive)
                num_verts = len(raw_indices) // stride
                for i in range(0, num_verts, 3):
                    tri = []
                    for j in range(3):
                        cur_idx = (i + j) * stride
                        p_idx = raw_indices[cur_idx + pos_offset] if pos_offset is not None else 0
                        n_idx = raw_indices[cur_idx + norm_offset] if norm_offset is not None else -1
                        u_idx = raw_indices[cur_idx + uv_offset] if uv_offset is not None else -1
                        tri.append((p_idx, n_idx, u_idx))
                    poly_vertices.append(tri)

            # Fan triangulation & vertex attribute extraction
            geom_id = geom.attrib.get("id", "default")
            for poly in poly_vertices:
                if len(poly) < 3:
                    continue
                triangles = [(poly[0], poly[i], poly[i + 1]) for i in range(1, len(poly) - 1)]
                for tri in triangles:
                    for vert_key in tri:
                        full_key = (geom_id, vert_key[0], vert_key[1], vert_key[2])

                        if full_key in unique_vertex_map:
                            unified_indices.append(unique_vertex_map[full_key])
                        else:
                            new_idx = len(unique_vertex_map)
                            unique_vertex_map[full_key] = new_idx
                            unified_indices.append(new_idx)

                            p_idx, n_idx, u_idx = vert_key

                            # Extract Position (x, y, z)
                            px = pos_src[p_idx * 3] if p_idx * 3 < len(pos_src) else 0.0
                            py = pos_src[p_idx * 3 + 1] if p_idx * 3 + 1 < len(pos_src) else 0.0
                            pz = pos_src[p_idx * 3 + 2] if p_idx * 3 + 2 < len(pos_src) else 0.0

                            # Update Bounding Box
                            min_bounds[0] = min(min_bounds[0], px)
                            min_bounds[1] = min(min_bounds[1], py)
                            min_bounds[2] = min(min_bounds[2], pz)
                            max_bounds[0] = max(max_bounds[0], px)
                            max_bounds[1] = max(max_bounds[1], py)
                            max_bounds[2] = max(max_bounds[2], pz)

                            # Extract Normal (nx, ny, nz)
                            if n_idx >= 0 and n_idx * 3 + 2 < len(norm_src):
                                nx = norm_src[n_idx * 3]
                                ny = norm_src[n_idx * 3 + 1]
                                nz = norm_src[n_idx * 3 + 2]
                            else:
                                nx, ny, nz = 0.0, 0.0, 1.0

                            # Extract UV (u, v)
                            if u_idx >= 0 and u_idx * 2 + 1 < len(uv_src):
                                u = uv_src[u_idx * 2]
                                v = uv_src[u_idx * 2 + 1]
                            else:
                                u, v = 0.0, 0.0

                            # Interleave: 8 Floats (32 bytes)
                            interleaved_vertices.extend([px, py, pz, nx, ny, nz, u, v])

    vertex_count = len(unique_vertex_map)
    index_count = len(unified_indices)
    vertex_stride = 32  # 8 floats x 4 bytes = 32 bytes

    # Verify Vulkan 4-Byte Alignment Rule
    assert vertex_stride % 4 == 0, f"Vertex stride ({vertex_stride}) must be a multiple of 4 bytes."

    # Determine Index Type (Uint16 or Uint32)
    use_uint16 = vertex_count <= 65535
    index_type = INDEX_TYPE_UINT16 if use_uint16 else INDEX_TYPE_UINT32
    index_fmt = "<H" if use_uint16 else "<I"
    index_size = 2 if use_uint16 else 4

    vertex_buffer_offset = HEADER_SIZE
    vertex_data_size = vertex_count * vertex_stride
    index_buffer_offset = vertex_buffer_offset + vertex_data_size

    # Build Binary Header (32 bytes)
    header_bytes = struct.pack(
        HEADER_FORMAT,
        MAGIC_BYTES,
        HEADER_VERSION,
        vertex_count,
        vertex_stride,
        index_count,
        index_type,
        vertex_buffer_offset,
        index_buffer_offset,
    )

    # Build Vertex Payload
    vertex_payload = struct.pack(f"<{len(interleaved_vertices)}f", *interleaved_vertices)

    # Build Index Payload
    index_payload = struct.pack(f"<{len(unified_indices)}{'H' if use_uint16 else 'I'}", *unified_indices)

    binary_blob = header_bytes + vertex_payload + index_payload

    # Create Sidecar JSON Metadata with Vulkan descriptors
    if min_bounds[0] == float("inf"):
        min_bounds = [0.0, 0.0, 0.0]
        max_bounds = [0.0, 0.0, 0.0]

    metadata = {
        "asset": os.path.basename(dae_path),
        "vertexCount": vertex_count,
        "vertexStrideBytes": vertex_stride,
        "indexCount": index_count,
        "indexType": "VK_INDEX_TYPE_UINT16" if use_uint16 else "VK_INDEX_TYPE_UINT32",
        "indexByteSize": index_size,
        "alignmentBytes": 4,
        "boundingBox": {"min": min_bounds, "max": max_bounds},
        "vulkanBindings": [
            {
                "binding": 0,
                "stride": vertex_stride,
                "inputRate": "VK_VERTEX_INPUT_RATE_VERTEX",
            }
        ],
        "vulkanAttributes": [
            {
                "location": 0,
                "binding": 0,
                "format": "VK_FORMAT_R32G32B32_SFLOAT",
                "offset": 0,
                "description": "Position (X, Y, Z)",
            },
            {
                "location": 1,
                "binding": 0,
                "format": "VK_FORMAT_R32G32B32_SFLOAT",
                "offset": 12,
                "description": "Normal (Nx, Ny, Nz)",
            },
            {
                "location": 2,
                "binding": 0,
                "format": "VK_FORMAT_R32G32_SFLOAT",
                "offset": 24,
                "description": "UV (U, V)",
            },
        ],
    }

    return binary_blob, metadata


def verify_binary_blob(bin_path: str, json_path: Optional[str] = None) -> bool:
    """Verifies a generated Vulkan .bin blob against format rules."""
    if not os.path.isfile(bin_path):
        print(f"[-] Error: File not found: {bin_path}")
        return False

    with open(bin_path, "rb") as f:
        data = f.read()

    if len(data) < HEADER_SIZE:
        print("[-] Verification failed: File smaller than 32-byte header.")
        return False

    magic, version, v_count, v_stride, i_count, i_type, v_offset, i_offset = struct.unpack(
        HEADER_FORMAT, data[:HEADER_SIZE]
    )

    print(f"[*] Verifying {os.path.basename(bin_path)}:")
    print(f"    Magic: {magic.decode('ascii', errors='ignore')}")
    print(f"    Format Version: {version}")
    print(f"    Vertex Count: {v_count}")
    print(f"    Vertex Stride: {v_stride} bytes (4-byte aligned: {v_stride % 4 == 0})")
    print(f"    Index Count: {i_count}")
    print(f"    Index Type: {'UINT16' if i_type == INDEX_TYPE_UINT16 else 'UINT32'}")
    print(f"    Vertex Offset: {v_offset}, Index Offset: {i_offset}")

    if magic != MAGIC_BYTES:
        print("[-] Verification failed: Invalid magic bytes.")
        return False

    if v_stride % 4 != 0:
        print("[-] Verification failed: Vertex stride is not 4-byte aligned.")
        return False

    index_elem_size = 2 if i_type == INDEX_TYPE_UINT16 else 4
    expected_size = HEADER_SIZE + (v_count * v_stride) + (i_count * index_elem_size)

    if len(data) != expected_size:
        print(f"[-] Verification failed: File size ({len(data)}) != expected size ({expected_size}).")
        return False

    print("[+] Binary blob verification SUCCESSFUL! Fully Vulkan aligned.")
    return True


def convert_file(dae_path: str, output_dir: Optional[str] = None) -> bool:
    """Converts a single .dae file to Vulkan-aligned .bin and .json sidecar."""
    dae_path = os.path.abspath(dae_path)
    if not os.path.isfile(dae_path):
        print(f"[-] Error: Input file does not exist: {dae_path}")
        return False

    target_dir = output_dir if output_dir else os.path.dirname(dae_path)
    os.makedirs(target_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(dae_path))[0]
    bin_path = os.path.join(target_dir, f"{base_name}.bin")
    json_path = os.path.join(target_dir, f"{base_name}.json")

    print(f"[*] Processing: {dae_path}")
    try:
        bin_blob, metadata = compact_dae_mesh(dae_path)

        with open(bin_path, "wb") as f:
            f.write(bin_blob)

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        print(f"[+] Output .bin: {bin_path} ({len(bin_blob)} bytes)")
        print(f"[+] Output .json: {json_path}")
        print(f"    Vertices: {metadata['vertexCount']}, Indices: {metadata['indexCount']}, Index Format: {metadata['indexType']}")
        return True
    except Exception as e:
        print(f"[-] Failed to convert {dae_path}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Offline Vulkan-Aligned Compaction Tool for Collada (.dae) files."
    )
    parser.add_argument("input_path", help="Path to input .dae file or directory of .dae files.")
    parser.add_argument("--output-dir", "-o", help="Output directory for generated .bin and .json files.")
    parser.add_argument("--recursive", "-r", action="store_true", help="Process directory recursively.")
    parser.add_argument("--verify", action="store_true", help="Verify existing .bin file layout instead of converting.")

    args = parser.parse_args()

    if args.verify:
        verify_binary_blob(args.input_path)
        sys.exit(0)

    input_path = os.path.abspath(args.input_path)

    if os.path.isfile(input_path):
        success = convert_file(input_path, args.output_dir)
        sys.exit(0 if success else 1)
    elif os.path.isdir(input_path):
        print(f"[*] Processing directory: {input_path}")
        converted_count = 0
        failed_count = 0

        if args.recursive:
            for root, _, files in os.walk(input_path):
                for f in files:
                    if f.lower().endswith(".dae"):
                        dae_file = os.path.join(root, f)
                        if convert_file(dae_file, args.output_dir):
                            converted_count += 1
                        else:
                            failed_count += 1
        else:
            for f in os.listdir(input_path):
                if f.lower().endswith(".dae"):
                    dae_file = os.path.join(input_path, f)
                    if convert_file(dae_file, args.output_dir):
                        converted_count += 1
                    else:
                        failed_count += 1

        print(f"\n[+] Batch complete: {converted_count} converted, {failed_count} failed.")
        sys.exit(0 if failed_count == 0 else 1)
    else:
        print(f"[-] Error: Path does not exist: {input_path}")
        sys.exit(1)


if __name__ == "__main__":
    main()
