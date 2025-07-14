import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketHandler } from '../src/app/core/static/js/websocket-handler.js';

// Mock WebSocket
class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = WebSocket.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        this._closed = false;
        
        // Simulate connection
        setTimeout(() => {
            if (this._closed) return; // Don't fire events if already closed
            
            if (this.url.includes('fail')) {
                this.readyState = WebSocket.CLOSED;
                if (this.onerror) this.onerror(new Error('Connection failed'));
                // Add a small delay before onclose to allow error handling
                setTimeout(() => {
                    if (!this._closed && this.onclose) {
                        this.onclose({ code: 1006, reason: 'Connection failed' });
                    }
                }, 0);
            } else {
                this.readyState = WebSocket.OPEN;
                if (this.onopen) this.onopen();
            }
        }, 10);
    }
    
    send(data) {
        if (this.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not open');
        }
    }
    
    close() {
        this._closed = true;
        this.readyState = WebSocket.CLOSED;
        // Clear all handlers to prevent any pending callbacks
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        const closeHandler = this.onclose;
        this.onclose = null;
        if (closeHandler) {
            closeHandler({ code: 1000, reason: 'Normal closure' });
        }
    }
}

// WebSocket constants
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

global.WebSocket = MockWebSocket;
global.WebSocket.CONNECTING = 0;
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSING = 2;
global.WebSocket.CLOSED = 3;

