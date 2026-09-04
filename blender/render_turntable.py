import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

CAMERA_LOCATION = (4.2, -6.0, 2.4)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--frames", type=int, default=36)
    parser.add_argument("--size", type=int, default=600)
    parser.add_argument("--padding", type=float, default=1.12)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def import_model(path):
    extension = os.path.splitext(path)[1].lower()
    if extension not in {".glb", ".gltf"}:
        raise RuntimeError("Blender input must be a GLB or glTF file")

    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]

    for obj in list(imported):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
            imported.remove(obj)

    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("The imported model contains no mesh objects")
    return imported, meshes


def world_bounds(meshes):
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(corner[index] for corner in corners) for index in range(3)))
    maximum = Vector(tuple(max(corner[index] for corner in corners) for index in range(3)))
    center = (minimum + maximum) * 0.5

    radial_extent = max(
        math.hypot(corner.x - center.x, corner.y - center.y) for corner in corners
    )
    vertical_extent = max(abs(corner.z - center.z) for corner in corners)
    camera_elevation = math.atan2(
        CAMERA_LOCATION[2], math.hypot(CAMERA_LOCATION[0], CAMERA_LOCATION[1])
    )
    projected_vertical_extent = (
        math.cos(camera_elevation) * vertical_extent
        + math.sin(camera_elevation) * radial_extent
    )
    fit_extent = max(radial_extent, projected_vertical_extent)
    if not math.isfinite(fit_extent) or fit_extent <= 1e-8:
        raise RuntimeError("The model has invalid or zero-sized bounds")
    return center, fit_extent


def create_normalized_pivot(imported, center, radius):
    pivot = bpy.data.objects.new("ArtifactTurntable", None)
    bpy.context.scene.collection.objects.link(pivot)

    imported_set = set(imported)
    roots = [obj for obj in imported if obj.parent is None or obj.parent not in imported_set]
    normalization = Matrix.Scale(1.0 / radius, 4) @ Matrix.Translation(-center)
    for obj in roots:
        world_matrix = obj.matrix_world.copy()
        obj.parent = pivot
        obj.matrix_world = normalization @ world_matrix

    bpy.context.view_layer.update()
    return pivot


def point_at(obj, target=(0.0, 0.0, 0.0)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, color):
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    point_at(light)


def configure_scene(size, padding):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 60

    world = bpy.data.worlds.new("ArtifactWorld") if scene.world is None else scene.world
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.16, 0.16, 0.16, 1.0)
        background.inputs["Strength"].default_value = 0.35

    camera_data = bpy.data.cameras.new("ArtifactCamera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.0 * padding
    camera_data.lens = 50
    camera_data.clip_start = 0.01
    camera_data.clip_end = 100.0
    camera = bpy.data.objects.new("ArtifactCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = CAMERA_LOCATION
    point_at(camera)
    scene.camera = camera

    add_area_light("Key", (3.8, -4.0, 5.2), 900, 4.0, (1.0, 0.92, 0.82))
    add_area_light("Fill", (-4.5, -2.0, 2.8), 550, 5.0, (0.72, 0.84, 1.0))
    add_area_light("Rim", (0.5, 4.5, 4.5), 800, 3.0, (1.0, 1.0, 1.0))
    return scene


def render_frames(scene, pivot, output, frame_count):
    os.makedirs(output, exist_ok=True)
    scene.frame_set(1)
    for index in range(frame_count):
        pivot.rotation_euler[2] = 2.0 * math.pi * index / frame_count
        bpy.context.view_layer.update()
        scene.render.filepath = os.path.join(output, f"frame_{index:04d}.png")
        bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    imported, meshes = import_model(os.path.abspath(args.input))
    center, radius = world_bounds(meshes)
    pivot = create_normalized_pivot(imported, center, radius)
    scene = configure_scene(args.size, args.padding)
    render_frames(scene, pivot, os.path.abspath(args.output), args.frames)


if __name__ == "__main__":
    main()
