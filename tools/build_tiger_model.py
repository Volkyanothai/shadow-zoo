"""Create the editable grey tiger study and export its native skinned GLB.

Run from the repository root with Blender 4.3.2:
  blender -b --factory-startup --python tools/build_tiger_model.py -- --blend-path /workspace/artifacts/tiger-study.blend

The geometry and baked authored motion live in the two sibling modules.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy

sys.dont_write_bytecode = True
TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from tiger_mesh import create_tiger_mesh
from tiger_rig import rig_and_animate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", default=str(TOOLS.parent))
    parser.add_argument("--blend-path", default="/workspace/artifacts/tiger-study.blend")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    out = Path(args.output_root) / "assets/fighters/tiger3d"
    out.mkdir(parents=True, exist_ok=True)
    blend_path = Path(args.blend_path)
    blend_path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    geometry = create_tiger_mesh()
    result = rig_and_animate(geometry["body"], geometry["landmarks"], geometry["details"])
    bpy.context.scene.render.fps = 60
    # glTF preserves timeline seconds; frame zero gives every clip a valid
    # first pose at t=0 and avoids stale bones before a frame-one first key.
    bpy.context.scene.frame_set(0)

    # Only model, details and the actual armature enter the game asset.
    bpy.ops.object.select_all(action="DESELECT")
    exported_objects = [geometry["body"], result["armature"], *geometry["details"]]
    for obj in exported_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = result["armature"]
    glb_path = out / "tiger-study.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path), export_format="GLB", use_selection=True,
        export_yup=True, export_apply=False, export_skins=True,
        export_all_influences=False, export_animations=True,
        export_animation_mode="NLA_TRACKS", export_force_sampling=True,
        export_frame_range=False,
    )
    # The GLB contains every isolated clip. Open the editable source on a
    # clean idle preview instead of stacking every NLA motion at once.
    for track in result["armature"].animation_data.nla_tracks:
        track.mute = track.name != "idle_guard"
    bpy.context.scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    body = geometry["body"]
    body.data.calc_loop_triangles()
    metadata = dict(result.get("metadata", {}))
    metadata.update({
        "schema_version": 1,
        "authoring_tool": "Blender " + bpy.app.version_string,
        "source": "Original procedural model and authored baked motion for Shadow Zoo",
        "stage": "grey_model_motion_study",
        "body_vertices": len(body.data.vertices),
        "body_triangles": len(body.data.loop_triangles),
        "deform_bones": sum(b.use_deform for b in result["armature"].data.bones),
        "source_glb_sha256": hashlib.sha256(glb_path.read_bytes()).hexdigest(),
        "coordinate_note": "Blender Z up, negative Y forward; glTF/Godot Y up, positive Z forward",
    })
    (out / "tiger-study.motion.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print("TIGER_MODEL_BUILT " + json.dumps({
        "glb": str(glb_path), "blend": str(blend_path),
        "bytes": glb_path.stat().st_size, "metadata": metadata,
    }))


if __name__ == "__main__":
    main()
