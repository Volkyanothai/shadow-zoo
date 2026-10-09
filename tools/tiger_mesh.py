"""Construct the untextured Kai anatomical study in Blender 4.3.

This is an original volumetric prototype, not a textured final production model.
The unioned body is one connected deformable surface. Tiny facial and claw
accents are separate meshes assigned explicitly to their anatomical bones.

Coordinates: X across the body (.L is +X), -Y forward, Z up, metres. Arms are
in a relaxed A-pose. The feet use a full sole, rather than a digitigrade hock.
"""

import math

import bpy
from mathutils import Vector


LANDMARKS = {
    "root": (0.0, 0.0, 0.0),
    "pelvis": (0.0, 0.025, 1.00),
    "spine": (0.0, 0.015, 1.18),
    "chest": (0.0, 0.0, 1.49),
    "neck": (0.0, 0.0, 1.70),
    "head": (0.0, -0.015, 1.89),
    "head_tip": (0.0, -0.025, 2.12),
    "shoulder.L": (0.28, 0.0, 1.52),
    "elbow.L": (0.56, -0.005, 1.36),
    "wrist.L": (0.81, -0.01, 1.21),
    "hand.L": (0.93, -0.035, 1.17),
    "hip.L": (0.145, 0.01, 0.97),
    "knee.L": (0.18, -0.025, 0.52),
    "ankle.L": (0.20, 0.01, 0.14),
    "toe.L": (0.20, -0.22, 0.065),
    "tail_joints": [
        (0.0, 0.14, 0.98),
        (0.0, 0.36, 0.86),
        (0.025, 0.60, 0.76),
        (0.07, 0.85, 0.76),
        (0.105, 1.09, 0.88),
        (0.115, 1.26, 1.06),
        (0.10, 1.32, 1.23),
    ],
}
for _name, _point in list(LANDMARKS.items()):
    if _name.endswith(".L"):
        LANDMARKS[_name[:-2] + ".R"] = (-_point[0], _point[1], _point[2])


def _material(name, color, roughness=0.64):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = (*color, 1.0)
    return mat


def _ellipsoid(name, center, radius, pieces, rotation=None, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1.0, location=center
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = radius
    if rotation is not None:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for face in obj.data.polygons:
        face.use_smooth = True
    pieces.append(obj)
    return obj


def _loft(name, centers, radii, pieces, sides=20, flatten=1.0):
    """Closed round tube with locally perpendicular rings, in object coordinates."""
    vertices, faces = [], []
    points = [Vector(p) for p in centers]
    for i, center in enumerate(points):
        if i == 0:
            direction = points[1] - center
        elif i == len(points) - 1:
            direction = center - points[i - 1]
        else:
            direction = points[i + 1] - points[i - 1]
        direction.normalize()
        ref = Vector((0.0, 1.0, 0.0))
        if abs(direction.dot(ref)) > 0.9:
            ref = Vector((1.0, 0.0, 0.0))
        u = direction.cross(ref).normalized()
        v = direction.cross(u).normalized()
        for j in range(sides):
            angle = 2.0 * math.pi * j / sides
            point = center + radii[i] * (math.cos(angle) * u + flatten * math.sin(angle) * v)
            vertices.append(tuple(point))
    for i in range(len(points) - 1):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(points) - 1) * sides + j for j in range(sides)))
    mesh = bpy.data.meshes.new(name + "Surface")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for poly in mesh.polygons:
        poly.use_smooth = True
    pieces.append(obj)
    return obj


def _limb(name, start, end, radii, pieces, flatten=1.0):
    a, b = Vector(start), Vector(end)
    centers = [a.lerp(b, i / (len(radii) - 1)) for i in range(len(radii))]
    return _loft(name, centers, radii, pieces, flatten=flatten)


