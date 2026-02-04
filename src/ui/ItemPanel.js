/**
 * ItemPanel displays item information or allows drawing from decks.
 * Shows when clicking on a linked template.
 * Supports dragging and lock-to-sync across multiplayer sessions.
 */
export class ItemPanel {
  constructor(container, dataManager) {
    this.container = container;
    this.dataManager = dataManager;
    this.currentTemplate = null;
    this.lastDrawnItem = null;

    // Dragging state
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };

    // Lock state for multiplayer sync
    this.isLocked = false;

    // Callback for when the link changes (for multiplayer sync)
    this.onLinkChange = null;

    // Callback for when an item is added to stash
    this.onAddToStash = null;

    // Callback for lock toggle
    this.onLockToggle = null;

    this.createUI();
  }

  /**
   * Set callback for when template link changes
   * @param {Function} callback - Function(template, linkData) called when link changes
   */
  setOnLinkChange(callback) {
    this.onLinkChange = callback;
  }

  /**
   * Set callback for when an item is added to stash
   * @param {Function} callback - Function(item, source) called when item is added
   */
  setOnAddToStash(callback) {
    this.onAddToStash = callback;
  }

  createUI() {
    this.panel = document.createElement('div');
    this.panel.className = 'item-panel draggable-panel';
    this.panel.innerHTML = `
      <div class="item-panel-header panel-header-draggable">
        <span class="item-panel-title">Item Details</span>
        <div class="panel-header-actions">
          <button class="panel-lock-btn" title="Lock to sync with other players">
            <span class="lock-icon">&#128275;</span>
          </button>
          <button class="item-panel-close">&times;</button>
        </div>
      </div>
      <div class="item-panel-content">
        <div class="item-panel-placeholder">
          Click a linked template to view item or deck
        </div>
      </div>
    `;

    this.container.appendChild(this.panel);
    this.setupEventListeners();
    this.setupDragging();
    this.hide();
  }

  setupEventListeners() {
    const closeBtn = this.panel.querySelector('.item-panel-close');
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
    const header = this.panel.querySelector('.item-panel-header');

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
      this.panel.style.transform = 'none';
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
      this.panel.style.transform = 'none';
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
    const linkedData = this.currentTemplate?.userData?.linkedData;
    return {
      type: 'item',
      linkType: linkedData?.type || null,
      linkId: linkedData?.id || null,
      isVisible: this.isVisible()
    };
  }

  /**
   * Set panel state from sync data
   * @param {Object} state - Panel state from sync
   */
  setPanelState(state) {
    if (state.linkType && state.linkId) {
      if (state.linkType === 'item') {
        const item = this.dataManager.getItem(state.linkId);
        if (item) {
          this.renderItem(item);
          if (state.isVisible) this.show();
        }
      } else if (state.linkType === 'deck') {
        const deck = this.dataManager.getDeck(state.linkId);
        if (deck) {
          this.renderDeck(deck);
          if (state.isVisible) this.show();
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
   * Show the panel for a clicked template
   * @param {THREE.Object3D} template - The clicked template
   */
  showForTemplate(template) {
    this.currentTemplate = template;
    const linkedData = template?.userData?.linkedData;

    if (!linkedData) {
      this.showUnlinkedState();
      this.show();
      return;
    }

    if (linkedData.type === 'item') {
      const item = this.dataManager.getItem(linkedData.id);
      if (item) {
        this.renderItem(item);
      } else {
        this.showNotFoundState('item', linkedData.id);
      }
    } else if (linkedData.type === 'deck') {
      const deck = this.dataManager.getDeck(linkedData.id);
      if (deck) {
        this.renderDeck(deck);
      } else {
        this.showNotFoundState('deck', linkedData.id);
      }
    }

    this.show();
  }

  /**
   * Render item details
   * @param {Object} item - Item object to display
   */
  renderItem(item) {
    const content = this.panel.querySelector('.item-panel-content');
    const rarityClass = `rarity-${item.rarity || 'common'}`;

    let propertiesHtml = '';
    if (item.properties) {
      propertiesHtml = `
        <div class="item-properties">
          ${Object.entries(item.properties).map(([key, value]) => `
            <div class="item-property">
              <span class="property-key">${this.formatKey(key)}:</span>
              <span class="property-value">${value}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    let tagsHtml = '';
    if (item.tags && item.tags.length > 0) {
      tagsHtml = `
        <div class="item-tags">
          ${item.tags.map(tag => `<span class="item-tag">${tag}</span>`).join('')}
        </div>
      `;
    }

    content.innerHTML = `
      <div class="item-display">
        <div class="item-name ${rarityClass}">${item.name}</div>
        <div class="item-type-line">
          <span class="item-type">${item.type || 'Item'}</span>
          <span class="item-rarity ${rarityClass}">${item.rarity || 'common'}</span>
        </div>
        <div class="item-description">${item.description || ''}</div>
        ${propertiesHtml}
        ${tagsHtml}
        <button class="add-to-stash-btn" data-item-id="${item.id}">Add to Stash</button>
      </div>
      ${this.renderLinkSelector()}
    `;

    this.setupLinkSelectorEvents();
    this.setupAddToStashButton(item, 'linked');
    this.updateTitle(item.name);
  }

  /**
   * Render deck details with draw functionality
   * @param {Object} deck - Deck object to display
   */
  renderDeck(deck) {
    const content = this.panel.querySelector('.item-panel-content');
    const state = this.dataManager.getDeckState(deck.id);

    content.innerHTML = `
      <div class="deck-display">
        <div class="deck-name">${deck.name}</div>
        <div class="deck-description">${deck.description || ''}</div>
        <div class="deck-info">
          <span class="deck-mode">${deck.drawMode === 'sequential' ? 'Sequential' : 'Random'}</span>
          <span class="deck-replacement">${deck.replacement ? 'With replacement' : 'Without replacement'}</span>
        </div>
        <div class="deck-status">
          Cards remaining: <strong>${state.remaining}</strong> / ${state.total}
          ${state.exhausted ? '<span class="deck-exhausted">(Exhausted)</span>' : ''}
        </div>
        <div class="deck-actions">
          <button class="deck-draw-btn" ${state.exhausted ? 'disabled' : ''}>Draw Card</button>
          <button class="deck-reset-btn">Reset Deck</button>
        </div>
        <div class="deck-drawn-item"></div>
      </div>
      ${this.renderLinkSelector()}
    `;

    // Set up draw button
    const drawBtn = content.querySelector('.deck-draw-btn');
    drawBtn.addEventListener('click', () => this.drawFromDeck(deck.id));

    // Set up reset button
    const resetBtn = content.querySelector('.deck-reset-btn');
    resetBtn.addEventListener('click', () => this.resetDeck(deck.id));

    this.setupLinkSelectorEvents();
    this.updateTitle(deck.name);
  }

  /**
   * Draw a card from the deck and show result
   * @param {string} deckId - Deck to draw from
   */
  drawFromDeck(deckId) {
    const item = this.dataManager.drawFromDeck(deckId);
    const drawnDiv = this.panel.querySelector('.deck-drawn-item');

    if (item) {
      this.lastDrawnItem = item;
      const rarityClass = `rarity-${item.rarity || 'common'}`;

      drawnDiv.innerHTML = `
        <div class="drawn-card">
          <div class="drawn-label">Drawn:</div>
          <div class="drawn-item-name ${rarityClass}">${item.name}</div>
          <div class="drawn-item-type">${item.type || 'Item'}</div>
          <div class="drawn-item-description">${item.description || ''}</div>
          <button class="add-to-stash-btn drawn-stash-btn" data-item-id="${item.id}">Add to Stash</button>
        </div>
      `;
      drawnDiv.classList.add('draw-animate');
      setTimeout(() => drawnDiv.classList.remove('draw-animate'), 300);

      // Setup stash button for drawn item
      this.setupAddToStashButton(item, 'drawn');

      // Update deck status
      this.updateDeckStatus(deckId);
    } else {
      drawnDiv.innerHTML = `
        <div class="drawn-card empty">
          <div class="drawn-label">Deck is empty!</div>
        </div>
      `;
    }
  }

  /**
   * Reset a deck to its initial state
   * @param {string} deckId - Deck to reset
   */
  resetDeck(deckId) {
    this.dataManager.resetDeck(deckId);
    this.lastDrawnItem = null;

    // Re-render the deck
    const deck = this.dataManager.getDeck(deckId);
    if (deck) {
      this.renderDeck(deck);
    }
  }

  /**
   * Update deck status display after drawing
   * @param {string} deckId - Deck ID
   */
  updateDeckStatus(deckId) {
    const state = this.dataManager.getDeckState(deckId);
    const statusDiv = this.panel.querySelector('.deck-status');
    const drawBtn = this.panel.querySelector('.deck-draw-btn');

    if (statusDiv) {
      statusDiv.innerHTML = `
        Cards remaining: <strong>${state.remaining}</strong> / ${state.total}
        ${state.exhausted ? '<span class="deck-exhausted">(Exhausted)</span>' : ''}
      `;
    }

    if (drawBtn) {
      drawBtn.disabled = state.exhausted;
    }
  }

  /**
   * Show state when template is not linked to any data
   */
  showUnlinkedState() {
    const content = this.panel.querySelector('.item-panel-content');
    content.innerHTML = `
      <div class="item-panel-placeholder">
        <p>This template is not linked to any item or deck.</p>
        <p class="placeholder-hint">Select a deck or item below to link it.</p>
      </div>
      ${this.renderLinkSelector()}
    `;
    this.setupLinkSelectorEvents();
    this.updateTitle('Unlinked Template');
  }

  /**
   * Render the link selector dropdown
   * @returns {string} HTML for the link selector
   */
  renderLinkSelector() {
    const decks = this.dataManager.getAllDecks();
    const items = this.dataManager.getAllItems();
    const currentLink = this.currentTemplate?.userData?.linkedData;

    let currentValue = '';
    if (currentLink) {
      currentValue = `${currentLink.type}:${currentLink.id}`;
    }

    return `
      <div class="link-selector">
        <label class="link-selector-label">Link to:</label>
        <select class="link-selector-dropdown">
          <option value="" ${!currentValue ? 'selected' : ''}>-- None --</option>
          <optgroup label="Decks">
            ${decks.map(deck => `
              <option value="deck:${deck.id}" ${currentValue === `deck:${deck.id}` ? 'selected' : ''}>
                ${deck.name}
              </option>
            `).join('')}
          </optgroup>
          <optgroup label="Items">
            ${items.map(item => `
              <option value="item:${item.id}" ${currentValue === `item:${item.id}` ? 'selected' : ''}>
                ${item.name}
              </option>
            `).join('')}
          </optgroup>
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
   * Setup event listener for add to stash button
   * @param {Object} item - The item to add
   * @param {string} source - Source type: 'linked', 'drawn'
   */
  setupAddToStashButton(item, source) {
    const btn = this.panel.querySelector('.add-to-stash-btn');
    if (btn && this.onAddToStash) {
      // Remove existing listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', () => {
        this.onAddToStash(item, source);
        // Visual feedback
        newBtn.textContent = 'Added!';
        newBtn.disabled = true;
        newBtn.classList.add('stash-added');
        setTimeout(() => {
          newBtn.textContent = 'Add to Stash';
          newBtn.disabled = false;
          newBtn.classList.remove('stash-added');
        }, 1500);
      });
    }
  }

  /**
   * Handle link selection change
   * @param {string} value - Selected value in format "type:id" or empty
   */
  handleLinkChange(value) {
    if (!this.currentTemplate) return;

    let linkData = null;
    if (value) {
      const [type, id] = value.split(':');
      linkData = { type, id };
    }

    // Update the template's linked data
    this.currentTemplate.userData.linkedData = linkData;

    // Notify callback for multiplayer sync
    if (this.onLinkChange) {
      this.onLinkChange(this.currentTemplate, linkData);
    }

    // Re-render the panel with new link
    this.showForTemplate(this.currentTemplate);
  }

  /**
   * Show state when linked data is not found
   * @param {string} type - 'item' or 'deck'
   * @param {string} id - The ID that wasn't found
   */
  showNotFoundState(type, id) {
    const content = this.panel.querySelector('.item-panel-content');
    content.innerHTML = `
      <div class="item-panel-error">
        <p>${type === 'item' ? 'Item' : 'Deck'} not found: <code>${id}</code></p>
        <p class="error-hint">The linked data may have been removed or the ID is incorrect.</p>
      </div>
    `;
    this.updateTitle('Not Found');
  }

  /**
   * Update the panel title
   * @param {string} title - New title
   */
  updateTitle(title) {
    const titleEl = this.panel.querySelector('.item-panel-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Format a property key for display
   * @param {string} key - Key to format
   * @returns {string} Formatted key
   */
  formatKey(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  show() {
    this.panel.style.display = 'block';
    this.panel.classList.add('panel-visible');
  }

  hide() {
    this.panel.classList.remove('panel-visible');
    this.panel.style.display = 'none';
    this.currentTemplate = null;
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
