"""Skin and author the grey tiger's 3D fighting movement study.

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
from mathutils import Matrix, Vector


FPS = 60
CLIP_DURATIONS = {
    "idle_guard": 3.2,
    "step_forward": 1.2,
    "step_back": 1.2,
    "jab": 0.70,
    "cross": 0.85,
    "hook": 0.90,
    "guard_block": 0.90,
    "dodge": 0.95,
    "hit_react": 0.85,
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
    phase = time / CLIP_DURATIONS[clip]
    # Left lead/right rear, rather than a symmetrical upright display pose.
    target = Vector((.215, -.18, .14) if side == "L" else (-.19, .17, .14))
    if clip not in ("step_forward", "step_back"):
        return target
    first = "L" if clip == "step_forward" else "R"
    start, end = (.06, .46) if side == first else (.54, .94)
    local_phase = (phase - start) / (end - start)
    target.y += (-.50 if clip == "step_forward" else .50) * _smooth(local_phase)
    if 0 < local_phase < 1:
        # A compact fighting shuffle; the support paw stays completely still.
        target.z += .055 * math.sin(math.pi * local_phase) ** 1.45
    return target


def _path(time, keys):
    return _curve(time, [(at, _v(point)) for at, point in keys])


def _torso(points, travel, shift, pelvis_yaw, chest_yaw, lean, roll,
           head_yaw=0.0, head_lean=math.radians(9), head_roll=0.0):
    """Absolute anatomical chain, distributing a turn instead of one hinge."""
    pelvis_rotation = _rotation(pelvis_yaw, lean * .35, roll * .30)
    spine_rotation = _rotation(pelvis_yaw * .45 + chest_yaw * .55,
                               lean * .8, roll * .75)
    chest_rotation = _rotation(chest_yaw, lean, roll)
    neck_rotation = _rotation(chest_yaw * .10 + head_yaw * .3,
                              lean * .3 + math.radians(2), roll * .4)
    head_rotation = _rotation(head_yaw + chest_yaw * .04, head_lean, head_roll)
    pelvis = points["pelvis"] + travel + shift
    spine = pelvis + pelvis_rotation @ (points["spine"] - points["pelvis"])
    chest = spine + spine_rotation @ (points["chest"] - points["spine"])
    neck = chest + chest_rotation @ (points["neck"] - points["chest"])
    head = neck + neck_rotation @ (points["head_pivot"] - points["neck"])
    return {"pelvis": (pelvis, pelvis_rotation), "spine": (spine, spine_rotation),
            "chest": (chest, chest_rotation), "neck": (neck, neck_rotation),
            "head": (head, head_rotation)}


def _pose(armature, points, clip, time):
    """Author a fighting beat in world targets, then bake real bone transforms.

    Anticipation, body transfer, contact and recovery have separate curves.
    Guard hands are placed beside the face; elbows use a downward pole, not
    the previous wide horizontal display pose. All clips meet the same guard
    at both ends, and even the tail returns to that common reference pose.
    """
    _POSE_MATRICES.clear()
    phase = time / CLIP_DURATIONS[clip]
    zero = Vector((0, 0, 0))
    travel = zero.copy()
    shift = Vector((.006, -.01, -.11))
    pelvis_yaw, chest_yaw = math.radians(-14), math.radians(-24)
    lean, roll = math.radians(7), 0.0
    head_yaw, head_lean, head_roll = 0.0, math.radians(9), 0.0
    breath, settle, strike = 0.0, 0.0, 0.0
    tail_impulse = 0.0
    strike_side = "R" if clip == "cross" else "L"

    if clip == "idle_guard":
        # Unequal held beats: breathe, quietly settle weight, then look back
        # onto the opponent. These stay small enough to keep a ready guard.
        breath = _curve(phase, [(0, 0), (.20, .25), (.43, 1), (.68, .28),
                                (.86, -.15), (1, 0)])
        settle = _curve(phase, [(0, 0), (.18, -.45), (.39, .65), (.65, .1),
                                (.84, -.2), (1, 0)])
        shift.x += .008 * settle
        shift.y += .004 * breath
        shift.z += .0025 * breath
        chest_yaw += math.radians(.8) * settle
        lean += math.radians(.6) * breath
        head_yaw = math.radians(_curve(phase, [(0, 0), (.13, 0), (.29, 1.8),
                                              (.49, .3), (.73, -.8), (1, 0)]))
        head_lean += math.radians(.7) * breath
    elif clip in ("step_forward", "step_back"):
        direction = -.50 if clip == "step_forward" else .50
        first = _smooth((phase - .06) / .40)
        second = _smooth((phase - .54) / .40)
        # Keep the hips between the paws as their stagger stretches, while
        # retaining the authored half-metre advance/retreat on the root.
        travel.y = direction * (first + second) * .5
        shift.z -= .047 * math.sin(math.pi * phase) ** 2
        settle = _curve(phase, [(0, 0), (.10, -.4), (.29, .8), (.50, 0),
                                (.63, -.7), (.81, .4), (1, 0)])
        shift.x += .012 * settle
        pelvis_yaw += math.radians(1.5) * settle
        chest_yaw -= math.radians(.9) * settle
        # The body is softly arrested by each landing, not a treadmill bob.
        head_lean += math.radians(.6) * settle
        tail_impulse = .018 * settle
    elif clip == "jab":
        pelvis_yaw = math.radians(_curve(time, [(0, -14), (.055, -11), (.13, -18),
                                               (.20, -23), (.32, -20), (.53, -14), (.70, -14)]))
        chest_yaw = math.radians(_curve(time, [(0, -24), (.07, -20), (.14, -31),
                                              (.20, -40), (.28, -38), (.48, -26), (.58, -24), (.70, -24)]))
        strike = _curve(time, [(0, 0), (.065, -.10), (.135, .42), (.20, 1),
                               (.225, 1), (.31, .62), (.46, .12), (.57, 0), (.70, 0)])
        shift.y += _curve(time, [(0, 0), (.07, .009), (.20, -.042), (.29, -.040), (.57, 0), (.70, 0)])
        lean += math.radians(1.6) * max(0, strike)
        tail_impulse = _curve(time, [(0, 0), (.10, .005), (.27, -.045), (.43, .018), (.70, 0)])
    elif clip == "cross":
        # Rear hip leads, then rear shoulder drives through. The lead paw
        # never leaves its cheek while the rear paw travels toward contact.
        pelvis_yaw = math.radians(_curve(time, [(0, -14), (.09, -20), (.18, 1),
                                               (.29, 20), (.38, 18), (.60, -7), (.74, -14), (.85, -14)]))
        chest_yaw = math.radians(_curve(time, [(0, -24), (.11, -29), (.20, 8),
                                              (.29, 39), (.36, 36), (.53, 5), (.70, -24), (.85, -24)]))
        strike = _curve(time, [(0, 0), (.10, -.10), (.19, .28), (.29, 1),
                               (.325, 1), (.43, .54), (.60, .08), (.71, 0), (.85, 0)])
        shift.y += _curve(time, [(0, 0), (.11, .016), (.29, -.055), (.39, -.048), (.72, 0), (.85, 0)])
        shift.x += _curve(time, [(0, 0), (.13, -.009), (.29, .018), (.40, .014), (.72, 0), (.85, 0)])
        lean += math.radians(2.0) * max(0, strike)
        head_yaw = math.radians(-2.0) * max(0, strike)
        tail_impulse = _curve(time, [(0, 0), (.15, -.014), (.35, .08), (.53, -.025), (.85, 0)])
    elif clip == "hook":
        pelvis_yaw = math.radians(_curve(time, [(0, -14), (.12, -9), (.24, -21),
                                               (.34, -29), (.42, -27), (.62, -18), (.78, -14), (.90, -14)]))
        chest_yaw = math.radians(_curve(time, [(0, -24), (.14, -12), (.25, -33),
                                              (.34, -48), (.42, -43), (.62, -30), (.78, -24), (.90, -24)]))
        strike = _curve(time, [(0, 0), (.12, .28), (.25, .7), (.34, 1),
                               (.40, .94), (.53, .54), (.69, .08), (.80, 0), (.90, 0)])
        shift.y += _curve(time, [(0, 0), (.13, .012), (.34, -.031), (.45, -.025), (.79, 0), (.90, 0)])
        shift.x += _curve(time, [(0, 0), (.14, .008), (.34, -.012), (.52, -.006), (.79, 0), (.90, 0)])
        tail_impulse = _curve(time, [(0, 0), (.17, .018), (.40, -.062), (.64, .023), (.90, 0)])
    elif clip == "guard_block":
        cover = _curve(time, [(0, 0), (.07, .22), (.16, 1), (.28, 1),
                              (.38, 1), (.56, .9), (.73, .12), (.83, 0), (.90, 0)])
        impact = _curve(time, [(0, 0), (.23, 0), (.29, 1), (.36, .55),
                               (.48, .12), (.62, 0), (.90, 0)])
        shift.z -= .031 * cover
        shift.y += .028 * impact
        lean -= math.radians(3) * impact
        head_lean += math.radians(4.5) * cover
        chest_yaw += math.radians(4) * cover
        tail_impulse = -.025 * impact
    elif clip == "dodge":
        slip = _curve(time, [(0, 0), (.09, .08), (.20, .62), (.35, 1),
                             (.48, 1), (.59, .72), (.76, .14), (.87, 0), (.95, 0)])
        shift.x += .055 * slip
        shift.y += .013 * slip
        shift.z -= .087 * slip
        pelvis_yaw -= math.radians(4) * slip
        chest_yaw -= math.radians(9) * slip
        roll += math.radians(11) * slip
        head_roll = math.radians(-2) * slip
        head_lean += math.radians(3) * slip
        tail_impulse = _curve(time, [(0, 0), (.16, .012), (.46, -.044), (.67, .018), (.95, 0)])
    elif clip == "hit_react":
        recoil = _curve(time, [(0, 0), (.09, 0), (.14, .55), (.22, 1),
                               (.32, .8), (.46, .35), (.63, .06), (.76, 0), (.85, 0)])
        head_snap = _curve(time, [(0, 0), (.09, 0), (.145, 1), (.22, .8),
                                  (.34, .35), (.54, -.12), (.70, 0), (.85, 0)])
        shift.y += .061 * recoil
        shift.z -= .022 * recoil
        lean -= math.radians(12) * recoil
        chest_yaw += math.radians(7) * recoil
        head_lean -= math.radians(19) * head_snap
        head_yaw = math.radians(-6) * head_snap
        tail_impulse = _curve(time, [(0, 0), (.12, 0), (.30, .058), (.48, -.02), (.85, 0)])

    torso = _torso(points, travel, shift, pelvis_yaw, chest_yaw, lean, roll,
                   head_yaw, head_lean, head_roll)
    neutral = _torso(points, zero, Vector((.006, -.01, -.11)),
                     math.radians(-14), math.radians(-24), math.radians(7), 0.0)
    head_delta = torso["head"][0] - neutral["head"][0]
    _set_bone(armature, "root", travel, rotation=Matrix.Identity(3))
    for name, (position, rotation) in torso.items():
        _set_bone(armature, name, position, rotation=rotation)
    pelvis, pelvis_rotation = torso["pelvis"]
    chest, chest_rotation = torso["chest"]

    for side, sign in (("L", 1), ("R", -1)):
        hip = pelvis + pelvis_rotation @ (points[f"hip.{side}"] - points["pelvis"])
        ankle = _foot_target(side, clip, time)
        thigh_length = (points[f"knee.{side}"] - points[f"hip.{side}"]).length
        shin_length = (points[f"ankle.{side}"] - points[f"knee.{side}"]).length
        knee, ankle = _two_bone(hip, ankle, thigh_length, shin_length,
                                Vector((sign * .055, -1, .03)))
        _set_bone(armature, f"thigh.{side}", hip, direction=knee - hip)
        _set_bone(armature, f"shin.{side}", knee, direction=ankle - knee)
        _set_bone(armature, f"foot.{side}", ankle, rotation=Matrix.Identity(3))

        shoulder = chest + chest_rotation @ (points[f"shoulder.{side}"] - points["chest"])
        _set_bone(armature, f"clavicle.{side}", chest, rotation=chest_rotation)
        guard = Vector((.20, -.445, 1.58) if side == "L" else (-.21, -.255, 1.61)) + head_delta
        wrist = guard.copy()
        if clip == "cross" and side == "L":
            # As the lead shoulder turns away, fold this hand back to the
            # cheek. Leaving it in the extended lead guard would straighten
            # both arms and expose the face during the rear-hand punch.
            wrist += Vector((-.025, .18, .045)) * max(0.0, strike)
        pole = Vector((sign * .27, .16, -1.0))
        # Upright closed-guard silhouette: the paw extends toward the cheek,
        # rather than dangling horizontally like the previous prototype.
        hand_direction = Vector((sign * .04, -.32, .95)).normalized()
        if clip == "idle_guard":
            wrist.z += .0035 * breath
            wrist.y -= .0025 * settle
        elif clip in ("step_forward", "step_back"):
            wrist.z += .003 * settle
        elif clip in ("jab", "cross") and side == strike_side:
            target = Vector((.12, -.835, 1.535) if side == "L" else (-.105, -.83, 1.55)) + travel
            wrist = guard.lerp(target, max(0.0, strike))
            wrist.y -= min(0.0, strike) * .13
            hand_direction = hand_direction.lerp(Vector((0, -1, -.015)),
                                                   _smooth(max(0.0, strike) / .80)).normalized()
        elif clip == "hook" and side == "L":
            # A horizontal arc with the elbow bent, distinct from a straight
            # punch. It comes around the guard, across the opponent's jaw.
            wrist = _path(time, [(0, guard), (.08, guard), (.15, (.39, -.43, 1.57)),
                                 (.245, (.33, -.62, 1.585)), (.34, (-.085, -.59, 1.58)),
                                 (.42, (-.15, -.53, 1.565)), (.59, (.08, -.425, 1.57)),
                                 (.78, guard), (.90, guard)])
            hook_shape = _curve(time, [(0, 0), (.10, 0), (.22, 1), (.43, 1),
                                       (.65, .3), (.78, 0), (.90, 0)])
            pole = pole.lerp(Vector((.85, .15, .16)), hook_shape)
            hand_direction = hand_direction.lerp(Vector((-.68, -.72, .10)), hook_shape).normalized()
        elif clip == "guard_block":
            cover = _curve(time, [(0, 0), (.07, .22), (.16, 1), (.56, .9),
                                  (.73, .12), (.83, 0), (.90, 0)])
            target = Vector((sign * .235, -.33, 1.65)) + head_delta
            wrist = guard.lerp(target, cover)
            hand_direction = hand_direction.lerp(
                Vector((sign * .02, -.32, .95)).normalized(), cover).normalized()
            pole.x *= 1.0 - .35 * cover
        elif clip == "hit_react":
            recoil = _curve(time, [(0, 0), (.09, 0), (.22, 1), (.46, .35),
                                   (.76, 0), (.85, 0)])
            wrist.x += sign * .031 * recoil
            wrist.y += .011 * recoil

        arm_length = (points[f"elbow.{side}"] - points[f"shoulder.{side}"]).length
        forearm_length = (points[f"wrist.{side}"] - points[f"elbow.{side}"]).length
        elbow, wrist = _two_bone(shoulder, wrist, arm_length, forearm_length, pole)
        _set_bone(armature, f"upper_arm.{side}", shoulder, direction=elbow - shoulder)
        _set_bone(armature, f"forearm.{side}", elbow, direction=wrist - elbow)
        _set_bone(armature, f"hand.{side}", wrist, direction=hand_direction)

    tail_position = pelvis + pelvis_rotation @ (points["tail"][0] - points["pelvis"])
    for index in range(len(points["tail"]) - 1):
        name = f"tail.{index + 1:02d}"
        rest_axis = points["tail"][index + 1] - points["tail"][index]
        secondary = 0.0
        if clip == "idle_guard":
            # Phase varies down the tail, yet every segment closes exactly.
            secondary = .013 * (math.sin(phase * math.tau - index * .46)
                                 - math.sin(-index * .46))
        # Distal joints respond more than the heavy tail root. All impulses
        # decay to zero before the common ending guard, including the tail.
        reaction = tail_impulse * (.38 + index * .13)
        rotation = _rotation(math.radians(-14) * .45
                             + (pelvis_yaw - math.radians(-14)) * .40
                             + secondary + reaction)
        _set_bone(armature, name, tail_position, rotation=rotation)
        tail_position += rotation @ rest_axis


def _author_actions(armature, points):
    actions = {}
    armature.animation_data_create()
    for clip, duration in CLIP_DURATIONS.items():
        action = bpy.data.actions.new(clip)
        action.use_fake_user = True
        armature.animation_data.action = action
        # Bake at 30 Hz; the exporter resamples to 60 Hz. Durations align to
        # 60 Hz frames because Blender 4.3 truncates NLA end-frame fractions.
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
    """Public build contract; return exportable rig, nine actions and metadata."""
    points = _landmarks(landmarks)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = int(max(CLIP_DURATIONS.values()) * FPS)
    armature, definitions = _make_armature(points)
    weight_info = _skin_body(body, armature, definitions, points)
    _bind_details(detail_objects, armature)
    actions = _author_actions(armature, points)
    contacts = {
        "step_forward": {"foot.L": [[0, .072], [.552, 1.2]], "foot.R": [[0, .648], [1.128, 1.2]]},
        "step_back": {"foot.L": [[0, .648], [1.128, 1.2]], "foot.R": [[0, .072], [.552, 1.2]]},
    }
    peaks = {"step_forward": .31, "step_back": .31, "jab": .20,
             "cross": .29, "hook": .34, "guard_block": .38,
             "dodge": .42, "hit_react": .22}
    events = {
        "jab": [{"time": .20, "type": "strike_contact"}],
        "cross": [{"time": .29, "type": "strike_contact"}],
        "hook": [{"time": .34, "type": "strike_contact"}],
        "guard_block": [{"time": .16, "type": "guard_ready"},
                        {"time": .29, "type": "blocked_impact"},
                        {"time": .56, "type": "guard_release"}],
        "dodge": [{"time": .20, "type": "evasion_start"},
                  {"time": .58, "type": "evasion_end"}],
        "hit_react": [{"time": .14, "type": "hit_impact"}],
        "step_forward": [{"time": .552, "type": "lead_landing"},
                         {"time": 1.128, "type": "rear_landing"}],
        "step_back": [{"time": .552, "type": "rear_landing"},
                      {"time": 1.128, "type": "lead_landing"}],
    }
    phase_boundaries = {
        "jab": [("set", 0, .08), ("strike", .08, .225), ("recover", .225, .70)],
        "cross": [("load", 0, .12), ("strike", .12, .325), ("recover", .325, .85)],
        "hook": [("load", 0, .15), ("arc", .15, .40), ("recover", .40, .90)],
        "guard_block": [("cover", 0, .16), ("brace", .16, .56), ("recover", .56, .90)],
        "dodge": [("slip", 0, .20), ("evade", .20, .58), ("recover", .58, .95)],
        "hit_react": [("impact", 0, .22), ("recoil", .22, .46), ("recover", .46, .85)],
        "step_forward": [("lead_step", 0, .552), ("rear_step", .552, 1.2)],
        "step_back": [("rear_step", 0, .552), ("lead_step", .552, 1.2)],
        "idle_guard": [("ready", 0, 3.2)],
    }
    clips = {}
    for name, duration in CLIP_DURATIONS.items():
        planted = {"foot.L": [[0, duration]], "foot.R": [[0, duration]]}
        clips[name] = {"duration": duration, "foot_contacts": contacts.get(name, planted),
                       "root_translation_blender": [0, -.5 if name == "step_forward" else .5 if name == "step_back" else 0, 0],
                       "loop": name == "idle_guard", "events": events.get(name, []),
                       "phases": [{"name": phase_name, "start": start, "end": end}
                                  for phase_name, start, end in phase_boundaries[name]]}
        if name in peaks:
            clips[name]["pose_peak"] = peaks[name]
        if name in ("jab", "cross", "hook"):
            clips[name]["strike_contact"] = peaks[name]
            clips[name]["contact_time"] = peaks[name]
    clips["guard_block"]["guard_interval"] = [.16, .56]
    clips["dodge"]["evasion_interval"] = [.20, .58]
    metadata = {
        "schema_version": 1,
        "coordinate_system": "Blender metres: X across, -Y forward, Z up; glTF converts to Y up",
        "fps": FPS,
        "root_bone": "root",
        "foot_bones": ["foot.L", "foot.R"],
        "ankle_rest_height": .14,
        "stance": {"lead_side": "L", "rear_side": "R",
                   "ankles_blender": {"foot.L": [.215, -.18, .14], "foot.R": [-.19, .17, .14]},
                   "shared_guard_endpoints": True},
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
