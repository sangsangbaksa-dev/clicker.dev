#!/usr/bin/env python3
"""Build the Monster Hunt 3D models in Blender and export them as GLB.

Both monsters are rock bodies overgrown with hexagonal ore crystals. Every detachable
armor cluster is its own object named `plate_<n>` (n = break order) parented to the part
it sits on, so the game can knock them off one by one. Animated parts are separate
objects whose origin sits at their pivot:

  specter (잔향 해파리): body (bell) · eye_L/eye_R (+ pupil_*) · core · tent_<i>_<seg> chains
  golem   (위상 골렘):   body (torso) · head · arm_L/arm_R (shoulder pivot) · leg_L/leg_R (hip
                         pivot) · eye_L/eye_R (+ pupil_*) · core

    pip install bpy==4.2.*
    python3 scripts/clicker-monsters-3d.py            # export both GLBs (Draco-compressed via npx)
    python3 scripts/clicker-monsters-3d.py --preview  # also render PNG previews (Cycles, CPU)

Blender is Z-up; the glTF exporter converts to Y-up. Units are metres; the game scales.
"""
from __future__ import annotations

import math
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import bpy  # noqa: I001 — must load first: it registers bmesh and mathutils
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "clicker" / "monster"
PREVIEW = "--preview" in sys.argv


# ---------------------------------------------------------------------------
# Scene + materials
# ---------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name: str, color, *, rough=0.8, metal=0.0, emit=None, emit_strength=0.0, transmission=0.0, ior=1.45):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["IOR"].default_value = ior
    if transmission:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


def palette(kind: str):
    if kind == "specter":
        return {
            "rock": material("rock", (0.018, 0.034, 0.044), rough=0.9),
            "ore": material("ore", (0.04, 0.52, 0.85), rough=0.14, metal=0.1, emit=(0.08, 0.62, 1.0), emit_strength=1.4),
            "nugget": material("nugget", (0.03, 0.3, 0.5), rough=0.3, metal=0.3, emit=(0.05, 0.45, 0.8), emit_strength=0.9),
            "ore_base": material("ore_base", (0.03, 0.09, 0.12), rough=0.6),
            "eye": material("eye", (0.55, 0.9, 1.0), rough=0.3, emit=(0.45, 0.9, 1.0), emit_strength=1.2),
            "pupil": material("pupil", (0.01, 0.02, 0.03), rough=0.2),
            "core": material("core", (0.5, 0.95, 1.0), rough=0.1, emit=(0.4, 0.9, 1.0), emit_strength=6.0),
        }
    return {
        "rock": material("rock", (0.032, 0.026, 0.042), rough=0.9),
        "ore": material("ore", (0.36, 0.1, 0.9), rough=0.14, metal=0.1, emit=(0.45, 0.16, 1.0), emit_strength=1.4),
        "nugget": material("nugget", (0.22, 0.07, 0.55), rough=0.3, metal=0.3, emit=(0.32, 0.1, 0.8), emit_strength=0.9),
        "ore_base": material("ore_base", (0.08, 0.05, 0.12), rough=0.6),
        "eye": material("eye", (1.0, 0.6, 0.2), rough=0.3, emit=(1.0, 0.55, 0.15), emit_strength=1.6),
        "pupil": material("pupil", (0.02, 0.01, 0.02), rough=0.2),
        "core": material("core", (0.8, 0.6, 1.0), rough=0.1, emit=(0.7, 0.45, 1.0), emit_strength=6.0),
    }


# ---------------------------------------------------------------------------
# Mesh helpers
# ---------------------------------------------------------------------------