def _curve_points(points, subdivisions=5):
    """Catmull-Rom samples, preserving each tail landmark exactly."""
    out = []
    vectors = [Vector(p) for p in points]
    for i in range(len(vectors) - 1):
        p0 = vectors[max(0, i - 1)]
        p1 = vectors[i]
        p2 = vectors[i + 1]
        p3 = vectors[min(len(vectors) - 1, i + 2)]
        for j in range(subdivisions):
            t = j / subdivisions
            p = 0.5 * (
                2 * p1
                + (-p0 + p2) * t
                + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
            )
            out.append(tuple(p))
    out.append(tuple(vectors[-1]))
    return out


def _accent(name, center, radius, material, details, rotation=None):
    obj = _ellipsoid(name, center, radius, details, rotation, segments=16, rings=10)
    obj.data.materials.append(material)
    obj["rig_bone"] = "head"
    return obj


def _nose(material, details):
    # A broad, feline inverted triangular nose: no spherical button nose.
    front = [(-0.055, -0.316, 1.914), (0.055, -0.316, 1.914), (0.0, -0.335, 1.872)]
    back = [(-0.048, -0.282, 1.911), (0.048, -0.282, 1.911), (0.0, -0.289, 1.873)]
    vertices = front + back
    faces = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]
    mesh = bpy.data.meshes.new("KaiNoseSurface")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Kai_Nose", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Soft nose edges", "BEVEL")
    bevel.width = 0.009
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.select_set(False)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj["rig_bone"] = "head"
    details.append(obj)


def _mouth(material, details):
    # Subtle mouth crease under the muzzle, swept as real tiny geometry.
    points = [
        (-0.111, -0.258, 1.826), (-0.075, -0.290, 1.814),
        (-0.031, -0.304, 1.816), (0.0, -0.314, 1.830),
        (0.031, -0.304, 1.816), (0.075, -0.290, 1.814),
        (0.111, -0.258, 1.826),
    ]
    obj = _loft("Kai_MouthCrease", _curve_points(points, 3), [0.003] * 19, details, sides=8)
    obj.data.materials.append(material)
    obj["rig_bone"] = "head"


def _claws(material, details):
    # Small original tapered keratin forms, not an armored gauntlet silhouette.
    for side, suffix in ((1, ".L"), (-1, ".R")):
        for toe in range(4):
            x = side * 0.20 - 0.075 + toe * 0.050
            y = -0.269 - (0.010 if toe in (1, 2) else 0.0)
            centers = [(x, y, 0.058), (x, y - 0.018, 0.052),
                       (x, y - 0.031, 0.036), (x, y - 0.038, 0.026)]
            obj = _loft("Kai_FootClaw" + suffix, centers,
                        [0.009, 0.008, 0.005, 0.0008], details, sides=6)
            obj.data.materials.append(material)
            obj["rig_bone"] = "foot" + suffix
        for finger in range(4):
            y = -0.078 + finger * 0.043
            centers = [(side * 1.004, y, 1.153), (side * 1.024, y, 1.146),
                       (side * 1.038, y, 1.133), (side * 1.044, y, 1.121)]
            obj = _loft("Kai_HandClaw" + suffix, centers,
                        [0.008, 0.007, 0.004, 0.0008], details, sides=6)
            obj.data.materials.append(material)
            obj["rig_bone"] = "hand" + suffix


