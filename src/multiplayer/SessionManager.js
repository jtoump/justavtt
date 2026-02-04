import { WebSocketSync } from './WebSocketSync.js';

/**
 * SessionManager handles multiplayer session lifecycle and state synchronization.
 * Users can create or join sessions by name to collaborate on the same map.
 */
export class SessionManager {
  constructor(app, serverUrl = 'ws://localhost:8080') {
    this.app = app;
    this.sync = new WebSocketSync(serverUrl);
    this.sessionName = null;
    this.isHost = false;
    this.userCount = 1;
    this.pendingUpdates = [];
    this.updateThrottle = 50; // ms between state broadcasts
    this.lastUpdateTime = 0;
    this.throttleTimer = null;

    // UI callbacks
    this.onSessionChange = null;
    this.onUserCountChange = null;
    this.onConnectionChange = null;
    this.onError = null;

    this.setupSyncCallbacks();
  }

  /**
   * Setup callbacks for the sync provider
   */
  setupSyncCallbacks() {
    this.sync.onStateReceived = (state, fromUser) => {
      this.handleRemoteStateUpdate(state, fromUser);
    };

    this.sync.onUserJoined = (userId, userCount) => {
      this.userCount = userCount;
      if (this.onUserCountChange) {
        this.onUserCountChange(userCount);
      }
      console.log(`User joined. Total users: ${userCount}`);
    };

    this.sync.onUserLeft = (userId, userCount) => {
      this.userCount = userCount;
      if (this.onUserCountChange) {
        this.onUserCountChange(userCount);
      }
      console.log(`User left. Total users: ${userCount}`);
    };

    this.sync.onConnectionChange = (connected) => {
      if (this.onConnectionChange) {
        this.onConnectionChange(connected);
      }
      if (!connected && this.sessionName) {
        console.warn('Connection lost. Attempting to reconnect...');
      }
    };

    this.sync.onError = (error) => {
      if (this.onError) {
        this.onError(error);
      }
    };
  }

  /**
   * Connect to the server
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      await this.sync.connect();
      return true;
    } catch (error) {
      console.error('Failed to connect to server:', error);
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }

  /**
   * Create a new session with the given name
   * @param {string} name - Session name to create
   * @returns {Promise<boolean>} Success status
   */
  async createSession(name) {
    if (!this.sync.isConnected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Could not connect to server');
      }
    }

    try {
      const currentState = this.app.getState();
      await this.sync.createSession(name, currentState);

      this.sessionName = name;
      this.isHost = true;
      this.userCount = 1;

      // Start listening for local state changes
      this.startStateSync();

      if (this.onSessionChange) {
        this.onSessionChange({
          name: this.sessionName,
          isHost: this.isHost,
          userCount: this.userCount
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to create session:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Join an existing session by name
   * @param {string} name - Session name to join
   * @returns {Promise<boolean>} Success status
   */
  async joinSession(name) {
    if (!this.sync.isConnected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Could not connect to server');
      }
    }

    try {
      const state = await this.sync.joinSession(name);

      this.sessionName = name;
      this.isHost = false;

      // Apply the received state
      if (state) {
        this.app.setState(state);
      }

      // Start listening for local state changes
      this.startStateSync();

      if (this.onSessionChange) {
        this.onSessionChange({
          name: this.sessionName,
          isHost: this.isHost,
          userCount: this.userCount
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to join session:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Leave the current session
   */
  leaveSession() {
    if (this.sessionName) {
      this.stopStateSync();
      this.sync.leaveSession();

      this.sessionName = null;
      this.isHost = false;
      this.userCount = 1;

      if (this.onSessionChange) {
        this.onSessionChange(null);
      }
    }
  }

  /**
   * Disconnect from the server entirely
   */
  disconnect() {
    this.leaveSession();
    this.sync.disconnect();
  }

  /**
   * Start synchronizing local state changes to the session
   */
  startStateSync() {
    this.app.onStateChange((state) => {
      this.handleLocalStateChange(state);
    });
  }

  /**
   * Stop synchronizing state changes
   */
  stopStateSync() {
    this.app.onStateChange(null);
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }

  /**
   * Handle local state changes and broadcast to session
   * @param {Object} state - The new state
   */
  handleLocalStateChange(state) {
    if (!this.sessionName) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    if (timeSinceLastUpdate >= this.updateThrottle) {
      // Send immediately
      this.sync.broadcastState(state);
      this.lastUpdateTime = now;
    } else {
      // Throttle - schedule for later
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
      }
      this.throttleTimer = setTimeout(() => {
        const currentState = this.app.getState();
        this.sync.broadcastState(currentState);
        this.lastUpdateTime = Date.now();
      }, this.updateThrottle - timeSinceLastUpdate);
    }
  }

  /**
   * Handle state updates received from other users
   * @param {Object} state - The received state
   * @param {string} fromUser - User who sent the update
   */
  handleRemoteStateUpdate(state, fromUser) {
    console.log('[Session] Applying remote state from:', fromUser, 'objects:', state?.objects?.length || 0);

    // Temporarily disable state change notifications to avoid echo
    const originalCallback = this.app.stateChangeCallback;
    this.app.stateChangeCallback = null;

    // Apply the remote state
    this.app.setState(state);

    // Re-enable state change notifications
    this.app.stateChangeCallback = originalCallback;

    console.log('[Session] Remote state applied successfully');
  }

  /**
   * Get current session info
   * @returns {Object|null} Session info or null if not in session
   */
  getSessionInfo() {
    if (!this.sessionName) return null;

    return {
      name: this.sessionName,
      isHost: this.isHost,
      userCount: this.userCount,
      isConnected: this.sync.isConnected
    };
  }

  /**
   * Check if currently in a session
   * @returns {boolean}
   */
  isInSession() {
    return this.sessionName !== null;
  }

  /**
   * Get the current session name
   * @returns {string|null}
   */
  getSessionName() {
    return this.sessionName;
  }
}
