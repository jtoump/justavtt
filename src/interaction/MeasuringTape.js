import * as THREE from 'three';

/**
 * MeasuringTape provides a flexible measuring tool for wargaming.
 * Displays distance in inches (standard wargaming measurement).
 */
export class MeasuringTape {
  constructor(scene) {
    this.scene = scene;
    this.isActive = false;
    this.startPoint = null;
    this.endPoint = null;

    // Scale: 1 grid unit = 1 inch (standard wargaming scale)
    this.unitsPerInch = 1;

    // Visual elements
    this.line = null;
    this.startMarker = null;
    this.endMarker = null;
    this.tickMarks = [];

    // Colors
    this.tapeColor = 0xffff00; // Yellow
    this.validColor = 0x00ff00; // Green for in-range
    this.invalidColor = 0xff0000; // Red for out-of-range

    // Range checking (optional)
    this.maxRange = null;

    this.createVisuals();
  }

  createVisuals() {
    // Main measuring line
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: this.tapeColor,
      linewidth: 3,
      depthTest: false
    });
    this.line = new THREE.Line(lineGeometry, lineMaterial);
    this.line.renderOrder = 999;
    this.line.visible = false;
    this.scene.add(this.line);

    // Start marker (circle)
    this.startMarker = this.createMarker(0x00ff00);
    this.scene.add(this.startMarker);

    // End marker (circle)
    this.endMarker = this.createMarker(0xff6600);
    this.scene.add(this.endMarker);
  }

  createMarker(color) {
    const geometry = new THREE.RingGeometry(0.15, 0.25, 32);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.9
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.02;
    marker.renderOrder = 998;
    marker.visible = false;
    return marker;
  }

  createTickMark() {
    const geometry = new THREE.PlaneGeometry(0.1, 0.4);
    const material = new THREE.MeshBasicMaterial({
      color: this.tapeColor,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.7
    });
    const tick = new THREE.Mesh(geometry, material);
    tick.rotation.x = -Math.PI / 2;
    tick.position.y = 0.01;
    tick.renderOrder = 997;
    tick.visible = false;
    this.scene.add(tick);
    return tick;
  }

  start(point) {
    this.isActive = true;
    this.startPoint = point.clone();
    this.startPoint.y = 0.1;

    this.startMarker.position.copy(this.startPoint);
    this.startMarker.position.y = 0.02;
    this.startMarker.visible = true;

    this.line.visible = true;
    this.endMarker.visible = true;

    this.update(point);
  }

  update(point) {
    if (!this.isActive || !this.startPoint) return null;

    this.endPoint = point.clone();
    this.endPoint.y = 0.1;

    // Update line
    const positions = new Float32Array([
      this.startPoint.x, this.startPoint.y, this.startPoint.z,
      this.endPoint.x, this.endPoint.y, this.endPoint.z
    ]);
    this.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.line.geometry.attributes.position.needsUpdate = true;

    // Update end marker
    this.endMarker.position.copy(this.endPoint);
    this.endMarker.position.y = 0.02;

    // Calculate distance
    const distance = this.calculateDistance();

    // Update tick marks
    this.updateTickMarks();

    // Update colors based on range
    this.updateColors(distance);

    return distance;
  }

  calculateDistance() {
    if (!this.startPoint || !this.endPoint) return 0;

    const dx = this.endPoint.x - this.startPoint.x;
    const dz = this.endPoint.z - this.startPoint.z;
    const distanceUnits = Math.sqrt(dx * dx + dz * dz);

    return distanceUnits / this.unitsPerInch;
  }

  updateTickMarks() {
    const distance = this.calculateDistance();
    const numTicks = Math.floor(distance);

    // Ensure we have enough tick marks
    while (this.tickMarks.length < numTicks) {
      this.tickMarks.push(this.createTickMark());
    }

    // Position tick marks
    const dx = this.endPoint.x - this.startPoint.x;
    const dz = this.endPoint.z - this.startPoint.z;
    const length = Math.sqrt(dx * dx + dz * dz);

    if (length === 0) return;

    const dirX = dx / length;
    const dirZ = dz / length;
    const angle = Math.atan2(dirX, dirZ);

    for (let i = 0; i < this.tickMarks.length; i++) {
      const tick = this.tickMarks[i];

      if (i < numTicks) {
        const dist = (i + 1) * this.unitsPerInch;
        tick.position.x = this.startPoint.x + dirX * dist;
        tick.position.z = this.startPoint.z + dirZ * dist;
        tick.rotation.z = angle;
        tick.visible = true;

        // Make every 6" tick larger (half foot markers)
        if ((i + 1) % 6 === 0) {
          tick.scale.set(1.5, 1.5, 1);
        } else {
          tick.scale.set(1, 1, 1);
        }
      } else {
        tick.visible = false;
      }
    }
  }

  updateColors(distance) {
    if (this.maxRange !== null) {
      const inRange = distance <= this.maxRange;
      const color = inRange ? this.validColor : this.invalidColor;

      this.line.material.color.setHex(color);
      this.endMarker.material.color.setHex(color);

      for (const tick of this.tickMarks) {
        tick.material.color.setHex(color);
      }
    }
  }

  setMaxRange(range) {
    this.maxRange = range;
  }

  clearMaxRange() {
    this.maxRange = null;
    this.line.material.color.setHex(this.tapeColor);
    this.endMarker.material.color.setHex(0xff6600);
  }

  end() {
    const distance = this.calculateDistance();
    this.hide();
    return distance;
  }

  hide() {
    this.isActive = false;
    this.startPoint = null;
    this.endPoint = null;

    this.line.visible = false;
    this.startMarker.visible = false;
    this.endMarker.visible = false;

    for (const tick of this.tickMarks) {
      tick.visible = false;
    }
  }

  isInRange(distance) {
    if (this.maxRange === null) return true;
    return distance <= this.maxRange;
  }

  formatDistance(distance) {
    const inches = Math.round(distance * 10) / 10;
    if (inches >= 12) {
      const feet = Math.floor(inches / 12);
      const remainingInches = Math.round((inches % 12) * 10) / 10;
      return `${feet}' ${remainingInches}"`;
    }
    return `${inches}"`;
  }

  dispose() {
    this.scene.remove(this.line);
    this.scene.remove(this.startMarker);
    this.scene.remove(this.endMarker);

    for (const tick of this.tickMarks) {
      this.scene.remove(tick);
      tick.geometry.dispose();
      tick.material.dispose();
    }

    this.line.geometry.dispose();
    this.line.material.dispose();
    this.startMarker.geometry.dispose();
    this.startMarker.material.dispose();
    this.endMarker.geometry.dispose();
    this.endMarker.material.dispose();
  }
}
