export class JsonRenderer {
    constructor() {
        this.defaultIndentSize = 20;
    }

    render(jsonData) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message json-response';

        const jsonContainer = document.createElement('div');
        jsonContainer.className = 'json-container';

        const header = document.createElement('div');
        header.className = 'json-header';
        header.textContent = 'JSON Response:';
        jsonContainer.appendChild(header);

        jsonContainer.appendChild(this.renderJson(jsonData));
        
        messageDiv.appendChild(jsonContainer);
        return messageDiv;
    }

    renderJson(data, level = 0) {
        const indent = '  '.repeat(level);
        
        if (Array.isArray(data)) {
            return this.renderArray(data, level);
        } else if (typeof data === 'object' && data !== null) {
            return this.renderObject(data, level);
        } else {
            return this.renderPrimitive(data);
        }
    }

    renderArray(data, level) {
        const arrayDiv = document.createElement('div');
        arrayDiv.className = 'json-array';
        arrayDiv.style.marginLeft = `${level * this.defaultIndentSize}px`;
        
        data.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'json-array-item';
            
            const indexSpan = document.createElement('span');
            indexSpan.className = 'json-index';
            indexSpan.textContent = `[${index}]: `;
            itemDiv.appendChild(indexSpan);
            
            if (typeof item === 'object' && item !== null) {
                itemDiv.appendChild(this.renderJson(item, level + 1));
            } else {
                const valueSpan = document.createElement('span');
                valueSpan.className = 'json-value';
                valueSpan.textContent = JSON.stringify(item);
                itemDiv.appendChild(valueSpan);
            }
            
            arrayDiv.appendChild(itemDiv);
        });
        
        return arrayDiv;
    }

    renderObject(data, level) {
        const objectDiv = document.createElement('div');
        objectDiv.className = 'json-object';
        objectDiv.style.marginLeft = `${level * this.defaultIndentSize}px`;
        
        Object.entries(data).forEach(([key, value]) => {
            const propertyDiv = document.createElement('div');
            propertyDiv.className = 'json-property';
            
            const keySpan = document.createElement('span');
            keySpan.className = 'json-key';
            keySpan.textContent = `${key}: `;
            propertyDiv.appendChild(keySpan);
            
            if (typeof value === 'object' && value !== null) {
                propertyDiv.appendChild(this.renderJson(value, level + 1));
            } else {
                const valueSpan = document.createElement('span');
                valueSpan.className = 'json-value';
                valueSpan.textContent = JSON.stringify(value);
                propertyDiv.appendChild(valueSpan);
            }
            
            objectDiv.appendChild(propertyDiv);
        });
        
        return objectDiv;
    }

    renderPrimitive(data) {
        const valueSpan = document.createElement('span');
        valueSpan.className = 'json-value';
        valueSpan.textContent = JSON.stringify(data);
        return valueSpan;
    }
}