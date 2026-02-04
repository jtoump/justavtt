/**
 * InventoryManager handles per-user inventory with localStorage persistence.
 * Each user has their own private inventory that persists across sessions.
 */
export class InventoryManager {
  constructor() {
    this.userId = this.getOrCreateUserId();
    this.inventory = this.loadInventory();
    this.onChangeCallbacks = [];
  }

  /**
   * Get or create a unique user ID
   * @returns {string} User ID
   */
  getOrCreateUserId() {
    const storageKey = 'vtt_user_id';
    let userId = localStorage.getItem(storageKey);

    if (!userId) {
      userId = this.generateUUID();
      localStorage.setItem(storageKey, userId);
      console.log('[InventoryManager] Created new user ID:', userId);
    }

    return userId;
  }

  /**
   * Generate a UUID v4
   * @returns {string} UUID string
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get the localStorage key for this user's inventory
   * @returns {string} Storage key
   */
  getStorageKey() {
    return `vtt_inventory_${this.userId}`;
  }

  /**
   * Load inventory from localStorage
   * @returns {Object} Inventory data
   */
  loadInventory() {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        const data = JSON.parse(stored);
        console.log('[InventoryManager] Loaded inventory:', data.items?.length || 0, 'items');
        return data;
      }
    } catch (error) {
      console.error('[InventoryManager] Failed to load inventory:', error);
    }

    // Default empty inventory
    return {
      version: 1,
      items: []
    };
  }

  /**
   * Save inventory to localStorage
   */
  saveInventory() {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.inventory));
      this.notifyChange();
    } catch (error) {
      console.error('[InventoryManager] Failed to save inventory:', error);
    }
  }

  /**
   * Add an item to the inventory
   * @param {Object} item - Item object with id, name, type, rarity, etc.
   * @param {string} source - Source of the item: 'drawn', 'linked', 'manual'
   * @returns {Object} The added inventory entry
   */
  addItem(item, source = 'manual') {
    const entry = {
      id: this.generateUUID(),
      itemId: item.id,
      name: item.name,
      type: item.type || 'item',
      rarity: item.rarity || 'common',
      description: item.description || '',
      source: source,
      addedAt: Date.now()
    };

    this.inventory.items.push(entry);
    this.saveInventory();
    console.log('[InventoryManager] Added item:', entry.name);
    return entry;
  }

  /**
   * Remove an item from the inventory by instance ID
   * @param {string} instanceId - The unique instance ID of the item
   * @returns {boolean} True if removed, false if not found
   */
  removeItem(instanceId) {
    const index = this.inventory.items.findIndex(item => item.id === instanceId);
    if (index > -1) {
      const removed = this.inventory.items.splice(index, 1)[0];
      this.saveInventory();
      console.log('[InventoryManager] Removed item:', removed.name);
      return true;
    }
    return false;
  }

  /**
   * Get all items in the inventory
   * @returns {Array} Array of inventory items
   */
  getItems() {
    return [...this.inventory.items];
  }

  /**
   * Get the count of items in the inventory
   * @returns {number} Item count
   */
  getItemCount() {
    return this.inventory.items.length;
  }

  /**
   * Clear all items from the inventory
   */
  clearInventory() {
    this.inventory.items = [];
    this.saveInventory();
    console.log('[InventoryManager] Cleared inventory');
  }

  /**
   * Check if an item is already in the inventory
   * @param {string} itemId - The item ID to check
   * @returns {boolean} True if item exists in inventory
   */
  hasItem(itemId) {
    return this.inventory.items.some(item => item.itemId === itemId);
  }

  /**
   * Get items by source
   * @param {string} source - Source type: 'drawn', 'linked', 'manual'
   * @returns {Array} Filtered items
   */
  getItemsBySource(source) {
    return this.inventory.items.filter(item => item.source === source);
  }

  /**
   * Register a callback for when inventory changes
   * @param {Function} callback - Function to call on change
   */
  onChange(callback) {
    if (callback) {
      this.onChangeCallbacks.push(callback);
    }
  }

  /**
   * Remove a change callback
   * @param {Function} callback - Callback to remove
   */
  offChange(callback) {
    const index = this.onChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.onChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all change callbacks
   */
  notifyChange() {
    for (const callback of this.onChangeCallbacks) {
      try {
        callback(this.inventory.items);
      } catch (error) {
        console.error('[InventoryManager] Change callback error:', error);
      }
    }
  }

  /**
   * Get the current user ID
   * @returns {string} User ID
   */
  getUserId() {
    return this.userId;
  }
}
