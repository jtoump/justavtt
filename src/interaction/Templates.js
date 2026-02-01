import * as THREE from 'three';

/**
 * Templates for wargaming - blast markers, flame templates, etc.
 */
export class Templates {
  constructor(scene) {
    this.scene = scene;
    this.activeTemplate = null;
    this.placedTemplates = [];

    // Template definitions (sizes in inches)
    this.templateTypes = {
      'small-blast': { type: 'circle', radius: 1.5, color: 0xff6600, label: '3" Blast' },
      'large-blast': { type: 'circle', radius: 2.5, color: 0xff3300, label: '5" Blast' },
      'apocalypse': { type: 'circle', radius: 5, color: 0xff0000, label: '10" Apocalypse' },
      'flame': { type: 'teardrop', length: 8, width: 4, color: 0xff4400, label: 'Flamer' },
      'cone-small': { type: 'cone', length: 6, angle: 45, color: 0x00aaff, label: '6" Cone' },
      'cone-large': { type: 'cone', length: 12, angle: 45, color: 0x0066ff, label: '12" Cone' },
      'line': { type: 'line', length: 12, width: 0.5, color: 0xffff00, label: '12" Line' },
      'aura-3': { type: 'ring', innerRadius: 0, outerRadius: 3, color: 0x00ff88, label: '3" Aura' },
      'aura-6': { type: 'ring', innerRadius: 0, outerRadius: 6, color: 0x00ff44, label: '6" Aura' }
    };
  }

  createTemplate(typeName) {
    const config = this.templateTypes[typeName];
    if (!config) return null;

    let mesh;

    switch (config.type) {
      case 'circle':
        mesh = this.createCircleTemplate(config);
        break;
      case 'teardrop':
        mesh = this.createTeardropTemplate(config);
        break;
      case 'cone':
        mesh = this.createConeTemplate(config);
        break;
      case 'line':
        mesh = this.createLineTemplate(config);
        break;
      case 'ring':
        mesh = this.createRingTemplate(config);
        break;
      default:
        return null;
    }

    mesh.userData.templateType = typeName;
    mesh.userData.templateConfig = config;
    mesh.renderOrder = 100;

    return mesh;
  }

  createCircleTemplate(config) {
    const geometry = new THREE.CircleGeometry(config.radius, 64);
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;

    // Add outline
    const outlineGeometry = new THREE.RingGeometry(config.radius - 0.05, config.radius, 64);
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false
    });
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.02;

    const group = new THREE.Group();
    group.add(mesh);
    group.add(outline);

    return group;
  }

  createTeardropTemplate(config) {
    // Create teardrop shape (flame template)
    const shape = new THREE.Shape();
    const length = config.length;
    const width = config.width;

    // Start at the narrow end
    shape.moveTo(0, 0);

    // Curve to wide end
    shape.bezierCurveTo(
      width * 0.3, length * 0.3,
      width * 0.5, length * 0.6,
      width * 0.5, length
    );

    // Wide end arc
    shape.absarc(0, length, width * 0.5, 0, Math.PI, false);

    // Curve back to start
    shape.bezierCurveTo(
      -width * 0.5, length * 0.6,
      -width * 0.3, length * 0.3,
      0, 0
    );

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.PI; // Point forward
    mesh.position.y = 0.01;

    // Add gradient effect (inner brighter)
    const innerGeometry = new THREE.ShapeGeometry(shape);
    innerGeometry.scale(0.6, 0.6, 1);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: false
    });
    const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
    innerMesh.rotation.x = -Math.PI / 2;
    innerMesh.rotation.z = Math.PI;
    innerMesh.position.y = 0.02;

    const group = new THREE.Group();
    group.add(mesh);
    group.add(innerMesh);

    return group;
  }

  createConeTemplate(config) {
    const angleRad = (config.angle / 2) * (Math.PI / 180);
    const length = config.length;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(Math.sin(angleRad) * length, Math.cos(angleRad) * length);
    shape.absarc(0, 0, length, Math.PI / 2 - angleRad, Math.PI / 2 + angleRad, false);
    shape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -Math.PI / 2; // Point forward
    mesh.position.y = 0.01;

    const group = new THREE.Group();
    group.add(mesh);

    return group;
  }

  createLineTemplate(config) {
    const geometry = new THREE.PlaneGeometry(config.width, config.length);
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.position.z = config.length / 2; // Extend forward from origin

    const group = new THREE.Group();
    group.add(mesh);

    return group;
  }

  createRingTemplate(config) {
    const geometry = new THREE.RingGeometry(config.innerRadius, config.outerRadius, 64);
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;

    // Add outline
    const outlineGeometry = new THREE.RingGeometry(config.outerRadius - 0.05, config.outerRadius, 64);
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false
    });
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.02;

    const group = new THREE.Group();
    group.add(mesh);
    group.add(outline);

    return group;
  }

  showTemplate(typeName, position) {
    this.hideActiveTemplate();

    const template = this.createTemplate(typeName);
    if (!template) return null;

    template.position.copy(position);
    template.position.y = 0;
    this.scene.add(template);
    this.activeTemplate = template;

    return template;
  }

  updateTemplatePosition(position) {
    if (this.activeTemplate) {
      this.activeTemplate.position.x = position.x;
      this.activeTemplate.position.z = position.z;
    }
  }

  rotateTemplate(angle) {
    if (this.activeTemplate) {
      this.activeTemplate.rotation.y = angle;
    }
  }

  placeTemplate() {
    if (this.activeTemplate) {
      this.activeTemplate.userData.placed = true;
      this.placedTemplates.push(this.activeTemplate);
      this.activeTemplate = null;
      return true;
    }
    return false;
  }

  hideActiveTemplate() {
    if (this.activeTemplate) {
      this.scene.remove(this.activeTemplate);
      this.activeTemplate = null;
    }
  }

  removeTemplate(template) {
    const index = this.placedTemplates.indexOf(template);
    if (index > -1) {
      this.placedTemplates.splice(index, 1);
      this.scene.remove(template);
    }
  }

  clearAllTemplates() {
    this.hideActiveTemplate();
    for (const template of this.placedTemplates) {
      this.scene.remove(template);
    }
    this.placedTemplates = [];
  }

  getTemplateTypes() {
    return Object.entries(this.templateTypes).map(([key, config]) => ({
      id: key,
      label: config.label,
      type: config.type
    }));
  }

  // Check if a point is within a placed template
  isPointInTemplate(point, template) {
    const config = template.userData.templateConfig;
    const dx = point.x - template.position.x;
    const dz = point.z - template.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (config.type === 'circle' || config.type === 'ring') {
      return distance <= config.radius || distance <= config.outerRadius;
    }

    // For other shapes, simplified check
    return distance <= config.length;
  }

  // Get all objects within a template
  getObjectsInTemplate(template, objects) {
    return objects.filter(obj => {
      const point = obj.position;
      return this.isPointInTemplate(point, template);
    });
  }

  dispose() {
    this.clearAllTemplates();
  }
}
