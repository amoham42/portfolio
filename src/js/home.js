import Stats from "stats.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  SelectiveBloomEffect,
  BlendFunction,
} from "postprocessing";

import netherPortalVertexGLSL from "./../shaders/nether_portal_vertex.glsl?raw";
import netherPortalFragmentGLSL from "./../shaders/nether_portal_fragment.glsl?raw";
import swarmVertexGLSL from "./../shaders/swarm_vertex.glsl?raw";
import swarmFragmentGLSL from "./../shaders/swarm_fragment.glsl?raw";

import { ParticleSystem } from "./ParticleSystem.js";
import { Animation } from "./animations.js";

let renderer;
let camera;
let scene;
let controls;
let stats;
let animationFrameId;
let rectAreaLight;
let torchLight;
let torchLight1;
let torchLight2;
let torchLight3;
let torchLight4;
let cube;
let cube2;
let composer;
let renderPass;
let bloomEffect;
let bloomPass;
let swarmMaterial;
let particleSystem;
let particleSystem2;
let particleSystem3;
let cameraAnimation = null;
let knobAnimation = null;
let knobNode = null;
let mapAnimation = null;
let mapNode = null;

let torchBaseIntensity = 100.0;
let torchFlickerOffset1 = 0;
let torchFlickerOffset2 = 1.5;

let campos2 = [
  new THREE.Vector3(37, 28, 31.15),
  new THREE.Vector3(-0.6, 0.7, 0.42),
];
let campos3 = [
  new THREE.Vector3(10.7, 9.3, -1.05),
  new THREE.Vector3(-0.157, 0.005, 0.0008),
];

function getCanvasAndContainer() {
  const canvas = document.getElementById("canvas");
  const container = document.getElementById("canvas-container");
  if (!canvas || !container) {
    throw new Error("Canvas or container element not found");
  }
  return { canvas, container };
}

function createRenderer(canvas, container) {
  const rendererInstance = new THREE.WebGLRenderer({
    canvas: canvas,
    powerPreference: "high-performance",
    antialias: false,
    stencil: false,
    depth: true,
  });
  rendererInstance.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendererInstance.setSize(container.clientWidth, container.clientHeight);
  return rendererInstance;
}

function createCamera(container) {
  const aspect = container.clientWidth / container.clientHeight;
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  cam.position.set(102, 12, 93);
  cam.rotation.set(0.22, 0.77, -0.15);
  cam.lookAt(0, 30, 0);
  return cam;
}

function addLights(targetScene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  hemi.position.set(0, 20, 0);
  targetScene.add(hemi);

  // Area light with #5614c4
  RectAreaLightUniformsLib.init();
  rectAreaLight = new THREE.RectAreaLight("#5614c4", 20.0, 7.0, 10.7);
  rectAreaLight.position.set(-10.0, 12.0, 0.0);
  rectAreaLight.rotation.set(0, -1.57, 0);
  targetScene.add(rectAreaLight);

  // Torch-like point light (warm orange)
  torchLight = new THREE.PointLight("#ff7b00", 100.0, 25, 2.0);
  torchLight.position.set(-6.0, 15.0, 6.5);
  targetScene.add(torchLight);
  torchLight1 = new THREE.PointLight("#ff7b00", 100.0, 25, 2.0);
  torchLight1.position.set(-6.0, 15.0, -5.5);
  targetScene.add(torchLight1);
  torchLight2 = new THREE.PointLight("#4ee2ec", 500.0, 25, 2.0);
  torchLight2.position.set(-7.4, 6.1, 19.6);
  targetScene.add(torchLight2);
  torchLight3 = new THREE.PointLight("#ff7b00", 400.0, 25, 2.0);
  torchLight3.position.set(-16.5, 5.2, -17.4);
  targetScene.add(torchLight3);
  torchLight4 = new THREE.PointLight("#ff7b00", 400.0, 25, 2.0);
  torchLight4.position.set(-16.5, 5.2, 6.4);
  targetScene.add(torchLight4);
}

