import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { Grid } from './core/Grid.js';
import { Raycaster } from './interaction/Raycaster.js';
import { SnapHighlight } from './interaction/SnapHighlight.js';
import { WallPreview } from './interaction/WallPreview.js';
import { MeasurementLine } from './interaction/MeasurementLine.js';
import { MeasuringTape } from './interaction/MeasuringTape.js';
import { Templates } from './interaction/Templates.js';
import { ObjectManager } from './objects/ObjectManager.js';
import { UIManager } from './ui/UIManager.js';
import { DiceRoller } from './ui/DiceRoller.js';
import { ItemPanel } from './ui/ItemPanel.js';
import { MapState } from './state/MapState.js';
import { SessionManager } from './multiplayer/SessionManager.js';
import { DataManager } from './data/DataManager.js';
import { InventoryManager } from './data/InventoryManager.js';
import { InventoryPanel } from './ui/InventoryPanel.js';
import { CreaturePanel } from './ui/CreaturePanel.js';
import { DiceNotationParser } from './utils/DiceNotationParser.js';

class App {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.currentMode = 'select';
    this.currentSnapTarget = null;
    this.wallStart = null;
    this.moveStartPos = null;
    this.lastPlacedPositions = [];
    this.mapState = new MapState();
    this.currentTemplateType = 'small-blast';
    this.isMeasuring = false;
    this.init();
  }

  async init() {
    this.uiManager = new UIManager('ui-container');
    await this.uiManager.loadConfig('/src/config/ui.json');
    const settings = this.uiManager.getSettings();
    this.modeConfig = this.uiManager.getModes();
    this.keybinds = this.uiManager.getKeybinds();

    this.sceneManager = new SceneManager(this.canvas);
    this.cameraController = new CameraController(
      this.sceneManager.camera,
      this.canvas
    );

    this.grid = new Grid(settings.gridSize || 20);
    this.sceneManager.add(this.grid.getObject());

    this.objectManager = new ObjectManager(
      this.sceneManager.scene,
      this.grid
    );

    if (settings.boxColor) {
      const color = parseInt(settings.boxColor.replace('#', ''), 16);
      this.objectManager.setBoxColor(color);
    }

    this.snapHighlight = new SnapHighlight(this.sceneManager.scene);
    this.wallPreview = new WallPreview(this.sceneManager.scene);
    this.measurementLine = new MeasurementLine(this.sceneManager.scene);
    this.measuringTape = new MeasuringTape(this.sceneManager.scene);
    this.templates = new Templates(this.sceneManager.scene);
    this.distanceDisplay = document.getElementById('distance-display');

    // Create measure display for wargaming
    this.measureDisplay = document.createElement('div');
    this.measureDisplay.className = 'measure-display';
    this.measureDisplay.style.display = 'none';
    document.getElementById('app').appendChild(this.measureDisplay);

    // Initialize dice roller
    this.diceRoller = new DiceRoller(document.getElementById('app'));
    this.diceRoller.hide(); // Hidden by default

    // Initialize data manager and item panel
    this.dataManager = new DataManager();
    await this.dataManager.loadData('/src/data');
    this.itemPanel = new ItemPanel(document.getElementById('app'), this.dataManager);

    // Setup callback for when template link changes (for multiplayer sync)
    this.itemPanel.setOnLinkChange((template, linkData) => {
      console.log('[App] Template link changed:', linkData);
      this.notifyStateChange();
    });

    // Initialize inventory system
    this.inventoryManager = new InventoryManager();
    this.inventoryPanel = new InventoryPanel(
      document.getElementById('app'),
      this.inventoryManager
    );

    // Wire up ItemPanel to inventory
    this.itemPanel.setOnAddToStash((item, source) => {
      this.inventoryManager.addItem(item, source);
      console.log('[App] Item added to stash:', item.name);
    });

    // Initialize creature panel with dice notation parser
    this.diceNotationParser = new DiceNotationParser(this.diceRoller);
    this.creaturePanel = new CreaturePanel(
      document.getElementById('app'),
      this.dataManager,
      this.diceNotationParser
    );

    // Setup callback for when creature link changes (for multiplayer sync)
    this.creaturePanel.setOnLinkChange((object, linkData) => {
      console.log('[App] Object creature link changed:', linkData);
      this.notifyStateChange();
    });

    this.raycaster = new Raycaster(
      this.sceneManager.camera,
      this.canvas
    );
    this.raycaster.setGridPlane(this.grid.getRaycastPlane());

    this.setupRaycasterCallbacks();
    this.setupKeyboardEvents();
    this.registerUIActions();
    this.uiManager.render();
    this.uiManager.setActiveMode(this.currentMode);

    // Initialize multiplayer session manager
    this.initSessionManager();

    this.animate();
  }

  initSessionManager() {
    // Get server URL from settings or dynamically use current host
    const host = window.location.hostname || 'localhost';
    const defaultUrl = `ws://${host}:8080`;
    const serverUrl = this.uiManager.getSettings().serverUrl || defaultUrl;
    this.sessionManager = new SessionManager(this, serverUrl);

    // Setup session UI
    this.uiManager.renderSessionPanel();

    // Register session actions
    this.uiManager.registerAction('createSession', async (name) => {
      if (!name || !name.trim()) {
        console.warn('Session name is required');
        return;
      }
      try {
        await this.sessionManager.createSession(name.trim());
      } catch (error) {
        console.error('Failed to create session:', error.message);
      }
    });

    this.uiManager.registerAction('joinSession', async (name) => {
      if (!name || !name.trim()) {
        console.warn('Session name is required');
        return;
      }
      try {
        await this.sessionManager.joinSession(name.trim());
      } catch (error) {
        console.error('Failed to join session:', error.message);
      }
    });

    this.uiManager.registerAction('leaveSession', () => {
      this.sessionManager.leaveSession();
    });

    // Setup session event callbacks
    this.sessionManager.onSessionChange = (sessionInfo) => {
      this.uiManager.updateSessionUI(sessionInfo);
    };

    this.sessionManager.onUserCountChange = (count) => {
      this.uiManager.updateUserCount(count);
    };

    this.sessionManager.onConnectionChange = (connected) => {
      this.uiManager.updateSessionStatus(connected);
    };

    this.sessionManager.onError = (error) => {
      console.error('Session error:', error.message);
    };
  }

  setupRaycasterCallbacks() {
    this.raycaster.setOnClick((event) => this.handleClick(event));
    this.raycaster.setOnSelect((event) => this.handleSelect(event));
    this.raycaster.setOnMove((event) => this.handleMove(event));
    this.raycaster.setOnPlace((event) => this.handlePlace(event));
    this.raycaster.setOnHover((event) => this.handleHover(event));
    this.raycaster.setOnTemplateClick((event) => this.handleTemplateClick(event));
  }

  handleTemplateClick(event) {
    if (!event.template) return;

    if (this.currentMode === 'delete') {
      // Delete the template
      this.templates.removeTemplate(event.template);
      this.updateRaycasterTemplates();
      this.notifyStateChange();
      // Hide item panel if it was showing this template
      if (this.itemPanel && this.itemPanel.currentTemplate === event.template) {
        this.itemPanel.hide();
      }
    } else {
      // Show item panel for the clicked template
      if (this.itemPanel) {
        this.itemPanel.showForTemplate(event.template);
      }
    }
  }

  updateRaycasterTemplates() {
    const clickableTemplates = this.templates.getClickableTemplates();
    this.raycaster.setTemplateObjects(clickableTemplates);
  }

  setupKeyboardEvents() {
    window.addEventListener('keydown', (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = event.key;
      const action = this.keybinds[key];

      if (action && this.uiManager.actions[action]) {
        event.preventDefault();
        this.uiManager.actions[action]();
      }
    });
  }

  handleClick(event) {
    if (this.currentMode === 'place') {
      if (event.type === 'grid') {
        const gridPos = this.grid.worldToGrid(event.point.x, event.point.z);
        if (gridPos) {
          this.objectManager.addBox(gridPos.x, gridPos.z);
          this.lastPlacedPositions = [{ x: gridPos.x, z: gridPos.z }];
          this.updateRaycasterObjects();
          this.notifyStateChange();
        }
      } else if (event.type === 'object') {
        const gridX = event.object.userData.gridX;
        const gridZ = event.object.userData.gridZ;
        this.objectManager.stackOnObject(event.object);
        this.lastPlacedPositions = [{ x: gridX, z: gridZ }];
        this.updateRaycasterObjects();
        this.notifyStateChange();
      }
    } else if (this.currentMode === 'delete') {
      if (event.type === 'object') {
        this.objectManager.removeObject(event.object);
        this.updateRaycasterObjects();
        this.notifyStateChange();
      }
    } else if (this.currentMode === 'measure') {
      // Measuring tape mode - click to start/end measurement
      if (!this.isMeasuring) {
        // Start measuring
        this.isMeasuring = true;
        this.measuringTape.start(event.point);
        this.measureDisplay.style.display = 'block';
        this.measureDisplay.textContent = '0"';
      } else {
        // End measuring
        this.isMeasuring = false;
        this.measuringTape.end();
        this.measureDisplay.style.display = 'none';
      }
    } else if (this.currentMode === 'template') {
      // Template mode - click to place template
      if (this.templates.activeTemplate) {
        const placedTemplate = this.templates.activeTemplate;
        this.templates.placeTemplate();
        // Link clickable templates to a default deck for demo purposes
        if (placedTemplate.userData.clickable) {
          // Default link to common treasure deck - can be customized later
          this.templates.linkTemplateToData(placedTemplate, { type: 'deck', id: 'treasure-common' });
        }
        this.updateRaycasterTemplates();
        this.notifyStateChange();
      } else {
        this.templates.showTemplate(this.currentTemplateType, event.point);
      }
    } else if (this.currentMode === 'select') {
      // Select mode - click on objects to view/edit creature stats
      if (event.type === 'object') {
        this.creaturePanel.showForObject(event.object);
      }
    } else if (this.currentMode === 'wall') {
      // Wall mode - click to start/place wall line
      if (event.type === 'grid' || event.type === 'object') {
        const gridPos = event.type === 'grid'
          ? this.grid.worldToGrid(event.point.x, event.point.z)
          : { x: event.object.userData.gridX, z: event.object.userData.gridZ };

        if (gridPos) {
          if (!this.wallStart) {
            // First click - set wall start
            this.wallStart = gridPos;
            const worldPos = this.grid.gridToWorld(gridPos.x, gridPos.z);
            const stackHeight = this.objectManager.getStackHeight(gridPos.x, gridPos.z);
            this.snapHighlight.setColor(0x00aaff);
            this.snapHighlight.show(worldPos.x, (worldPos.y || 0) + stackHeight, worldPos.z);
          } else {
            // Second click - place wall
            const positions = this.wallPreview.getLinePositions(this.wallStart, gridPos);
            this.lastPlacedPositions = [];
            for (const pos of positions) {
              this.objectManager.addBox(pos.x, pos.z);
              this.lastPlacedPositions.push({ x: pos.x, z: pos.z });
            }
            this.updateRaycasterObjects();
            this.notifyStateChange();
            this.wallStart = null;
            this.wallPreview.hide();
            this.snapHighlight.hide();
          }
        }
      }
    }
  }

  handleHover(event) {
    if (this.currentMode === 'place') {
      if (event.objectHit) {
        // Hovering over an object - show highlight for stacking
        const obj = event.objectHit.object;
        const worldPos = this.grid.gridToWorld(obj.userData.gridX, obj.userData.gridZ);
        const stackHeight = this.objectManager.getStackHeight(obj.userData.gridX, obj.userData.gridZ);
        this.snapHighlight.setColor(0xffaa00); // Orange for stack
        this.snapHighlight.show(worldPos.x, (worldPos.y || 0) + stackHeight, worldPos.z);
      } else if (event.gridHit) {
        // Hovering over the grid - show highlight for placement
        const gridPos = this.grid.worldToGrid(event.gridHit.point.x, event.gridHit.point.z);
        if (gridPos) {
          const worldPos = this.grid.gridToWorld(gridPos.x, gridPos.z);
          const stackHeight = this.objectManager.getStackHeight(gridPos.x, gridPos.z);
          this.snapHighlight.setColor(0x00ff88); // Green for grid
          this.snapHighlight.show(worldPos.x, (worldPos.y || 0) + stackHeight, worldPos.z);
        } else {
          this.snapHighlight.hide();
        }
      } else {
        this.snapHighlight.hide();
      }
    } else if (this.currentMode === 'delete') {
      if (event.objectHit) {
        const obj = event.objectHit.object;
        const worldPos = this.grid.gridToWorld(obj.userData.gridX, obj.userData.gridZ);
        this.snapHighlight.setColor(0xff4444);
        this.snapHighlight.show(worldPos.x, (worldPos.y || 0) + obj.userData.stackLevel, worldPos.z);
      } else if (event.templateHit && event.templateHit.template) {
        // Show delete highlight for templates
        const template = event.templateHit.template;
        this.snapHighlight.setColor(0xff4444);
        this.snapHighlight.show(template.position.x, 0.1, template.position.z);
      } else {
        this.snapHighlight.hide();
      }
    } else if (this.currentMode === 'measure') {
      // Update measuring tape on hover
      if (this.isMeasuring && event.gridHit) {
        const distance = this.measuringTape.update(event.gridHit.point);
        if (distance !== null) {
          const formatted = this.measuringTape.formatDistance(distance);
          this.measureDisplay.textContent = formatted;
        }
      }
    } else if (this.currentMode === 'template') {
      // Update template position on hover
      if (event.gridHit) {
        if (this.templates.activeTemplate) {
          this.templates.updateTemplatePosition(event.gridHit.point);
        } else {
          // Show preview template
          this.templates.showTemplate(this.currentTemplateType, event.gridHit.point);
        }
      }
    } else if (this.currentMode === 'wall') {
      // Wall mode - show preview line from start to current position
      if (this.wallStart && event.gridHit) {
        const gridPos = this.grid.worldToGrid(event.gridHit.point.x, event.gridHit.point.z);
        if (gridPos) {
          const positions = this.wallPreview.getLinePositions(this.wallStart, gridPos);
          this.wallPreview.show(
            positions,
            this.grid,
            (x, z) => this.objectManager.getStackHeight(x, z)
          );
        }
      } else if (!this.wallStart && event.gridHit) {
        // Show highlight at hover position when no wall started
        const gridPos = this.grid.worldToGrid(event.gridHit.point.x, event.gridHit.point.z);
        if (gridPos) {
          const worldPos = this.grid.gridToWorld(gridPos.x, gridPos.z);
          const stackHeight = this.objectManager.getStackHeight(gridPos.x, gridPos.z);
          this.snapHighlight.setColor(0x00aaff);
          this.snapHighlight.show(worldPos.x, (worldPos.y || 0) + stackHeight, worldPos.z);
        }
      }
    }
  }

  handleSelect(event) {
    this.objectManager.selectObject(event.object);

    const gridX = event.object.userData.gridX;
    const gridZ = event.object.userData.gridZ;
    const worldPos = this.grid.gridToWorld(gridX, gridZ);
    const stackHeight = event.object.userData.stackLevel;

    this.moveStartPos = {
      grid: { x: gridX, z: gridZ },
      world: { x: worldPos.x, y: (worldPos.y || 0) + stackHeight, z: worldPos.z }
    };
  }

  handleMove(event) {
    if (!this.objectManager.selectedObject) return;

    const snapTarget = this.objectManager.getSnapTarget(
      event.gridHit,
      event.objectHit
    );

    this.currentSnapTarget = snapTarget;

    if (snapTarget) {
      const highlightColor = snapTarget.type === 'stack' ? 0xffaa00 : 0x00ff88;
      this.snapHighlight.setColor(highlightColor);
      this.snapHighlight.show(
        snapTarget.worldX,
        snapTarget.worldY,
        snapTarget.worldZ
      );

      if (this.moveStartPos) {
        const endWorld = { x: snapTarget.worldX, y: snapTarget.worldY, z: snapTarget.worldZ };
        this.measurementLine.show(this.moveStartPos.world, endWorld);

        const distance = this.measurementLine.calculateDistance(
          this.moveStartPos.grid,
          { x: snapTarget.gridX, z: snapTarget.gridZ }
        );

        const losCheck = this.measurementLine.checkLineOfSight(
          this.moveStartPos.world,
          endWorld,
          this.objectManager.getObjects(),
          this.objectManager.selectedObject
        );

        if (losCheck.blocked) {
          this.distanceDisplay.innerHTML = `Distance: ${distance}<br><span class="los-blocked">No Line of Sight</span>`;
        } else {
          this.distanceDisplay.textContent = `Distance: ${distance}`;
        }
        this.distanceDisplay.classList.add('visible');
      }
    } else {
      this.snapHighlight.hide();
      this.measurementLine.hide();
      this.distanceDisplay.classList.remove('visible');
    }
  }

  handlePlace(event) {
    this.snapHighlight.hide();
    this.measurementLine.hide();
    this.distanceDisplay.classList.remove('visible');
    this.moveStartPos = null;

    if (this.currentSnapTarget) {
      this.objectManager.confirmMove(this.currentSnapTarget);
      this.notifyStateChange();
    } else {
      this.objectManager.cancelMove();
    }

    this.currentSnapTarget = null;
    this.updateRaycasterObjects();
  }

  setMode(mode) {
    if (this.currentMode === mode) return;

    this.clearModeState();
    this.currentMode = mode;
    this.raycaster.setSelectEnabled(mode === 'move');
    this.uiManager.setActiveMode(mode);
  }

  clearModeState() {
    this.objectManager.deselectObject();
    this.raycaster.cancelCarry();
    this.snapHighlight.hide();
    this.wallPreview.hide();
    this.measurementLine.hide();
    this.measuringTape.hide();
    this.templates.hideActiveTemplate();
    this.distanceDisplay.classList.remove('visible');
    this.measureDisplay.style.display = 'none';
    this.wallStart = null;
    this.moveStartPos = null;
    this.currentSnapTarget = null;
    this.isMeasuring = false;
  }

  handleEscape() {
    // Cancel measuring
    if (this.isMeasuring) {
      this.isMeasuring = false;
      this.measuringTape.hide();
      this.measureDisplay.style.display = 'none';
      return;
    }

    // Cancel template placement
    if (this.templates.activeTemplate) {
      this.templates.hideActiveTemplate();
      return;
    }

    if (this.wallStart) {
      this.wallStart = null;
      this.wallPreview.hide();
      this.snapHighlight.hide();
      return;
    }

    if (this.objectManager.selectedObject) {
      this.objectManager.cancelMove();
      this.raycaster.cancelCarry();
      this.snapHighlight.hide();
      this.measurementLine.hide();
      this.distanceDisplay.classList.remove('visible');
      this.moveStartPos = null;
      this.currentSnapTarget = null;
      return;
    }

    this.setMode('select');
  }

  updateRaycasterObjects() {
    this.raycaster.setObjects(this.objectManager.getObjects());
  }

  handleRepeat() {
    if (this.lastPlacedPositions.length === 0) return;

    for (const pos of this.lastPlacedPositions) {
      this.objectManager.addBox(pos.x, pos.z);
    }
    this.updateRaycasterObjects();
    this.notifyStateChange();
  }

  registerUIActions() {
    // Mode actions
    this.uiManager.registerAction('setModeSelect', () => this.setMode('select'));
    this.uiManager.registerAction('setModePlace', () => this.setMode('place'));
    this.uiManager.registerAction('setModeMove', () => this.setMode('move'));
    this.uiManager.registerAction('setModeMeasure', () => this.setMode('measure'));
    this.uiManager.registerAction('setModeTemplate', () => this.setMode('template'));
    this.uiManager.registerAction('setModeDelete', () => this.setMode('delete'));
    this.uiManager.registerAction('setModeWall', () => this.setMode('wall'));

    this.uiManager.registerAction('escape', () => this.handleEscape());
    this.uiManager.registerAction('repeat', () => this.handleRepeat());

    this.uiManager.registerAction('clearAll', () => {
      this.objectManager.clearAll();
      this.templates.clearAllTemplates();
      this.clearModeState();
      this.updateRaycasterObjects();
      this.updateRaycasterTemplates();
      this.notifyStateChange();
    });

    this.uiManager.registerAction('toggleGrid', () => {
      this.grid.toggleVisibility();
    });

    // Dice roller toggle
    this.uiManager.registerAction('toggleDice', () => {
      this.diceRoller.toggle();
    });

    // Inventory panel toggle
    this.uiManager.registerAction('toggleInventory', () => {
      this.inventoryPanel.toggle();
    });

    // Color and shape settings
    this.uiManager.registerAction('setGridColor', (color) => {
      const hex = parseInt(color.replace('#', ''), 16);
      this.grid.setGroundColor(hex);
      this.notifyStateChange();
    });

    // Grid texture control
    this.uiManager.registerAction('setGridTexture', (dataUrl, file) => {
      console.log(`[App] Setting grid texture: ${file.name}`);
      this.grid.setGroundTexture(dataUrl);
      this.notifyStateChange();
    });

    this.uiManager.registerAction('clearGridTexture', () => {
      console.log('[App] Clearing grid texture');
      this.grid.clearGroundTexture();
      this.notifyStateChange();
    });

    // Heightmap control
    this.uiManager.registerAction('setHeightMap', (dataUrl, file) => {
      console.log(`[App] Setting heightmap: ${file.name}`);
      this.grid.setHeightMap(dataUrl);
      this.notifyStateChange();
    });

    this.uiManager.registerAction('clearHeightMap', () => {
      console.log('[App] Clearing heightmap');
      this.grid.clearHeightMap();
      this.notifyStateChange();
    });

    this.uiManager.registerAction('setObjectColor', (color) => {
      const hex = parseInt(color.replace('#', ''), 16);
      this.objectManager.setBoxColor(hex);
    });

    // Wargaming-specific actions
    this.uiManager.registerAction('setBaseSize', (size) => {
      this.objectManager.setBaseSize(size);
    });

    this.uiManager.registerAction('setTemplateType', (type) => {
      this.currentTemplateType = type;
      // Update preview if in template mode
      if (this.currentMode === 'template') {
        this.templates.hideActiveTemplate();
      }
    });

    // Light color control - applies to new light objects
    this.uiManager.registerAction('setLightColor', (color) => {
      const hex = parseInt(color.replace('#', ''), 16);
      // Set light color for new light objects
      this.objectManager.setLightColor(hex);
    });

    // Time of day / scene lighting control
    this.uiManager.registerAction('setTimeOfDay', (preset) => {
      this.sceneManager.setTimeOfDay(preset);
    });

    // Shape selection
    this.uiManager.registerAction('setObjectShape', (shape) => {
      this.objectManager.setShape(shape);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.cameraController.update();
    this.sceneManager.render();
  }

  /**
   * Get the current map state as a serializable object
   * @returns {Object} The serialized map state
   */
  getState() {
    return this.mapState.serialize(this.objectManager, this.templates, this.grid);
  }

  /**
   * Get the current map state as a JSON string
   * @returns {string} JSON string of the map state
   */
  getStateJSON() {
    return JSON.stringify(this.mapState.serialize(this.objectManager, this.templates, this.grid));
  }

  /**
   * Set the map state from a state object
   * @param {Object} state - The state object to apply
   */
  setState(state) {
    this.clearModeState();
    this.mapState.deserialize(state, this.objectManager, this.templates, this.grid);
    this.updateRaycasterObjects();
    this.updateRaycasterTemplates();
  }

  /**
   * Set the map state from a JSON string
   * @param {string} json - JSON string of the map state
   */
  setStateJSON(json) {
    this.clearModeState();
    try {
      const state = JSON.parse(json);
      this.mapState.deserialize(state, this.objectManager, this.templates, this.grid);
    } catch (e) {
      console.error('Failed to parse map state JSON:', e);
    }
    this.updateRaycasterObjects();
    this.updateRaycasterTemplates();
  }

  /**
   * Callback for state changes (to be used by multiplayer sync)
   * @param {Function} callback - Function to call when state changes
   */
  onStateChange(callback) {
    this.stateChangeCallback = callback;
  }

  /**
   * Notify listeners that state has changed
   */
  notifyStateChange() {
    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.getState());
    }
  }
}

// Expose app instance globally for multiplayer integration
const app = new App();
window.app = app;
