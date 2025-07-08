// Global test setup
// Mock browser APIs that might not be available in JSDOM
global.WebSocket = class WebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }
  
  send(data) {
    // Mock implementation
  }
  
  close() {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal closure' });
    }
  }
};

// Mock fetch if needed
global.fetch = global.fetch || (() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve('')
}));

// Add any other global mocks needed for your tests