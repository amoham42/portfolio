import * as THREE from "three";

import particleVertex from "./../shaders/particle_vertex.glsl?raw";
import particleFragment from "./../shaders/particle_fragment.glsl?raw";
import fboVertex from "./../shaders/fbo_vertex.glsl?raw";
import fboFragment from "./../shaders/fbo_fragment.glsl?raw";

/**
 * Customizable Particle System for different effects and placements
 *
 * Usage Examples:
 *
 * // Basic particle system with default purple particles
 * const particles1 = new ParticleSystem();
 *
 * // Red particles with faster speed
 * const particles2 = new ParticleSystem({
 *   color: new THREE.Vector3(1.0, 0.2, 0.2),
 *   speedMultiplier: 2.0,
 *   startPos: new THREE.Vector3(-5.0, 0.0, 0.0)
 * });
 *
 * // Blue particles with position offset and color variation
 * const particles3 = new ParticleSystem({
 *   color: new THREE.Vector3(0.2, 0.5, 1.0),
 *   colorVariation: 0.3,
 *   positionOffset: new THREE.Vector3(0.0, 10.0, 0.0),
 *   basePointSize: 150.0
 * });
 *
 * // Slow moving green particles with upward motion
 * const particles4 = new ParticleSystem({
 *   color: new THREE.Vector3(0.2, 1.0, 0.3),
 *   speedMultiplier: 0.5,
 *   forwardSpeed: new THREE.Vector3(2.0, 1.0, 0.5),
 *   curlScale: 0.8
 * });
 *
 * // Update particle properties dynamically
 * particles1.updateOptions({
 *   color: new THREE.Vector3(1.0, 1.0, 0.0), // Change to yellow
 *   speedMultiplier: 1.5,
 *   forwardSpeed: new THREE.Vector3(3.0, -1.0, 2.0) // Add 3D velocity
 * });
 */
export class ParticleSystem {
  constructor(options = {}) {
    const defaultOptions = {
      size: 8,
      curlScale: 1.5,
      forwardSpeed: new THREE.Vector3(4.0, 0.0, 0.0),
      noiseScale: 0.15,
      basePointSize: 300.0,
      minSize: 5.0,
      maxSize: 10.0,
      targetPos: new THREE.Vector3(0.0, 6.0, -4.0),
      nearRadius: 2.0,
      startPos: new THREE.Vector3(-10.0, 6.0, -4.0),
      startArea: new THREE.Vector3(0.0, 12.0, 8.0),
      endPos: new THREE.Vector3(16.0, 6.0, -4.0),
      shrinkSpeed: 0.7,
      color: new THREE.Vector3(0.77, 0.2, 1.0),
      colorVariation: 0.0,
      speedMultiplier: 1.0,
      positionOffset: new THREE.Vector3(0.0, 0.0, 0.0),
    };

    this.options = { ...defaultOptions, ...options };

    if (options.targetPos) {
      this.options.targetPos = options.targetPos.clone
        ? options.targetPos.clone()
        : new THREE.Vector3().copy(options.targetPos);
    }
    if (options.startPos) {
      this.options.startPos = options.startPos.clone
        ? options.startPos.clone()
        : new THREE.Vector3().copy(options.startPos);
    }
    if (options.startArea) {
      this.options.startArea = options.startArea.clone
        ? options.startArea.clone()
        : new THREE.Vector3().copy(options.startArea);
    }
    if (options.forwardSpeed) {
      this.options.forwardSpeed = options.forwardSpeed.clone
        ? options.forwardSpeed.clone()
        : new THREE.Vector3().copy(options.forwardSpeed);
    }
    if (options.color) {
      this.options.color = options.color.clone
        ? options.color.clone()
        : new THREE.Vector3().copy(options.color);
    }
    if (options.positionOffset) {
      this.options.positionOffset = options.positionOffset.clone
        ? options.positionOffset.clone()
        : new THREE.Vector3().copy(options.positionOffset);
    }

    this.size = this.options.size;
    this.clock = new THREE.Clock();

    this.fboMaterial = null;
    this.particleMaterial = null;
    this.fbo = null;
    this.fbo2 = null;

    this.fboScene = null;
    this.fboCamera = null;
    this.points = null;

    // Create params object for backward compatibility
    this.params = {
      curlScale: this.options.curlScale,
      forwardSpeed: this.options.forwardSpeed
        .clone()
        .multiplyScalar(this.options.speedMultiplier),
      noiseScale: this.options.noiseScale,
      basePointSize: this.options.basePointSize,
      minSize: this.options.minSize,
      maxSize: this.options.maxSize,
      targetPos: this.options.targetPos
        .clone()
        .add(this.options.positionOffset),
      nearRadius: this.options.nearRadius,
      startPos: this.options.startPos.clone().add(this.options.positionOffset),
      startArea: this.options.startArea.clone(),
      endPos: this.options.endPos,
      shrinkSpeed: this.options.shrinkSpeed,
    };
  }

