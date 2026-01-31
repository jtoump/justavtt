import * as THREE from 'three';

export class MeasurementLine {
  constructor(scene) {
    this.scene = scene;
    this.line = null;
    this.material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      linewidth: 2
    });
  }

  show(startPos, endPos) {
    this.hide();

    const points = [
      new THREE.Vector3(startPos.x, startPos.y + 0.5, startPos.z),
      new THREE.Vector3(endPos.x, endPos.y + 0.5, endPos.z)
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.line = new THREE.Line(geometry, this.material);
    this.scene.add(this.line);
  }

  hide() {
    if (this.line) {
      this.scene.remove(this.line);
      this.line.geometry.dispose();
      this.line = null;
    }
  }

  calculateDistance(startGrid, endGrid) {
    const dx = Math.abs(endGrid.x - startGrid.x);
    const dz = Math.abs(endGrid.z - startGrid.z);
    return Math.max(dx, dz);
  }

  checkLineOfSight(startPos, endPos, objects, excludeObject = null) {
    const start = new THREE.Vector3(startPos.x, startPos.y + 0.5, startPos.z);
    const end = new THREE.Vector3(endPos.x, endPos.y + 0.5, endPos.z);

    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();
    direction.normalize();

    const raycaster = new THREE.Raycaster(start, direction, 0, distance);

    const objectsToCheck = excludeObject
      ? objects.filter(obj => obj !== excludeObject)
      : objects;

    const intersects = raycaster.intersectObjects(objectsToCheck);

    return {
      blocked: intersects.length > 0,
      blockingObject: intersects.length > 0 ? intersects[0].object : null
    };
  }

  dispose() {
    this.hide();
    this.material.dispose();
  }
}