describe('WebSocketHandler', () => {
    let handler;
    let onMessageSpy;
    let onStatusUpdateSpy;
    let onErrorSpy;
    let onCloseSpy;
    let onOpenSpy;
    let consoleLogSpy;
    let consoleErrorSpy;
    
    beforeEach(() => {
        vi.useFakeTimers();
        
        // Silence console during tests
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        onMessageSpy = vi.fn();
        onStatusUpdateSpy = vi.fn();
        onErrorSpy = vi.fn();
        onCloseSpy = vi.fn();
        onOpenSpy = vi.fn();
        
        handler = new WebSocketHandler({
            onMessage: onMessageSpy,
            onStatusUpdate: onStatusUpdateSpy,
            onError: onErrorSpy,
            onClose: onCloseSpy,
            onOpen: onOpenSpy,
            maxRetries: 3,
            baseDelay: 100
        });
    });
    
    afterEach(() => {
        handler.close();
        vi.useRealTimers();
        vi.clearAllMocks();
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        // Clear any pending promises
        return new Promise(resolve => setTimeout(resolve, 0));
    });
    
    describe('Connection', () => {
        it('should connect successfully', async () => {
            const promise = handler.connect('ws://localhost:8080');
            
            // Wait for async connection
            await vi.runAllTimersAsync();
            await promise;
            
            expect(handler.isConnected()).toBe(true);
            expect(onOpenSpy).toHaveBeenCalled();
        });
        
        it('should retry on connection failure', async () => {
            // Use a promise to track the connection
            let connectionPromise;
            const connectAndTrack = () => {
                connectionPromise = handler.connect('ws://localhost:8080/fail');
                // Always handle the rejection to prevent unhandled errors
                connectionPromise.catch(() => {});
                return connectionPromise;
            };
            
            const promise = connectAndTrack();
            
            // First attempt fails (wait for initial timeout and error callback)
            await vi.advanceTimersByTimeAsync(15);
            expect(handler.retryCount).toBe(1);
            expect(onStatusUpdateSpy).toHaveBeenCalledWith('Reconnecting... (1/3)');
            
            // Continue through all retries
            await vi.runAllTimersAsync();
            
            // Should eventually fail after max retries
            await expect(promise).rejects.toThrow('WebSocket connection failed after');
        });
        
        it('should use exponential backoff for retries', async () => {
            const promise = handler.connect('ws://localhost:8080/fail');
            // Handle the rejection to prevent unhandled errors
            promise.catch(() => {});
            
            // First attempt fails immediately
            await vi.advanceTimersByTimeAsync(15);
            expect(handler.retryCount).toBe(1);
            
            // Second attempt after 100ms delay
            await vi.advanceTimersByTimeAsync(110);
            expect(handler.retryCount).toBe(2);
            
            // Complete all retries
            await vi.runAllTimersAsync();
            
            // Should fail after retries
            await expect(promise).rejects.toThrow();
        });
    });
    
    describe('Message Handling', () => {
        beforeEach(async () => {
            const promise = handler.connect('ws://localhost:8080');
            await vi.runAllTimersAsync();
            await promise;
        });
        
        it('should handle event messages', () => {
            handler._handleMessage('event: Processing...');
            expect(onStatusUpdateSpy).toHaveBeenCalledWith('Processing...');
        });
        
        it('should handle data messages', () => {
            handler._handleMessage('data: Test data');
            expect(onMessageSpy).toHaveBeenCalledWith('Test data', 'data');
        });
        
        it('should handle JSON messages', () => {
            const jsonData = { test: 'value' };
            handler._handleMessage(JSON.stringify(jsonData));
            expect(onMessageSpy).toHaveBeenCalledWith(jsonData, 'json');
        });
        
        it('should handle multiple messages in one frame', () => {
            handler._handleMessage('event: Status\ndata: Line 1\ndata: Line 2');
            
            expect(onStatusUpdateSpy).toHaveBeenCalledWith('Status');
            expect(onMessageSpy).toHaveBeenCalledWith('Line 1', 'data');
            expect(onMessageSpy).toHaveBeenCalledWith('Line 2', 'data');
        });
        
        it('should close on end event', () => {
            const closeSpy = vi.spyOn(handler, 'close');
            handler._handleMessage('event: end');
            expect(closeSpy).toHaveBeenCalled();
        });
    });
    
    describe('Cleanup', () => {
        it('should clean up properly on close', async () => {
            const promise = handler.connect('ws://localhost:8080');
            await vi.runAllTimersAsync();
            await promise;
            
            const ws = handler.websocket;
            handler.close();
            
            expect(handler.websocket).toBeNull();
            expect(handler.isClosing).toBe(true);
            expect(ws.onmessage).toBeNull();
            expect(ws.onerror).toBeNull();
            expect(ws.onclose).toBeNull();
            expect(ws.onopen).toBeNull();
        });
        
        it('should clear retry timeout on close', async () => {
            // Don't await the promise immediately
            handler.connect('ws://localhost:8080/fail').catch(() => {
                // Ignore the expected rejection
            });
            
            // Let it fail and start scheduling retry
            await vi.advanceTimersByTimeAsync(15); // Wait for initial connection to fail
            expect(handler.retryTimeout).not.toBeNull();
            
            handler.close();
            expect(handler.retryTimeout).toBeNull();
        });
    });
    
    describe('State Management', () => {
        it('should track connection state correctly', async () => {
            expect(handler.isConnected()).toBe(false);
            expect(handler.getState()).toBeNull();
            
            const promise = handler.connect('ws://localhost:8080');
            
            // Wait a tick for WebSocket to be created
            await vi.advanceTimersByTimeAsync(0);
            
            // After connect is called, WebSocket should exist
            expect(handler.getState()).toBe(WebSocket.CONNECTING);
            
            await vi.runAllTimersAsync();
            await promise;
            
            expect(handler.isConnected()).toBe(true);
            expect(handler.getState()).toBe(WebSocket.OPEN);
        });
        
        it('should reset retry counter', async () => {
            const promise = handler.connect('ws://localhost:8080/fail');
            // Handle the rejection to prevent unhandled errors
            promise.catch(() => {});
            
            // Let it retry a few times
            await vi.advanceTimersByTimeAsync(15);
            await vi.advanceTimersByTimeAsync(110);
            
            expect(handler.retryCount).toBeGreaterThan(0);
            
            handler.resetRetries();
            expect(handler.retryCount).toBe(0);
            
            // Complete the test
            await vi.runAllTimersAsync();
            await expect(promise).rejects.toThrow();
        });
    });
    
    describe('Send', () => {
        it('should send string messages', async () => {
            const promise = handler.connect('ws://localhost:8080');
            await vi.runAllTimersAsync();
            await promise;
            
            const sendSpy = vi.spyOn(handler.websocket, 'send');
            handler.send('Test message');
            
            expect(sendSpy).toHaveBeenCalledWith('Test message');
        });
        
        it('should send object messages as JSON', async () => {
            const promise = handler.connect('ws://localhost:8080');
            await vi.runAllTimersAsync();
            await promise;
            
            const sendSpy = vi.spyOn(handler.websocket, 'send');
            const obj = { test: 'value' };
            handler.send(obj);
            
            expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(obj));
        });
        
        it('should throw error if not connected', () => {
            expect(() => handler.send('Test')).toThrow('WebSocket is not connected');
        });
    });
});