  getRenderTarget() {
    // Render positions in a size x size floating-point target (1 texel per particle)
    return new THREE.WebGLRenderTarget(this.size, this.size, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });
  }

  setupFBO(renderer) {
    this.fbo = this.getRenderTarget();
    this.fbo2 = this.getRenderTarget();

    const position = this.params.startPos.clone();
    const area = this.params.startArea.clone();

    this.fboScene = new THREE.Scene();
    this.fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fboCamera.position.z = 0.5;
    this.fboCamera.lookAt(0, 0, 0);
    this.fboScene.add(this.fboCamera);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const positions = new Float32Array(this.size * this.size * 4);
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const index = (i + j * this.size) * 4;

        positions[index + 0] = position.x + Math.random() * area.x;
        positions[index + 1] = position.y + Math.random() * area.y;
        positions[index + 2] = position.z + Math.random() * area.z;
        positions[index + 3] = 0.0;
      }
    }

    const positionsTexture = new THREE.DataTexture(
      positions,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    positionsTexture.minFilter = THREE.NearestFilter;
    positionsTexture.magFilter = THREE.NearestFilter;
    positionsTexture.generateMipmaps = false;
    positionsTexture.needsUpdate = true;

    this.fboMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPositions: { value: positionsTexture },
        uTime: { value: 0 },
        uDelta: { value: 0 },
        uCurlScale: { value: this.params.curlScale },
        uForwardSpeed: { value: this.params.forwardSpeed.clone() },
        uNoiseScale: { value: this.params.noiseScale },
        uStartPos: { value: this.params.startPos.clone() },
        uStartArea: { value: this.params.startArea.clone() },
        uEndPos: { value: this.params.endPos },
        uSpeedMultiplier: { value: this.options.speedMultiplier },
      },
      vertexShader: fboVertex,
      fragmentShader: fboFragment,
    });

    const mesh = new THREE.Mesh(geometry, this.fboMaterial);
    this.fboScene.add(mesh);

    renderer.setRenderTarget(this.fbo);
    renderer.render(this.fboScene, this.fboCamera);
    renderer.setRenderTarget(this.fbo2);
    renderer.render(this.fboScene, this.fboCamera);
    renderer.setRenderTarget(null);
  }

  addParticles(scene) {
    this.particleMaterial = new THREE.ShaderMaterial({
      extensions: {
        derivatives: "#extension GL_OES_standard_derivatives : enable",
      },
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uPositions: { value: null },
        uResolution: { value: new THREE.Vector4() },
        uBasePointSize: { value: this.params.basePointSize },
        uMinSize: { value: this.params.minSize },
        uMaxSize: { value: this.params.maxSize },
        uTargetPos: { value: this.params.targetPos.clone() },
        uNearRadius: { value: this.params.nearRadius },
        uShrinkSpeed: { value: this.params.shrinkSpeed },
        // Color uniforms
        uColor: { value: this.options.color.clone() },
        uColorVariation: { value: this.options.colorVariation },
      },
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
    });

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.size * this.size * 3);
    const uvs = new Float32Array(this.size * this.size * 2);
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const pIndex = (i + j * this.size) * 3;
        const uvIndex = (i + j * this.size) * 2;
        positions[pIndex + 0] = Math.random() * 2 - 1;
        positions[pIndex + 1] = Math.random() * 2 - 1;
        positions[pIndex + 2] = Math.random() * 2 - 1;
        uvs[uvIndex + 0] = (i + 0.5) / this.size;
        uvs[uvIndex + 1] = (j + 0.5) / this.size;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    if (this.fbo)
      this.particleMaterial.uniforms.uPositions.value = this.fbo.texture;

    this.points = new THREE.Points(geometry, this.particleMaterial);
    scene.add(this.points);
  }

  update(renderer) {
    if (!this.fbo || !this.fbo2 || !this.fboScene || !this.fboCamera) return;
    const delta = this.clock.getDelta();

    this.fboMaterial.uniforms.uTime.value += delta;
    this.fboMaterial.uniforms.uDelta.value = delta;
    this.particleMaterial.uniforms.uTime.value += delta;
    this.fboMaterial.uniforms.uPositions.value = this.fbo2.texture;
    this.particleMaterial.uniforms.uPositions.value = this.fbo.texture;

    renderer.setRenderTarget(this.fbo);
    renderer.render(this.fboScene, this.fboCamera);
    renderer.setRenderTarget(null);

    const temp = this.fbo;
    this.fbo = this.fbo2;
    this.fbo2 = temp;
  }

  // Method to update options after initialization
  updateOptions(newOptions = {}) {
    // Merge new options with existing ones
    this.options = { ...this.options, ...newOptions };

    // Handle Vector3 properties that need deep copying
    if (newOptions.targetPos) {
      this.options.targetPos = newOptions.targetPos.clone
        ? newOptions.targetPos.clone()
        : new THREE.Vector3().copy(newOptions.targetPos);
    }
    if (newOptions.startPos) {
      this.options.startPos = newOptions.startPos.clone
        ? newOptions.startPos.clone()
        : new THREE.Vector3().copy(newOptions.startPos);
    }
    if (newOptions.startArea) {
      this.options.startArea = newOptions.startArea.clone
        ? newOptions.startArea.clone()
        : new THREE.Vector3().copy(newOptions.startArea);
    }
    if (newOptions.forwardSpeed) {
      this.options.forwardSpeed = newOptions.forwardSpeed.clone
        ? newOptions.forwardSpeed.clone()
        : new THREE.Vector3().copy(newOptions.forwardSpeed);
    }
    if (newOptions.color) {
      this.options.color = newOptions.color.clone
        ? newOptions.color.clone()
        : new THREE.Vector3().copy(newOptions.color);
    }
    if (newOptions.positionOffset) {
      this.options.positionOffset = newOptions.positionOffset.clone
        ? newOptions.positionOffset.clone()
        : new THREE.Vector3().copy(newOptions.positionOffset);
    }

    // Update params object
    this.params = {
      curlScale: this.options.curlScale,
      forwardSpeed: this.options.forwardSpeed
        .clone()
        .multiplyScalar(this.options.speedMultiplier),
      noiseScale: this.options.noiseScale,
      basePointSize: this.options.basePointSize,
      minSize: this.options.minSize,
      maxSize: this.options.maxSize,
      targetPos: this.options.targetPos
        .clone()
        .add(this.options.positionOffset),
      nearRadius: this.options.nearRadius,
      startPos: this.options.startPos.clone().add(this.options.positionOffset),
      startArea: this.options.startArea.clone(),
      endPos: this.options.endPos,
      shrinkSpeed: this.options.shrinkSpeed,
    };

    // Update uniforms if materials exist
    if (this.fboMaterial) {
      this.fboMaterial.uniforms.uCurlScale.value = this.params.curlScale;
      this.fboMaterial.uniforms.uForwardSpeed.value.copy(
        this.params.forwardSpeed
      );
      this.fboMaterial.uniforms.uNoiseScale.value = this.params.noiseScale;
      this.fboMaterial.uniforms.uStartPos.value.copy(this.params.startPos);
      this.fboMaterial.uniforms.uStartArea.value.copy(this.params.startArea);
      this.fboMaterial.uniforms.uEndPos.value.copy(this.params.endPos);
      this.fboMaterial.uniforms.uSpeedMultiplier.value =
        this.options.speedMultiplier;
    }

    if (this.particleMaterial) {
      this.particleMaterial.uniforms.uBasePointSize.value =
        this.params.basePointSize;
      this.particleMaterial.uniforms.uMinSize.value = this.params.minSize;
      this.particleMaterial.uniforms.uMaxSize.value = this.params.maxSize;
      this.particleMaterial.uniforms.uTargetPos.value.copy(
        this.params.targetPos
      );
      this.particleMaterial.uniforms.uNearRadius.value = this.params.nearRadius;
      this.particleMaterial.uniforms.uShrinkSpeed.value =
        this.params.shrinkSpeed;
      this.particleMaterial.uniforms.uColor.value.copy(this.options.color);
      this.particleMaterial.uniforms.uColorVariation.value =
        this.options.colorVariation;
    }
  }

  dispose(scene = null) {
    if (this.points && scene) {
      scene.remove(this.points);
    }
    this.points = null;

    this.fbo?.dispose?.();
    this.fbo2?.dispose?.();
    this.fbo = null;
    this.fbo2 = null;

    this.fboMaterial?.dispose?.();
    this.particleMaterial?.dispose?.();
    this.fboMaterial = null;
    this.particleMaterial = null;

    this.fboScene = null;
    this.fboCamera = null;
  }

  // Static helper methods for common particle presets
  static createFireParticles(options = {}) {
    return new ParticleSystem({
      color: new THREE.Vector3(1.0, 0.3, 0.1), // Orange-red
      colorVariation: 0.3,
      speedMultiplier: 1.2,
      curlScale: 2.0,
      basePointSize: 250.0,
      forwardSpeed: new THREE.Vector3(4.0, 1.0, 0.0), // Fire moves forward and up
      ...options,
    });
  }

  static createWaterParticles(options = {}) {
    return new ParticleSystem({
      color: new THREE.Vector3(0.2, 0.7, 1.0), // Blue
      colorVariation: 0.2,
      speedMultiplier: 0.8,
      curlScale: 1.8,
      basePointSize: 200.0,
      forwardSpeed: new THREE.Vector3(3.0, -0.5, 0.0), // Water flows forward and slightly down
      ...options,
    });
  }

  static createMagicParticles(options = {}) {
    return new ParticleSystem({
      color: new THREE.Vector3(0.8, 0.2, 1.0), // Purple
      colorVariation: 0.5,
      speedMultiplier: 0.6,
      curlScale: 2.5,
      basePointSize: 400.0,
      forwardSpeed: new THREE.Vector3(2.0, 0.0, 0.0), // Magic flows gently forward
      ...options,
    });
  }

  static createSparkParticles(options = {}) {
    return new ParticleSystem({
      color: new THREE.Vector3(1.0, 0.9, 0.3), // Golden yellow
      colorVariation: 0.1,
      speedMultiplier: 2.5,
      curlScale: 1.2,
      basePointSize: 150.0,
      minSize: 2.0,
      maxSize: 6.0,
      forwardSpeed: new THREE.Vector3(6.0, 0.5, 0.0), // Sparks move fast forward and slightly up
      ...options,
    });
  }
}
