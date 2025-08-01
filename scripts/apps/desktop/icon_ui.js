// gem/scripts/apps/desktop/icon_ui.js

/**
 * UI component for creating and managing desktop icons
 */
window.IconUI = class IconUI {
    /**
     * @param {Object} callbacks - Event callbacks for icon interactions
     * @param {Object} dependencies - System dependencies including Utils
     */
    constructor(callbacks, dependencies) {
        this.callbacks = callbacks;
        this.dependencies = dependencies;
    }

    /**
     * Create a draggable desktop icon element
     * @param {Object} fileData - File data with name and path properties
     * @returns {HTMLElement} Icon DOM element
     */
    createIcon(fileData) {
        const { Utils } = this.dependencies;
        const iconChar = this._getIconForFile(fileData.name);

        const iconImg = Utils.createElement('div', { className: 'desktop-icon__image', textContent: iconChar });
        const iconLabel = Utils.createElement('span', { className: 'desktop-icon__label', textContent: fileData.name });
        const iconDiv = Utils.createElement('div', {
            className: 'desktop-icon',
            'data-path': fileData.path,
            title: fileData.path
        }, [iconImg, iconLabel]);

        iconDiv.addEventListener('dblclick', () => this.callbacks.onDoubleClick(fileData.path));
        iconDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            this.callbacks.onClick?.(fileData.path, iconDiv);
        });
        iconDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.callbacks.onRightClick?.(fileData.path, iconDiv, e);
        });

        let isDragging = false;
        let offsetX, offsetY;

        iconDiv.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;

            isDragging = true;
            const parentRect = iconDiv.parentElement.getBoundingClientRect();
            offsetX = e.clientX - iconDiv.getBoundingClientRect().left + parentRect.left;
            offsetY = e.clientY - iconDiv.getBoundingClientRect().top + parentRect.top;

            iconDiv.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const parentRect = iconDiv.parentElement.getBoundingClientRect();
                let newLeft = e.clientX - offsetX;
                let newTop = e.clientY - offsetY;

                newLeft = Math.max(0, Math.min(newLeft, parentRect.width - iconDiv.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, parentRect.height - iconDiv.offsetHeight));

                iconDiv.style.left = `${newLeft}px`;
                iconDiv.style.top = `${newTop}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                iconDiv.classList.remove('dragging');
            }
        });

        return iconDiv;
    }

    /**
     * Get appropriate emoji icon for file type
     * @param {string} fileName - Name of the file
     * @returns {string} Emoji character representing the file type
     * @private
     */
    _getIconForFile(fileName) {
        const { Utils } = this.dependencies;
        const ext = Utils.getFileExtension(fileName);
        
        if (!ext || fileName.indexOf('.') === -1) {
            return '📁';
        }
        
        switch (ext) {
            case 'txt': case 'md': return '📄';
            case 'oopic': return '🎨';
            case 'sh': case 'js': return '📜';
            case 'json': return '{}';
            case 'bas': return '💻';
            case 'html': case 'htm': return '🌐';
            default: return '📄';
        }
    }
}
