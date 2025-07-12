/**
 * HTML Sanitizer for preventing XSS attacks
 * Uses a whitelist approach to allow only safe HTML elements and attributes
 */
export class HTMLSanitizer {
    constructor() {
        // Allowed HTML tags
        this.allowedTags = new Set([
            'p', 'br', 'span', 'div', 'strong', 'em', 'b', 'i', 'u',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            'a', 'code', 'pre', 'blockquote',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'img', 'hr'
        ]);

        // Allowed attributes for specific tags
        this.allowedAttributes = {
            'a': ['href', 'title', 'target', 'rel'],
            'img': ['src', 'alt', 'title', 'width', 'height'],
            'code': ['class'],
            'pre': ['class'],
            '*': ['class', 'id'] // Allowed on all tags
        };

        // URL schemes we allow
        this.allowedSchemes = ['http', 'https', 'mailto'];
    }

    /**
     * Sanitize HTML string to prevent XSS attacks
     * @param {string} html - The HTML string to sanitize
     * @returns {string} - Sanitized HTML string
     */
    sanitize(html) {
        if (!html) return '';
        
        // Create a temporary div to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Recursively sanitize all nodes
        this.sanitizeNode(tempDiv);
        
        return tempDiv.innerHTML;
    }

    /**
     * Recursively sanitize a DOM node and its children
     * @param {Node} node - The node to sanitize
     */
    sanitizeNode(node) {
        // Get all child nodes (we need to copy because we'll be modifying the list)
        const children = Array.from(node.childNodes);
        
        for (const child of children) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();
                
                if (!this.allowedTags.has(tagName)) {
                    // Remove dangerous tags completely (don't preserve content)
                    if (this.isDangerousTag(tagName)) {
                        node.removeChild(child);
                    } else {
                        // For other tags, preserve text content
                        const textNode = document.createTextNode(child.textContent);
                        node.replaceChild(textNode, child);
                    }
                } else {
                    // Sanitize attributes
                    this.sanitizeAttributes(child);
                    
                    // Recursively sanitize children
                    this.sanitizeNode(child);
                }
            }
        }
    }

    /**
     * Sanitize attributes of an element
     * @param {Element} element - The element whose attributes to sanitize
     */
    sanitizeAttributes(element) {
        const tagName = element.tagName.toLowerCase();
        const attributes = Array.from(element.attributes);
        
        for (const attr of attributes) {
            const attrName = attr.name.toLowerCase();
            
            // Check if attribute is allowed
            const allowedForTag = this.allowedAttributes[tagName] || [];
            const allowedGlobal = this.allowedAttributes['*'] || [];
            
            if (!allowedForTag.includes(attrName) && !allowedGlobal.includes(attrName)) {
                element.removeAttribute(attr.name);
                continue;
            }
            
            // Special handling for href and src attributes
            if (attrName === 'href' || attrName === 'src') {
                if (!this.isValidUrl(attr.value)) {
                    element.removeAttribute(attr.name);
                }
            }
            
            // Remove javascript: and data: URLs
            if (attr.value.toLowerCase().includes('javascript:') || 
                attr.value.toLowerCase().includes('data:text/html')) {
                element.removeAttribute(attr.name);
            }
        }
        
        // Ensure links open in new tab safely
        if (tagName === 'a' && element.hasAttribute('target')) {
            element.setAttribute('rel', 'noopener noreferrer');
        }
    }

    /**
     * Check if a tag is dangerous and should be completely removed
     * @param {string} tagName - The tag name to check
     * @returns {boolean} - True if tag is dangerous
     */
    isDangerousTag(tagName) {
        const dangerous = ['script', 'style', 'iframe', 'object', 'embed', 'form'];
        return dangerous.includes(tagName.toLowerCase());
    }

    /**
     * Check if a URL is valid and safe
     * @param {string} url - The URL to validate
     * @returns {boolean} - True if URL is valid and safe
     */
    isValidUrl(url) {
        try {
            const parsed = new URL(url, window.location.href);
            return this.allowedSchemes.includes(parsed.protocol.slice(0, -1));
        } catch {
            // Relative URLs are okay
            return !url.includes(':');
        }
    }

    /**
     * Escape HTML entities in plain text
     * @param {string} text - The text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create a singleton instance
export const htmlSanitizer = new HTMLSanitizer();