def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def mesh_object(name: str, bm: bmesh.types.BMesh, mat, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    return link(obj, parent)


def rocky(obj, strength=0.12, size=0.35, seed=0, levels=2):
    """Subdivide + displace with a Voronoi-ish texture, then apply — real geometry, exports cleanly."""
    sub = obj.modifiers.new("sub", "SUBSURF")
    sub.levels = levels
    sub.render_levels = levels
    tex = bpy.data.textures.new(f"{obj.name}_rock", "VORONOI")
    tex.noise_scale = size
    tex.distance_metric = "DISTANCE"
    disp = obj.modifiers.new("disp", "DISPLACE")
    disp.texture = tex
    disp.strength = strength
    disp.mid_level = 0.6
    disp.texture_coords = "OBJECT"
    tex2 = bpy.data.textures.new(f"{obj.name}_grain", "CLOUDS")
    tex2.noise_scale = size * 0.35
    disp2 = obj.modifiers.new("grain", "DISPLACE")
    disp2.texture = tex2
    disp2.strength = strength * 0.25
    disp2.texture_coords = "OBJECT"
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    # Faceted, chiselled stone reads better than smooth shading.
    for poly in obj.data.polygons:
        poly.use_smooth = False


def crystal(bm, base: Vector, axis: Vector, radius: float, height: float, rng: random.Random, sides=6):
    """One hexagonal prism with a pointed, slightly off-centre tip, added into `bm`."""
    axis = axis.normalized()
    q = axis.to_track_quat("Z", "Y")
    twist = rng.uniform(0, math.tau)
    taper = rng.uniform(0.75, 0.95)
    tip = height * rng.uniform(0.28, 0.45)
    bottom, top = [], []
    for k in range(sides):
        a = twist + k * math.tau / sides
        r = radius * rng.uniform(0.9, 1.08)
        local = Vector((math.cos(a) * r, math.sin(a) * r, -radius * 0.4))
        bottom.append(bm.verts.new(base + q @ local))
        local_top = Vector((math.cos(a) * r * taper, math.sin(a) * r * taper, height))
        top.append(bm.verts.new(base + q @ local_top))
    apex = bm.verts.new(base + q @ Vector((rng.uniform(-0.2, 0.2) * radius, rng.uniform(-0.2, 0.2) * radius, height + tip)))
    for k in range(sides):
        n = (k + 1) % sides
        bm.faces.new((bottom[k], bottom[n], top[n], top[k]))
        bm.faces.new((top[k], top[n], apex))
    bm.faces.new(list(reversed(bottom)))


def surface_point(bvh: BVHTree, origin: Vector, direction: Vector):
    """Ray from outside toward the body; returns (location, normal) on its surface."""
    hit = bvh.ray_cast(origin, direction)
    if hit[0] is None:
        return None
    return hit[0], hit[1]


def cluster(name: str, host_bvh: BVHTree, host_world: Matrix, aim_from: Vector, mats, rng: random.Random,
            size: float, count: int, parent, spread=0.55, direction: Vector | None = None):
    """A detachable ore cluster: a rock seat plus several crystals, grown where a ray from
    `aim_from` (world space; toward the host centre unless `direction` is given) lands."""
    inv = host_world.inverted()
    ray_dir = (inv.to_3x3() @ direction).normalized() if direction else (inv @ host_world.translation - inv @ aim_from).normalized()
    hit = surface_point(host_bvh, inv @ aim_from, ray_dir)
    if not hit:
        raise RuntimeError(f"{name}: ray missed the host")
    loc_local, normal_local = hit
    loc = host_world @ loc_local
    normal = (host_world.to_3x3() @ normal_local).normalized()

    # Seat: a squashed rocky lump the crystals grow out of.
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=size * 0.55)
    bmesh.ops.scale(bm, vec=(1.0, 1.0, 0.45), verts=bm.verts)
    seat = mesh_object(f"{name}_seat", bm, mats["ore_base"])
    rocky(seat, strength=size * 0.18, size=size * 0.6, levels=1)

    bm = bmesh.new()
    for i in range(count):
        tilt = Vector((rng.uniform(-spread, spread), rng.uniform(-spread, spread), 1.0)).normalized()
        offset = Vector((rng.uniform(-0.3, 0.3) * size, rng.uniform(-0.3, 0.3) * size, 0.0))
        scale = 1.0 if i == 0 else rng.uniform(0.45, 0.85)
        crystal(bm, offset, tilt, size * 0.2 * scale, size * 0.95 * scale, rng)
    shards = mesh_object(name, bm, mats["ore"])
    for poly in shards.data.polygons:
        poly.use_smooth = False

    # Merge the seat into the crystal object so each plate is one mesh (join keeps both materials).
    bpy.ops.object.select_all(action="DESELECT")
    seat.select_set(True)
    shards.select_set(True)
    bpy.context.view_layer.objects.active = shards
    bpy.ops.object.join()

    # Orient: local +Z along the surface normal, sunk slightly into the host.
    rot = normal.to_track_quat("Z", "Y").to_matrix().to_4x4()
    world = Matrix.Translation(loc - normal * size * 0.12) @ rot
    shards.matrix_world = world
    bpy.context.view_layer.update()
    shards.parent = parent
    shards.matrix_parent_inverse = parent.matrix_world.inverted()
    return shards


