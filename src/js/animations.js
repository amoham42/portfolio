import * as THREE from "three";

export class Animation {
  constructor(config) {
    const {
      target,
      startPosition,
      targetPosition,
      startRotation,
      targetRotation,
      duration = 1500,
      onUpdate = null,
      onComplete = null,
    } = config;

    this.target = target;
    this.startTime = performance.now();
    this.duration = duration;
    this.startPosition = startPosition;
    this.targetPosition = targetPosition;
    this.startRotation = startRotation;
    this.targetRotation = targetRotation;
    this.isComplete = false;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
  }

  static easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  update() {
    if (this.isComplete) return;

    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    const easedProgress = Animation.easeInOutCubic(progress);

    // Interpolate position
    if (this.startPosition && this.targetPosition) {
      this.target.position.lerpVectors(
        this.startPosition,
        this.targetPosition,
        easedProgress
      );
    }

    // Interpolate rotation
    if (this.startRotation && this.targetRotation) {
      const startQuat = new THREE.Quaternion().setFromEuler(this.startRotation);
      const targetQuat = new THREE.Quaternion().setFromEuler(
        this.targetRotation
      );
      const currentQuat = new THREE.Quaternion().slerpQuaternions(
        startQuat,
        targetQuat,
        easedProgress
      );
      this.target.setRotationFromQuaternion(currentQuat);
    }

    // Custom update callback
    if (this.onUpdate) {
      this.onUpdate(easedProgress, this);
    }

    // Check completion
    if (progress >= 1) {
      this.isComplete = true;

      // Set final values
      if (this.targetPosition) {
        this.target.position.copy(this.targetPosition);
      }
      if (this.targetRotation) {
        this.target.rotation.copy(this.targetRotation);
      }

      // Complete callback
      if (this.onComplete) {
        this.onComplete(this);
      }
    }
  }

  static create(config) {
    return new Animation(config);
  }
}
