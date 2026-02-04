/**
 * DataManager handles loading and managing items and decks from JSON data.
 * Provides methods for accessing items and drawing from decks.
 */
export class DataManager {
  constructor() {
    this.items = new Map();
    this.decks = new Map();
    this.creatures = new Map();
    this.deckStates = new Map(); // Track drawn items for non-replacement decks
    this.loaded = false;
  }

  /**
   * Load data from JSON files
   * @param {string} basePath - Base path to data files (default: '/src/data')
   * @returns {Promise<void>}
   */
  async loadData(basePath = '/src/data') {
    try {
      const [itemsResponse, decksResponse, creaturesResponse] = await Promise.all([
        fetch(`${basePath}/items.json`),
        fetch(`${basePath}/decks.json`),
        fetch(`${basePath}/creatures.json`).catch(() => ({ ok: false }))
      ]);

      if (!itemsResponse.ok) {
        throw new Error(`Failed to load items.json: ${itemsResponse.status}`);
      }
      if (!decksResponse.ok) {
        throw new Error(`Failed to load decks.json: ${decksResponse.status}`);
      }

      const itemsData = await itemsResponse.json();
      const decksData = await decksResponse.json();

      // Index items by ID
      for (const item of itemsData.items || []) {
        this.items.set(item.id, item);
      }

      // Index decks by ID and initialize state
      for (const deck of decksData.decks || []) {
        this.decks.set(deck.id, deck);
        this.deckStates.set(deck.id, {
          drawnItems: [],
          sequentialIndex: 0
        });
      }

      // Load creatures (optional - won't fail if missing)
      if (creaturesResponse.ok) {
        const creaturesData = await creaturesResponse.json();
        for (const creature of creaturesData.creatures || []) {
          this.creatures.set(creature.id, creature);
        }
        console.log(`[DataManager] Loaded ${this.creatures.size} creatures`);
      }

      this.loaded = true;
      console.log(`[DataManager] Loaded ${this.items.size} items and ${this.decks.size} decks`);
    } catch (error) {
      console.error('[DataManager] Failed to load data:', error);
      throw error;
    }
  }

  /**
   * Get an item by ID
   * @param {string} id - Item ID
   * @returns {Object|null} Item object or null if not found
   */
  getItem(id) {
    return this.items.get(id) || null;
  }

  /**
   * Get all items
   * @returns {Array} Array of all items
   */
  getAllItems() {
    return Array.from(this.items.values());
  }

  /**
   * Get a deck by ID
   * @param {string} id - Deck ID
   * @returns {Object|null} Deck object or null if not found
   */
  getDeck(id) {
    return this.decks.get(id) || null;
  }

  /**
   * Get all decks
   * @returns {Array} Array of all decks
   */
  getAllDecks() {
    return Array.from(this.decks.values());
  }

  /**
   * Get a creature by ID
   * @param {string} id - Creature ID
   * @returns {Object|null} Creature object or null if not found
   */
  getCreature(id) {
    return this.creatures.get(id) || null;
  }

  /**
   * Get all creatures
   * @returns {Array} Array of all creatures
   */
  getAllCreatures() {
    return Array.from(this.creatures.values());
  }

  /**
   * Draw an item from a deck
   * @param {string} deckId - Deck ID to draw from
   * @returns {Object|null} Drawn item or null if deck is empty/exhausted
   */
  drawFromDeck(deckId) {
    const deck = this.decks.get(deckId);
    if (!deck) {
      console.warn(`[DataManager] Deck not found: ${deckId}`);
      return null;
    }

    const state = this.deckStates.get(deckId);
    const availableItems = this.getAvailableItems(deck, state);

    if (availableItems.length === 0) {
      console.log(`[DataManager] Deck ${deckId} is exhausted`);
      return null;
    }

    let drawnItemId;

    if (deck.drawMode === 'sequential') {
      // Draw in order
      drawnItemId = availableItems[0];
      if (!deck.replacement) {
        state.sequentialIndex++;
      }
    } else {
      // Random draw (with optional weights)
      drawnItemId = this.weightedRandomPick(availableItems, deck, state);
    }

    // Track drawn item for non-replacement decks
    if (!deck.replacement) {
      state.drawnItems.push(drawnItemId);
    }

    const item = this.getItem(drawnItemId);
    console.log(`[DataManager] Drew from ${deckId}:`, item?.name || drawnItemId);
    return item;
  }

  /**
   * Get available (undrawn) items from a deck
   * @param {Object} deck - Deck object
   * @param {Object} state - Deck state
   * @returns {Array} Array of available item IDs
   */
  getAvailableItems(deck, state) {
    if (deck.replacement) {
      return deck.items;
    }

    if (deck.drawMode === 'sequential') {
      return deck.items.slice(state.sequentialIndex);
    }

    // Filter out already drawn items
    return deck.items.filter(id => !state.drawnItems.includes(id));
  }

  /**
   * Perform weighted random selection
   * @param {Array} availableItems - Array of available item IDs
   * @param {Object} deck - Deck object (may have weights)
   * @param {Object} state - Deck state
   * @returns {string} Selected item ID
   */
  weightedRandomPick(availableItems, deck, state) {
    // If no weights or replacement is false (need to recalculate), use equal weights
    if (!deck.weights || !deck.replacement) {
      const randomIndex = Math.floor(Math.random() * availableItems.length);
      return availableItems[randomIndex];
    }

    // Build weights for available items
    const weights = [];
    for (const itemId of availableItems) {
      const originalIndex = deck.items.indexOf(itemId);
      weights.push(deck.weights[originalIndex] || 1);
    }

    // Weighted random selection
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < availableItems.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return availableItems[i];
      }
    }

    // Fallback
    return availableItems[availableItems.length - 1];
  }

  /**
   * Reset a deck to its initial state
   * @param {string} deckId - Deck ID to reset
   */
  resetDeck(deckId) {
    if (this.deckStates.has(deckId)) {
      this.deckStates.set(deckId, {
        drawnItems: [],
        sequentialIndex: 0
      });
      console.log(`[DataManager] Reset deck: ${deckId}`);
    }
  }

  /**
   * Get the current state of a deck
   * @param {string} deckId - Deck ID
   * @returns {Object} Deck state with remaining count
   */
  getDeckState(deckId) {
    const deck = this.decks.get(deckId);
    const state = this.deckStates.get(deckId);

    if (!deck || !state) {
      return null;
    }

    const available = this.getAvailableItems(deck, state);
    return {
      total: deck.items.length,
      remaining: deck.replacement ? deck.items.length : available.length,
      drawn: state.drawnItems.length,
      exhausted: !deck.replacement && available.length === 0
    };
  }

  /**
   * Check if data has been loaded
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }
}