def mesh_centre(obj) -> Vector:
    """Centre of the part's own geometry (local space). Parts pivot at a joint, so rays aimed
    at the origin would pile everything up at the shoulder or hip."""
    corners = [Vector(c) for c in obj.bound_box]
    return sum(corners, Vector()) / 8


def speckle(host, mats, rng: random.Random, count: int, size: float, name="speckles"):
    """Small fixed crystals peppered over a part — texture, not armor (they never break)."""
    bvh = BVHTree.FromObject(host, bpy.context.evaluated_depsgraph_get())
    centre = mesh_centre(host)
    bm = bmesh.new()
    placed = 0
    tries = 0
    while placed < count and tries < count * 20:
        tries += 1
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if d.length < 0.2:
            continue
        d.normalize()
        hit = bvh.ray_cast(centre + d * 10, -d)
        if hit[0] is None:
            continue
        crystal(bm, hit[0] - hit[1] * 0.01, hit[1] + Vector((rng.uniform(-.3, .3), rng.uniform(-.3, .3), 0)), size * rng.uniform(0.5, 1), size * rng.uniform(1.5, 3), rng)
        placed += 1
    obj = mesh_object(f"{host.name}_{name}", bm, mats["ore"], parent=host)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def nuggets(host, mats, rng: random.Random, count: int, size: float, avoid: list[tuple[Vector, float]] = ()):
    """Ore crust: faceted ore lumps half-sunk all over a part so the body reads as ore-encrusted
    stone, not stone with a few crystals. Skips spots listed in `avoid` (local point, radius)."""
    bvh = BVHTree.FromObject(host, bpy.context.evaluated_depsgraph_get())
    centre = mesh_centre(host)
    bm = bmesh.new()
    placed = tries = 0
    while placed < count and tries < count * 30:
        tries += 1
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if d.length < 0.2:
            continue
        d.normalize()
        hit = bvh.ray_cast(centre + d * 20, -d)
        if hit[0] is None or any((hit[0] - p).length < r for p, r in avoid):
            continue
        r = size * rng.uniform(0.55, 1.25)
        lump = bmesh.new()
        bmesh.ops.create_icosphere(lump, subdivisions=1, radius=r)
        for v in lump.verts:
            v.co *= rng.uniform(0.75, 1.2)
        bmesh.ops.scale(lump, vec=(1, 1, rng.uniform(0.45, 0.7)), verts=lump.verts)
        q = hit[1].to_track_quat("Z", "Y")
        bmesh.ops.rotate(lump, cent=(0, 0, 0), matrix=q.to_matrix(), verts=lump.verts)
        bmesh.ops.translate(lump, vec=hit[0] - hit[1] * r * 0.25, verts=lump.verts)
        me = bpy.data.meshes.new("tmp")
        lump.to_mesh(me)
        lump.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        placed += 1
    obj = mesh_object(f"{host.name}_ore", bm, mats["nugget"], parent=host)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def eye(name: str, parent, loc: Vector, radius: float, mats, look=Vector((0, -1, 0))):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=radius)
    ball = mesh_object(name, bm, mats["eye"])
    ball.location = loc
    ball.parent = parent
    for poly in ball.data.polygons:
        poly.use_smooth = True
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=radius * 0.5)
    pupil = mesh_object(f"pupil_{name.split('_')[1]}", bm, mats["pupil"], parent=ball)
    pupil.location = look.normalized() * radius * 0.62
    pupil.scale = (1, 0.55, 1)
    for poly in pupil.data.polygons:
        poly.use_smooth = True
    return ball


