/**
 * WebSocketSync handles real-time synchronization via WebSocket.
 * This is the communication layer for multiplayer sessions.
 */
export class WebSocketSync {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.sessionId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    // Callbacks
    this.onStateReceived = null;
    this.onUserJoined = null;
    this.onUserLeft = null;
    this.onConnectionChange = null;
    this.onError = null;
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyConnectionChange(true);
          resolve();
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.notifyConnectionChange(false);
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
  }

  /**
   * Attempt to reconnect after disconnection
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (!this.isConnected && this.sessionId) {
        console.log(`Reconnection attempt ${this.reconnectAttempts}...`);
        this.connect().then(() => {
          if (this.sessionId) {
            this.joinSession(this.sessionId);
          }
        }).catch(() => {});
      }
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   * @param {string} data - Raw message data
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'state_update':
          if (this.onStateReceived) {
            this.onStateReceived(message.state, message.from);
          }
          break;

        case 'full_state':
          if (this.onStateReceived) {
            this.onStateReceived(message.state, null);
          }
          break;

        case 'user_joined':
          if (this.onUserJoined) {
            this.onUserJoined(message.userId, message.userCount);
          }
          break;

        case 'user_left':
          if (this.onUserLeft) {
            this.onUserLeft(message.userId, message.userCount);
          }
          break;

        case 'session_created':
          this.sessionId = message.sessionId;
          break;

        case 'session_joined':
          this.sessionId = message.sessionId;
          break;

        case 'error':
          console.error('Server error:', message.error);
          if (this.onError) {
            this.onError(new Error(message.error));
          }
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Send a message to the server
   * @param {Object} message - Message object to send
   */
  send(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Create a new session
   * @param {string} sessionName - Name of the session to create
   * @param {Object} initialState - Initial map state
   * @returns {Promise<string>} Session ID
   */
  createSession(sessionName, initialState) {
    return new Promise((resolve, reject) => {
      const handler = (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'session_created') {
            this.ws.removeEventListener('message', messageHandler);
            this.sessionId = message.sessionId;
            resolve(message.sessionId);
          } else if (message.type === 'error') {
            this.ws.removeEventListener('message', messageHandler);
            reject(new Error(message.error));
          }
        } catch (e) {}
      };

      const messageHandler = (event) => handler(event.data);
      this.ws.addEventListener('message', messageHandler);

      this.send({
        type: 'create_session',
        sessionName,
        state: initialState
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.ws.removeEventListener('message', messageHandler);
        reject(new Error('Session creation timeout'));
      }, 5000);
    });
  }

  /**
   * Join an existing session
   * @param {string} sessionName - Name of the session to join
   * @returns {Promise<Object>} Current session state
   */
  joinSession(sessionName) {
    return new Promise((resolve, reject) => {
      const handler = (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'session_joined') {
            this.ws.removeEventListener('message', messageHandler);
            this.sessionId = message.sessionId;
            resolve(message.state);
          } else if (message.type === 'error') {
            this.ws.removeEventListener('message', messageHandler);
            reject(new Error(message.error));
          }
        } catch (e) {}
      };

      const messageHandler = (event) => handler(event.data);
      this.ws.addEventListener('message', messageHandler);

      this.send({
        type: 'join_session',
        sessionName
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.ws.removeEventListener('message', messageHandler);
        reject(new Error('Session join timeout'));
      }, 5000);
    });
  }

  /**
   * Leave the current session
   */
  leaveSession() {
    if (this.sessionId) {
      this.send({
        type: 'leave_session',
        sessionId: this.sessionId
      });
      this.sessionId = null;
    }
  }

  /**
   * Broadcast state update to all session participants
   * @param {Object} state - The state to broadcast
   */
  broadcastState(state) {
    if (this.sessionId) {
      this.send({
        type: 'state_update',
        sessionId: this.sessionId,
        state
      });
    }
  }

  /**
   * Notify connection state change
   * @param {boolean} connected - Whether connected
   */
  notifyConnectionChange(connected) {
    if (this.onConnectionChange) {
      this.onConnectionChange(connected);
    }
  }

  /**
   * Check if currently in a session
   * @returns {boolean}
   */
  isInSession() {
    return this.sessionId !== null && this.isConnected;
  }

  /**
   * Get current session ID
   * @returns {string|null}
   */
  getSessionId() {
    return this.sessionId;
  }
}