function addCube(targetScene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const widthPixels = renderer?.domElement?.width || 1024;
  const heightPixels = renderer?.domElement?.height || 768;
  const portalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uResolution: { value: new THREE.Vector3(widthPixels, heightPixels, 1.0) },
    },
    vertexShader: netherPortalVertexGLSL,
    fragmentShader: netherPortalFragmentGLSL,
  });
  cube = new THREE.Mesh(geometry, portalMaterial);
  cube.position.set(-10.0, 12.0, 0.0);
  cube.scale.set(1.0, 16.0, 14.0);
  targetScene.add(cube);
}

function addSecondCube(targetScene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeColor = new THREE.Color("#c42cff");
  const material = new THREE.MeshStandardMaterial({
    color: cubeColor,
    emissive: cubeColor,
    emissiveIntensity: 2.0,
    metalness: 0.2,
    roughness: 0.4,
  });
  cube2 = new THREE.Mesh(geometry, material);
  cube2.position.set(7.0, -15.0, -1.0);
  cube2.scale.set(25.0, 25.0, 25.0);
  targetScene.add(cube2);
}

function addSwarmCubes() {
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = boxGeometry.index;
  geometry.attributes = boxGeometry.attributes;

  const particleCount = 20 * 80;
  const translateArray = new Float32Array(particleCount * 3);
  for (let i = 0, i3 = 0, l = particleCount; i < l; i++, i3 += 3) {
    for (let j = -6.0; j < 21.0; j += 1) {
      translateArray[i3 + 0] = j;
      translateArray[i3 + 1] = -4.5 - i;
      translateArray[i3 + 2] = 12.0;
      i3 += 3;
    }

    for (let j = -13.0; j < 12.0; j += 1) {
      translateArray[i3 + 0] = 20.0;
      translateArray[i3 + 1] = -4.5 - i;
      translateArray[i3 + 2] = j;
      i3 += 3;
    }
  }

  geometry.setAttribute(
    "translate",
    new THREE.InstancedBufferAttribute(translateArray, 3)
  );
  swarmMaterial = new THREE.RawShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
    },
    vertexShader: swarmVertexGLSL,
    fragmentShader: swarmFragmentGLSL,
  });
  geometry.instanceCount = particleCount;
  const swarm = new THREE.Mesh(geometry, swarmMaterial);
  swarm.scale.set(1, 1, 1);
  scene.add(swarm);
}

function onResize() {
  const container = document.getElementById("canvas");
  const pixelWidth = container.clientWidth;
  const pixelHeight = container.clientHeight;
  camera.aspect = pixelWidth / pixelHeight;
  camera.updateProjectionMatrix();
  composer.setSize(pixelWidth, pixelHeight);
  cube.material.uniforms.uResolution.value.set(pixelWidth, pixelHeight, 1.0);
}

function startCameraAnimation(targetCampos = campos2) {
  const startPosition = camera.position.clone();
  const startRotation = camera.rotation.clone();
  const targetPosition = targetCampos[0];
  const targetRotation = new THREE.Euler(
    targetCampos[1].x,
    targetCampos[1].y,
    targetCampos[1].z
  );

  cameraAnimation = new Animation({
    target: camera,
    startPosition,
    targetPosition,
    startRotation,
    targetRotation,
    duration: 1500,
  });
}

function startKnobAnimation() {
  if (!knobNode) return;

  const startRotation = knobNode.rotation.clone();
  const startPosition = knobNode.position.clone();
  const targetRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(-75),
    0,
    THREE.MathUtils.degToRad(180)
  );
  const targetPosition = new THREE.Vector3(10.676, 5.5, -11.447);

  knobAnimation = new Animation({
    target: knobNode,
    startPosition,
    targetPosition,
    startRotation,
    targetRotation,
    duration: 500,
  });
}

