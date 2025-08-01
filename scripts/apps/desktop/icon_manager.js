// gem/scripts/apps/desktop/icon_manager.js

/**
 * Manages desktop icons and their layout
 */
window.IconManager = class IconManager {
    /**
     * @param {HTMLElement} desktopContainer - Desktop container element
     * @param {Object} dependencies - System dependencies
     * @param {Object} callbacks - Icon event callbacks
     */
    constructor(desktopContainer, dependencies, callbacks) {
        this.desktopContainer = desktopContainer;
        this.dependencies = dependencies;
        this.callbacks = callbacks;
        this.ui = new this.dependencies.IconUI({
            onDoubleClick: (path) => this.callbacks.onIconDoubleClick(path),
            onClick: (path, element) => this.callbacks.onIconClick?.(path, element),
            onRightClick: (path, element, event) => this.callbacks.onIconRightClick?.(path, element, event)
        }, this.dependencies);
        /** @type {Array<{element: HTMLElement, data: Object}>} Array of icon objects */
        this.icons = [];
        this.desktopUI = null;
    }

    /**
     * Load and display icons from the desktop directory
     * @returns {Promise<void>}
     */
    async loadIcons() {
        const { FileSystemManager, UserManager } = this.dependencies;
        const currentUser = UserManager.getCurrentUser().name;
        const desktopPath = `/home/${currentUser}/Desktop`;

        const pathInfo = FileSystemManager.validatePath(desktopPath, { allowMissing: true });
        if (!pathInfo.data.node) {
            await this.dependencies.CommandExecutor.processSingleCommand(`mkdir -p ${desktopPath}`, { isInteractive: false });
        }

        const desktopNode = FileSystemManager.getNodeByPath(desktopPath);
        if (desktopNode && desktopNode.children) {
            Object.keys(desktopNode.children).forEach(name => {
                const fullPath = `${desktopPath}/${name}`;
                const iconData = { name, path: fullPath };
                const iconElement = this.ui.createIcon(iconData);
                this.desktopContainer.appendChild(iconElement);
                this.icons.push({ element: iconElement, data: iconData });
            });
        }
        
        if (this.icons.length > 0 && this.desktopUI) {
            this.desktopUI.hideWelcomeMessage();
        } else if (this.icons.length === 0 && this.desktopUI) {
            this.desktopUI.showWelcomeMessage();
        }
        
        this.arrangeIcons();
    }

    /**
     * Arrange icons in a grid layout on the desktop
     */
    arrangeIcons() {
        const PADDING = 20;
        const ICON_WIDTH = 80;
        const ICON_HEIGHT = 90;
        const containerWidth = this.desktopContainer.clientWidth;
        const cols = Math.floor((containerWidth - PADDING) / ICON_WIDTH);

        this.icons.forEach((icon, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            icon.element.style.left = `${PADDING + col * ICON_WIDTH}px`;
            icon.element.style.top = `${PADDING + row * ICON_HEIGHT}px`;
        });
    }

    /**
     * Find icon by file path
     * @param {string} path - File path to search for
     * @returns {Object|undefined} Icon object or undefined if not found
     */
    getIconByPath(path) {
        return this.icons.find(icon => icon.data.path === path);
    }

    /**
     * Remove all icons from the desktop
     */
    clearIcons() {
        this.icons.forEach(icon => {
            if (icon.element.parentNode) {
                icon.element.parentNode.removeChild(icon.element);
            }
        });
        this.icons = [];
        
        if (this.desktopUI) {
            this.desktopUI.showWelcomeMessage();
        }
    }
    
    /**
     * Set reference to desktop UI for welcome message control
     * @param {Object} desktopUI - Desktop UI instance
     */
    setDesktopUI(desktopUI) {
        this.desktopUI = desktopUI;
    }
}
