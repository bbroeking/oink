"""Build a conservative quadruped rig and looping walk cycle for Rosie v2.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/blender/rig_rosie_v2.py
"""

import math
import os

import bpy
from mathutils import Vector


ROOT = "/Users/bbroeking/projects/oink"
SOURCE = f"{ROOT}/assets/models/rosie/rosie-meshy-quadruped-v2.glb"
OUTPUT = f"{ROOT}/assets/models/rosie/rosie-custom-rig-walk-v3.glb"
BLEND = f"{ROOT}/assets/models/rosie/rosie-custom-rig-walk-v3.blend"
PREVIEW_DIR = "/tmp/rosie-custom-rig-preview"


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def smoothstep(value):
    value = clamp(value)
    return value * value * (3.0 - 2.0 * value)


def select_only(*objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[-1]


def make_rig():
    armature_data = bpy.data.armatures.new("RosieRig")
    armature = bpy.data.objects.new("RosieRig", armature_data)
    bpy.context.collection.objects.link(armature)
    armature.show_in_front = True

    select_only(armature)
    bpy.ops.object.mode_set(mode="EDIT")

    root = armature_data.edit_bones.new("Root")
    root.head = (0.0, 0.0, -0.70)
    root.tail = (0.0, 0.0, -0.55)
    root.use_deform = False

    body = armature_data.edit_bones.new("Body")
    body.head = (0.0, 0.0, -0.12)
    body.tail = (0.0, 0.0, 0.48)
    body.parent = root

    leg_specs = {
        "Leg_FL": (-0.34, -0.25),
        "Leg_FR": (0.34, -0.25),
        "Leg_BL": (-0.34, 0.50),
        "Leg_BR": (0.34, 0.50),
    }
    for name, (x, y) in leg_specs.items():
        bone = armature_data.edit_bones.new(name)
        bone.head = (x, y, -0.10)
        bone.tail = (x, y, -0.66)
        bone.parent = root

    tail = armature_data.edit_bones.new("Tail")
    tail.head = (0.0, 0.71, 0.06)
    tail.tail = (0.0, 0.96, 0.11)
    tail.parent = body

    bpy.ops.object.mode_set(mode="OBJECT")
    return armature, leg_specs


def weight_mesh(mesh, armature, leg_specs):
    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)

    groups = {name: mesh.vertex_groups.new(name=name) for name in ["Body", *leg_specs, "Tail"]}

    for vertex in mesh.data.vertices:
        x, y, z = vertex.co

        nearest_name = None
        nearest_distance = 1e9
        for name, (cx, cy) in leg_specs.items():
            distance = math.sqrt(((x - cx) / 0.24) ** 2 + ((y - cy) / 0.30) ** 2)
            if distance < nearest_distance:
                nearest_name = name
                nearest_distance = distance

        leg_height = smoothstep((-0.12 - z) / 0.34)
        leg_radius = smoothstep((1.35 - nearest_distance) / 0.55)
        leg_weight = leg_height * leg_radius

        tail_length = smoothstep((y - 0.71) / 0.18)
        tail_width = smoothstep((0.34 - abs(x)) / 0.18)
        tail_height = smoothstep((z + 0.08) / 0.15)
        tail_weight = tail_length * tail_width * tail_height

        # Avoid overlapping influences. The short legs remain almost rigid below
        # the belly, while only the curl outside the rump follows the tail bone.
        tail_weight = min(tail_weight, 1.0 - leg_weight)
        body_weight = max(0.0, 1.0 - leg_weight - tail_weight)

        groups[nearest_name].add([vertex.index], leg_weight, "REPLACE")
        groups["Tail"].add([vertex.index], tail_weight, "REPLACE")
        groups["Body"].add([vertex.index], body_weight, "REPLACE")

    mesh.parent = armature
    mesh.matrix_parent_inverse = armature.matrix_world.inverted()
    modifier = mesh.modifiers.new("RosieArmature", "ARMATURE")
    modifier.object = armature


def make_walk_cycle(armature):
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 25
    scene.render.fps = 24

    action = bpy.data.actions.new("Rosie_Walk")
    armature.animation_data_create()
    armature.animation_data.action = action

    body = armature.pose.bones["Body"]
    tail = armature.pose.bones["Tail"]
    legs = {name: armature.pose.bones[name] for name in ("Leg_FL", "Leg_FR", "Leg_BL", "Leg_BR")}
    for bone in [body, tail, *legs.values()]:
        bone.rotation_mode = "XYZ"

    amplitude = math.radians(14.0)
    tail_amplitude = math.radians(5.0)
    phases = {"Leg_FL": 1.0, "Leg_BR": 1.0, "Leg_FR": -1.0, "Leg_BL": -1.0}

    for frame in range(1, 26, 2):
        phase = math.tau * (frame - 1) / 24.0

        body.location = (0.0, 0.0, 0.022 * abs(math.sin(phase)))
        body.rotation_euler = (math.radians(1.5) * math.sin(phase), 0.0, 0.0)
        body.keyframe_insert(data_path="location", frame=frame)
        body.keyframe_insert(data_path="rotation_euler", frame=frame)

        for name, bone in legs.items():
            bone.rotation_euler = (phases[name] * amplitude * math.sin(phase), 0.0, 0.0)
            bone.keyframe_insert(data_path="rotation_euler", frame=frame)

        # Two gentle wags per gait cycle. Five degrees keeps the thick curl
        # outside the rump instead of sweeping through the body.
        tail.rotation_euler = (0.0, 0.0, tail_amplitude * math.sin(phase * 2.0))
        tail.keyframe_insert(data_path="rotation_euler", frame=frame)

    if hasattr(action, "use_cyclic"):
        action.use_cyclic = True

    # Blender 5.x stores keyframes in layered channel bags rather than
    # exposing Action.fcurves directly. The default interpolation is smooth
    # and exports correctly to glTF, so no post-processing is required here.


def add_preview_scene(armature):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 600
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "None"
    scene.world = bpy.data.worlds.new("RosiePreviewWorld")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.035, 0.035, 0.045, 1.0)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.35

    camera_data = bpy.data.cameras.new("RosiePreviewCamera")
    camera = bpy.data.objects.new("RosiePreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.15
    camera.location = (3.2, 0.0, 0.05)
    target = Vector((0.0, 0.0, -0.05))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()

    for name, location, energy, size in [
        ("Key", (3.5, -4.0, 4.5), 750.0, 4.0),
        ("Fill", (-2.5, -1.0, 2.5), 450.0, 3.0),
        ("Rim", (0.0, 4.0, 3.0), 550.0, 3.0),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(name, data)
        light.location = location
        bpy.context.collection.objects.link(light)
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()

    os.makedirs(PREVIEW_DIR, exist_ok=True)
    for frame in (1, 7, 13, 19):
        scene.frame_set(frame)
        scene.render.filepath = f"{PREVIEW_DIR}/frame-{frame:02d}.png"
        bpy.ops.render.render(write_still=True)


def export(mesh, armature):
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    select_only(mesh, armature)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_animations=True,
        export_frame_range=True,
        export_force_sampling=True,
    )


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SOURCE)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one mesh, found {[obj.name for obj in meshes]}")
    mesh = meshes[0]
    mesh.name = "RosieMesh"

    armature, leg_specs = make_rig()
    weight_mesh(mesh, armature, leg_specs)
    make_walk_cycle(armature)
    add_preview_scene(armature)
    export(mesh, armature)
    print(f"ROSIE_EXPORT={OUTPUT}")


if __name__ == "__main__":
    main()
