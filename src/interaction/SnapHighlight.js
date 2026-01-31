import * as THREE from 'three';

export class SnapHighlight {
  constructor(scene) {
    this.scene = scene;
    this.highlightMesh = null;
    this.createHighlightMesh();
  }

  createHighlightMesh() {
    const geometry = new THREE.BoxGeometry(0.95, 0.1, 0.95);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6
    });
    this.highlightMesh = new THREE.Mesh(geometry, material);
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);
  }

  show(x, y, z) {
    this.highlightMesh.position.set(x, y + 0.05, z);
    this.highlightMesh.visible = true;
  }

  hide() {
    this.highlightMesh.visible = false;
  }

  setColor(color) {
    this.highlightMesh.material.color.setHex(color);
  }

  dispose() {
    this.scene.remove(this.highlightMesh);
    this.highlightMesh.geometry.dispose();
    this.highlightMesh.material.dispose();
  }
}
