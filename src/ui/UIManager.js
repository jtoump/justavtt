export class UIManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.actions = {};
    this.config = null;
    this.buttons = new Map();
    this.modeButtons = new Map();
    this.sessionPanel = null;
    this.sessionElements = {};
  }

  async loadConfig(configPath) {
    const response = await fetch(configPath);
    this.config = await response.json();
    return this.config;
  }

  registerAction(actionName, callback) {
    this.actions[actionName] = callback;
  }

  render() {
    if (!this.config) {
      console.warn('UIManager: No config loaded');
      return;
    }

    this.container.innerHTML = '';
    this.buttons.clear();
    this.modeButtons.clear();

    // Create collapsible panel structure
    const panel = document.createElement('div');
    panel.className = 'ui-panel';

    // Panel header with collapse button
    const header = document.createElement('div');
    header.className = 'ui-panel-header';

    const title = document.createElement('span');
    title.className = 'ui-panel-title';
    title.textContent = 'Controls';

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'ui-collapse-btn';
    collapseBtn.textContent = '−';
    collapseBtn.title = 'Collapse/Expand';

    header.appendChild(title);
    header.appendChild(collapseBtn);

    // Panel content (scrollable)
    const content = document.createElement('div');
    content.className = 'ui-panel-content';
    this.panelContent = content;

    // Toggle collapse on header click
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('collapsed');
      collapseBtn.textContent = panel.classList.contains('collapsed') ? '+' : '−';
    });

    panel.appendChild(header);
    panel.appendChild(content);
    this.container.appendChild(panel);

    // Add buttons to content
    if (this.config.buttons) {
      let addedSeparator = false;

      for (const buttonConfig of this.config.buttons) {
        if (!buttonConfig.isMode && !addedSeparator) {
          const separator = document.createElement('div');
          separator.className = 'ui-separator';
          content.appendChild(separator);
          addedSeparator = true;
        }

        const button = this.createButton(buttonConfig);
        content.appendChild(button);
        this.buttons.set(buttonConfig.id, button);

        if (buttonConfig.isMode) {
          this.modeButtons.set(buttonConfig.mode, button);
        }
      }
    }

    // Add controls to content
    if (this.config.controls) {
      const separator = document.createElement('div');
      separator.className = 'ui-separator';
      content.appendChild(separator);

      for (const control of this.config.controls) {
        if (control.type === 'color') {
          const colorControl = this.createColorInput(control);
          content.appendChild(colorControl);
        } else if (control.type === 'select') {
          const selectControl = this.createSelect(control);
          content.appendChild(selectControl);
        } else if (control.type === 'file') {
          const fileControl = this.createFileInput(control);
          content.appendChild(fileControl);
        }
      }
    }
  }

  createButton(config) {
    const button = document.createElement('button');
    button.id = config.id;
    button.className = 'ui-button';
    button.textContent = config.label;

    if (config.isMode) {
      button.dataset.mode = config.mode;
    }

    button.addEventListener('click', () => {
      const action = this.actions[config.action];
      if (action) {
        action();
      } else {
        console.warn(`UIManager: Action "${config.action}" not registered`);
      }
    });

    return button;
  }

  createColorInput(config) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ui-control';

    const label = document.createElement('label');
    label.textContent = config.label;
    label.htmlFor = config.id;

    const input = document.createElement('input');
    input.type = 'color';
    input.id = config.id;
    input.value = config.default || '#ffffff';

    input.addEventListener('input', () => {
      const action = this.actions[config.action];
      if (action) {
        action(input.value);
      }
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return wrapper;
  }

  createSelect(config) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ui-control';

    const label = document.createElement('label');
    label.textContent = config.label;
    label.htmlFor = config.id;

    const select = document.createElement('select');
    select.id = config.id;
    select.className = 'ui-select';

    for (const option of config.options) {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      if (option.value === config.default) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      const action = this.actions[config.action];
      if (action) {
        action(select.value);
      }
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    return wrapper;
  }

  createFileInput(config) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ui-control ui-file-control';

    const label = document.createElement('label');
    label.textContent = config.label;
    label.htmlFor = config.id;

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'ui-file-input-wrapper';

    const input = document.createElement('input');
    input.type = 'file';
    input.id = config.id;
    input.accept = config.accept || 'image/*';
    input.className = 'ui-file-input';

    const browseBtn = document.createElement('button');
    browseBtn.type = 'button';
    browseBtn.className = 'ui-button ui-file-browse';
    browseBtn.textContent = 'Browse...';

    const fileName = document.createElement('span');
    fileName.className = 'ui-file-name';
    fileName.textContent = 'No file selected';

    // Clear button (shown when file is selected)
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'ui-button ui-file-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.style.display = 'none';

    browseBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) {
        fileName.textContent = file.name;
        clearBtn.style.display = 'inline-block';

        // Read file as data URL and pass to action
        const reader = new FileReader();
        reader.onload = (e) => {
          const action = this.actions[config.action];
          if (action) {
            action(e.target.result, file);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      fileName.textContent = 'No file selected';
      clearBtn.style.display = 'none';

      // Call clear action if defined
      const clearAction = this.actions[config.clearAction];
      if (clearAction) {
        clearAction();
      }
    });

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(browseBtn);
    inputWrapper.appendChild(fileName);
    inputWrapper.appendChild(clearBtn);

    wrapper.appendChild(label);
    wrapper.appendChild(inputWrapper);
    return wrapper;
  }

  setActiveMode(mode) {
    for (const [modeName, button] of this.modeButtons) {
      if (modeName === mode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  }

  updateButtonLabel(buttonId, label) {
    const button = this.buttons.get(buttonId);
    if (button) {
      button.textContent = label;
    }
  }

  getSettings() {
    return this.config?.settings || {};
  }

  getModes() {
    return this.config?.modes || {};
  }

  getKeybinds() {
    return this.config?.keybinds || {};
  }

  createSessionPanel() {
    const panel = document.createElement('div');
    panel.className = 'session-panel';
    panel.id = 'session-panel';

    // Status indicator
    const status = document.createElement('div');
    status.className = 'session-status';
    status.id = 'session-status';
    status.innerHTML = '<span class="status-dot offline"></span><span class="status-text">Offline</span>';

    // Session name input
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'session-input-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'session-name-input';
    input.className = 'session-input';
    input.placeholder = 'Session name...';

    inputWrapper.appendChild(input);

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'session-buttons';

    const createBtn = document.createElement('button');
    createBtn.id = 'session-create';
    createBtn.className = 'ui-button session-btn';
    createBtn.textContent = 'Create';
    createBtn.addEventListener('click', () => {
      const action = this.actions['createSession'];
      if (action) action(input.value);
    });

    const joinBtn = document.createElement('button');
    joinBtn.id = 'session-join';
    joinBtn.className = 'ui-button session-btn';
    joinBtn.textContent = 'Join';
    joinBtn.addEventListener('click', () => {
      const action = this.actions['joinSession'];
      if (action) action(input.value);
    });

    const leaveBtn = document.createElement('button');
    leaveBtn.id = 'session-leave';
    leaveBtn.className = 'ui-button session-btn';
    leaveBtn.textContent = 'Leave';
    leaveBtn.style.display = 'none';
    leaveBtn.addEventListener('click', () => {
      const action = this.actions['leaveSession'];
      if (action) action();
    });

    buttonsContainer.appendChild(createBtn);
    buttonsContainer.appendChild(joinBtn);
    buttonsContainer.appendChild(leaveBtn);

    // User count display
    const userCount = document.createElement('div');
    userCount.className = 'session-users';
    userCount.id = 'session-users';
    userCount.style.display = 'none';
    userCount.textContent = '1 user';

    panel.appendChild(status);
    panel.appendChild(inputWrapper);
    panel.appendChild(buttonsContainer);
    panel.appendChild(userCount);

    // Store references
    this.sessionElements = {
      panel,
      status,
      statusDot: status.querySelector('.status-dot'),
      statusText: status.querySelector('.status-text'),
      input,
      createBtn,
      joinBtn,
      leaveBtn,
      userCount
    };

    return panel;
  }

  updateSessionStatus(connected) {
    const { statusDot, statusText } = this.sessionElements;
    if (!statusDot || !statusText) return;

    if (connected) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Connected';
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Offline';
    }
  }

  updateSessionUI(sessionInfo) {
    const { input, createBtn, joinBtn, leaveBtn, userCount, statusText } = this.sessionElements;
    if (!input) return;

    if (sessionInfo) {
      // In a session
      input.value = sessionInfo.name;
      input.disabled = true;
      createBtn.style.display = 'none';
      joinBtn.style.display = 'none';
      leaveBtn.style.display = 'inline-block';
      userCount.style.display = 'block';
      userCount.textContent = `${sessionInfo.userCount} user${sessionInfo.userCount !== 1 ? 's' : ''}`;
      statusText.textContent = `In session: ${sessionInfo.name}`;
    } else {
      // Not in a session
      input.disabled = false;
      createBtn.style.display = 'inline-block';
      joinBtn.style.display = 'inline-block';
      leaveBtn.style.display = 'none';
      userCount.style.display = 'none';
    }
  }

  updateUserCount(count) {
    const { userCount } = this.sessionElements;
    if (userCount) {
      userCount.textContent = `${count} user${count !== 1 ? 's' : ''}`;
    }
  }

  renderSessionPanel() {
    this.sessionPanel = this.createSessionPanel();

    // Use panel content if available, otherwise fall back to container
    const target = this.panelContent || this.container;

    // Add separator before session panel
    const separator = document.createElement('div');
    separator.className = 'ui-separator';
    target.appendChild(separator);

    // Add label
    const label = document.createElement('div');
    label.className = 'ui-section-label';
    label.textContent = 'Multiplayer';
    target.appendChild(label);

    target.appendChild(this.sessionPanel);
  }
}
