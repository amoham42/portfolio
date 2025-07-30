import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class ParticleSystem {
    constructor(ammo, quantity, scene) {
        this.Ammo = ammo;
        this.quantity = quantity;
        this.scene = scene;

        this.particles = [];
        this.meshMap = new WeakMap();

        this.mass = 1.0;
        this.world = this.physics(this.Ammo);
        this.worldTransform = new this.Ammo.btTransform();

        this.position = new THREE.Vector3();
        this.matrix = new THREE.Matrix4();
        this.transform = new this.Ammo.btTransform();
        this.ammoOrigin = new this.Ammo.btVector3();
        this.ammoQuat = new this.Ammo.btQuaternion();
        this.rotation = new THREE.Quaternion();
        this.scale = new THREE.Vector3(1.0, 1.0, 1.0);

        this.attractionForce = new this.Ammo.btVector3();
        this.forceStrength = 15.0;
        this.rotationSpeed = Math.PI;
        this.centralSphere = null;
        this.centralSphereBody = null;

        this.init();
    }

    physics(Ammo) {
        const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
        const broadphase = new Ammo.btDbvtBroadphase();
        const solver = new Ammo.btSequentialImpulseConstraintSolver();
        const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
        world.setGravity(new Ammo.btVector3(0, 0, 0));
        return world;
    }

    init() {
        const objLoader = new OBJLoader();
        objLoader.load('cube.obj', (object) => {
            console.log('Cube loaded:', object);
            const newCube = object.children[0];
            const cubeGeometry = newCube.geometry;
            const cubeShape = new this.Ammo.btBoxShape(new this.Ammo.btVector3(0.1, 0.1, 0.1));
            this.createInstancedMeshes(cubeGeometry, this.scene, cubeShape, 20);
        });

        const sphereGeometry = new THREE.SphereGeometry(0.1, 32, 16);
        const sphereShape = new this.Ammo.btSphereShape(0.1);
        this.createInstancedMeshes(sphereGeometry, this.scene, sphereShape, 480);

        this.createCentralCube();
    }

    createInstancedMeshes(geometry, scene, shape, quantity) {
        const instanceCount = quantity;
        const bodies = [];
        const material = new THREE.MeshStandardMaterial({});
        const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        scene.add(instancedMesh);
        const color = new THREE.Color();

        for (let i = 0; i < instanceCount; i++) {

            this.position.set(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
            );
            this.rotation.set(0.0, 0.0, 0.0, 1.0);
            this.scale.set(1.0, 1.0, 1.0);

            this.matrix.compose(this.position, this.rotation, this.scale);
            this.transform.setFromOpenGLMatrix(this.matrix.elements);
            const motionState = new this.Ammo.btDefaultMotionState(this.transform);
            const localInertia = new this.Ammo.btVector3(0, 0, 0);
            shape.calculateLocalInertia(this.mass, localInertia);
            const rbInfo = new this.Ammo.btRigidBodyConstructionInfo(1, motionState, shape, localInertia);
            const body = new this.Ammo.btRigidBody(rbInfo);

            this.world.addRigidBody(body);
            bodies.push(body);

            instancedMesh.setMatrixAt(i, this.matrix);
            instancedMesh.setColorAt(i, color.setHex(0xffffff * Math.random()));
        }
        this.particles.push(instancedMesh);
        this.meshMap.set(instancedMesh, bodies);
      
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.instanceColor.needsUpdate = true;
        instancedMesh.layers.enable(1);
    }

    createCentralCube() {
        const radius = 0.2;

        const centralShape = new this.Ammo.btBoxShape(new this.Ammo.btVector3(radius / 2.0, radius / 2.0, radius / 2.0));
        this.transform.setIdentity();
        this.transform.setOrigin(new this.Ammo.btVector3(0, 0, 0));
        
        const motionState = new this.Ammo.btDefaultMotionState(this.transform);
        const localInertia = new this.Ammo.btVector3(0, 0, 0);
        
        const rbInfo = new this.Ammo.btRigidBodyConstructionInfo(0, motionState, centralShape, localInertia);
        this.centralCubeBody = new this.Ammo.btRigidBody(rbInfo);
        this.centralCubeBody.setCollisionFlags(this.centralCubeBody.getCollisionFlags() | 2);
        this.world.addRigidBody(this.centralCubeBody);
    }

    update(delta) {
        this.world.stepSimulation(delta, 10, 1 / 60);
    
        for(let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const bodies = this.meshMap.get(particle);
            
            for(let j = 0; j < bodies.length; j++) {
                const body = bodies[j];
                const motionState = body.getMotionState();
                
                
                motionState.getWorldTransform(this.worldTransform);
                const rotation = this.worldTransform.getRotation();
                const origin = this.worldTransform.getOrigin();

                this.attractionForce.setValue(
                    -origin.x() * this.forceStrength,
                    -origin.y() * this.forceStrength, 
                    -origin.z() * this.forceStrength
                );
                
                body.applyCentralForce(this.attractionForce);

                this.position.set(origin.x(), origin.y(), origin.z());
                this.rotation.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
                this.matrix.compose(this.position, this.rotation, this.scale);
                
                particle.setMatrixAt(j, this.matrix);
            }
            
            particle.instanceMatrix.needsUpdate = true;
            particle.computeBoundingSphere();
        }

        
        const angularVelocity = this.centralCubeBody.getAngularVelocity();
        angularVelocity.setY(this.rotationSpeed);
        this.centralCubeBody.setAngularVelocity(angularVelocity);
        this.Ammo.destroy(angularVelocity);
    }
}
