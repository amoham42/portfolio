import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import Stats from 'stats.js';

import vertexShader from '../shaders/bloom_vertex.glsl?raw';
import fragmentShader from '../shaders/bloom_fragment.glsl?raw';
import { ParticleSystem } from './particleSystem.js';

const BLOOM_SCENE = 1;
const params = {
    threshold: 0,
    strength: 1,
    radius: 0,
    exposure: 1
};

export class Scene {
    constructor(ammo) {
        this.Ammo = ammo;
        this.position = new THREE.Vector3();
        this.matrix = new THREE.Matrix4();
        this.transform = new this.Ammo.btTransform();
        this.ammoOrigin = new this.Ammo.btVector3();
        this.ammoQuat = new this.Ammo.btQuaternion();
        this.rotation = new THREE.Quaternion();
        this.scale = new THREE.Vector3(1.0, 1.0, 1.0);
        this.rigidBodies = [];

        this.bloomComposer = null;
        this.finalComposer = null;
        this.raycaster = null;
        this.mouse = null;

        this.darkMaterial = new THREE.MeshStandardMaterial({ color: 'black' });
        this.materials = {};

        this.bloomLayer = new THREE.Layers();
        this.bloomLayer.set(BLOOM_SCENE);
        this.init();
    }

    init() {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        

        this.scene = new THREE.Scene();
        this.camera.lookAt(0, 0, 0);
        this.clock = new THREE.Clock();

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
        this.directionalLight.position.set(5, 5, 5);

        this.ambientLight = new THREE.AmbientLight(0xffffff, 2);
        this.scene.add(this.directionalLight);

        const canvas = document.getElementById('canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            powerPreference: "high-performance",
            antialias: true
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setAnimationLoop(() => this.animate());
        this.renderer.shadowMap.enabled = true;

        this.stats = new Stats();
        document.body.appendChild(this.stats.dom);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = 1;
        this.controls.maxDistance = 10;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.autoRotateSpeed = 1;
        this.controls.target.set(0, 0.5, 0);
        this.controls.update();

        const renderScene = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = params.threshold;
        bloomPass.strength = params.strength;
        bloomPass.radius = params.radius;

        this.bloomComposer = new EffectComposer(this.renderer);
        this.bloomComposer.renderToScreen = false;
        this.bloomComposer.addPass(renderScene);
        this.bloomComposer.addPass(bloomPass);

        const mixPass = new ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: {value: null},
                    bloomTexture: {value: this.bloomComposer.renderTarget2.texture}
                },
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                defines: {}
            }), 'baseTexture'
        );
        mixPass.needsSwap = true;
        const outputPass = new OutputPass();

        this.finalComposer = new EffectComposer(this.renderer);
        this.finalComposer.addPass(renderScene);
        this.finalComposer.addPass(mixPass);
        this.finalComposer.addPass(outputPass);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        window.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        window.addEventListener('resize', () => this.onWindowResize());
        this.setupScene();
    }

    onPointerDown(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, false);
        if (intersects.length > 0) {
            const object = intersects[0].object;
            object.layers.toggle(BLOOM_SCENE);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.position.set(200, 200, 200);
    }

    setupScene() {

        this.scene.add(this.directionalLight);
        this.particleSystem = new ParticleSystem(this.Ammo, 50, this.scene);
    }

    animate() {
        this.stats.begin();
        this.controls.update();
        const delta = this.clock.getDelta();
        this.particleSystem.update(delta);
        this.scene.traverse((obj) => this.darkenNonBloomed(obj));
        this.bloomComposer.render();
        this.scene.traverse((obj) => this.restoreMaterial(obj));
        this.finalComposer.render();
        this.renderer.render(this.scene, this.camera);
        this.stats.end();   
    }

    darkenNonBloomed(obj) {
        if (obj.isMesh && this.bloomLayer.test(obj.layers) === false) {
            this.materials[obj.uuid] = obj.material;
            obj.material = this.darkMaterial;
        }
    }

    restoreMaterial(obj) {
        if (this.materials[obj.uuid]) {
            obj.material = this.materials[obj.uuid];
            delete this.materials[obj.uuid];
        }
    }
}