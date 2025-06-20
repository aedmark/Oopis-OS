/**
 * @file Manages the entire lifecycle and functionality of the OopisOS character-based paint application.
 * This includes the configuration, UI management, and the core state/drawing logic.
 * @author Andrew Edmark
 * @author Gemini
 */

/**
 * @module PaintAppConfig
 * @description Provides a centralized configuration object for the paint application.
 * This includes constants for canvas dimensions, tools, colors, and UI elements.
 */
const PaintAppConfig = {
    CANVAS: {
        DEFAULT_WIDTH: 80,
        DEFAULT_HEIGHT: 24,
    },
    DEFAULT_CHAR: '#',
    DEFAULT_FG_COLOR: 'text-green-500',
    DEFAULT_BG_COLOR: 'bg-transparent',
    ERASER_CHAR: ' ',
    ERASER_BG_COLOR: 'bg-neutral-950',
    FILE_EXTENSION: 'oopic',
    ASCII_CHAR_RANGE: { START: 32, END: 126 },
    CSS_CLASSES: {
        MODAL_HIDDEN: 'hidden',
        ACTIVE_TOOL: 'paint-tool-active',
        GRID_ACTIVE: 'paint-grid-active',
    },
    PALETTE: [
        { name: 'green',   class: 'text-green-500',   value: 'rgb(34, 197, 94)' },
        { name: 'red',     class: 'text-red-500',     value: 'rgb(239, 68, 68)' },
        { name: 'sky',     class: 'text-sky-400',     value: 'rgb(56, 189, 248)' },
        { name: 'amber',   class: 'text-amber-400',   value: 'rgb(251, 191, 36)' },
        { name: 'lime',    class: 'text-lime-400',    value: 'rgb(163, 230, 53)' },
        { name: 'neutral', class: 'text-neutral-300', value: 'rgb(212, 212, 212)' }
    ],
    EDITOR: {
        DEBOUNCE_DELAY_MS: 300,
        MAX_UNDO_STATES: 50,
    }
};

/**
 * @module PaintUI
 * @description Manages all DOM manipulations for the paint editor. This includes building the UI,
 * handling display updates, and calculating coordinates. It is a pure UI controller
 * that receives its instructions and data from the PaintManager.
 */
