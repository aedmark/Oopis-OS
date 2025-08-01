// gem/scripts/apps/desktop/window_manager.js

window.WindowManager = class WindowManager {
    constructor(desktopContainer, dependencies, eventCallbacks = {}) {
        this.desktopContainer = desktopContainer;
        this.dependencies = dependencies;
        this.windows = new Map();
        this.activeWindowId = null;
        this.highestZIndex = 100;
        this.windowCounter = 0;
        this.callbacks = {
            onWindowCreated: eventCallbacks.onWindowCreated || (() => {}),
            onWindowDestroyed: eventCallbacks.onWindowDestroyed || (() => {}),
            onWindowFocused: eventCallbacks.onWindowFocused || (() => {}),
        };
    }

    /**
     * Creates a new window and adds it to the desktop.
     * @param {object} options - Configuration for the new window (title, content, size, etc.)
     * @returns {string} The unique ID of the new window.
     */
    createWindow(options) {
        const { title, contentElement, width, height, x, y } = options;
        const windowId = `window-${this.windowCounter++}`;

        const windowComponent = this.dependencies.UIComponents.createWindowComponent(
            title,
            contentElement,
            {
                onFocus: () => this.focusWindow(windowId),
                onClose: () => this.destroyWindow(windowId),
            }
        );

        windowComponent.style.width = width ? `${width}px` : '400px';
        windowComponent.style.height = height ? `${height}px` : '300px';
        windowComponent.style.left = x ? `${x}px` : `${50 + (this.windows.size * 20)}px`;
        windowComponent.style.top = y ? `${y}px` : `${50 + (this.windows.size * 20)}px`;

        this.desktopContainer.appendChild(windowComponent);
        const windowData = { id: windowId, element: windowComponent, options };
        this.windows.set(windowId, windowData);

        this.callbacks.onWindowCreated(windowId, options.title);

        this.focusWindow(windowId);
        return windowId;
    }

    /**
     * Removes a window from the desktop.
     * @param {string} windowId - The ID of the window to destroy.
     */
    destroyWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (windowData) {
            windowData.element.remove();
            this.windows.delete(windowId);
            this.callbacks.onWindowDestroyed(windowId);
            if (this.activeWindowId === windowId) {
                this.activeWindowId = null;
            }
        }
    }

    /**
     * Brings a window to the front and marks it as active.
     * @param {string} windowId - The ID of the window to focus.
     */
    focusWindow(windowId) {
        if (this.activeWindowId === windowId && document.activeElement === this.windows.get(windowId)?.element) return;

        if (this.activeWindowId) {
            const oldActive = this.windows.get(this.activeWindowId);
            oldActive?.element.classList.remove('active');
        }

        const windowData = this.windows.get(windowId);
        if (windowData) {
            this.highestZIndex++;
            windowData.element.style.zIndex = this.highestZIndex;
            windowData.element.classList.add('active');
            this.activeWindowId = windowId;
            this.callbacks.onWindowFocused(windowId);
        }
    }

    /**
     * Store additional data with a window (like app instance)
     * @param {string} windowId - The ID of the window
     * @param {object} data - Data to store
     */
    setWindowData(windowId, data) {
        const windowData = this.windows.get(windowId);
        if (windowData) {
            windowData.appData = { ...windowData.appData, ...data };
        }
    }

    /**
     * Get stored data for a window
     * @param {string} windowId - The ID of the window
     * @returns {object} Stored data
     */
    getWindowData(windowId) {
        const windowData = this.windows.get(windowId);
        return windowData?.appData || {};
    }

    /**
     * Close a window (alias for destroyWindow)
     * @param {string} windowId - The ID of the window to close
     */
    closeWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (windowData?.appData?.appInstance) {
            try {
                windowData.appData.appInstance.exit();
            } catch (e) {
                console.warn('Error calling app exit:', e);
            }
        }
        this.destroyWindow(windowId);
    }
}