function startMapAnimation() {
  if (!mapNode) return;

  const startPosition = mapNode.position.clone();
  const targetPosition = new THREE.Vector3(
    startPosition.x,
    startPosition.y + 5.0,
    startPosition.z
  );

  mapAnimation = new Animation({
    target: mapNode,
    startPosition,
    targetPosition,
    duration: 1000,
  });
}

function navigateToExperience() {
  startCameraAnimation(campos3);
  startKnobAnimation();
  startMapAnimation();
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  stats.begin();
  const currentTime = performance.now() * 0.0005;
  particleSystem.update(renderer);
  particleSystem2.update(renderer);
  particleSystem3.update(renderer);
  cube.material.uniforms.uTime.value = currentTime;
  swarmMaterial.uniforms.uTime.value = currentTime;

  if (torchLight && torchLight1) {
    const flicker1 =
      Math.sin(currentTime * 8 + torchFlickerOffset1) * 0.3 +
      Math.sin(currentTime * 15 + torchFlickerOffset1) * 0.15 +
      Math.sin(currentTime * 23 + torchFlickerOffset1) * 0.1 +
      (Math.random() - 0.5) * 0.2;

    const flicker2 =
      Math.sin(currentTime * 7 + torchFlickerOffset2) * 0.3 +
      Math.sin(currentTime * 13 + torchFlickerOffset2) * 0.15 +
      Math.sin(currentTime * 21 + torchFlickerOffset2) * 0.1 +
      (Math.random() - 0.5) * 0.2;

    torchLight.intensity = Math.max(
      torchBaseIntensity * 0.6,
      torchBaseIntensity + flicker1 * 80
    );
    torchLight1.intensity = Math.max(
      torchBaseIntensity * 0.6,
      torchBaseIntensity + flicker2 * 80
    );
  }

  if (cameraAnimation) cameraAnimation.update();
  if (knobAnimation) knobAnimation.update();
  if (mapAnimation) mapAnimation.update();

  composer.render();

  stats.end();
}

