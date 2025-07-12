import { describe, it, expect } from 'vitest';
import { HTMLSanitizer } from '../../src/app/core/static/js/html-sanitizer.js';

describe('HTMLSanitizer', () => {
    let sanitizer;

    beforeEach(() => {
        sanitizer = new HTMLSanitizer();
    });

    it('should allow safe HTML tags', () => {
        const html = '<p>Hello <strong>world</strong>!</p>';
        const result = sanitizer.sanitize(html);
        expect(result).toBe(html);
    });

    it('should remove dangerous script tags', () => {
        const html = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
        const result = sanitizer.sanitize(html);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
        expect(result).toContain('<p>Hello</p>');
        expect(result).toContain('<p>World</p>');
    });

    it('should remove onclick attributes', () => {
        const html = '<button onclick="alert(\'XSS\')">Click me</button>';
        const result = sanitizer.sanitize(html);
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('alert');
    });

    it('should remove javascript: URLs', () => {
        const html = '<a href="javascript:alert(\'XSS\')">Link</a>';
        const result = sanitizer.sanitize(html);
        expect(result).toContain('<a>Link</a>');
        expect(result).not.toContain('javascript:');
    });

    it('should allow safe URLs', () => {
        const html = '<a href="https://example.com">Link</a>';
        const result = sanitizer.sanitize(html);
        expect(result).toContain('href="https://example.com"');
    });

    it('should add rel="noopener noreferrer" to target links', () => {
        const html = '<a href="https://example.com" target="_blank">Link</a>';
        const result = sanitizer.sanitize(html);
        expect(result).toContain('rel="noopener noreferrer"');
    });

    it('should escape HTML entities in escapeHtml', () => {
        const text = '<script>alert("XSS")</script>';
        const result = sanitizer.escapeHtml(text);
        expect(result).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
    });

    it('should handle empty and null inputs', () => {
        expect(sanitizer.sanitize('')).toBe('');
        expect(sanitizer.sanitize(null)).toBe('');
        expect(sanitizer.sanitize(undefined)).toBe('');
    });

    it('should remove data: URLs except images', () => {
        const html = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Bad</a>';
        const result = sanitizer.sanitize(html);
        expect(result).not.toContain('data:text/html');
    });

    it('should preserve allowed attributes', () => {
        const html = '<div class="container" id="main"><p class="text">Hello</p></div>';
        const result = sanitizer.sanitize(html);
        expect(result).toContain('class="container"');
        expect(result).toContain('id="main"');
        expect(result).toContain('class="text"');
    });

    it('should handle nested malicious content', () => {
        const html = '<div><p>Safe</p><script><script>alert("XSS")</script></script></div>';
        const result = sanitizer.sanitize(html);
        expect(result).not.toContain('<script>');
        expect(result).toContain('<p>Safe</p>');
    });

    it('should allow safe image tags', () => {
        const html = '<img src="/images/logo.png" alt="Logo" width="100" height="50">';
        const result = sanitizer.sanitize(html);
        expect(result).toContain('src="/images/logo.png"');
        expect(result).toContain('alt="Logo"');
        expect(result).toContain('width="100"');
    });

    it('should remove onerror from images', () => {
        const html = '<img src="x" onerror="alert(\'XSS\')">';
        const result = sanitizer.sanitize(html);
        expect(result).not.toContain('onerror');
        expect(result).toContain('<img src="x">');
    });
});