def create_tiger_mesh():
    """Return a unified body, small face/claw details, and the rig landmarks.

    A high resolution union is simplified to at most 26k body triangles. This
    gives actual connected joint surfaces but does not pretend to be production
    hand-retopology. Rigging owns the soft weights and pose deformation checks.
    """
    materials = {
        "clay": _material("Kai Grey Clay", (0.40, 0.425, 0.445)),
        "dark": _material("Kai Dark Clay", (0.115, 0.135, 0.15)),
        "eye": _material("Kai Eye Clay", (0.245, 0.27, 0.28), roughness=0.44),
        "iris": _material("Kai Iris Clay", (0.52, 0.54, 0.53), roughness=0.50),
        "inner_ear": _material("Kai Inner Ear Clay", (0.29, 0.305, 0.32)),
    }
    parts, details = [], []

    # Broad ribcage and lats flow into a narrower waist and stable pelvis.
    _ellipsoid("Ribcage", (0, 0.022, 1.40), (0.281, 0.172, 0.302), parts)
    _ellipsoid("Abdomen", (0, -0.020, 1.17), (0.199, 0.126, 0.246), parts)
    _ellipsoid("PelvisMass", (0, 0.030, 1.00), (0.235, 0.170, 0.174), parts)
    _ellipsoid("UpperBack", (0, 0.075, 1.49), (0.270, 0.139, 0.193), parts)
    for side in (-1, 1):
        _ellipsoid("Pectoral", (side * 0.132, -0.072, 1.487), (0.164, 0.104, 0.138), parts)
        _ellipsoid("Trapezius", (side * 0.124, 0.025, 1.619), (0.133, 0.123, 0.088), parts)
        _ellipsoid("Gluteal", (side * 0.117, 0.079, 0.985), (0.126, 0.140, 0.151), parts)
        _ellipsoid("HipTransition", (side * 0.150, 0.019, 0.942), (0.143, 0.147, 0.181), parts)
    _ellipsoid("Neck", (0, 0.0, 1.720), (0.141, 0.129, 0.195), parts)

    # Sculpted feline skull, muzzle pads, jaw and flared cheek volume.
    _ellipsoid("Skull", (0, -0.014, 1.916), (0.188, 0.164, 0.196), parts)
    _ellipsoid("Forehead", (0, -0.091, 1.977), (0.145, 0.102, 0.128), parts)
    _ellipsoid("LowerJaw", (0, -0.148, 1.804), (0.121, 0.115, 0.070), parts)
    _ellipsoid("MuzzleBridge", (0, -0.177, 1.923), (0.080, 0.100, 0.069), parts)
    for side in (-1, 1):
        _ellipsoid("Cheek", (side * 0.157, -0.030, 1.872), (0.095, 0.131, 0.135), parts)
        _ellipsoid("CheekLower", (side * 0.170, -0.006, 1.793), (0.074, 0.092, 0.087), parts)
        _ellipsoid("MuzzlePad", (side * 0.074, -0.205, 1.863), (0.092, 0.112, 0.066), parts)
        _ellipsoid("Ear", (side * 0.165, 0.022, 2.078), (0.066, 0.045, 0.069), parts)
        _ellipsoid("Brow", (side * 0.096, -0.155, 1.995), (0.072, 0.041, 0.025), parts,
                   rotation=(0, side * -0.20, side * -0.12))

    for side, suffix in ((1, ".L"), (-1, ".R")):
        shoulder = LANDMARKS["shoulder" + suffix]
        elbow = LANDMARKS["elbow" + suffix]
        wrist = LANDMARKS["wrist" + suffix]
        _ellipsoid("Deltoid" + suffix, shoulder, (0.127, 0.124, 0.132), parts)
        _limb("UpperArm" + suffix, shoulder, elbow,
              [0.110, 0.115, 0.109, 0.095, 0.082], parts)
        _ellipsoid("Elbow" + suffix, elbow, (0.085, 0.084, 0.085), parts)
        _limb("Forearm" + suffix, elbow, wrist,
              [0.082, 0.098, 0.096, 0.078, 0.064], parts)
        _ellipsoid("Wrist" + suffix, wrist, (0.067, 0.067, 0.071), parts)
        _ellipsoid("Paw" + suffix, (side * 0.891, -0.016, 1.181), (0.123, 0.086, 0.093), parts,
                   rotation=(0, side * 0.36, 0))
        # Four rounded knuckles, deliberately a fighting paw rather than a human hand.
        for finger in range(4):
            y = -0.078 + finger * 0.043
            _ellipsoid("Knuckle" + suffix, (side * 0.963, y, 1.157), (0.059, 0.029, 0.063), parts)
        _ellipsoid("Thumb" + suffix, (side * 0.858, -0.086, 1.148), (0.061, 0.042, 0.062), parts)

        hip, knee, ankle = (LANDMARKS[name + suffix] for name in ("hip", "knee", "ankle"))
        _limb("Thigh" + suffix, hip, knee,
              [0.126, 0.146, 0.144, 0.123, 0.097], parts, flatten=1.06)
        _ellipsoid("Kneecap" + suffix, (side * 0.18, -0.052, 0.520), (0.084, 0.073, 0.083), parts)
        _limb("Shin" + suffix, knee, ankle,
              [0.094, 0.113, 0.107, 0.084, 0.064], parts)
        _ellipsoid("Ankle" + suffix, ankle, (0.068, 0.071, 0.087), parts)
        _ellipsoid("Heel" + suffix, (side * 0.20, 0.032, 0.071), (0.091, 0.098, 0.074), parts)
        _ellipsoid("Foot" + suffix, (side * 0.20, -0.076, 0.068), (0.115, 0.165, 0.075), parts)
        for toe in range(4):
            x = side * 0.20 - 0.075 + toe * 0.050
            # The inner pair reach slightly farther, retaining a broad feline paw.
            y = -0.219 - (0.010 if toe in (1, 2) else 0.0)
            _ellipsoid("Toe" + suffix, (x, y, 0.053), (0.033, 0.067, 0.051), parts)

    tail_points = _curve_points(LANDMARKS["tail_joints"], subdivisions=5)
    tail_radii = [0.068 * (1.0 - i / (len(tail_points) - 1)) + 0.041 * i / (len(tail_points) - 1)
                  for i in range(len(tail_points))]
    _loft("CurvedTail", tail_points, tail_radii, parts, sides=16)
    _ellipsoid("TailTip", tail_points[-1], (0.043, 0.043, 0.047), parts)

    # Voxel union provides one real skin, without internal rigid overlaps.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = "Kai_Body"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    union = body.modifiers.new("Continuous anatomical surface", "REMESH")
    union.mode = "VOXEL"
    union.voxel_size = 0.010
    union.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=union.name)
    smooth = body.modifiers.new("Clay surface smoothing", "SMOOTH")
    smooth.factor = 0.54
    smooth.iterations = 4
    bpy.ops.object.modifier_apply(modifier=smooth.name)

    # A flat contact patch permits stable foot placement. Upper foot remains round.
    for vertex in body.data.vertices:
        if vertex.co.z < 0.016:
            vertex.co.z = 0.0
    tri_count = sum(len(poly.vertices) - 2 for poly in body.data.polygons)
    if tri_count > 26000:
        decimate = body.modifiers.new("Study mobile mesh budget", "DECIMATE")
        decimate.ratio = 26000.0 / tri_count
        decimate.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    for vertex in body.data.vertices:
        if vertex.co.z < 0.0:
            vertex.co.z = 0.0
    body.data.materials.clear()
    body.data.materials.append(materials["clay"])
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    body["study_mesh"] = True
    body["construction"] = "continuous voxel-unioned original clay study"
    body["coordinate_contract"] = "metres, +X left, -Y forward, +Z up; full-foot biped"

    # Small accents make the muzzle and eye line legible while preserving grey clay.
    for side in (-1, 1):
        _accent("Kai_InnerEar", (side * 0.167, -0.018, 2.080), (0.042, 0.010, 0.047),
                materials["inner_ear"], details)
        _accent("Kai_Eye", (side * 0.102, -0.161, 1.969), (0.040, 0.027, 0.020),
                materials["dark"], details, rotation=(0, side * -0.16, 0))
        _accent("Kai_Iris", (side * 0.103, -0.185, 1.970), (0.012, 0.006, 0.016),
                materials["iris"], details)
        _accent("Kai_Pupil", (side * 0.103, -0.191, 1.970), (0.004, 0.003, 0.013),
                materials["dark"], details)
    _nose(materials["dark"], details)
    _mouth(materials["dark"], details)
    _claws(materials["dark"], details)

    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    body.data.update()
    return {"body": body, "details": details, "landmarks": dict(LANDMARKS), "materials": materials}
