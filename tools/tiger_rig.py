"""Skin and author the grey tiger's first real 3D movement study.

Run inside Blender. Coordinates are metres, X across the body, -Y forward,
Z up. The mesh is one continuous surface; this module binds that surface to
an armature rather than moving separate rendered body pieces. Foot targets
are authored in world space, then two-bone IK is baked to ordinary bone
transforms so the exported glTF needs no Blender constraints.
"""

from __future__ import annotations

import math
from typing import Any

import bpy
from mathutils import Matrix, Quaternion, Vector


FPS = 60
CLIP_DURATIONS = {
    "idle_guard": 2.0,
    "step_forward": 1.2,
    "step_back": 1.2,
    "jab": 0.65,
}
_POSE_MATRICES = {}


def _v(value):
    return value.copy() if isinstance(value, Vector) else Vector(value)


def _smooth(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def _curve(time, keys):
    """Cubic easing with flat tangents at held reference poses."""
    if time <= keys[0][0]:
        return keys[0][1]
    for (ta, va), (tb, vb) in zip(keys, keys[1:]):
        if time <= tb:
            return va + (vb - va) * _smooth((time - ta) / (tb - ta))
    return keys[-1][1]


def _rotation(yaw=0.0, lean=0.0, roll=0.0):
    return (
        Matrix.Rotation(yaw, 3, "Z")
        @ Matrix.Rotation(lean, 3, "X")
        @ Matrix.Rotation(roll, 3, "Y")
    )


def _segment_distance(point, a, b):
    axis = b - a
    factor = max(0.0, min(1.0, (point - a).dot(axis) / max(axis.length_squared, 1e-9)))
    return (point - (a + axis * factor)).length


def _two_bone(start, target, first_length, second_length, pole):
    """Analytic joint position, preserving both segment lengths."""
    delta = target - start
    distance = delta.length
    direction = delta.normalized() if distance > 1e-8 else Vector((0, 0, -1))
    distance = min(first_length + second_length - 0.001,
                   max(abs(first_length - second_length) + 0.001, distance))
    target = start + direction * distance
    along = (first_length ** 2 - second_length ** 2 + distance ** 2) / (2.0 * distance)
    height = math.sqrt(max(0.0, first_length ** 2 - along ** 2))
    bend = pole - direction * pole.dot(direction)
    if bend.length_squared < 1e-8:
        bend = Vector((1, 0, 0)) - direction * direction.x
    bend.normalize()
    return start + direction * along + bend * height, target


def _landmarks(landmarks):
    data = {key: _v(value) for key, value in landmarks.items()
            if key not in ("tail", "tail_joints")}
    tail = landmarks.get("tail_joints", landmarks.get("tail"))
    if tail is None:
        tail = [(0, .14, .98), (0, .36, .86), (.025, .60, .76),
                (.07, .85, .76), (.105, 1.09, .88), (.115, 1.26, 1.06),
                (.10, 1.32, 1.23)]
    data["tail"] = [_v(point) for point in tail]
    # The mesh's head landmark is its volume centre. Put the animation pivot
    # at the base of the skull instead, so facial geometry turns together.
    data["head_pivot"] = data["neck"].lerp(data["head"], .42)
    return data


def _make_armature(points):
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    armature_data = bpy.data.armatures.new("Kai_Skeleton")
    armature = bpy.data.objects.new("Kai_Rig", armature_data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    definitions = {}

    def add(name, a, b, parent=None, deform=True):
        bone = armature_data.edit_bones.new(name)
        bone.head, bone.tail = _v(a), _v(b)
        if parent:
            bone.parent = armature_data.edit_bones[parent]
        bone.use_deform = deform
        bone.use_connect = False
        definitions[name] = (_v(a), _v(b), parent)

    add("root", (0, 0, 0), (0, 0, .12), deform=False)
    add("pelvis", points["pelvis"], points["spine"], "root")
    add("spine", points["spine"], points["chest"], "pelvis")
    add("chest", points["chest"], points["neck"], "spine")
    add("neck", points["neck"], points["head_pivot"], "chest")
    add("head", points["head_pivot"], points["head_tip"], "neck")
    for side in ("L", "R"):
        add(f"clavicle.{side}", points["chest"], points[f"shoulder.{side}"], "chest")
        add(f"upper_arm.{side}", points[f"shoulder.{side}"], points[f"elbow.{side}"], f"clavicle.{side}")
        add(f"forearm.{side}", points[f"elbow.{side}"], points[f"wrist.{side}"], f"upper_arm.{side}")
        add(f"hand.{side}", points[f"wrist.{side}"], points[f"hand.{side}"], f"forearm.{side}")
        add(f"thigh.{side}", points[f"hip.{side}"], points[f"knee.{side}"], "pelvis")
        add(f"shin.{side}", points[f"knee.{side}"], points[f"ankle.{side}"], f"thigh.{side}")
        add(f"foot.{side}", points[f"ankle.{side}"], points[f"toe.{side}"], f"shin.{side}")
    for index in range(len(points["tail"]) - 1):
        add(f"tail.{index + 1:02d}", points["tail"][index], points["tail"][index + 1],
            "pelvis" if index == 0 else f"tail.{index:02d}")
    bpy.ops.object.mode_set(mode="OBJECT")
    armature.show_in_front = True
    armature.data.display_type = "STICK"
    for bone in armature.pose.bones:
        bone.rotation_mode = "QUATERNION"
    return armature, definitions


def _skin_body(body, armature, definitions, points):
    """Soft anatomical envelopes, limited to four normalized influences.

    Region gates prevent a large chest envelope from pulling on the fists,
    while adjacent bones share a short band around each joint. The seamless
    source mesh is retained; vertices are never split into rigid body parts.
    """
    body.vertex_groups.clear()
    groups = {name: body.vertex_groups.new(name=name)
              for name in definitions if name != "root"}
    tail_names = [name for name in definitions if name.startswith("tail.")]
    sums = []
    for vertex in body.data.vertices:
        point = body.matrix_world @ vertex.co
        x, y, z = point
        side = "L" if x >= 0 else "R"
        if y > .22 and z < 1.38 and abs(x) < .23:
            names = tail_names + (["pelvis"] if y < .42 else [])
            softness = .052
        elif abs(x) > .285 and 1.03 < z < 1.68:
            names = [f"clavicle.{side}", f"upper_arm.{side}",
                     f"forearm.{side}", f"hand.{side}"]
            if abs(x) < .39 and z > 1.35:
                names += ["chest"]
            softness = .065
        elif z < 1.00 and (abs(x) > .065 or z < .79) and y < .25:
            # Keep the complete sole rigid to the foot bone. Blending shin
            # weights into the heel would lift its corners during a plant.
            names = [f"foot.{side}"] if z < .125 else [f"thigh.{side}", f"shin.{side}", f"foot.{side}"]
            if z > .84:
                names += ["pelvis"]
            softness = .075
        elif z > 1.80:
            # The skull, muzzle and ears retain volume together. Only the
            # short neck/base-of-skull band needs blended head weights.
            names = ["head"]
            softness = .095
        else:
            names = ["pelvis", "spine", "chest", "neck", "head"]
            if z > 1.34 and z < 1.65 and abs(x) > .18:
                names += [f"clavicle.{side}", f"upper_arm.{side}"]
            softness = .095
        distances = [(name, _segment_distance(point, definitions[name][0], definitions[name][1]))
                     for name in names]
        closest = min(distance for _, distance in distances)
        # Subtract the closest distance squared before exponentiation to keep
        # even broad muzzle vertices numerically stable.
        influences = sorted(
            [(name, math.exp(-max(0.0, distance * distance - closest * closest) /
                             (softness * softness))) for name, distance in distances],
            key=lambda pair: pair[1], reverse=True,
        )[:4]
        influences = [(name, weight) for name, weight in influences if weight > .001]
        total = sum(weight for _, weight in influences)
        for name, weight in influences:
            groups[name].add([vertex.index], weight / total, "REPLACE")
        sums.append(sum(weight / total for _, weight in influences))
    modifier = body.modifiers.new("Continuous_skin", "ARMATURE")
    modifier.object = armature
    # Match glTF/Godot's linear blend skinning in the editable Blender file.
    # Blender-only dual-quaternion volume preservation would hide joint
    # pinching that still needs to be checked in the shipped native model.
    modifier.use_deform_preserve_volume = False
    modifier.use_vertex_groups = True
    world_matrix = body.matrix_world.copy()
    body.parent = armature
    body.matrix_world = world_matrix
    body["skin_weight_limit"] = 4
    body["skin_weight_normalized"] = True
    body["continuous_surface"] = True
    return {"vertices": len(sums), "weight_sum_min": min(sums), "weight_sum_max": max(sums),
            "max_influences": 4}


def _bind_details(details, armature):
    for detail in details:
        requested = detail.get("rig_bone", "head")
        if requested not in armature.data.bones:
            requested = "head"
        world_matrix = detail.matrix_world.copy()
        detail.parent = armature
        detail.parent_type = "BONE"
        detail.parent_bone = requested
        detail.matrix_world = world_matrix


def _set_bone(armature, name, head, direction=None, rotation=None):
    """Set an absolute bone transform without introducing bone scaling."""
    rest = armature.data.bones[name]
    if rotation is None:
        rest_direction = (rest.tail_local - rest.head_local).normalized()
        quaternion = rest_direction.rotation_difference(direction.normalized()) @ rest.matrix_local.to_quaternion()
    else:
        quaternion = rotation.to_quaternion() @ rest.matrix_local.to_quaternion()
    desired = Matrix.Translation(head) @ quaternion.to_matrix().to_4x4()
    # Convert using the parent's newly authored matrix, not the dependency
    # graph's previous pose. This avoids stale-parent offsets while baking.
    if rest.parent:
        basis = rest.convert_local_to_pose(
            desired, rest.matrix_local,
            parent_matrix=_POSE_MATRICES[rest.parent.name],
            parent_matrix_local=rest.parent.matrix_local, invert=True,
        )
    else:
        basis = rest.convert_local_to_pose(desired, rest.matrix_local, invert=True)
    armature.pose.bones[name].matrix_basis = basis
    _POSE_MATRICES[name] = desired


def _foot_target(side, clip, time):
    duration = CLIP_DURATIONS[clip]
    phase = time / duration
    target = Vector((.215 if side == "L" else -.215, -.105 if side == "L" else .105, .14))
    if clip not in ("step_forward", "step_back"):
        return target
    forward = clip == "step_forward"
    # Fighting shuffle: the lead paw advances first, the rear paw retreats
    # first. The paws never cross and the guard stance survives the step.
    first = "L" if forward else "R"
    start, end = (.06, .46) if side == first else (.54, .94)
    progress = _smooth((phase - start) / (end - start))
    target.y += (-.50 if forward else .50) * progress
    if start < phase < end:
        # Enough clearance to read as a deliberate flat-footed fighting step.
        local_phase = (phase - start) / (end - start)
        target.z += .07 * math.sin(math.pi * local_phase) ** 1.35
    return target


def _pose(armature, points, clip, time):
    _POSE_MATRICES.clear()
    phase = time / CLIP_DURATIONS[clip]
    wave = math.sin(phase * math.tau)
    travel = Vector((0, (-.50 if clip == "step_forward" else .50) * phase, 0)) if clip in ("step_forward", "step_back") else Vector((0, 0, 0))
    breath = .004 * wave if clip == "idle_guard" else 0
    crouch = -.067 + breath
    pelvis_yaw = math.radians(-7)
    chest_yaw = math.radians(-16)
    lean = math.radians(4)
    pelvis_shift = Vector((0, 0, crouch))
    strike = 0.0
    if clip in ("step_forward", "step_back"):
        pelvis_shift.z -= .009 * math.sin(phase * math.tau * 2) ** 2
        pelvis_shift.z -= .027 * math.sin(phase * math.pi) ** 2
        pelvis_yaw += math.radians(2.5) * wave
        chest_yaw -= math.radians(2) * wave
        lean += math.radians(1.5 if clip == "step_forward" else -1.5)
    elif clip == "jab":
        # Pelvis starts the turn before the chest; the fist reaches contact
        # after the body has begun transferring weight onto the front foot.
        pelvis_yaw = math.radians(_curve(time, [(0, -7), (.055, -4), (.13, -16), (.23, -20), (.38, -9), (.65, -7)]))
        chest_yaw = math.radians(_curve(time, [(0, -16), (.075, -7), (.16, -25), (.23, -36), (.34, -25), (.53, -16), (.65, -16)]))
        strike = _curve(time, [(0, 0), (.075, -.06), (.16, .65), (.23, 1), (.28, .96), (.45, .13), (.56, 0), (.65, 0)])
        pelvis_shift.y = _curve(time, [(0, 0), (.08, .005), (.21, -.055), (.3, -.05), (.56, 0), (.65, 0)])
        lean += math.radians(3.5) * max(0, strike)
    pelvis_rotation = _rotation(pelvis_yaw, lean * .35)
    spine_rotation = _rotation(pelvis_yaw * .45 + chest_yaw * .55, lean * .8)
    chest_rotation = _rotation(chest_yaw, lean)
    neck_rotation = _rotation(chest_yaw * .22, lean * .25)
    head_rotation = _rotation(chest_yaw * .08, -math.radians(2))

    _set_bone(armature, "root", travel, rotation=Matrix.Identity(3))
    pelvis = points["pelvis"] + travel + pelvis_shift
    spine = pelvis + pelvis_rotation @ (points["spine"] - points["pelvis"])
    chest = spine + spine_rotation @ (points["chest"] - points["spine"])
    neck = chest + chest_rotation @ (points["neck"] - points["chest"])
    head = neck + neck_rotation @ (points["head_pivot"] - points["neck"])
    for name, position, rotation in (("pelvis", pelvis, pelvis_rotation), ("spine", spine, spine_rotation),
                                     ("chest", chest, chest_rotation), ("neck", neck, neck_rotation),
                                     ("head", head, head_rotation)):
        _set_bone(armature, name, position, rotation=rotation)

    for side, sign in (("L", 1), ("R", -1)):
        hip = pelvis + pelvis_rotation @ (points[f"hip.{side}"] - points["pelvis"])
        ankle = _foot_target(side, clip, time)
        thigh_length = (points[f"knee.{side}"] - points[f"hip.{side}"]).length
        shin_length = (points[f"ankle.{side}"] - points[f"knee.{side}"]).length
        knee, ankle = _two_bone(hip, ankle, thigh_length, shin_length, Vector((sign * .08, -1, .04)))
        _set_bone(armature, f"thigh.{side}", hip, direction=knee - hip)
        _set_bone(armature, f"shin.{side}", knee, direction=ankle - knee)
        _set_bone(armature, f"foot.{side}", ankle, rotation=Matrix.Identity(3))

        shoulder = chest + chest_rotation @ (points[f"shoulder.{side}"] - points["chest"])
        _set_bone(armature, f"clavicle.{side}", chest, rotation=chest_rotation)
        # Two hands protect the chin. The leading hand's extension drives the
        # whole upper-arm/forearm chain rather than rotating a pasted fist.
        wrist = Vector((sign * .185, -.285 if side == "L" else -.235,
                        1.60 if side == "L" else 1.57)) + travel + Vector((0, 0, breath))
        if side == "L" and clip == "jab":
            wrist = wrist.lerp(Vector((.14, -.84, 1.54)) + travel, max(0.0, strike))
            wrist.y -= min(0.0, strike) * .25
        if clip in ("step_forward", "step_back"):
            wrist.z += .006 * math.sin(phase * math.tau * 2)
        arm_length = (points[f"elbow.{side}"] - points[f"shoulder.{side}"]).length
        forearm_length = (points[f"wrist.{side}"] - points[f"elbow.{side}"]).length
        elbow, wrist = _two_bone(shoulder, wrist, arm_length, forearm_length, Vector((sign * .85, .20, -.60)))
        _set_bone(armature, f"upper_arm.{side}", shoulder, direction=elbow - shoulder)
        _set_bone(armature, f"forearm.{side}", elbow, direction=wrist - elbow)
        # Keep the knuckles facing toward the opponent. Hand orientation is
        # independent of elbow swivel, which avoids the paper-cutout look.
        hand_direction = Vector((0, -1, .10 if strike < .2 else -.02))
        _set_bone(armature, f"hand.{side}", wrist, direction=hand_direction)

    tail_position = pelvis + pelvis_rotation @ (points["tail"][0] - points["pelvis"])
    for index in range(len(points["tail"]) - 1):
        name = f"tail.{index + 1:02d}"
        rest_axis = points["tail"][index + 1] - points["tail"][index]
        sway = .035 * math.sin(time * math.tau / 2.0 - index * .42)
        rotation = _rotation(pelvis_yaw * .6 + sway)
        _set_bone(armature, name, tail_position, rotation=rotation)
        tail_position += rotation @ rest_axis


def _author_actions(armature, points):
    actions = {}
    armature.animation_data_create()
    for clip, duration in CLIP_DURATIONS.items():
        action = bpy.data.actions.new(clip)
        action.use_fake_user = True
        armature.animation_data.action = action
        # Bake at 30 Hz; the exporter resamples to 60 Hz. Last key is exact,
        # including the 0.65 s jab rather than rounding its duration upward.
        sample_count = max(2, math.ceil(duration * 30))
        for index in range(sample_count + 1):
            time = duration * index / sample_count
            _pose(armature, points, clip, time)
            bpy.context.view_layer.update()
            frame = time * FPS
            for bone in armature.pose.bones:
                bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)
                bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone.name)
                bone.keyframe_insert(data_path="scale", frame=frame, group=bone.name)
        for curve in action.fcurves:
            for key in curve.keyframe_points:
                key.interpolation = "LINEAR"
        action["duration_seconds"] = duration
        action["authored_motion"] = True
        actions[clip] = action
    armature.animation_data.action = actions["idle_guard"]
    bpy.context.scene.frame_set(0)
    # One independently named track per clip. glTF's NLA_TRACKS exporter
    # isolates each track during sampling, preserving the action names and
    # their individual durations rather than merging a long scene timeline.
    armature.animation_data.action = None
    for clip, action in actions.items():
        track = armature.animation_data.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, 0, action)
        strip.action_frame_start = 0
        strip.action_frame_end = CLIP_DURATIONS[clip] * FPS
        strip.frame_start = 0
        strip.frame_end = strip.action_frame_end
        strip.extrapolation = "NOTHING"
        strip.blend_type = "REPLACE"
    return actions


