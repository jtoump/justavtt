/**
 * DiceNotationParser parses {@...} notation in text and renders it as clickable HTML.
 * Supports damage rolls, attack rolls, DCs, conditions, spells, and saves.
 */
export class DiceNotationParser {
  constructor(diceRoller) {
    this.diceRoller = diceRoller;
  }

  /**
   * Parse text and replace {@...} notation with clickable HTML
   * @param {string} text - Text containing dice notation
   * @returns {string} HTML with clickable spans
   */
  parse(text) {
    if (!text) return '';

    // Regex: {@type value}
    return text.replace(/\{@(\w+)\s+([^}]+)\}/g, (match, type, value) => {
      return this.renderNotation(type.toLowerCase(), value.trim());
    });
  }

  /**
   * Render a single notation tag as HTML
   * @param {string} type - Tag type (damage, hit, dc, etc.)
   * @param {string} value - Tag value
   * @returns {string} HTML string
   */
  renderNotation(type, value) {
    switch (type) {
      case 'damage':
        // Normalize dice notation: "2d8 + 4" -> "2d8+4"
        const normalizedDamage = this.normalizeDice(value);
        return `<span class="dice-notation damage" data-dice="${normalizedDamage}" data-type="damage">${value}</span>`;

      case 'hit':
      case 'atk':
        // Attack bonus: +6 to hit -> roll d20+6
        const bonus = parseInt(value) || 0;
        const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
        return `<span class="dice-notation attack" data-dice="d20${bonusStr}" data-type="attack">${bonusStr}</span>`;

      case 'dc':
        // DC display only (no roll)
        return `<span class="dice-notation dc">DC ${value}</span>`;

      case 'save':
        // Save DC: "Con 12" -> "DC 12 Con save"
        const parts = value.split(/\s+/);
        if (parts.length >= 2) {
          const [ability, dc] = parts;
          return `<span class="dice-notation save">DC ${dc} ${ability} save</span>`;
        }
        return `<span class="dice-notation save">${value} save</span>`;

      case 'condition':
        // Condition reference (no roll)
        return `<span class="dice-notation condition">${value}</span>`;

      case 'spell':
        // Spell reference (no roll)
        return `<span class="dice-notation spell">${value}</span>`;

      case 'dice':
        // Generic dice roll
        const normalizedDice = this.normalizeDice(value);
        return `<span class="dice-notation dice" data-dice="${normalizedDice}" data-type="dice">${value}</span>`;

      default:
        return value;
    }
  }

  /**
   * Normalize dice notation by removing spaces around operators
   * @param {string} dice - Dice string like "2d8 + 4"
   * @returns {string} Normalized string like "2d8+4"
   */
  normalizeDice(dice) {
    return dice.replace(/\s*([+-])\s*/g, '$1');
  }

  /**
   * Setup click handlers for all dice notation elements in a container
   * @param {HTMLElement} container - Container with parsed HTML
   */
  setupClickHandlers(container) {
    if (!container) return;

    // Handle all clickable dice notation elements
    container.querySelectorAll('.dice-notation[data-dice]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDiceClick(el);
      });
    });

    // Also handle ability modifier clicks
    container.querySelectorAll('.ability-mod[data-dice]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDiceClick(el);
      });
    });
  }

  /**
   * Handle a click on a dice notation element
   * @param {HTMLElement} el - The clicked element
   */
  handleDiceClick(el) {
    const dice = el.dataset.dice;
    const type = el.dataset.type || 'roll';

    if (!dice || !this.diceRoller) return;

    // Auto-open dice roller panel if not visible
    if (this.diceRoller.panel && this.diceRoller.panel.style.display === 'none') {
      this.diceRoller.show();
    }

    // Perform the roll
    const result = this.diceRoller.rollFromString(dice);

    // Visual feedback
    el.classList.add('rolled');
    setTimeout(() => el.classList.remove('rolled'), 300);

    // Log for debugging
    console.log(`[DiceNotationParser] Rolled ${dice} (${type}):`, result);
  }

  /**
   * Parse and render a dice formula (for HP formulas, etc.)
   * @param {string} formula - Dice formula like "6d10 + 6"
   * @returns {string} HTML with clickable dice
   */
  renderDiceFormula(formula) {
    if (!formula) return '';
    return `<span class="dice-notation dice" data-dice="${this.normalizeDice(formula)}" data-type="hp">${formula}</span>`;
  }
}
