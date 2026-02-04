import * as THREE from 'three';

export class Grid {
  constructor(size = 20) {
    this.size = size;
    this.cellSize = 1;
    this.group = new THREE.Group();

    // Texture loader for ground textures
    this.textureLoader = new THREE.TextureLoader();
    this.currentTexture = null;
    this.originalColor = 0x2d2d44;

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
    this.originalColor = color;
  }

  /**
   * Set a texture for the ground plane
   * @param {string} imageUrl - URL or data URL of the image
   * @param {Object} options - Texture options
   * @param {number} options.repeatX - Horizontal repeat count (default: size)
   * @param {number} options.repeatY - Vertical repeat count (default: size)
   */
  setGroundTexture(imageUrl, options = {}) {
    const repeatX = options.repeatX || this.size;
    const repeatY = options.repeatY || this.size;

    this.textureLoader.load(
      imageUrl,
      (texture) => {
        // Configure texture for tiling
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
        texture.colorSpace = THREE.SRGBColorSpace;

        // Dispose of previous texture
        if (this.currentTexture) {
          this.currentTexture.dispose();
        }
        this.currentTexture = texture;

        // Apply texture to ground plane
        this.groundPlane.material.map = texture;
        this.groundPlane.material.color.setHex(0xffffff); // Reset color for texture
        this.groundPlane.material.needsUpdate = true;

        console.log('[Grid] Texture applied successfully');
      },
      undefined,
      (error) => {
        console.error('[Grid] Error loading texture:', error);
      }
    );
  }

  /**
   * Set texture repeat values
   * @param {number} repeatX - Horizontal repeat count
   * @param {number} repeatY - Vertical repeat count
   */
  setTextureRepeat(repeatX, repeatY) {
    if (this.currentTexture) {
      this.currentTexture.repeat.set(repeatX, repeatY);
    }
  }

  /**
   * Clear the texture and revert to solid color
   */
  clearGroundTexture() {
    if (this.currentTexture) {
      this.currentTexture.dispose();
      this.currentTexture = null;
    }

    this.groundPlane.material.map = null;
    this.groundPlane.material.color.setHex(this.originalColor);
    this.groundPlane.material.needsUpdate = true;

    console.log('[Grid] Texture cleared');
  }

  /**
   * Check if a texture is currently applied
   * @returns {boolean}
   */
  hasTexture() {
    return this.currentTexture !== null;
  }

  /**
   * Get texture state for serialization
   * @returns {Object|null}
   */
  getTextureState() {
    if (!this.currentTexture) return null;
    return {
      repeatX: this.currentTexture.repeat.x,
      repeatY: this.currentTexture.repeat.y
    };
  }
}