def core(parent, loc: Vector, size: float, mats):
    bm = bmesh.new()
    crystal(bm, Vector((0, 0, -size)), Vector((0, 0, 1)), size * 0.45, size * 1.4, random.Random(3))
    obj = mesh_object("core", bm, mats["core"], parent=parent)
    obj.location = loc
    return obj


def origin_to(obj, point_world: Vector):
    """Move an object's origin (its pivot) without moving its geometry."""
    offset = obj.matrix_world.inverted() @ point_world
    obj.data.transform(Matrix.Translation(-offset))
    obj.location = obj.location + obj.matrix_world.to_3x3() @ offset


# ---------------------------------------------------------------------------
# Specter — a stone jellyfish with a crystal crown
# ---------------------------------------------------------------------------

def build_specter():
    rng = random.Random(11)
    mats = palette("specter")

    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1.0)
    # Keep the upper cap, flare the rim outward and scallop it into lobes.
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.25], context="VERTS")
    for v in bm.verts:
        ang = math.atan2(v.co.y, v.co.x)
        rim = max(0.0, (0.2 - v.co.z) / 0.45)
        v.co.x *= 1.25 + rim * 0.25
        v.co.y *= 1.25 + rim * 0.25
        v.co.z = v.co.z * 0.95 - rim * 0.12 * (0.5 + 0.5 * math.cos(ang * 8))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.12)
    body = mesh_object("body", bm, mats["rock"])
    rocky(body, strength=0.09, size=0.3, seed=1)

    core(body, Vector((0, 0, 0.1)), 0.35, mats)
    eye_l = Vector((-0.42, -1.1, 0.25))
    eye_r = Vector((0.42, -1.1, 0.25))
    eye("eye_L", body, eye_l, 0.2, mats)
    eye("eye_R", body, eye_r, 0.2, mats)
    face = [(eye_l, 0.34), (eye_r, 0.34)]
    nuggets(body, mats, rng, 110, 0.13, avoid=face)
    speckle(body, mats, rng, 70, 0.045)

    # Tentacles: 8 chains of 4 tapered stone segments, each pivoting at its top.
    for i in range(8):
        a = i * math.tau / 8 + math.pi / 8
        parent = body
        top = Vector((math.cos(a) * 0.95, math.sin(a) * 0.95, -0.22))
        radius = 0.2
        for seg in range(4):
            length = 0.42 - seg * 0.04
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=radius * 0.72, radius2=radius, depth=length)
            obj = mesh_object(f"tent_{i}_{seg}", bm, mats["rock"])
            obj.location = top - Vector((0, 0, length / 2))
            rocky(obj, strength=0.03, size=0.12, levels=1)
            bpy.context.view_layer.update()
            origin_to(obj, top)
            bpy.context.view_layer.update()
            obj.parent = parent
            obj.matrix_parent_inverse = parent.matrix_world.inverted()
            nuggets(obj, mats, rng, 4 - seg // 2, radius * 0.55)
            if seg < 3:
                speckle(obj, mats, rng, 3, radius * 0.22, name="nubs")
            parent = obj
            top = top - Vector((0, 0, length * 0.96))
            radius *= 0.72

    bpy.context.view_layer.update()
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    world = body.matrix_world.copy()
    # Break order: flanks and rim first, the big crown last.
    aims = [
        (Vector((-3, 0, 0.1)), 0.65, 6),
        (Vector((3, 0, 0.1)), 0.65, 6),
        (Vector((-1.8, -1.6, 2.0)), 0.7, 6),
        (Vector((1.8, -1.6, 2.0)), 0.7, 6),
        (Vector((0, 2.5, 1.5)), 0.75, 6),
        (Vector((0, 0, 4)), 1.05, 9),
    ]
    for n, (aim, size, count) in enumerate(aims):
        cluster(f"plate_{n}", bvh, world, aim, mats, rng, size, count, body)
    return body


# ---------------------------------------------------------------------------
# Golem — a stone giant armored in violet ore
# ---------------------------------------------------------------------------

def block(name: str, size: Vector, mats, bevel=0.25, taper=1.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if taper != 1.0:
        for v in bm.verts:
            if v.co.z < 0:
                v.co.x *= taper
                v.co.y *= taper
    obj = mesh_object(name, bm, mats["rock"])
    bev = obj.modifiers.new("bev", "BEVEL")
    bev.width = bevel
    bev.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="bev")
    return obj


def build_golem():
    rng = random.Random(23)
    mats = palette("golem")

    # Hunched brute: broad shoulders, head sunk forward between them, long heavy arms.
    body = block("body", Vector((2.2, 1.3, 1.6)), mats, bevel=0.32, taper=0.72)
    body.location = (0, 0, 2.35)
    rocky(body, strength=0.14, size=0.4, seed=2)

    head = block("head", Vector((0.8, 0.75, 0.62)), mats, bevel=0.2)
    head.location = (0, -0.35, 3.3)
    rocky(head, strength=0.07, size=0.3, seed=3)
    bpy.context.view_layer.update()
    head_pivot = Vector((0, -0.2, 3.05))
    origin_to(head, head_pivot)
    bpy.context.view_layer.update()
    head.parent = body
    head.matrix_parent_inverse = body.matrix_world.inverted()
    eye_l = Vector((-0.19, -0.74, 3.36)) - head_pivot
    eye_r = Vector((0.19, -0.74, 3.36)) - head_pivot
    eye("eye_L", head, eye_l, 0.1, mats)
    eye("eye_R", head, eye_r, 0.1, mats)

    core_local = Vector((0, -0.62, 0.02))
    core(body, core_local, 0.24, mats)

    arms = {}
    legs = {}
    for side, sx in (("L", -1), ("R", 1)):
        arm = block(f"arm_{side}", Vector((0.7, 0.75, 1.8)), mats, bevel=0.2, taper=1.3)
        arm.location = (sx * 1.45, 0, 2.2)
        rocky(arm, strength=0.09, size=0.3)
        fist = block(f"fist_{side}", Vector((0.92, 0.92, 0.78)), mats, bevel=0.22)
        fist.location = (sx * 1.5, -0.05, 1.05)
        rocky(fist, strength=0.07, size=0.25)
        bpy.ops.object.select_all(action="DESELECT")
        fist.select_set(True)
        arm.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.join()
        bpy.context.view_layer.update()
        origin_to(arm, Vector((sx * 1.3, 0, 3.05)))
        bpy.context.view_layer.update()
        arm.parent = body
        arm.matrix_parent_inverse = body.matrix_world.inverted()
        arms[side] = arm

        leg = block(f"leg_{side}", Vector((0.78, 0.82, 1.2)), mats, bevel=0.16, taper=1.1)
        leg.location = (sx * 0.62, 0, 0.85)
        rocky(leg, strength=0.08, size=0.3)
        foot = block(f"foot_{side}", Vector((0.98, 1.12, 0.36)), mats, bevel=0.12)
        foot.location = (sx * 0.62, -0.12, 0.18)
        bpy.ops.object.select_all(action="DESELECT")
        foot.select_set(True)
        leg.select_set(True)
        bpy.context.view_layer.objects.active = leg
        bpy.ops.object.join()
        bpy.context.view_layer.update()
        origin_to(leg, Vector((sx * 0.62, 0, 1.4)))
        bpy.context.view_layer.update()
        leg.parent = body
        leg.matrix_parent_inverse = body.matrix_world.inverted()
        legs[side] = leg

    # Ore crust over every part (the core stays exposed so it can glow through).
    nuggets(body, mats, rng, 150, 0.16, avoid=[(core_local, 0.45)])
    nuggets(head, mats, rng, 22, 0.1, avoid=[(eye_l, 0.2), (eye_r, 0.2)])
    for part in (*arms.values(), *legs.values()):
        nuggets(part, mats, rng, 40, 0.13)
    speckle(body, mats, rng, 45, 0.06)
    speckle(head, mats, rng, 10, 0.04)
    for part in arms.values():
        speckle(part, mats, rng, 10, 0.05)

    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    bvh_body = BVHTree.FromObject(body, depsgraph)
    bvh_head = BVHTree.FromObject(head, depsgraph)
    wb, wh = body.matrix_world.copy(), head.matrix_world.copy()
    down, back = Vector((0, 0, -1)), Vector((0, 1, 0))
    # Break order matches the game: forearms, shoulders, crown, chest, belly.
    for n, side in enumerate(("L", "R")):
        arm = arms[side]
        sx = -1 if side == "L" else 1
        cluster(f"plate_{n}", BVHTree.FromObject(arm, depsgraph), arm.matrix_world.copy(),
                Vector((sx * 4, -0.3, 1.5)), mats, rng, 0.6, 6, arm, direction=Vector((-sx, 0.15, 0)))
    cluster("plate_2", bvh_body, wb, Vector((-0.8, 0.1, 6)), mats, rng, 0.85, 7, body, direction=down)
    cluster("plate_3", bvh_body, wb, Vector((0.8, 0.1, 6)), mats, rng, 0.85, 7, body, direction=down)
    cluster("plate_4", bvh_head, wh, Vector((0, -0.3, 7)), mats, rng, 0.6, 7, head, direction=down)
    cluster("plate_5", bvh_body, wb, Vector((-0.6, -5, 2.8)), mats, rng, 0.62, 6, body, direction=back)
    cluster("plate_6", bvh_body, wb, Vector((0.6, -5, 2.8)), mats, rng, 0.62, 6, body, direction=back)
    cluster("plate_7", bvh_body, wb, Vector((0, -5, 1.85)), mats, rng, 0.62, 6, body, direction=back)
    return body


# ---------------------------------------------------------------------------
# Export + preview
# ---------------------------------------------------------------------------

def export(kind: str):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{kind}.glb"
    raw = Path(tempfile.mkdtemp()) / f"{kind}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(raw),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_extras=False,
        export_animations=False,
    )
    # Draco only compresses geometry — node names and pivots (plates, limbs) stay intact,
    # unlike `optimize`/meshopt quantization which would flatten or move them.
    try:
        subprocess.run(["npx", "--yes", "@gltf-transform/cli@4", "draco", str(raw), str(path)], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError) as error:
        print(f"  draco failed ({error}); writing uncompressed — the game's loader handles both")
        shutil.copy(raw, path)
    tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print(f"  {path.name}: {path.stat().st_size / 1024:.0f} KB, {tris} faces, "
          f"{len([o for o in bpy.data.objects if o.name.startswith('plate_')])} plates")