export async function initHomeScene() {
  const { canvas, container } = getCanvasAndContainer();

  scene = new THREE.Scene();

  renderer = createRenderer(canvas, container);
  camera = createCamera(container);
  // controls = new OrbitControls(camera, renderer.domElement);
  // controls.enableDamping = true;
  // controls.dampingFactor = 0.05;
  // controls.target.set(0, 15, 0);

  composer = new EffectComposer(renderer, {
    multisampling: 0,
    frameBufferType: THREE.HalfFloatType,
  });

  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  bloomEffect = new SelectiveBloomEffect(scene, camera, {
    blendFunction: BlendFunction.ADD,
    mipmapBlur: true,
    intensity: 5.0,
    radius: 0.65,
    levels: 8,
    luminanceThreshold: 0.0,
    luminanceSmoothing: 0.0,
  });
  bloomPass = new EffectPass(camera, bloomEffect);
  composer.addPass(bloomPass);

  stats = new Stats();

  document.body.appendChild(stats.dom);

  addLights(scene);
  addCube(scene);
  addSecondCube(scene);
  bloomEffect.selection.add(cube2);

  particleSystem = new ParticleSystem({
    size: 8,
    color: new THREE.Vector3(0.77, 0.2, 1.0),
    colorVariation: 0.1,
    speedMultiplier: 1.0,
    basePointSize: 300.0,
    startPos: new THREE.Vector3(-10.0, 6.0, -4.0),
    targetPos: new THREE.Vector3(0.0, 6.0, -4.0),
    positionOffset: new THREE.Vector3(0.0, 0.0, 0.0),
  });
  particleSystem.setupFBO(renderer);
  particleSystem.addParticles(scene);

  particleSystem2 = new ParticleSystem({
    size: 4,
    color: new THREE.Vector3(0.8, 0.4, 0.0),
    colorVariation: 0.1,
    speedMultiplier: 1.0,
    basePointSize: 80.0,
    startPos: new THREE.Vector3(-5.0, 14.5, 6.5),
    targetPos: new THREE.Vector3(-5.0, 20.0, 6.5),
    endPos: new THREE.Vector3(-5.0, 20.0, 6.5),
    positionOffset: new THREE.Vector3(0.0, 0.0, 0.0),
    startArea: new THREE.Vector3(0.0, 1.0, 1.0),
    forwardSpeed: new THREE.Vector3(0.0, 1.0, 0.0),
  });
  particleSystem2.setupFBO(renderer);
  particleSystem2.addParticles(scene);

  particleSystem3 = new ParticleSystem({
    size: 4,
    color: new THREE.Vector3(0.8, 0.4, 0.0),
    colorVariation: 0.1,
    speedMultiplier: 1.0,
    basePointSize: 80.0,
    startPos: new THREE.Vector3(-5.0, 14.5, -5.5),
    targetPos: new THREE.Vector3(-5.0, 20.0, -5.5),
    endPos: new THREE.Vector3(-5.0, 20.0, -5.5),
    positionOffset: new THREE.Vector3(0.0, 0.0, 0.0),
    startArea: new THREE.Vector3(0.0, 1.0, 1.0),
    forwardSpeed: new THREE.Vector3(0.0, 1.0, 0.0),
  });
  particleSystem3.setupFBO(renderer);
  particleSystem3.addParticles(scene);

  addSwarmCubes();
  const ktx2Loader = new KTX2Loader()
    .setTranscoderPath("jsm/libs/basis/")
    .detectSupport(renderer);
  const loader = new GLTFLoader().setPath("/").setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const modelUrl = "top_scene14-v3.glb";
  try {
    const gltf = await loader.loadAsync(modelUrl);
    const root = gltf.scene || gltf.scenes[0];
    scene.add(root);

    if (root) {
      const bloomNode = root.getObjectByName("Bloom");
      const lightNode = root.getObjectByName("Lights");
      const billboardLightNode = root.getObjectByName("BillboardLight");
      const textNode = root.getObjectByName("Text");
      knobNode = root.getObjectByName("Knob");
      mapNode = root.getObjectByName("Map");

      if (bloomNode) {
        bloomNode.material = new THREE.MeshStandardMaterial({
          color: "#4ee2ec",
          emissive: "#4ee2ec",
          emissiveIntensity: 1.0,
        });

        if (bloomEffect) bloomEffect.selection.add(bloomNode);
      }

      if (billboardLightNode) {
        billboardLightNode.material = new THREE.MeshStandardMaterial({
          color: "#4ee2ec",
          emissive: "#4ee2ec",
          emissiveIntensity: 0.03,
        });
        if (bloomEffect) bloomEffect.selection.add(billboardLightNode);
      }

      if (textNode) {
        textNode.material = new THREE.MeshStandardMaterial({
          color: "#4ee2ec",
          emissive: "#4ee2ec",
          emissiveIntensity: 0.03,
        });
        if (bloomEffect) bloomEffect.selection.add(textNode);
      }

      if (lightNode) {
        lightNode.material.emissiveIntensity = 0.5;
        if (bloomEffect) bloomEffect.selection.add(lightNode);
      }
    }
  } catch (err) {
    console.error("Failed to load GLB:", modelUrl, err);
  }

  const mouse = new THREE.Vector2();
  function onMouseMove(event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }

  const experienceLink = document.querySelector(
    '.nav-link[href="#"]:first-child'
  );
  if (experienceLink && experienceLink.textContent.trim() === "Experience") {
    experienceLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigateToExperience();
    });
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("mousemove", onMouseMove);
  onResize();
  animate();

  setTimeout(() => {
    startCameraAnimation();
  }, 500);

  return {
    dispose: () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      controls?.dispose?.();
      renderer?.dispose?.();
      composer?.dispose?.();
      stats?.dom?.remove?.();
      particleSystem?.dispose?.(scene);
      cameraAnimation = null;
      knobAnimation = null;
      mapAnimation = null;
    },
  };
}

if (import.meta.hot == null) {
}
