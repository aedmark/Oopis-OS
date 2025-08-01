// gem/scripts/apps/desktop/desktop_ui.js

/**
 * UI component for the desktop environment interface
 */
window.DesktopUI = class DesktopUI {
    /**
     * @param {Object} callbacks - Event callback functions
     * @param {Object} dependencies - System dependencies including Utils
     */
    constructor(callbacks, dependencies) {
        this.callbacks = callbacks;
        this.dependencies = dependencies;
        /** @type {Object.<string, HTMLElement>} DOM elements */
        this.elements = {};
        this._buildLayout();
    }
    
    /**
     * Hide the welcome message overlay
     */
    hideWelcomeMessage() {
        if (this.elements.welcomeMessage) {
            this.elements.welcomeMessage.style.display = 'none';
        }
    }
    
    /**
     * Show the welcome message overlay
     */
    showWelcomeMessage() {
        if (this.elements.welcomeMessage) {
            this.elements.welcomeMessage.style.display = 'block';
        }
    }

    /**
     * Get the main desktop container element
     * @returns {HTMLElement} Desktop container
     */
    getContainer() {
        return this.elements.container;
    }

    /**
     * Build the desktop UI layout with container and welcome message
     * @private
     */
    _buildLayout() {
        const { Utils } = this.dependencies;
        this.elements.container = Utils.createElement('div', {
            id: 'desktop-container',
            className: 'desktop-placeholder'
        });
        
        this.elements.welcomeMessage = Utils.createElement('div', {
            className: 'desktop-welcome',
            style: 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: var(--color-text-subtle); font-size: var(--font-size-lg); pointer-events: none; z-index: -1;',
            innerHTML: 'Right-click to create files and folders<br>Double-click icons to open them'
        });
        
        this.elements.container.appendChild(this.elements.welcomeMessage);
    }
}