def preview(kind: str):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.018, 0.03, 1)
    scene.world = world
    height = 2.2 if kind == "golem" else 0.3
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.location = (3.2, -7.5, height + 1.6)
    cam.rotation_euler = (math.radians(80), 0, math.radians(23))
    cam.data.lens = 40 if kind == "golem" else 48
    link(cam)
    scene.camera = cam
    for name, loc, energy, color in (
        ("key", (4, -4, 6), 900, (1.0, 0.95, 0.9)),
        ("rim", (-4, 4, 5), 700, (0.5, 0.7, 1.0) if kind == "specter" else (0.7, 0.55, 1.0)),
        ("fill", (-5, -5, 1), 250, (0.6, 0.7, 0.9)),
    ):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        light.data.energy = energy
        light.data.size = 3
        light.data.color = color
        light.location = loc
        light.rotation_euler = (Vector((0, 0, height)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        link(light)
    scene.render.filepath = str(OUT.parent.parent.parent / "media" / f"monster_{kind}_preview.png")
    Path(scene.render.filepath).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print(f"  preview → {scene.render.filepath}")


if __name__ == "__main__":
    for kind, build in (("specter", build_specter), ("golem", build_golem)):
        reset_scene()
        build()
        export(kind)
        if PREVIEW:
            preview(kind)
