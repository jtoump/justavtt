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

    // Heightmap settings
    this.heightScale = 5;
    this.currentHeightMap = null;
    this.cellHeights = null;   // 2D array [iz][ix] of per-cell heights

    // Store data URLs for serialization/sync
    this.currentTextureUrl = null;
    this.currentHeightMapUrl = null;

    this.createGridHelper();
    this.createGroundPlane();
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
    // Subdivide to match grid resolution for heightmap vertex displacement
    const geometry = new THREE.PlaneGeometry(
      this.size, this.size,
      this.size, this.size
    );
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
    const worldY = this.getHeightAt(gridX, gridZ);
    return { x: worldX, y: worldY, z: worldZ };
  }

  getObject() {
    return this.group;
  }

  getRaycastPlane() {
    return this.groundPlane;
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
   * @param {number} options.repeatX - Horizontal repeat count (default: 1 for stretch)
   * @param {number} options.repeatY - Vertical repeat count (default: 1 for stretch)
   */
  setGroundTexture(imageUrl, options = {}) {
    const repeatX = options.repeatX || 1;
    const repeatY = options.repeatY || 1;
    this.currentTextureUrl = imageUrl;

    this.textureLoader.load(
      imageUrl,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
        texture.colorSpace = THREE.SRGBColorSpace;

        if (this.currentTexture) {
          this.currentTexture.dispose();
        }
        this.currentTexture = texture;

        this.groundPlane.material.map = texture;
        this.groundPlane.material.color.setHex(0xffffff);
        this.groundPlane.material.needsUpdate = true;

        console.log('[Grid] Texture applied successfully');
      },
      undefined,
      (error) => {
        console.error('[Grid] Error loading texture:', error);
      }
    );
  }

  setTextureRepeat(repeatX, repeatY) {
    if (this.currentTexture) {
      this.currentTexture.repeat.set(repeatX, repeatY);
    }
  }

  clearGroundTexture() {
    if (this.currentTexture) {
      this.currentTexture.dispose();
      this.currentTexture = null;
    }
    this.currentTextureUrl = null;

    this.groundPlane.material.map = null;
    this.groundPlane.material.color.setHex(this.originalColor);
    this.groundPlane.material.needsUpdate = true;

    console.log('[Grid] Texture cleared');
  }

  hasTexture() {
    return this.currentTexture !== null;
  }

  getTextureState() {
    if (!this.currentTexture) return null;
    return {
      repeatX: this.currentTexture.repeat.x,
      repeatY: this.currentTexture.repeat.y
    };
  }

  // ─── Heightmap (Smooth Displacement) ──────────────────────────────

  /**
   * Get terrain height for a grid cell
   * @param {number} gridX - Grid cell X index
   * @param {number} gridZ - Grid cell Z index
   * @returns {number} Height at that cell (0 if no heightmap)
   */
  getHeightAt(gridX, gridZ) {
    if (!this.cellHeights) return 0;
    if (gridX < 0 || gridX >= this.size || gridZ < 0 || gridZ >= this.size) return 0;
    return this.cellHeights[gridZ][gridX];
  }

  /**
   * Apply a heightmap image as smooth terrain displacement.
   * Vertices of the subdivided PlaneGeometry are displaced based on
   * pixel brightness, creating a smooth terrain surface.
   */
  setHeightMap(imageUrl, options = {}) {
    const scale = options.heightScale || this.heightScale;
    this.currentHeightMapUrl = imageUrl;

    const img = new Image();
    img.onload = () => {
      this._applyHeightData(img, scale);
      this.currentHeightMap = { heightScale: scale };
      console.log('[Grid] Smooth heightmap applied');
    };
    img.onerror = (err) => {
      console.error('[Grid] Error loading heightmap:', err);
    };
    img.src = imageUrl;
  }

  /**
   * Clear the heightmap and restore flat terrain
   */
  clearHeightMap() {
    // Restore flat subdivided PlaneGeometry
    const oldGeometry = this.groundPlane.geometry;
    this.groundPlane.geometry = new THREE.PlaneGeometry(
      this.size, this.size,
      this.size, this.size
    );
    oldGeometry.dispose();

    this.cellHeights = null;
    this.currentHeightMap = null;
    this.currentHeightMapUrl = null;

    // Restore grid helper visibility
    this.gridHelper.visible = true;

    // Re-apply texture if one exists
    if (this.currentTexture) {
      this.groundPlane.material.needsUpdate = true;
    }

    console.log('[Grid] Heightmap cleared');
  }

  setHeightScale(scale) {
    this.heightScale = scale;
  }

  /**
   * Displace PlaneGeometry vertices based on heightmap image brightness.
   *
   * PlaneGeometry(size, size, size, size) has (size+1)×(size+1) vertices.
   * Vertex layout in local space (before rotation):
   *   local X = -halfSize + ix  (ix: 0..size)
   *   local Y = +halfSize - iy  (iy: 0..size)
   *   local Z = 0 (displaced to height)
   *
   * After rotation.x = -PI/2:
   *   world X = local X
   *   world Z = -local Y = -halfSize + iy
   *   world Y = local Z (the height)
   */
  _applyHeightData(img, scale) {
    const size = this.size;
    const verts = size + 1; // vertices per side

    // Sample the heightmap at vertex resolution
    const canvas = document.createElement('canvas');
    canvas.width = verts;
    canvas.height = verts;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, verts, verts);
    const imageData = ctx.getImageData(0, 0, verts, verts);
    const pixels = imageData.data;

    // Compute per-vertex heights from image brightness
    const vertexHeights = [];
    for (let iy = 0; iy < verts; iy++) {
      vertexHeights[iy] = [];
      for (let ix = 0; ix < verts; ix++) {
        const idx = (iy * verts + ix) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const brightness = (r + g + b) / (3 * 255);
        vertexHeights[iy][ix] = brightness * scale;
      }
    }

    // Displace geometry vertices (local Z becomes world Y after rotation)
    const positions = this.groundPlane.geometry.attributes.position;
    for (let iy = 0; iy < verts; iy++) {
      for (let ix = 0; ix < verts; ix++) {
        const vertexIndex = iy * verts + ix;
        positions.setZ(vertexIndex, vertexHeights[iy][ix]);
      }
    }

    positions.needsUpdate = true;
    this.groundPlane.geometry.computeVertexNormals();
    this.groundPlane.geometry.computeBoundingBox();
    this.groundPlane.geometry.computeBoundingSphere();

    // Compute per-cell heights (average of 4 corner vertices)
    // Cell (gridX, gridZ) corners are vertices: (gridX, gridZ), (gridX+1, gridZ),
    //                                           (gridX, gridZ+1), (gridX+1, gridZ+1)
    this.cellHeights = [];
    for (let gz = 0; gz < size; gz++) {
      this.cellHeights[gz] = [];
      for (let gx = 0; gx < size; gx++) {
        const h00 = vertexHeights[gz][gx];
        const h10 = vertexHeights[gz][gx + 1];
        const h01 = vertexHeights[gz + 1][gx];
        const h11 = vertexHeights[gz + 1][gx + 1];
        this.cellHeights[gz][gx] = (h00 + h10 + h01 + h11) / 4;
      }
    }

    // Hide flat grid helper (it won't follow the terrain surface)
    this.gridHelper.visible = false;
  }

  // ─── State Serialization (for multiplayer sync) ───────────────────

  getGridState() {
    return {
      groundColor: this.originalColor,
      textureUrl: this.currentTextureUrl,
      textureRepeat: this.getTextureState(),
      heightmapUrl: this.currentHeightMapUrl,
      heightScale: this.heightScale,
      cellHeights: this.cellHeights
    };
  }

  applyGridState(state) {
    if (!state) return;

    // Apply ground color
    if (state.groundColor != null) {
      this.setGroundColor(state.groundColor);
    }

    // Apply cellHeights synchronously first (needed for correct object placement)
    if (state.cellHeights) {
      this.cellHeights = state.cellHeights;
      this.gridHelper.visible = false;
    } else {
      this.cellHeights = null;
      this.gridHelper.visible = true;
    }

    // Apply heightmap visual (async image load, but cellHeights already set)
    if (state.heightmapUrl) {
      this.currentHeightMapUrl = state.heightmapUrl;
      this.heightScale = state.heightScale || this.heightScale;
      this.setHeightMap(state.heightmapUrl, { heightScale: this.heightScale });
    } else if (this.currentHeightMap) {
      this.clearHeightMap();
    }

    // Apply texture (async load, cosmetic only)
    if (state.textureUrl) {
      const options = state.textureRepeat || {};
      this.setGroundTexture(state.textureUrl, options);
    } else if (this.currentTexture) {
      this.clearGroundTexture();
    }
  }
}
