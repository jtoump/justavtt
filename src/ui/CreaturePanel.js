/**
 * CreaturePanel displays creature stat blocks when clicking on linked objects.
 * Shows when clicking on a miniature in select mode.
 * Supports dragging and lock-to-sync across multiplayer sessions.
 */
export class CreaturePanel {
  constructor(container, dataManager, diceNotationParser) {
    this.container = container;
    this.dataManager = dataManager;
    this.parser = diceNotationParser;
    this.currentObject = null;

    // Dragging state
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };

    // Lock state for multiplayer sync
    this.isLocked = false;

    // Callbacks
    this.onLinkChange = null;
    this.onLockToggle = null; // Called when lock is toggled

    this.createUI();
  }

  /**
   * Set callback for when object creature link changes
   * @param {Function} callback - Function(object, linkData) called when link changes
   */
  setOnLinkChange(callback) {
    this.onLinkChange = callback;
  }

  createUI() {
    this.panel = document.createElement('div');
    this.panel.className = 'creature-panel draggable-panel';
    this.panel.innerHTML = `
      <div class="creature-panel-header panel-header-draggable">
        <span class="creature-panel-title">Creature</span>
        <div class="panel-header-actions">
          <button class="panel-lock-btn" title="Lock to sync with other players">
            <span class="lock-icon">&#128275;</span>
          </button>
          <button class="creature-panel-close">&times;</button>
        </div>
      </div>
      <div class="creature-panel-content">
        <div class="creature-panel-placeholder">
          Click a miniature to view creature stats
        </div>
      </div>
    `;

    this.container.appendChild(this.panel);
    this.setupEventListeners();
    this.setupDragging();
    this.hide();
  }

  setupEventListeners() {
    const closeBtn = this.panel.querySelector('.creature-panel-close');
    closeBtn.addEventListener('click', () => this.hide());

    // Lock button
    const lockBtn = this.panel.querySelector('.panel-lock-btn');
    lockBtn.addEventListener('click', () => this.toggleLock());

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });
  }

  /**
   * Setup dragging functionality
   */
  setupDragging() {
    const header = this.panel.querySelector('.creature-panel-header');

    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on buttons
      if (e.target.closest('button')) return;

      this.isDragging = true;
      const rect = this.panel.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      this.panel.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;

      // Keep panel within viewport
      const maxX = window.innerWidth - this.panel.offsetWidth;
      const maxY = window.innerHeight - this.panel.offsetHeight;

      this.panel.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      this.panel.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
      this.panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.panel.classList.remove('dragging');
      }
    });

    // Touch support for mobile
    header.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;

      this.isDragging = true;
      const touch = e.touches[0];
      const rect = this.panel.getBoundingClientRect();
      this.dragOffset = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
      this.panel.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;

      const touch = e.touches[0];
      const x = touch.clientX - this.dragOffset.x;
      const y = touch.clientY - this.dragOffset.y;

      const maxX = window.innerWidth - this.panel.offsetWidth;
      const maxY = window.innerHeight - this.panel.offsetHeight;

      this.panel.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      this.panel.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
      this.panel.style.right = 'auto';
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.panel.classList.remove('dragging');
      }
    });
  }

  /**
   * Toggle lock state for multiplayer sync
   */
  toggleLock() {
    this.isLocked = !this.isLocked;
    const lockBtn = this.panel.querySelector('.panel-lock-btn');
    const lockIcon = lockBtn.querySelector('.lock-icon');

    if (this.isLocked) {
      lockBtn.classList.add('locked');
      lockIcon.innerHTML = '&#128274;'; // Locked icon
      lockBtn.title = 'Unlock (stop syncing with other players)';
    } else {
      lockBtn.classList.remove('locked');
      lockIcon.innerHTML = '&#128275;'; // Unlocked icon
      lockBtn.title = 'Lock to sync with other players';
    }

    // Notify callback
    if (this.onLockToggle) {
      this.onLockToggle(this.isLocked, this.getPanelState());
    }
  }

  /**
   * Set lock state programmatically (for receiving sync from other players)
   * @param {boolean} locked - Lock state
   */
  setLocked(locked) {
    if (this.isLocked !== locked) {
      this.toggleLock();
    }
  }

  /**
   * Get current panel state for syncing
   * @returns {Object} Panel state
   */
  getPanelState() {
    const linkedData = this.currentObject?.userData?.linkedCreature;
    return {
      type: 'creature',
      creatureId: linkedData?.id || null,
      isVisible: this.isVisible()
    };
  }

  /**
   * Set panel state from sync data
   * @param {Object} state - Panel state from sync
   */
  setPanelState(state) {
    if (state.creatureId) {
      const creature = this.dataManager.getCreature(state.creatureId);
      if (creature) {
        this.renderCreature(creature);
        if (state.isVisible) {
          this.show();
        }
      }
    }
  }

  /**
   * Set callback for lock toggle
   * @param {Function} callback - Function(isLocked, panelState) called when lock is toggled
   */
  setOnLockToggle(callback) {
    this.onLockToggle = callback;
  }

  /**
   * Show the panel for a clicked object
   * @param {THREE.Object3D} object - The clicked object (miniature)
   */
  showForObject(object) {
    this.currentObject = object;
    const linkedData = object?.userData?.linkedCreature;

    if (linkedData) {
      const creature = this.dataManager.getCreature(linkedData.id);
      if (creature) {
        this.renderCreature(creature);
      } else {
        this.showNotFoundState(linkedData.id);
      }
    } else {
      this.showUnlinkedState();
    }

    this.show();
  }

  /**
   * Render creature stat block
   * @param {Object} creature - Creature object to display
   */
  renderCreature(creature) {
    const content = this.panel.querySelector('.creature-panel-content');

    content.innerHTML = `
      <div class="stat-block">
        <div class="creature-name">${creature.name}</div>
        <div class="creature-type">${creature.size} ${creature.type}, ${creature.alignment}</div>

        <div class="stat-block-divider"></div>

        <div class="stat-line"><strong>AC</strong> ${creature.ac.value}${creature.ac.type ? ` (${creature.ac.type})` : ''}</div>
        <div class="stat-line"><strong>HP</strong> ${creature.hp.average} ${this.parser.renderDiceFormula(creature.hp.formula)}</div>
        <div class="stat-line"><strong>Speed</strong> ${this.formatSpeed(creature.speed)}</div>

        <div class="stat-block-divider"></div>

        <div class="ability-scores">
          ${this.renderAbilityScores(creature.stats)}
        </div>

        <div class="stat-block-divider"></div>

        ${this.renderImmunities(creature)}
        ${this.renderVulnerabilities(creature)}
        ${creature.skills ? `<div class="stat-line"><strong>Skills</strong> ${creature.skills.join(', ')}</div>` : ''}
        ${creature.senses ? `<div class="stat-line"><strong>Senses</strong> ${creature.senses.join(', ')}</div>` : ''}
        ${creature.languages ? `<div class="stat-line"><strong>Languages</strong> ${Array.isArray(creature.languages) ? creature.languages.join(', ') : creature.languages}</div>` : ''}
        <div class="stat-line"><strong>CR</strong> ${creature.cr}</div>

        ${creature.traits && creature.traits.length > 0 ? `
          <div class="stat-block-divider"></div>
          ${this.renderTraits(creature.traits)}
        ` : ''}

        ${creature.actions && creature.actions.length > 0 ? `
          <div class="stat-block-divider"></div>
          <div class="actions-header">Actions</div>
          ${this.renderActions(creature.actions)}
        ` : ''}

        ${creature.reactions && creature.reactions.length > 0 ? `
          <div class="stat-block-divider"></div>
          <div class="actions-header">Reactions</div>
          ${this.renderActions(creature.reactions)}
        ` : ''}

        ${creature.legendaryActions && creature.legendaryActions.length > 0 ? `
          <div class="stat-block-divider"></div>
          <div class="actions-header">Legendary Actions</div>
          ${this.renderActions(creature.legendaryActions)}
        ` : ''}
      </div>

      ${this.renderLinkSelector()}
    `;

    this.parser.setupClickHandlers(content);
    this.setupLinkSelectorEvents();
    this.updateTitle(creature.name);
  }

  /**
   * Format speed object to string
   * @param {Object|number} speed - Speed object or number
   * @returns {string} Formatted speed string
   */
  formatSpeed(speed) {
    if (typeof speed === 'number') {
      return `${speed} ft.`;
    }
    if (typeof speed === 'object') {
      const parts = [];
      if (speed.walk) parts.push(`${speed.walk} ft.`);
      if (speed.fly) parts.push(`fly ${speed.fly} ft.${speed.hover ? ' (hover)' : ''}`);
      if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
      if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
      if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
      return parts.join(', ');
    }
    return String(speed);
  }

  /**
   * Render ability scores table
   * @param {Object} stats - Stats object with str, dex, con, int, wis, cha
   * @returns {string} HTML string
   */
  renderAbilityScores(stats) {
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    return `
      <table class="ability-table">
        <tr>
          ${abilities.map(a => `<th>${a.toUpperCase()}</th>`).join('')}
        </tr>
        <tr>
          ${abilities.map(a => {
            const score = stats[a] || 10;
            const mod = Math.floor((score - 10) / 2);
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            return `<td>${score} (<span class="ability-mod" data-dice="d20${mod >= 0 ? '+' : ''}${mod}" data-type="check">${modStr}</span>)</td>`;
          }).join('')}
        </tr>
      </table>
    `;
  }

  /**
   * Render immunities (damage and condition)
   * @param {Object} creature - Creature object
   * @returns {string} HTML string
   */
  renderImmunities(creature) {
    const parts = [];

    if (creature.immunities) {
      if (creature.immunities.damage && creature.immunities.damage.length > 0) {
        parts.push(`<div class="stat-line"><strong>Damage Immunities</strong> ${creature.immunities.damage.join(', ')}</div>`);
      }
      if (creature.immunities.condition && creature.immunities.condition.length > 0) {
        parts.push(`<div class="stat-line"><strong>Condition Immunities</strong> ${creature.immunities.condition.join(', ')}</div>`);
      }
    }

    return parts.join('');
  }

  /**
   * Render damage vulnerabilities
   * @param {Object} creature - Creature object
   * @returns {string} HTML string
   */
  renderVulnerabilities(creature) {
    if (creature.vulnerabilities && creature.vulnerabilities.length > 0) {
      return `<div class="stat-line"><strong>Damage Vulnerabilities</strong> ${creature.vulnerabilities.join(', ')}</div>`;
    }
    return '';
  }

  /**
   * Render traits section
   * @param {Array} traits - Array of trait objects
   * @returns {string} HTML string
   */
  renderTraits(traits) {
    if (!traits || traits.length === 0) return '';

    return traits.map(trait => `
      <div class="trait">
        <strong class="trait-name">${trait.name}.</strong>
        <span class="trait-desc">${this.parser.parse(trait.desc)}</span>
      </div>
    `).join('');
  }

  /**
   * Render actions section
   * @param {Array} actions - Array of action objects
   * @returns {string} HTML string
   */
  renderActions(actions) {
    if (!actions || actions.length === 0) return '';

    return actions.map(action => `
      <div class="action">
        <strong class="action-name">${action.name}.</strong>
        <span class="action-desc">${this.parser.parse(action.desc)}</span>
      </div>
    `).join('');
  }

  /**
   * Render the creature link selector dropdown
   * @returns {string} HTML for the link selector
   */
  renderLinkSelector() {
    const creatures = this.dataManager.getAllCreatures();
    const currentLink = this.currentObject?.userData?.linkedCreature;
    const currentValue = currentLink ? currentLink.id : '';

    return `
      <div class="link-selector">
        <label class="link-selector-label">Link to creature:</label>
        <select class="link-selector-dropdown">
          <option value="" ${!currentValue ? 'selected' : ''}>-- None --</option>
          ${creatures.map(creature => `
            <option value="${creature.id}" ${currentValue === creature.id ? 'selected' : ''}>
              ${creature.name} (CR ${creature.cr})
            </option>
          `).join('')}
        </select>
      </div>
    `;
  }

  /**
   * Setup event listeners for the link selector
   */
  setupLinkSelectorEvents() {
    const selector = this.panel.querySelector('.link-selector-dropdown');
    if (selector) {
      selector.addEventListener('change', (e) => this.handleLinkChange(e.target.value));
    }
  }

  /**
   * Handle link selection change
   * @param {string} value - Selected creature ID or empty string
   */
  handleLinkChange(value) {
    if (!this.currentObject) return;

    const linkData = value ? { id: value } : null;

    // Update the object's linked creature data
    this.currentObject.userData.linkedCreature = linkData;

    // Notify callback for multiplayer sync
    if (this.onLinkChange) {
      this.onLinkChange(this.currentObject, linkData);
    }

    // Re-render the panel with new link
    this.showForObject(this.currentObject);
  }

  /**
   * Show state when object is not linked to any creature
   */
  showUnlinkedState() {
    const content = this.panel.querySelector('.creature-panel-content');
    content.innerHTML = `
      <div class="creature-panel-placeholder">
        <p>This miniature is not linked to any creature.</p>
        <p class="placeholder-hint">Select a creature below to link it.</p>
      </div>
      ${this.renderLinkSelector()}
    `;
    this.setupLinkSelectorEvents();
    this.updateTitle('Unlinked Miniature');
  }

  /**
   * Show state when linked creature is not found
   * @param {string} id - The creature ID that wasn't found
   */
  showNotFoundState(id) {
    const content = this.panel.querySelector('.creature-panel-content');
    content.innerHTML = `
      <div class="creature-panel-error">
        <p>Creature not found: <code>${id}</code></p>
        <p class="error-hint">The linked creature may have been removed.</p>
      </div>
      ${this.renderLinkSelector()}
    `;
    this.setupLinkSelectorEvents();
    this.updateTitle('Not Found');
  }

  /**
   * Update the panel title
   * @param {string} title - New title
   */
  updateTitle(title) {
    const titleEl = this.panel.querySelector('.creature-panel-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  show() {
    this.panel.style.display = 'block';
    this.panel.classList.add('panel-visible');
  }

  hide() {
    this.panel.classList.remove('panel-visible');
    this.panel.style.display = 'none';
    this.currentObject = null;
  }

  isVisible() {
    return this.panel.style.display !== 'none';
  }

  toggle() {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }
}
