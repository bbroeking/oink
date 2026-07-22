import * as THREE from "three";

const TAU = Math.PI * 2;

function makeMaterial(color, roughness = 0.72, metalness = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

function addMesh(parent, name, geometry, material, transform = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (transform.position) mesh.position.set(...transform.position);
  if (transform.rotation) mesh.rotation.set(...transform.rotation);
  if (transform.scale) mesh.scale.set(...transform.scale);
  parent.add(mesh);
  return mesh;
}

function addPivot(parent, name, position) {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(...position);
  parent.add(pivot);
  return pivot;
}

function capsuleY(radius, length, capSegments = 12, radialSegments = 24) {
  return new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments);
}

function ellipsoid(parent, name, material, position, scale, rotation = [0, 0, 0]) {
  return addMesh(
    parent,
    name,
    new THREE.SphereGeometry(1, 48, 32),
    material,
    { position, rotation, scale },
  );
}

function cylinder(parent, name, material, radiusTop, radiusBottom, depth, position, rotation = [0, 0, 0]) {
  return addMesh(
    parent,
    name,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, depth, 40, 1, false),
    material,
    { position, rotation },
  );
}

function createLeg(parent, id, x, z, materials) {
  const pivot = addPivot(parent, `${id}-leg-pivot`, [x, 0.28, z]);
  pivot.userData.role = "walk-leg-pivot";

  addMesh(
    pivot,
    `${id}-leg`,
    capsuleY(0.14, 0.58, 10, 24),
    materials.skin,
    { position: [0, -0.38, 0], scale: [1, 1, 0.95] },
  );

  addMesh(
    pivot,
    `${id}-hoof`,
    new THREE.CylinderGeometry(0.15, 0.17, 0.16, 36),
    materials.hoof,
    { position: [0, -0.76, 0], scale: [1.05, 0.8, 1.12] },
  );

  return pivot;
}

function createEar(parent, id, position, side, materials) {
  const pivot = addPivot(parent, `${id}-ear-pivot`, position);
  pivot.rotation.z = side * 0.16;
  pivot.rotation.x = -0.08;
  pivot.userData.role = "ear-pivot";

  ellipsoid(pivot, `${id}-outer-ear`, materials.skin, [0, 0.13, 0], [0.18, 0.35, 0.1], [0.1, 0, side * 0.12]);
  ellipsoid(pivot, `${id}-inner-ear`, materials.innerEar, [0, 0.12, 0.035], [0.1, 0.24, 0.025], [0.1, 0, side * 0.12]);

  return pivot;
}

function createTail(parent, materials) {
  const pivot = addPivot(parent, "tail-pivot", [1.05, 0.45, 0]);
  pivot.userData.role = "tail-pivot";

  const stalk = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.22, 0.07, 0),
    new THREE.Vector3(0.4, 0.13, 0.02),
  ]);
  addMesh(pivot, "tail-stalk", new THREE.TubeGeometry(stalk, 28, 0.045, 14, false), materials.skin);

  const curl = new THREE.CurvePath();
  const points = [];
  for (let i = 0; i <= 44; i += 1) {
    const t = i / 44;
    const a = t * TAU * 1.08;
    const r = 0.18 - t * 0.035;
    points.push(new THREE.Vector3(0.4 + Math.cos(a) * r, 0.14 + Math.sin(a) * r, 0.02));
  }
  curl.add(new THREE.CatmullRomCurve3(points));
  addMesh(pivot, "tail-curl", new THREE.TubeGeometry(curl, 72, 0.047, 14, false), materials.skin);

  return pivot;
}

