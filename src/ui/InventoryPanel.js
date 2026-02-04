/**
 * InventoryPanel displays the user's collected items in a bottom drawer.
 */
export class InventoryPanel {
  constructor(container, inventoryManager) {
    this.container = container;
    this.inventoryManager = inventoryManager;
    this.isOpen = false;

    this.createUI();
    this.setupInventoryListener();
  }

  createUI() {
    this.panel = document.createElement('div');
    this.panel.className = 'inventory-panel';
    this.panel.innerHTML = `
      <div class="inventory-handle">
        <div class="inventory-handle-bar"></div>
      </div>
      <div class="inventory-header">
        <span class="inventory-title">My Inventory</span>
        <span class="inventory-count">(0 items)</span>
        <button class="inventory-close">&times;</button>
      </div>
      <div class="inventory-content">
        <div class="inventory-items"></div>
      </div>
    `;

    this.container.appendChild(this.panel);
    this.setupEventListeners();
    this.renderItems();
  }

  setupEventListeners() {
    // Close button
    const closeBtn = this.panel.querySelector('.inventory-close');
    closeBtn.addEventListener('click', () => this.hide());

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.hide();
      }
    });

    // Handle click (can be used for drag-to-resize in future)
    const handle = this.panel.querySelector('.inventory-handle');
    handle.addEventListener('click', () => this.toggle());
  }

  setupInventoryListener() {
    this.inventoryManager.onChange(() => {
      this.renderItems();
    });
  }

  /**
   * Render all inventory items
   */
  renderItems() {
    const itemsContainer = this.panel.querySelector('.inventory-items');
    const items = this.inventoryManager.getItems();
    const countDisplay = this.panel.querySelector('.inventory-count');

    countDisplay.textContent = `(${items.length} item${items.length !== 1 ? 's' : ''})`;

    if (items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="inventory-empty">
          <p>No items collected yet</p>
          <p class="inventory-empty-hint">Draw from decks or add items to your stash</p>
        </div>
      `;
      return;
    }

    // Sort by most recently added
    const sortedItems = [...items].sort((a, b) => b.addedAt - a.addedAt);

    itemsContainer.innerHTML = sortedItems.map(item => this.renderItem(item)).join('');

    // Setup item click handlers for expanding
    const itemElements = itemsContainer.querySelectorAll('.inventory-item');
    itemElements.forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't toggle if clicking the remove button
        if (e.target.closest('.inventory-item-remove')) return;
        this.toggleItemExpand(el);
      });
    });

    // Setup remove buttons
    const removeBtns = itemsContainer.querySelectorAll('.inventory-item-remove');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const instanceId = btn.dataset.id;
        this.removeItem(instanceId);
      });
    });
  }

  /**
   * Toggle item expanded state
   * @param {HTMLElement} itemElement - The item element to toggle
   */
  toggleItemExpand(itemElement) {
    const isExpanded = itemElement.classList.contains('expanded');

    // Collapse all other items first
    const allItems = this.panel.querySelectorAll('.inventory-item.expanded');
    allItems.forEach(el => el.classList.remove('expanded'));

    // Toggle the clicked item
    if (!isExpanded) {
      itemElement.classList.add('expanded');
    }
  }

  /**
   * Render a single inventory item
   * @param {Object} item - Inventory item entry
   * @returns {string} HTML string
   */
  renderItem(item) {
    const rarityClass = `rarity-${item.rarity || 'common'}`;
    const sourceLabel = this.getSourceLabel(item.source);
    const addedDate = new Date(item.addedAt).toLocaleDateString();

    return `
      <div class="inventory-item" data-id="${item.id}">
        <div class="inventory-item-header">
          <div class="inventory-item-info">
            <div class="inventory-item-name ${rarityClass}">${item.name}</div>
            <div class="inventory-item-meta">
              <span class="inventory-item-type">${item.type}</span>
              <span class="inventory-item-source">${sourceLabel}</span>
            </div>
          </div>
          <div class="inventory-item-actions">
            <span class="inventory-item-expand-icon">▼</span>
            <button class="inventory-item-remove" data-id="${item.id}" title="Remove from inventory">
              &times;
            </button>
          </div>
        </div>
        <div class="inventory-item-details">
          <div class="inventory-item-rarity">
            <span class="detail-label">Rarity:</span>
            <span class="${rarityClass}">${item.rarity || 'common'}</span>
          </div>
          ${item.description ? `
            <div class="inventory-item-description">${item.description}</div>
          ` : ''}
          <div class="inventory-item-added">
            <span class="detail-label">Added:</span>
            <span>${addedDate}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get human-readable source label
   * @param {string} source - Source type
   * @returns {string} Label
   */
  getSourceLabel(source) {
    switch (source) {
      case 'drawn': return 'Drawn';
      case 'linked': return 'Collected';
      case 'manual': return 'Added';
      default: return source;
    }
  }

  /**
   * Remove an item with optional confirmation
   * @param {string} instanceId - Item instance ID
   */
  removeItem(instanceId) {
    // Find the item for the confirmation message
    const items = this.inventoryManager.getItems();
    const item = items.find(i => i.id === instanceId);

    if (item) {
      // Direct removal without confirmation for better UX
      this.inventoryManager.removeItem(instanceId);
    }
  }

  /**
   * Update the badge count on the toolbar button
   * @param {HTMLElement} button - The toolbar button element
   */
  updateButtonBadge(button) {
    if (!button) return;

    const count = this.inventoryManager.getItemCount();
    let badge = button.querySelector('.inventory-badge');

    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'inventory-badge';
        button.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-block';
    } else if (badge) {
      badge.style.display = 'none';
    }
  }

  show() {
    this.panel.classList.add('drawer-open');
    this.isOpen = true;
    this.renderItems(); // Refresh when opening
  }

  hide() {
    this.panel.classList.remove('drawer-open');
    this.isOpen = false;
  }

  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible() {
    return this.isOpen;
  }
}
