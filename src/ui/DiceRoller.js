/**
 * DiceRoller provides a comprehensive dice rolling system for wargaming.
 * Supports multiple dice types, modifiers, and common wargaming mechanics.
 */
export class DiceRoller {
  constructor(container) {
    this.container = container;
    this.history = [];
    this.maxHistory = 20;

    this.onRoll = null; // Callback for when dice are rolled (for multiplayer sync)

    this.createUI();
  }

  createUI() {
    this.panel = document.createElement('div');
    this.panel.className = 'dice-roller-panel';
    this.panel.innerHTML = `
      <div class="dice-roller-header">
        <span class="dice-icon">🎲</span>
        <span>Dice Roller</span>
        <button class="dice-collapse-btn">−</button>
      </div>
      <div class="dice-roller-content">
        <div class="dice-quick-buttons">
          <button class="dice-btn" data-dice="1d6">1d6</button>
          <button class="dice-btn" data-dice="2d6">2d6</button>
          <button class="dice-btn" data-dice="3d6">3d6</button>
          <button class="dice-btn" data-dice="d20">d20</button>
          <button class="dice-btn" data-dice="d10">d10</button>
          <button class="dice-btn" data-dice="d3">d3</button>
        </div>
        <div class="dice-custom-roll">
          <input type="number" class="dice-count" value="1" min="1" max="50">
          <span>d</span>
          <select class="dice-type">
            <option value="3">3</option>
            <option value="6" selected>6</option>
            <option value="8">8</option>
            <option value="10">10</option>
            <option value="12">12</option>
            <option value="20">20</option>
            <option value="100">100</option>
          </select>
          <button class="dice-roll-btn">Roll</button>
        </div>
        <div class="dice-modifiers">
          <label><input type="checkbox" class="dice-reroll-ones"> Re-roll 1s</label>
          <label><input type="checkbox" class="dice-reroll-fails"> Re-roll fails</label>
          <input type="number" class="dice-target" placeholder="Target" min="1" max="20">
        </div>
        <div class="dice-result"></div>
        <div class="dice-history"></div>
      </div>
    `;

    this.container.appendChild(this.panel);
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Collapse/expand
    const collapseBtn = this.panel.querySelector('.dice-collapse-btn');
    const content = this.panel.querySelector('.dice-roller-content');

    collapseBtn.addEventListener('click', () => {
      content.classList.toggle('collapsed');
      collapseBtn.textContent = content.classList.contains('collapsed') ? '+' : '−';
    });

    // Quick roll buttons
    const quickBtns = this.panel.querySelectorAll('.dice-btn');
    quickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const dice = btn.dataset.dice;
        this.rollFromString(dice);
      });
    });

    // Custom roll
    const rollBtn = this.panel.querySelector('.dice-roll-btn');
    rollBtn.addEventListener('click', () => this.rollCustom());

    // Enter key on inputs
    const inputs = this.panel.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.rollCustom();
      });
    });
  }

  rollFromString(diceStr) {
    // Parse dice string like "2d6", "d20", "3d6+2"
    const match = diceStr.match(/(\d*)d(\d+)([+-]\d+)?/i);
    if (!match) return null;

    const count = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3]) || 0;

    return this.roll(count, sides, modifier);
  }

  rollCustom() {
    const count = parseInt(this.panel.querySelector('.dice-count').value) || 1;
    const sides = parseInt(this.panel.querySelector('.dice-type').value);
    const target = parseInt(this.panel.querySelector('.dice-target').value) || null;
    const rerollOnes = this.panel.querySelector('.dice-reroll-ones').checked;
    const rerollFails = this.panel.querySelector('.dice-reroll-fails').checked;

    return this.roll(count, sides, 0, { target, rerollOnes, rerollFails });
  }

  roll(count, sides, modifier = 0, options = {}) {
    const { target, rerollOnes, rerollFails } = options;

    let results = [];
    let rerolls = [];

    // Initial roll
    for (let i = 0; i < count; i++) {
      results.push(this.rollDie(sides));
    }

    // Handle re-rolls
    if (rerollOnes) {
      results = results.map((r, i) => {
        if (r === 1) {
          const newRoll = this.rollDie(sides);
          rerolls.push({ index: i, original: r, new: newRoll, reason: 'ones' });
          return newRoll;
        }
        return r;
      });
    }

    if (rerollFails && target) {
      results = results.map((r, i) => {
        if (r < target && !(rerollOnes && rerolls.some(rr => rr.index === i))) {
          const newRoll = this.rollDie(sides);
          rerolls.push({ index: i, original: r, new: newRoll, reason: 'fail' });
          return newRoll;
        }
        return r;
      });
    }

    const total = results.reduce((a, b) => a + b, 0) + modifier;

    // Calculate successes if target set
    let successes = null;
    if (target) {
      successes = results.filter(r => r >= target).length;
    }

    const rollData = {
      count,
      sides,
      modifier,
      results,
      rerolls,
      total,
      target,
      successes,
      timestamp: Date.now()
    };

    this.displayResult(rollData);
    this.addToHistory(rollData);

    // Trigger callback for multiplayer sync
    if (this.onRoll) {
      this.onRoll(rollData);
    }

    return rollData;
  }

  rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  displayResult(rollData) {
    const resultDiv = this.panel.querySelector('.dice-result');

    const diceStr = `${rollData.count}d${rollData.sides}${rollData.modifier > 0 ? '+' + rollData.modifier : rollData.modifier < 0 ? rollData.modifier : ''}`;

    let html = `
      <div class="roll-header">${diceStr}</div>
      <div class="roll-dice">
        ${rollData.results.map((r, i) => {
          const isMax = r === rollData.sides;
          const isMin = r === 1;
          const isSuccess = rollData.target && r >= rollData.target;
          const wasRerolled = rollData.rerolls.some(rr => rr.index === i);

          let classes = 'die';
          if (isMax) classes += ' die-max';
          if (isMin) classes += ' die-min';
          if (rollData.target) classes += isSuccess ? ' die-success' : ' die-fail';

          return `<span class="${classes}" title="${wasRerolled ? 'Re-rolled' : ''}">${r}</span>`;
        }).join('')}
      </div>
      <div class="roll-total">
        Total: <strong>${rollData.total}</strong>
        ${rollData.successes !== null ? `<span class="roll-successes">(${rollData.successes} successes)</span>` : ''}
      </div>
    `;

    if (rollData.rerolls.length > 0) {
      html += `<div class="roll-rerolls">Re-rolled: ${rollData.rerolls.map(r => `${r.original}→${r.new}`).join(', ')}</div>`;
    }

    resultDiv.innerHTML = html;
    resultDiv.classList.add('roll-animate');
    setTimeout(() => resultDiv.classList.remove('roll-animate'), 300);
  }

  addToHistory(rollData) {
    this.history.unshift(rollData);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    this.updateHistoryDisplay();
  }

  updateHistoryDisplay() {
    const historyDiv = this.panel.querySelector('.dice-history');

    historyDiv.innerHTML = this.history.slice(0, 5).map(roll => {
      const diceStr = `${roll.count}d${roll.sides}`;
      const time = new Date(roll.timestamp).toLocaleTimeString();

      return `
        <div class="history-item">
          <span class="history-dice">${diceStr}</span>
          <span class="history-results">[${roll.results.join(', ')}]</span>
          <span class="history-total">= ${roll.total}</span>
          ${roll.successes !== null ? `<span class="history-successes">(${roll.successes})</span>` : ''}
        </div>
      `;
    }).join('');
  }

  // For receiving rolls from other players in multiplayer
  displayRemoteRoll(rollData, playerName) {
    const resultDiv = this.panel.querySelector('.dice-result');
    const diceStr = `${rollData.count}d${rollData.sides}`;

    resultDiv.innerHTML = `
      <div class="roll-header remote-roll">${playerName} rolled ${diceStr}</div>
      <div class="roll-dice">
        ${rollData.results.map(r => `<span class="die">${r}</span>`).join('')}
      </div>
      <div class="roll-total">Total: <strong>${rollData.total}</strong></div>
    `;

    this.addToHistory({ ...rollData, remote: true, playerName });
  }

  show() {
    this.panel.style.display = 'block';
  }

  hide() {
    this.panel.style.display = 'none';
  }

  toggle() {
    if (this.panel.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }
}