export function createRosieImg2ThreejsModel(options = {}) {
  const root = new THREE.Group();
  root.name = "Rosie img2threejs procedural model";
  root.scale.setScalar(options.scale ?? 1);

  const materials = {
    skin: makeMaterial(0xffb8b8, 0.76),
    skinBlush: makeMaterial(0xff8fa2, 0.82),
    innerEar: makeMaterial(0xff6f87, 0.84),
    snout: makeMaterial(0xff9aa5, 0.78),
    nostril: makeMaterial(0x4d2024, 0.62),
    eye: makeMaterial(0x090809, 0.25),
    eyeSpark: makeMaterial(0xffffff, 0.2),
    mouth: makeMaterial(0x68222f, 0.5),
    hoof: makeMaterial(0x543429, 0.68),
  };

  const rig = {
    root,
    legs: {},
    tail: null,
    head: null,
    ears: {},
  };

  ellipsoid(root, "rounded-capsule-body", materials.skin, [0.18, 0.48, 0], [0.9, 0.48, 0.42]);
  ellipsoid(root, "soft-belly-volume", materials.skin, [0.06, 0.24, 0], [0.78, 0.22, 0.38]);

  rig.head = addPivot(root, "head-pivot", [-0.78, 0.78, 0]);
  rig.head.userData.role = "head-pivot";
  ellipsoid(rig.head, "oversized-round-head", materials.skin, [0, 0, 0], [0.48, 0.52, 0.44]);

  const snoutPivot = addPivot(rig.head, "snout-pivot", [-0.42, -0.05, 0]);
  snoutPivot.rotation.z = Math.PI / 2;
  cylinder(snoutPivot, "rounded-snout", materials.snout, 0.18, 0.22, 0.34, [0, 0, 0]);
  cylinder(snoutPivot, "snout-front-disc", materials.snout, 0.2, 0.2, 0.025, [0, -0.18, 0]);
  ellipsoid(snoutPivot, "upper-nostril", materials.nostril, [0.07, -0.198, 0.04], [0.026, 0.01, 0.04]);
  ellipsoid(snoutPivot, "lower-nostril", materials.nostril, [0.07, -0.198, -0.04], [0.026, 0.01, 0.04]);

  ellipsoid(rig.head, "visible-eye", materials.eye, [-0.3, 0.09, 0.36], [0.07, 0.11, 0.025]);
  ellipsoid(rig.head, "eye-highlight-large", materials.eyeSpark, [-0.32, 0.14, 0.382], [0.025, 0.04, 0.008]);
  ellipsoid(rig.head, "eye-highlight-small", materials.eyeSpark, [-0.27, 0.06, 0.385], [0.014, 0.02, 0.006]);
  ellipsoid(rig.head, "round-cheek", materials.skinBlush, [-0.23, -0.12, 0.39], [0.105, 0.09, 0.018]);
  ellipsoid(rig.head, "smiling-mouth", materials.mouth, [-0.39, -0.25, 0.09], [0.07, 0.035, 0.018], [0, 0.2, -0.22]);

  rig.ears.left = createEar(rig.head, "near", [0.02, 0.42, 0.16], 1, materials);
  rig.ears.right = createEar(rig.head, "far", [0.02, 0.4, -0.15], -1, materials);
  rig.ears.right.scale.setScalar(0.86);

  rig.legs.frontNear = createLeg(root, "front-near", -0.5, 0.24, materials);
  rig.legs.frontFar = createLeg(root, "front-far", -0.5, -0.22, materials);
  rig.legs.rearNear = createLeg(root, "rear-near", 0.72, 0.23, materials);
  rig.legs.rearFar = createLeg(root, "rear-far", 0.72, -0.22, materials);
  rig.legs.frontFar.scale.setScalar(0.92);
  rig.legs.rearFar.scale.setScalar(0.92);

  rig.tail = createTail(root, materials);

  root.userData.sculptRuntime = {
    source: "img2threejs-inspired procedural reconstruction from rosie-rig-ready-left-v3.png",
    rigType: "separate Object3D pivots; not a skinned mesh",
    nodes: {
      head: rig.head.name,
      tail: rig.tail.name,
      legs: Object.fromEntries(Object.entries(rig.legs).map(([key, node]) => [key, node.name])),
    },
    sockets: {
      tailRoot: [1.05, 0.45, 0],
      headRoot: [-0.78, 0.78, 0],
      feet: [
        [-0.5, -0.48, 0.24],
        [-0.5, -0.48, -0.22],
        [0.72, -0.48, 0.23],
        [0.72, -0.48, -0.22],
      ],
    },
  };

  root.userData.animateWalk = (timeSeconds) => {
    const t = timeSeconds * 5.2;
    rig.legs.frontNear.rotation.z = Math.sin(t) * 0.22;
    rig.legs.rearFar.rotation.z = Math.sin(t) * 0.22;
    rig.legs.frontFar.rotation.z = Math.sin(t + Math.PI) * 0.2;
    rig.legs.rearNear.rotation.z = Math.sin(t + Math.PI) * 0.2;
    rig.tail.rotation.y = Math.sin(t * 0.72) * 0.22;
    rig.tail.rotation.z = Math.sin(t * 0.62) * 0.08;
    rig.head.rotation.z = Math.sin(t * 0.45) * 0.025;
    root.position.y = Math.sin(t * 2) * 0.015;
  };

  return root;
}