const PaintUI = (() => {
    "use strict";
    let elements = {};
    let isInitialized = false;
    let eventCallbacks = {};
    let cellDimensions = { width: 0, height: 0 };

    /**
     * Initializes DOM elements, builds the toolbar, and attaches initial event listeners.
     * This function is designed to run only once.
     * @private
     * @param {object} callbacks - An object containing callback functions from PaintManager for UI events.
     * @returns {boolean} True if initialization is successful, false otherwise.
     */
    function _initDOM(callbacks) {
        if (isInitialized) return true;
        eventCallbacks = callbacks;

        elements.modal = document.getElementById('paint-modal');
        elements.toolbar = document.getElementById('paint-toolbar');
        elements.canvas = document.getElementById('paint-canvas');
        elements.statusBar = document.getElementById('paint-statusbar');
        elements.charSelectModal = document.getElementById('paint-char-select-modal');
        elements.charSelectGrid = document.getElementById('paint-char-select-grid');

        if (!elements.modal || !elements.toolbar || !elements.canvas || !elements.statusBar || !elements.charSelectModal || !elements.charSelectGrid) {
            console.error("PaintUI: Critical UI elements missing!");
            return false;
        }

        elements.toolbar.innerHTML = '';

        const pencilSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" /></svg>';
        const eraserSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M16.24,3.56L21.19,8.5C21.58,8.89 21.58,9.5 21.19,9.9L12.1,19L3,19L3,9.9L7.94,5M17.31,2.5L6.81,13L4,13L4,18L9,18L19.5,7.5M15.12,5.12L18.87,8.87" /></svg>';
        const undoSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M12.5,8C9.81,8,7.5,10.27,7.5,13S9.81,18,12.5,18c2.04,0,3.84-1.18,4.63-2.92l1.48,1.48C17.34,18.23,15.06,20,12.5,20C8.91,20,6,16.91,6,13.5S8.91,7,12.5,7c1.78,0,3.4,.71,4.59,1.86L19,7v6h-6l1.92-1.92C14.04,9.82,13.3,9,12.5,9c-1.38,0-2.5,1.12-2.5,2.5s1.12,2.5,2.5,2.5c.83,0,1.55-.4,2-1h1.53c-.64,1.9-2.51,3.25-4.53,3.25-2.76,0-5-2.24-5-5s2.24-5,5-5c1.38,0,2.64,.56,3.54,1.46L18.5,6H12.5V8Z"/></svg>';
        const redoSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M11.5,8c2.76,0,5,2.24,5,5s-2.24,5-5,5c-1.38,0-2.64-.56-3.54-1.46L5.5,18H11.5v-2c.83,0,1.55-.39,2-1h-1.53c.64-1.9,2.51,3.25,4.53-3.25,1.38,0,2.5,1.12,2.5,2.5s-1.12,2.5-2.5,2.5c-.82,0-1.55-.39-2-1H5.41l1.46-1.46C8.16,11.23,9.78,10,11.5,10c2.76,0,5,2.24,5,5s-2.24,5-5,5-5-2.24-5-5c0-.17.01-.34.04-.5L4,14.08C4,14.54,4,15,4,15.5c0,3.59,3.09,6.5,6.5,6.5s6.5-2.91,6.5-6.5S14.91,9,11.5,9c-1.78,0-3.4,.71,4.59,1.86L5,9V3h6l-1.92,1.92C10.96,6.18,11.7,7,11.5,7Z" /></svg>';
        const gridSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/></svg>';
        const charSelectSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M6,15.5L9.5,12L6,8.5L7.42,7.08L12.34,12L7.42,16.92L6,15.5M13.42,16.92L18.34,12L13.42,7.08L14.84,5.66L21.17,12L14.84,18.34L13.42,16.92Z" /></svg>';

        elements.undoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: undoSVG, title: 'Undo (Ctrl+Z)', eventListeners: { click: () => eventCallbacks.onUndo() } });
        elements.redoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: redoSVG, title: 'Redo (Ctrl+Y)', eventListeners: { click: () => eventCallbacks.onRedo() } });
        elements.pencilBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: pencilSVG, title: 'Pencil (P)', eventListeners: { click: () => eventCallbacks.onToolChange('pencil') }});
        elements.eraserBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: eraserSVG, title: 'Eraser (E)', eventListeners: { click: () => eventCallbacks.onToolChange('eraser') }});
        elements.gridBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: gridSVG, title: 'Toggle Grid (G)', eventListeners: { click: () => eventCallbacks.onGridToggle() } });
        elements.charSelectBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: charSelectSVG, title: 'Select Character (C)', eventListeners: { click: () => eventCallbacks.onCharSelectOpen() } });

        elements.colorButtons = [];
        const colorPaletteContainer = Utils.createElement('div', { className: 'paint-palette' });
        PaintAppConfig.PALETTE.forEach((color, index) => {
            const colorBtn = Utils.createElement('button', {
                className: `paint-color-swatch`,
                style: { backgroundColor: color.value },
                title: `Color ${index + 1} (${color.name}) (${index + 1})`,
                eventListeners: { click: () => eventCallbacks.onColorChange(color.class) }
            });
            elements.colorButtons.push(colorBtn);
            colorPaletteContainer.appendChild(colorBtn);
        });

        elements.saveExitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: 'Save & Exit', title: 'Save & Exit (Ctrl+S)', eventListeners: { click: () => eventCallbacks.onSaveAndExit() }});
        elements.exitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: 'Exit', title: 'Exit without Saving (Ctrl+O)', eventListeners: { click: () => eventCallbacks.onExit() }});

        const leftGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.undoBtn, elements.redoBtn, elements.pencilBtn, elements.eraserBtn, elements.gridBtn, elements.charSelectBtn);
        const rightGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.saveExitBtn, elements.exitBtn);

        elements.toolbar.append(leftGroup, colorPaletteContainer, rightGroup);

        elements.canvas.addEventListener('mousedown', eventCallbacks.onMouseDown);
        document.addEventListener('mousemove', eventCallbacks.onMouseMove);
        document.addEventListener('mouseup', eventCallbacks.onMouseUp);
        elements.canvas.addEventListener('mouseleave', eventCallbacks.onMouseLeave);
        elements.charSelectModal.addEventListener('click', (e) => {
            if (e.target === elements.charSelectModal) {
                hideCharSelect();
            }
        });

        isInitialized = true;
        return true;
    }

    /**
     * Toggles the visibility of the grid overlay on the canvas.
     * @param {boolean} isActive - True to show the grid, false to hide it.
     */
    function toggleGrid(isActive) {
        if (!elements.canvas) return;
        elements.canvas.classList.toggle(PaintAppConfig.CSS_CLASSES.GRID_ACTIVE, isActive);
    }

    /**
     * Populates the character selection grid with all available ASCII characters and shows the modal.
     * @param {function(string): void} onSelectCallback - The callback to execute when a character is chosen.
     */
    function populateAndShowCharSelect(onSelectCallback) {
        if (!elements.charSelectGrid || !elements.charSelectModal) return;
        elements.charSelectGrid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const { START, END } = PaintAppConfig.ASCII_CHAR_RANGE;

        for (let i = START; i <= END; i++) {
            const char = String.fromCharCode(i);
            const btn = Utils.createElement('button', {
                className: 'paint-char-btn',
                textContent: char,
                eventListeners: {
                    click: () => onSelectCallback(char)
                }
            });
            fragment.appendChild(btn);
        }
        elements.charSelectGrid.appendChild(fragment);
        elements.charSelectModal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
    }

    /**
     * Hides the character selection modal.
     */
    function hideCharSelect() {
        if (elements.charSelectModal) {
            elements.charSelectModal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        }
    }

    /**
     * Calculates the rendered width and height of a single canvas grid cell.
     * @private
     */
    function _calculateCellSize() {
        if (!elements.canvas || !elements.canvas.firstChild) return;
        const testCell = elements.canvas.firstChild;
        cellDimensions.width = testCell.offsetWidth;
        cellDimensions.height = testCell.offsetHeight;
    }

    /**
     * Converts mouse pixel coordinates to canvas grid coordinates.
     * @param {number} pixelX - The clientX coordinate from a mouse event.
     * @param {number} pixelY - The clientY coordinate from a mouse event.
     * @returns {{x: number, y: number}|null} An object with x and y grid coordinates, or null if outside the canvas.
     */
    function getGridCoordinates(pixelX, pixelY) {
        if (!elements.canvas || !cellDimensions.width || !cellDimensions.height) return null;
        const rect = elements.canvas.getBoundingClientRect();
        const x = pixelX - rect.left;
        const y = pixelY - rect.top;

        if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;
        const gridX = Math.floor(x / cellDimensions.width);
        const gridY = Math.floor(y / cellDimensions.height);
        return { x: gridX, y: gridY };
    }

    /**
     * Updates the status bar text with the current tool, character, color, and coordinates.
     * @param {object} status - The current status object.
     * @param {string} status.tool - The name of the active tool.
     * @param {string} status.char - The current drawing character.
     * @param {string} status.fg - The current foreground color class.
     * @param {{x: number, y: number}} status.coords - The current mouse grid coordinates.
     */
    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        const colorName = status.fg.replace('text-', '').replace(/-\d+/, '');
        elements.statusBar.textContent = `Tool: ${status.tool} | Char: '${status.char}' | Color: ${colorName} | Coords: ${status.coords.x},${status.coords.y}`;
    }

    /**
     * Updates the toolbar UI to reflect the current state (active tool, color, undo/redo availability).
     * @param {string} activeTool - The name of the currently active tool ('pencil' or 'eraser').
     * @param {string} activeColor - The CSS class of the currently active color.
     * @param {boolean} undoPossible - Whether an undo action is available.
     * @param {boolean} redoPossible - Whether a redo action is available.
     * @param {boolean} isGridActive - Whether the grid overlay is currently visible.
     */
    function updateToolbar(activeTool, activeColor, undoPossible, redoPossible, isGridActive) {
        if (!isInitialized) return;
        elements.pencilBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'pencil');
        elements.eraserBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'eraser');
        elements.undoBtn.disabled = !undoPossible;
        elements.redoBtn.disabled = !redoPossible;
        elements.gridBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, isGridActive);

        elements.colorButtons.forEach((btn, index) => {
            const colorClass = PaintAppConfig.PALETTE[index].class;
            btn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, colorClass === activeColor);
        });
    }

    /**
     * Shows the main paint application modal.
     * @param {object} callbacks - An object of event callbacks from the PaintManager.
     */
    function show(callbacks) {
        if (!isInitialized) {
            if (!_initDOM(callbacks)) return;
        }
        elements.modal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        OutputManager.setEditorActive(true);
    }

    /**
     * Hides the main paint application modal.
     */
    function hide() {
        if (elements.modal) {
            elements.modal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        }
        hideCharSelect();
        OutputManager.setEditorActive(false);
    }

    /**
     * Renders the entire canvas based on the provided data model.
     * @param {Array<Array<{char: string, fg: string, bg: string}>>} canvasData - A 2D array representing the canvas state.
     */
    function renderCanvas(canvasData) {
        if (!elements.canvas) return;
        elements.canvas.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const gridWidth = canvasData[0]?.length || PaintAppConfig.CANVAS.DEFAULT_WIDTH;
        const gridHeight = canvasData.length || PaintAppConfig.CANVAS.DEFAULT_HEIGHT;

        elements.canvas.style.gridTemplateColumns = `repeat(${gridWidth}, 1fr)`;
        elements.canvas.style.gridTemplateRows = `repeat(${gridHeight}, 1fr)`;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = canvasData[y]?.[x] || { char: ' ', fg: PaintAppConfig.DEFAULT_FG_COLOR, bg: PaintAppConfig.ERASER_BG_COLOR };
                const span = Utils.createElement('span', {
                    textContent: cell.char,
                    className: `${cell.fg} ${cell.bg}`
                });
                fragment.appendChild(span);
            }
        }
        elements.canvas.appendChild(fragment);
        _calculateCellSize();
    }

    /**
     * Resets the UI to its initial state, clearing all dynamically generated elements.
     */
    function reset() {
        if (elements.canvas) elements.canvas.innerHTML = '';
        if (elements.statusBar) elements.statusBar.textContent = '';
        if (elements.toolbar) elements.toolbar.innerHTML = '';
        isInitialized = false;
    }

    return { show, hide, renderCanvas, reset, getGridCoordinates, updateStatusBar, updateToolbar, toggleGrid, populateAndShowCharSelect, hideCharSelect };
})();

