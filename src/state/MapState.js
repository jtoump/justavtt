/**
 * MapState handles serialization and deserialization of the map state.
 * This is the foundation for multiplayer session synchronization.
 */
export class MapState {
  constructor() {
    this.version = 1;
  }

  /**
   * Serialize the current map state to a plain object
   * @param {ObjectManager} objectManager - The object manager containing map objects
   * @param {Templates} templates - Optional templates manager
   * @returns {Object} Serialized map state
   */
  serialize(objectManager, templates = null) {
    const objects = objectManager.getObjects().map(obj => {
      // Get color from object - handle both Mesh and Group (model) objects
      let color = '#3366cc'; // default color
      if (obj.isGroup) {
        // For Groups (models), find the body mesh color (skip the dark base at index 0)
        const children = obj.children || [];
        for (let i = 1; i < children.length; i++) {
          const child = children[i];
          if (child.isMesh && child.material && child.material.color) {
            color = '#' + child.material.color.getHexString();
            break;
          }
        }
      } else if (obj.material && obj.material.color) {
        color = '#' + obj.material.color.getHexString();
      }

      return {
        gridX: obj.userData.gridX,
        gridZ: obj.userData.gridZ,
        stackLevel: obj.userData.stackLevel,
        shape: obj.userData.shape || 'box',
        baseSize: obj.userData.baseSize || '32mm',
        color
      };
    });

    // Serialize templates if provided
    const serializedTemplates = templates ? this.serializeTemplates(templates) : [];

    return {
      version: this.version,
      timestamp: Date.now(),
      objects,
      templates: serializedTemplates
    };
  }

  /**
   * Serialize placed templates
   * @param {Templates} templates - The templates manager
   * @returns {Array} Serialized templates array
   */
  serializeTemplates(templates) {
    return templates.placedTemplates.map(template => ({
      templateType: template.userData.templateType,
      position: {
        x: template.position.x,
        y: template.position.y,
        z: template.position.z
      },
      rotation: template.rotation.y,
      linkedData: template.userData.linkedData || null
    }));
  }

  /**
   * Serialize to JSON string
   * @param {ObjectManager} objectManager - The object manager containing map objects
   * @returns {string} JSON string of map state
   */
  toJSON(objectManager) {
    return JSON.stringify(this.serialize(objectManager));
  }

  /**
   * Deserialize and apply state to the object manager
   * @param {Object} state - The state object to deserialize
   * @param {ObjectManager} objectManager - The object manager to apply state to
   * @param {Templates} templates - Optional templates manager
   */
  deserialize(state, objectManager, templates = null) {
    if (!state || !state.objects) {
      console.warn('Invalid state object');
      return;
    }

    // Clear existing objects
    objectManager.clearAll();

    // Sort objects by stackLevel to ensure proper stacking order
    const sortedObjects = [...state.objects].sort((a, b) => a.stackLevel - b.stackLevel);

    // Recreate objects
    for (const objData of sortedObjects) {
      const color = parseInt(objData.color.replace('#', ''), 16);
      objectManager.addBoxWithState(
        objData.gridX,
        objData.gridZ,
        objData.shape || 'box',
        color,
        objData.baseSize || '32mm'
      );
    }

    // Deserialize templates if provided
    if (templates && state.templates) {
      this.deserializeTemplates(state.templates, templates);
    }
  }

  /**
   * Deserialize and recreate templates
   * @param {Array} templateData - Array of serialized template data
   * @param {Templates} templates - The templates manager
   */
  deserializeTemplates(templateData, templates) {
    // Clear existing templates
    templates.clearAllTemplates();

    // Recreate each template
    for (const data of templateData) {
      const template = templates.createTemplate(data.templateType);
      if (template) {
        template.position.set(data.position.x, data.position.y, data.position.z);
        template.rotation.y = data.rotation || 0;

        // Restore linked data
        if (data.linkedData) {
          template.userData.linkedData = data.linkedData;
        }

        // Mark as placed and add to scene
        template.userData.placed = true;
        templates.scene.add(template);
        templates.placedTemplates.push(template);
      }
    }
  }

  /**
   * Deserialize from JSON string
   * @param {string} json - JSON string of map state
   * @param {ObjectManager} objectManager - The object manager to apply state to
   */
  fromJSON(json, objectManager) {
    try {
      const state = JSON.parse(json);
      this.deserialize(state, objectManager);
    } catch (e) {
      console.error('Failed to parse map state JSON:', e);
    }
  }

  /**
   * Create a diff between two states (for future incremental updates)
   * @param {Object} oldState - Previous state
   * @param {Object} newState - Current state
   * @returns {Object} Diff object with added, removed, and modified objects
   */
  diff(oldState, newState) {
    const oldMap = new Map();
    const newMap = new Map();

    // Create lookup maps using grid position + stack level as key
    for (const obj of (oldState?.objects || [])) {
      const key = `${obj.gridX},${obj.gridZ},${obj.stackLevel}`;
      oldMap.set(key, obj);
    }

    for (const obj of (newState?.objects || [])) {
      const key = `${obj.gridX},${obj.gridZ},${obj.stackLevel}`;
      newMap.set(key, obj);
    }

    const added = [];
    const removed = [];
    const modified = [];

    // Find added and modified
    for (const [key, obj] of newMap) {
      if (!oldMap.has(key)) {
        added.push(obj);
      } else {
        const oldObj = oldMap.get(key);
        if (oldObj.color !== obj.color || oldObj.shape !== obj.shape) {
          modified.push(obj);
        }
      }
    }

    // Find removed
    for (const [key, obj] of oldMap) {
      if (!newMap.has(key)) {
        removed.push(obj);
      }
    }

    return { added, removed, modified };
  }
}
