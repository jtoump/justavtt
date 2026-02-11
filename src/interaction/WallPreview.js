import * as THREE from 'three';

export class WallPreview {
  constructor(scene) {
    this.scene = scene;
    this.highlights = [];
    this.geometry = new THREE.BoxGeometry(0.95, 0.1, 0.95);
    this.material = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.6
    });
  }

  getLinePositions(startGrid, endGrid) {
    const positions = [];

    const dx = Math.abs(endGrid.x - startGrid.x);
    const dz = Math.abs(endGrid.z - startGrid.z);
    const sx = startGrid.x < endGrid.x ? 1 : -1;
    const sz = startGrid.z < endGrid.z ? 1 : -1;
    let err = dx - dz;

    let x = startGrid.x;
    let z = startGrid.z;

    while (true) {
      positions.push({ x, z });

      if (x === endGrid.x && z === endGrid.z) break;

      const e2 = 2 * err;
      if (e2 > -dz) {
        err -= dz;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        z += sz;
      }
    }

    return positions;
  }

  show(gridPositions, grid, getStackHeight) {
    this.hide();

    for (const gridPos of gridPositions) {
      const worldPos = grid.gridToWorld(gridPos.x, gridPos.z);
      const stackHeight = getStackHeight(gridPos.x, gridPos.z);

      const mesh = new THREE.Mesh(this.geometry, this.material);
      mesh.position.set(worldPos.x, (worldPos.y || 0) + stackHeight + 0.05, worldPos.z);
      this.scene.add(mesh);
      this.highlights.push(mesh);
    }
  }

  hide() {
    for (const mesh of this.highlights) {
      this.scene.remove(mesh);
    }
    this.highlights = [];
  }

  dispose() {
    this.hide();
    this.geometry.dispose();
    this.material.dispose();
  }
}