/**
 * @module PaintManager
 * @description The main controller for the paint application. It manages the application's state,
 * user interactions (mouse and keyboard), the canvas data model, and the undo/redo stack.
 */
const PaintManager = (() => {
    "use strict";
    let isActiveState = false, currentFilePath = null, canvasData = [], isDirty = false;
    let isDrawing = false, currentTool = 'pencil', drawChar = PaintAppConfig.DEFAULT_CHAR;
    let fgColor = PaintAppConfig.DEFAULT_FG_COLOR, lastCoords = { x: -1, y: -1 };
    let undoStack = [], redoStack = [], saveUndoStateTimeout = null;
    let isGridVisible = false;

    /**
     * A collection of callbacks passed to the PaintUI module to handle events.
     * @private
     */
    const paintEventCallbacks = {
        onMouseDown: _handleMouseDown,
        onMouseMove: _handleMouseMove,
        onMouseUp: _handleMouseUp,
        onMouseLeave: _handleMouseLeave,
        onToolChange: _setTool,
        onColorChange: _setColor,
        onSaveAndExit: () => exit(true),
        onExit: () => exit(false),
        onUndo: _performUndo,
        onRedo: _performRedo,
        onGridToggle: _toggleGrid,
        onCharSelectOpen: _openCharSelect,
    };

    /**
     * Creates a new, empty 2D array to represent a blank canvas.
     * @private
     * @param {number} w - The width of the canvas.
     * @param {number} h - The height of the canvas.
     * @returns {Array<Array<object>>} The new canvas data model.
     */
    function _createBlankCanvas(w, h) {
        let data = [];
        for (let y = 0; y < h; y++) {
            data.push(Array.from({ length: w }, () => ({
                char: ' ', fg: PaintAppConfig.DEFAULT_FG_COLOR, bg: PaintAppConfig.ERASER_BG_COLOR
            })));
        }
        return data;
    }

    /**
     * Updates the UI toolbar based on the current state of the manager.
     * @private
     */
    function _updateToolbarState() {
        PaintUI.updateToolbar(currentTool, fgColor, undoStack.length > 1, redoStack.length > 0, isGridVisible);
    }

    /**
     * Saves the current canvas state to the undo stack.
     * @private
     */
    function _saveUndoState() {
        redoStack = [];
        undoStack.push(JSON.parse(JSON.stringify(canvasData)));
        if (undoStack.length > PaintAppConfig.EDITOR.MAX_UNDO_STATES) {
            undoStack.shift();
        }
        _updateToolbarState();
    }

    /**
     * Debounces the saving of the undo state to improve performance during rapid drawing.
     * @private
     */
    function _triggerSaveUndoState() {
        if (saveUndoStateTimeout) clearTimeout(saveUndoStateTimeout);
        saveUndoStateTimeout = setTimeout(_saveUndoState, PaintAppConfig.EDITOR.DEBOUNCE_DELAY_MS);
    }

    /**
     * Reverts the canvas to the previous state in the undo stack.
     * @private
     */
    function _performUndo() {
        if (undoStack.length <= 1) return;
        const currentState = undoStack.pop();
        redoStack.push(currentState);
        canvasData = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
    }

    /**
     * Re-applies a state from the redo stack.
     * @private
     */
    function _performRedo() {
        if (redoStack.length === 0) return;
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        canvasData = JSON.parse(JSON.stringify(nextState));
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
    }

    /**
     * Toggles the grid visibility state and updates the UI.
     * @private
     */
    function _toggleGrid() {
        isGridVisible = !isGridVisible;
        PaintUI.toggleGrid(isGridVisible);
        _updateToolbarState();
    }

    /**
     * Opens the character selection modal.
     * @private
     */
    function _openCharSelect() {
        PaintUI.populateAndShowCharSelect(_setDrawCharFromSelection);
    }

    /**
     * Sets the drawing character based on the user's selection from the modal.
     * @private
     * @param {string} char - The character selected by the user.
     */
    function _setDrawCharFromSelection(char) {
        drawChar = char;
        PaintUI.hideCharSelect();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
    }

    /**
     * The core drawing logic. Modifies the canvas data model at specific coordinates based on the current tool.
     * @private
     * @param {number} x - The x-coordinate of the cell to draw on.
     * @param {number} y - The y-coordinate of the cell to draw on.
     */
    function _drawOnCanvas(x, y) {
        if (y < 0 || y >= canvasData.length || x < 0 || x >= canvasData[0].length) return;

        const cell = canvasData[y][x];
        let changed = false;

        if (currentTool === 'pencil') {
            if (cell.char !== drawChar || cell.fg !== fgColor || cell.bg !== PaintAppConfig.DEFAULT_BG_COLOR) {
                cell.char = drawChar;
                cell.fg = fgColor;
                cell.bg = PaintAppConfig.DEFAULT_BG_COLOR;
                changed = true;
            }
        } else if (currentTool === 'eraser') {
            if (cell.char !== PaintAppConfig.ERASER_CHAR || cell.bg !== PaintAppConfig.ERASER_BG_COLOR) {
                cell.char = PaintAppConfig.ERASER_CHAR;
                cell.fg = PaintAppConfig.DEFAULT_FG_COLOR;
                cell.bg = PaintAppConfig.ERASER_BG_COLOR;
                changed = true;
            }
        }

        if (changed) {
            isDirty = true;
            PaintUI.renderCanvas(canvasData);
        }
    }

    /**
     * Handles the mousedown event on the canvas to begin a drawing action.
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    function _handleMouseDown(e) {
        isDrawing = true;
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) {
            lastCoords = coords;
            _drawOnCanvas(coords.x, coords.y);
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords });
        }
    }

    /**
     * Handles the mousemove event to continue a drawing action or update status.
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    function _handleMouseMove(e) {
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) {
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords });
        }
        if (!isDrawing || !coords || (coords.x === lastCoords.x && coords.y === lastCoords.y)) return;

        _drawOnCanvas(coords.x, coords.y);
        lastCoords = coords;
    }

    /**
     * Handles the mouseup event to end a drawing action.
     * @private
     */
    function _handleMouseUp() {
        if (isDrawing && isDirty) {
            _triggerSaveUndoState();
        }
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
    }

    /**
     * Handles the mouseleave event to end a drawing action if the mouse leaves the canvas.
     * @private
     */
    function _handleMouseLeave() {
        if (isDrawing && isDirty) {
            _triggerSaveUndoState();
        }
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
    }

    /**
     * Sets the active drawing tool.
     * @private
     * @param {string} toolName - The name of the tool to activate ('pencil' or 'eraser').
     */
    function _setTool(toolName) {
        currentTool = toolName;
        _updateToolbarState();
    }

    /**
     * Sets the active drawing color.
     * @private
     * @param {string} colorClass - The CSS class of the color to activate.
     */
    function _setColor(colorClass) {
        fgColor = colorClass;
        _updateToolbarState();
    }

    /**
     * Resets all internal state variables to their defaults.
     * @private
     */
    function _resetState() {
        isActiveState = false;
        currentFilePath = null;
        canvasData = [];
        isDirty = false;
        isDrawing = false;
        currentTool = 'pencil';
        drawChar = PaintAppConfig.DEFAULT_CHAR;
        fgColor = PaintAppConfig.DEFAULT_FG_COLOR;
        lastCoords = { x: -1, y: -1 };
        undoStack = [];
        redoStack = [];
        isGridVisible = false;
        if (saveUndoStateTimeout) {
            clearTimeout(saveUndoStateTimeout);
            saveUndoStateTimeout = null;
        }
    }

    /**
     * Serializes the canvas data and saves it to a file in the virtual file system.
     * @private
     * @param {string} filePath - The absolute path to save the file to.
     * @returns {Promise<boolean>} A promise that resolves to true on success, false otherwise.
     */
    async function _performSave(filePath) {
        if (!filePath) {
            await OutputManager.appendToOutput(`Cannot save. No filename specified.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return false;
        }

        const fileData = {
            version: "1.1",
            width: canvasData[0].length,
            height: canvasData.length,
            cells: canvasData
        };
        const jsonContent = JSON.stringify(fileData, null, 2);
        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(filePath, jsonContent, { currentUser, primaryGroup });

        if (saveResult.success) {
            if (await FileSystemManager.save()) {
                await OutputManager.appendToOutput(`Art saved to '${filePath}'.`, { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });
                isDirty = false;
                return true;
            } else {
                await OutputManager.appendToOutput(`Error saving file system after art save.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                return false;
            }
        } else {
            await OutputManager.appendToOutput(`Error saving art: ${saveResult.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return false;
        }
    }

    /**
     * Helper function to re-show the paint UI after a modal confirmation is cancelled.
     * @private
     * @param {string} [logMessage] - An optional message to log to the terminal.
     */
    function _reenterPaint(logMessage) {
        if (logMessage) {
            void OutputManager.appendToOutput(logMessage, {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
        }
        PaintUI.show(paintEventCallbacks);
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
        document.addEventListener('keydown', handleKeyDown);
        TerminalUI.setInputState(false);
    }

    /**
     * Enters the paint application, initializing the UI and state.
     * @param {string|null} filePath - The path of the file to edit, or null for a new file.
     * @param {string} fileContent - The initial content of the file if it exists.
     */
    function enter(filePath, fileContent) {
        if (isActiveState) return;
        isActiveState = true;
        TerminalUI.setInputState(false);
        currentFilePath = filePath;
        isDirty = false;
        currentTool = 'pencil';
        drawChar = PaintAppConfig.DEFAULT_CHAR;
        fgColor = PaintAppConfig.DEFAULT_FG_COLOR;
        isGridVisible = false;

        if (fileContent) {
            let parsedData = null;
            let parseError = null;
            try {
                parsedData = JSON.parse(fileContent);
            } catch (e) {
                parseError = e;
            }

            if (!parseError && parsedData && parsedData.cells && parsedData.width && parsedData.height) {
                canvasData = parsedData.cells;
            } else {
                const errorMessage = parseError ? parseError.message : "Invalid .oopic file format.";
                void OutputManager.appendToOutput(`Error loading paint file: ${errorMessage}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
            }
        } else {
            canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
        }

        undoStack = [JSON.parse(JSON.stringify(canvasData))];
        redoStack = [];

        PaintUI.show(paintEventCallbacks);
        PaintUI.renderCanvas(canvasData);
        PaintUI.toggleGrid(isGridVisible);
        _updateToolbarState();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: {x: -1, y: -1} });

        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * Exits the paint application, handling save logic and confirmation prompts.
     * @param {boolean} [save=false] - If true, attempts to save the file before exiting.
     * @returns {Promise<void>}
     * @async
     */
    async function exit(save = false) {
        if (!isActiveState) return;

        document.removeEventListener('keydown', handleKeyDown);

        if (isDirty && !save) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: ["You have unsaved changes. Are you sure you want to exit and discard them?"],
                    confirmText: "Discard Changes",
                    cancelText: "Keep Painting",
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                });
            });
            if (!confirmed) {
                _reenterPaint();
                return;
            }
        }

        if (save && isDirty) {
            let savePath = currentFilePath;
            let wasSaveSuccessful = false;

            if (savePath) {
                wasSaveSuccessful = await _performSave(savePath);
            } else {
                PaintUI.hide();

                const prospectivePath = await new Promise(resolve => {
                    ModalInputManager.requestInput(
                        "Enter filename to save as (.oopic extension will be added if missing):",
                        (filename) => {
                            if (!filename || filename.trim() === "") {
                                resolve({ path: null, reason: "Save cancelled. No filename provided." });
                            } else {
                                if (!filename.endsWith(`.${PaintAppConfig.FILE_EXTENSION}`)) {
                                    filename += `.${PaintAppConfig.FILE_EXTENSION}`;
                                }
                                resolve({ path: FileSystemManager.getAbsolutePath(filename, FileSystemManager.getCurrentPath()), reason: null });
                            }
                        },
                        () => {
                            resolve({ path: null, reason: "Save cancelled." });
                        },
                        false
                    );
                });

                if (prospectivePath.path) {
                    let proceedWithSave = true;
                    const pathInfo = FileSystemManager.validatePath("paint save", prospectivePath.path, { allowMissing: true });

                    if (pathInfo.node) {
                        const confirmedOverwrite = await new Promise(resolve => {
                            ModalManager.request({
                                context: 'graphical',
                                messageLines: [`File '${prospectivePath.path.split('/').pop()}' already exists. Overwrite?`],
                                onConfirm: () => resolve(true),
                                onCancel: () => resolve(false)
                            });
                        });
                        if (!confirmedOverwrite) {
                            proceedWithSave = false;
                            await OutputManager.appendToOutput("Save cancelled. File not overwritten.", { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                        }
                    }

                    if (proceedWithSave) {
                        wasSaveSuccessful = await _performSave(prospectivePath.path);
                        if(wasSaveSuccessful) {
                            currentFilePath = prospectivePath.path;
                        }
                    }
                } else {
                    await OutputManager.appendToOutput(prospectivePath.reason, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                }
            }

            if (!wasSaveSuccessful) {
                _reenterPaint("Returning to paint editor.");
                return;
            }
        }

        PaintUI.hide();
        PaintUI.reset();
        _resetState();
        TerminalUI.setInputState(true);
        TerminalUI.focusInput();
    }

    /**
     * Global keydown handler for the paint editor, processing shortcuts.
     * @param {KeyboardEvent} event - The keydown event object.
     * @private
     */
    function handleKeyDown(event) {
        if (!isActiveState) return;

        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            if (key === 'z') {
                event.preventDefault(); _performUndo();
            } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault(); _performRedo();
            } else if (key === 's') {
                event.preventDefault(); void exit(true);
            } else if (key === 'o') {
                event.preventDefault(); void exit(false);
            }
            return;
        }

        const key = event.key.toLowerCase();
        const isAppKey = ['p', 'e', 'g', 'c', '1', '2', '3', '4', '5', '6'].includes(key);
        const isCharKey = event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey;

        if (isAppKey) {
            event.preventDefault();
            if (key === 'p') { _setTool('pencil'); }
            else if (key === 'e') { _setTool('eraser'); }
            else if (key === 'g') { _toggleGrid(); }
            else if (key === 'c') { _openCharSelect(); }
            else {
                const colorIndex = parseInt(key, 10) - 1;
                if (colorIndex >= 0 && colorIndex < PaintAppConfig.PALETTE.length) {
                    _setColor(PaintAppConfig.PALETTE[colorIndex].class);
                }
            }
        } else if (isCharKey) {
            event.preventDefault();
            drawChar = event.key;
        }

        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
    }

    return { enter, exit, isActive: () => isActiveState };
})();