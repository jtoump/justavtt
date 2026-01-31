import * as THREE from 'three';

export class Grid {
  constructor(size = 20) {
    this.size = size;
    this.cellSize = 1;
    this.group = new THREE.Group();

    this.createGridHelper();
    this.createGroundPlane();
    this.createRaycastPlane();
  }

  createGridHelper() {
    this.gridHelper = new THREE.GridHelper(
      this.size,
      this.size,
      0x444444,
      0x333333
    );
    this.gridHelper.position.y = 0.01;
    this.group.add(this.gridHelper);
  }

  createGroundPlane() {
    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    const material = new THREE.MeshStandardMaterial({
      color: 0x2d2d44,
      roughness: 0.8,
      metalness: 0.2
    });
    this.groundPlane = new THREE.Mesh(geometry, material);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.receiveShadow = true;
    this.group.add(this.groundPlane);
  }

  createRaycastPlane() {
    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    const material = new THREE.MeshBasicMaterial({
      visible: false
    });
    this.raycastPlane = new THREE.Mesh(geometry, material);
    this.raycastPlane.rotation.x = -Math.PI / 2;
    this.raycastPlane.name = 'raycastPlane';
    this.group.add(this.raycastPlane);
  }

  worldToGrid(worldX, worldZ) {
    const halfSize = this.size / 2;
    const gridX = Math.floor(worldX + halfSize);
    const gridZ = Math.floor(worldZ + halfSize);

    if (gridX < 0 || gridX >= this.size || gridZ < 0 || gridZ >= this.size) {
      return null;
    }

    return { x: gridX, z: gridZ };
  }

  gridToWorld(gridX, gridZ) {
    const halfSize = this.size / 2;
    const worldX = gridX - halfSize + 0.5;
    const worldZ = gridZ - halfSize + 0.5;
    return { x: worldX, z: worldZ };
  }

  getObject() {
    return this.group;
  }

  getRaycastPlane() {
    return this.raycastPlane;
  }

  toggleVisibility() {
    this.gridHelper.visible = !this.gridHelper.visible;
  }

  isVisible() {
    return this.gridHelper.visible;
  }

  setGroundColor(color) {
    this.groundPlane.material.color.setHex(color);
  }
}