def rig_and_animate(body, landmarks, detail_objects):
    """Public build contract; return exportable rig, four actions and metadata."""
    points = _landmarks(landmarks)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = 120
    armature, definitions = _make_armature(points)
    weight_info = _skin_body(body, armature, definitions, points)
    _bind_details(detail_objects, armature)
    actions = _author_actions(armature, points)
    contacts = {
        "idle_guard": {"foot.L": [[0, 2.0]], "foot.R": [[0, 2.0]]},
        "jab": {"foot.L": [[0, .65]], "foot.R": [[0, .65]]},
        "step_forward": {"foot.L": [[0, .072], [.552, 1.2]], "foot.R": [[0, .648], [1.128, 1.2]]},
        "step_back": {"foot.L": [[0, .648], [1.128, 1.2]], "foot.R": [[0, .072], [.552, 1.2]]},
    }
    clips = {}
    for name, duration in CLIP_DURATIONS.items():
        clips[name] = {"duration": duration, "foot_contacts": contacts[name],
                       "root_translation_blender": [0, -.5 if name == "step_forward" else .5 if name == "step_back" else 0, 0],
                       "loop": name == "idle_guard"}
    clips["jab"]["strike_contact"] = .23
    metadata = {
        "schema_version": 1,
        "coordinate_system": "Blender metres: X across, -Y forward, Z up; glTF converts to Y up",
        "fps": FPS,
        "root_bone": "root",
        "foot_bones": ["foot.L", "foot.R"],
        "ankle_rest_height": .14,
        "continuous_skinned_mesh": body.name,
        "weights": weight_info,
        "bone_count": len(definitions),
        "clips": clips,
        "export": {"export_animation_mode": "NLA_TRACKS", "export_force_sampling": True,
                   "export_frame_range": False},
    }
    armature["motion_study"] = True
    armature["forward_axis"] = "-Y"
    return {"armature": armature, "actions": actions, "metadata": metadata}
