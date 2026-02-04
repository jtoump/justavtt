import * as THREE from 'three';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(15, 20, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Store references to scene lights
    this.ambientLight = null;
    this.directionalLight = null;

    this.setupLights();
    this.setupResize();
  }

  setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.directionalLight.position.set(10, 20, 10);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 50;
    this.directionalLight.shadow.camera.left = -20;
    this.directionalLight.shadow.camera.right = 20;
    this.directionalLight.shadow.camera.top = 20;
    this.directionalLight.shadow.camera.bottom = -20;
    this.scene.add(this.directionalLight);
  }

  /**
   * Set ambient light intensity
   * @param {number} intensity - Light intensity (0-2)
   */
  setAmbientIntensity(intensity) {
    if (this.ambientLight) {
      this.ambientLight.intensity = intensity;
    }
  }

  /**
   * Set ambient light color
   * @param {number} color - Hex color
   */
  setAmbientColor(color) {
    if (this.ambientLight) {
      this.ambientLight.color.setHex(color);
    }
  }

  /**
   * Set directional (sun) light intensity
   * @param {number} intensity - Light intensity (0-2)
   */
  setDirectionalIntensity(intensity) {
    if (this.directionalLight) {
      this.directionalLight.intensity = intensity;
    }
  }

  /**
   * Set directional light color
   * @param {number} color - Hex color
   */
  setDirectionalColor(color) {
    if (this.directionalLight) {
      this.directionalLight.color.setHex(color);
    }
  }

  /**
   * Apply a time-of-day preset
   * @param {string} preset - 'day', 'dusk', 'night', 'dawn'
   */
  setTimeOfDay(preset) {
    const presets = {
      day: {
        ambient: { intensity: 0.5, color: 0xffffff },
        directional: { intensity: 1.0, color: 0xffffff },
        background: 0x87ceeb
      },
      dawn: {
        ambient: { intensity: 0.3, color: 0xffd4a6 },
        directional: { intensity: 0.6, color: 0xffaa66 },
        background: 0x4a3728
      },
      dusk: {
        ambient: { intensity: 0.25, color: 0xff9966 },
        directional: { intensity: 0.5, color: 0xff6633 },
        background: 0x2d1f3d
      },
      night: {
        ambient: { intensity: 0.1, color: 0x4466aa },
        directional: { intensity: 0.15, color: 0x6688cc },
        background: 0x0a0a1a
      }
    };

    const settings = presets[preset];
    if (!settings) return;

    this.setAmbientIntensity(settings.ambient.intensity);
    this.setAmbientColor(settings.ambient.color);
    this.setDirectionalIntensity(settings.directional.intensity);
    this.setDirectionalColor(settings.directional.color);
    this.scene.background = new THREE.Color(settings.background);
  }

  /**
   * Get current lighting state
   * @returns {Object} Current lighting configuration
   */
  getLightingState() {
    return {
      ambient: {
        intensity: this.ambientLight?.intensity || 0.5,
        color: this.ambientLight?.color.getHex() || 0xffffff
      },
      directional: {
        intensity: this.directionalLight?.intensity || 1,
        color: this.directionalLight?.color.getHex() || 0xffffff
      }
    };
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  add(object) {
    this.scene.add(object);
  }

  remove(object) {
    this.scene.remove(object);
  }
}
