/**
 * Reusable WebSocket handler with automatic retry and exponential backoff
 * Handles common WebSocket patterns for the application
 */
export class WebSocketHandler {
    constructor(options = {}) {
        this.options = {
            maxRetries: 5,
            baseDelay: 1000, // Base delay in milliseconds
            maxDelay: 30000, // Maximum delay in milliseconds
            backoffMultiplier: 2,
            onMessage: null,
            onStatusUpdate: null,
            onError: null,
            onClose: null,
            onOpen: null,
            onMessageComplete: null,
            preserveDataLineBreaks: false, // New option to preserve line breaks in data messages
            ...options
        };
        
        this.websocket = null;
        this.retryCount = 0;
        this.retryTimeout = null;
        this.isClosing = false;
        this.messageHandlers = [];
        this.url = null;
        this.pendingResolve = null;
        this.pendingReject = null;
    }
    
    /**
     * Connect to WebSocket with automatic retry
     * @param {string} url - WebSocket URL
     * @returns {Promise} - Resolves when connected, rejects on failure
     */
    connect(url) {
        this.url = url;
        this.isClosing = false;
        
        return new Promise((resolve, reject) => {
            this.pendingResolve = resolve;
            this.pendingReject = reject;
            this._attemptConnection(resolve, reject);
        });
    }
    
    _attemptConnection(resolve, reject) {
        console.log(`WebSocket connecting to: ${this.url} (attempt ${this.retryCount + 1})`);
        
        try {
            this.websocket = new WebSocket(this.url);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected successfully');
                this.retryCount = 0;
                
                if (this.options.onOpen) {
                    this.options.onOpen();
                }
                
                resolve();
                this.pendingResolve = null;
                this.pendingReject = null;
            };
            
            this.websocket.onmessage = (event) => {
                this._handleMessage(event.data);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                
                if (this.options.onError) {
                    this.options.onError(error);
                }
            };
            
            this.websocket.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                
                if (!this.isClosing && this.retryCount < this.options.maxRetries) {
                    this._scheduleRetry(resolve, reject);
                } else {
                    if (this.options.onClose) {
                        this.options.onClose(event);
                    }
                    
                    if (!this.isClosing) {
                        reject(new Error(`WebSocket connection failed after ${this.retryCount} attempts`));
                    } else {
                        // If we're explicitly closing, resolve instead of rejecting
                        resolve();
                    }
                }
            };
        } catch (error) {
            console.error('WebSocket connection error:', error);
            
            if (this.retryCount < this.options.maxRetries) {
                this._scheduleRetry(resolve, reject);
            } else {
                reject(error);
            }
        }
    }
    
    _scheduleRetry(resolve, reject) {
        this.retryCount++;
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.options.baseDelay * Math.pow(this.options.backoffMultiplier, this.retryCount - 1),
            this.options.maxDelay
        );
        
        console.log(`Retrying WebSocket connection in ${delay}ms (attempt ${this.retryCount}/${this.options.maxRetries})`);
        
        if (this.options.onStatusUpdate) {
            this.options.onStatusUpdate(`Reconnecting... (${this.retryCount}/${this.options.maxRetries})`);
        }
        
        this.retryTimeout = setTimeout(() => {
            this._attemptConnection(resolve, reject);
        }, delay);
    }
    
    _handleMessage(message) {
        // Check if this is a data message that should be preserved intact
        if (this.options.preserveDataLineBreaks && message.startsWith("data: ")) {
            // Process the entire data message without splitting
            this._processLine(message);
        } else {
            // For all other messages, handle multiple lines normally
            const lines = message.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                this._processLine(line);
            }
        }
    }
    
    _processLine(line) {
        // Handle event messages
        if (line.startsWith("event: ")) {
            const statusText = line.replace("event: ", "").trim();
            
            if (this.options.onStatusUpdate && statusText) {
                this.options.onStatusUpdate(statusText);
            }
            
            // Check for end event
            if (line.startsWith("event: end")) {
                this.close();
            }
            
            // Check for message boundary events
            const messageBoundaryEvents = ['Response', 'Evaluation', 'message_complete'];
            if (messageBoundaryEvents.includes(statusText)) {
                if (this.options.onMessageComplete) {
                    this.options.onMessageComplete(statusText);
                }
            }
            
            return;
        }
        
        // Handle data messages
        if (line.startsWith("data: ")) {
            const data = line.substring(6); // Keep everything after "data: "
            
            if (this.options.onMessage) {
                this.options.onMessage(data, 'data');
            }
            
            return;
        }
        
        // Handle raw JSON arrays or other formats
        if (line.trim()) {
            // Try to parse as JSON
            try {
                const jsonData = JSON.parse(line);
                
                if (this.options.onMessage) {
                    this.options.onMessage(jsonData, 'json');
                }
            } catch (e) {
                // Not JSON, treat as raw message
                if (this.options.onMessage) {
                    this.options.onMessage(line, 'raw');
                }
            }
        }
    }
    
    /**
     * Send a message through the WebSocket
     * @param {string|object} message - Message to send
     */
    send(message) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }
        
        const data = typeof message === 'object' ? JSON.stringify(message) : message;
        this.websocket.send(data);
    }
    
    /**
     * Close the WebSocket connection
     */
    close() {
        this.isClosing = true;
        
        // Clear any pending retry timeout
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
        
        if (this.websocket) {
            // Remove all event handlers to prevent memory leaks
            this.websocket.onmessage = null;
            this.websocket.onclose = null;
            this.websocket.onerror = null;
            this.websocket.onopen = null;
            
            if (this.websocket.readyState === WebSocket.OPEN || 
                this.websocket.readyState === WebSocket.CONNECTING) {
                this.websocket.close();
            }
            
            this.websocket = null;
        }
        
        // Resolve any pending promise to prevent unhandled rejections
        if (this.pendingResolve) {
            this.pendingResolve();
            this.pendingResolve = null;
            this.pendingReject = null;
        }
        
        this.retryCount = 0;
    }
    
    /**
     * Get the current WebSocket state
     * @returns {number|null} - WebSocket readyState or null if not connected
     */
    getState() {
        return this.websocket ? this.websocket.readyState : null;
    }
    
    /**
     * Check if WebSocket is connected
     * @returns {boolean}
     */
    isConnected() {
        return !!(this.websocket && this.websocket.readyState === WebSocket.OPEN);
    }
    
    /**
     * Reset retry counter (useful when manually reconnecting)
     */
    resetRetries() {
        this.retryCount = 0;
    }
}