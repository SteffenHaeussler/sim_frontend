import { describe, it, expect } from 'vitest';

describe('Test Environment', () => {
  it('should have localStorage available', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    localStorage.removeItem('test');
  });

  it('should have fetch mock available', () => {
    expect(global.fetch).toBeDefined();
    expect(typeof global.fetch).toBe('function');
  });

  it('should have WebSocket mock available', () => {
    expect(global.WebSocket).toBeDefined();
    const ws = new WebSocket('ws://test');
    expect(ws.url).toBe('ws://test');
  });

  it('should have JSDOM environment', () => {
    expect(global.document).toBeDefined();
    expect(global.window).toBeDefined();
    const div = document.createElement('div');
    expect(div.tagName).toBe('DIV');
  });
});