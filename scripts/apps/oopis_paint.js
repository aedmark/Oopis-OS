/**
 * @file Manages the entire lifecycle and functionality of the OopisOS character-based paint application.
 * This includes the configuration, UI management, and the core state/drawing logic.
 * @author Andrew Edmark
 * @author Gemini
 */

/**
 * @module PaintAppConfig
 * @description Provides a centralized configuration object for the paint application.
 */
const PaintAppConfig = {
    CANVAS: {
        DEFAULT_WIDTH: 80,
        DEFAULT_HEIGHT: 24,
    },
    DEFAULT_CHAR: '#',
    DEFAULT_FG_COLOR: '#22c55e',
    DEFAULT_BG_COLOR: 'transparent',
    ERASER_CHAR: ' ',
    ERASER_BG_COLOR: 'transparent',
    FILE_EXTENSION: 'oopic',
    ASCII_CHAR_RANGE: {
        START: 32,
        END: 126
    },
    BRUSH: {
        DEFAULT_SIZE: 1,
        MAX_SIZE: 10,
        DEFAULT_SHAPE: 'round',
    },
    LOCAL_STORAGE_KEY: 'oopisPaintSettings',
    CSS_CLASSES: {
        MODAL_HIDDEN: 'hidden',
        ACTIVE_TOOL: 'paint-tool-active',
        GRID_ACTIVE: 'paint-grid-active',
        DROPDOWN_ACTIVE: 'paint-dropdown-active',
    },
    PALETTE: [{
        name: 'Black',
        value: '#000000'
    }, {
        name: 'Red',
        value: '#f44336'
    }, {
        name: 'Yellow',
        value: '#ffeb3b'
    }, {
        name: 'Green',
        value: '#4caf50'
    }, {
        name: 'Blue',
        value: '#03a9f4'
    }, {
        name: 'Brown',
        value: '#795548'
    }, ],
    EDITOR: {
        DEBOUNCE_DELAY_MS: 300,
        MAX_UNDO_STATES: 50,
    },
    CUSTOM_COLOR_GRID: [
        // Greyscale Ramp
        '#ffffff', '#f0f0f0', '#e0e0e0', '#cfcfcf', '#bfbfbf', '#afafaf', '#9f9f9f', '#8f8f8f',
        '#7f7f7f', '#6f6f6f', '#5f5f5f', '#4f4f4f', '#3f3f3f', '#2f2f2f', '#1f1f1f', '#000000',
        // Reds -> Pinks
        '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#d32f2f', '#b71c1c', '#880e4f',
        '#f8bbd0', '#f48fb1', '#f06292', '#ec407a', '#e91e63', '#d81b60', '#c2185b', '#ad1457',
        // Oranges -> Browns
        '#ffccbc', '#ffab91', '#ff8a65', '#ff7043', '#ff5722', '#e64a19', '#bf360c', '#8d6e63',
        '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#795548',
        // Yellows
        '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#ffeb3b', '#fdd835', '#fbc02d', '#f57f17',
        // Greens
        '#dcedc8', '#c5e1a5', '#aed581', '#9ccc65', '#8bc34a', '#7cb342', '#689f38', '#33691e',
        '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#1b5e20',
        // Blues & Teals
        '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00796b', '#004d40', '#01579b',
        '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#0288d1', '#0277bd', '#01579b',
        // Purples & Indigos
        '#d1c4e9', '#b39ddb', '#9575cd', '#7e57c2', '#673ab7', '#5e35b1', '#512da8', '#311b92',
        '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0', '#3f51b5', '#3949ab', '#303f9f', '#1a237e'
    ]
};

/**
 * @module PaintUI
 * @description Manages all DOM manipulations and UI logic for the paint editor.
 * It is responsible for building the layout, rendering the canvas, and handling UI events.
 */
const PaintUI = (() => {
    "use strict";
    let elements = {};
    let eventCallbacks = {};
    let isInitialized = false;
    let cellDimensions = {
        width: 0,
        height: 0
    };
    let gridOffset = {
        x: 0,
        y: 0
    };

    /**
     * Constructs the entire DOM structure for the paint application.
     * @param {object} callbacks - An object mapping event names to their handler functions from PaintManager.
     * @returns {HTMLElement} The main container element for the paint application.
     */
    function buildLayout(callbacks) {
        eventCallbacks = callbacks;
        elements = {};

        const paintContainer = Utils.createElement('div', {
            id: 'paint-container'
        });

        elements.toolbar = Utils.createElement('div', {
            id: 'paint-toolbar'
        });
        elements.statusBar = Utils.createElement('div', {
            id: 'paint-statusbar',
            textContent: 'Tool: Pencil | Char: # | Coords: 0,0'
        });
        elements.canvasWrapper = Utils.createElement('div', {
            id: 'paint-canvas-wrapper'
        });
        elements.canvas = Utils.createElement('div', {
            id: 'paint-canvas'
        });

        elements.charSelectModal = _createModal('paint-char-select-modal', 'Select a Character');
        elements.colorSelectModal = _createModal('paint-color-select-modal', 'Select a Color');

        const pencilSVG = '<svg fill="currentColor" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M16 2H17V3H18V4H19V5H20V6H19V7H18V8H17V7H16V6H15V5H14V4H15V3H16M12 6H14V7H15V8H16V10H15V11H14V12H13V13H12V14H11V15H10V16H9V17H8V18H7V19H6V20H2V16H3V15H4V14H5V13H6V12H7V11H8V10H9V9H10V8H11V7H12Z"></path></svg>';
        const eraserSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.9995 13L10.9995 6.00004M20.9995 21H7.99955M10.9368 20.0628L19.6054 11.3941C20.7935 10.2061 21.3875 9.61207 21.6101 8.92709C21.8058 8.32456 21.8058 7.67551 21.6101 7.07298C21.3875 6.388 20.7935 5.79397 19.6054 4.60592L19.3937 4.39415C18.2056 3.2061 17.6116 2.61207 16.9266 2.38951C16.3241 2.19373 15.675 2.19373 15.0725 2.38951C14.3875 2.61207 13.7935 3.2061 12.6054 4.39415L4.39366 12.6059C3.20561 13.794 2.61158 14.388 2.38902 15.073C2.19324 15.6755 2.19324 16.3246 2.38902 16.9271C2.61158 17.6121 3.20561 18.2061 4.39366 19.3941L5.06229 20.0628C5.40819 20.4087 5.58114 20.5816 5.78298 20.7053C5.96192 20.815 6.15701 20.8958 6.36108 20.9448C6.59126 21 6.83585 21 7.32503 21H8.67406C9.16324 21 9.40784 21 9.63801 20.9448C9.84208 20.8958 10.0372 20.815 10.2161 20.7053C10.418 20.5816 10.5909 20.4087 10.9368 20.0628Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
        const shapeSVG = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M9.072 15.25h13.855c0.69-0 1.249-0.56 1.249-1.25 0-0.23-0.062-0.446-0.171-0.631l0.003 0.006-6.927-12c-0.237-0.352-0.633-0.58-1.083-0.58s-0.846 0.228-1.080 0.575l-0.003 0.005-6.928 12c-0.105 0.179-0.167 0.395-0.167 0.625 0 0.69 0.56 1.25 1.25 1.25 0 0 0 0 0.001 0h-0zM16 4.5l4.764 8.25h-9.526zM7.838 16.75c-0.048-0.001-0.104-0.002-0.161-0.002-4.005 0-7.252 3.247-7.252 7.252s3.247 7.252 7.252 7.252c0.056 0 0.113-0.001 0.169-0.002l-0.008 0c0.048 0.001 0.104 0.002 0.161 0.002 4.005 0 7.252-3.247 7.252-7.252s-3.247-7.252-7.252-7.252c-0.056 0-0.113 0.001-0.169 0.002l0.008-0zM7.838 28.75c-0.048 0.002-0.103 0.003-0.16 0.003-2.625 0-4.753-2.128-4.753-4.753s2.128-4.753 4.753-4.753c0.056 0 0.112 0.001 0.168 0.003l-0.008-0c0.048-0.002 0.103-0.003 0.16-0.003 2.625 0 4.753 2.128 4.753 4.753s-2.128 4.753-4.753 4.753c-0.056 0-0.112-0.001-0.168-0.003l0.008 0zM28 16.75h-8c-1.794 0.001-3.249 1.456-3.25 3.25v8c0.001 1.794 1.456 3.249 3.25 3.25h8c1.794-0.001 3.249-1.456 3.25-3.25v-8c-0.001-1.794-1.456-3.249-3.25-3.25h-0zM28.75 28c-0 0.414-0.336 0.75-0.75 0.75h-8c-0.414-0-0.75-0.336-0.75-0.75v0-8c0-0.414 0.336 0.75 0.75 0.75h8c0.414 0 0.75 0.336 0.75 0.75v0z"></path></svg>';
        const dropdownArrowSVG = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:0.8em; height:0.8em; margin-left:4px;"><path d="M7 10l5 5 5-5z"></path></svg>';

        elements.saveBtn = Utils.createElement('button', {
            className: 'paint-tool',
            textContent: 'Save',
            title: 'Save (Ctrl+S)',
            eventListeners: {
                click: () => eventCallbacks.onSave()
            }
        });
        elements.exitBtn = Utils.createElement('button', {
            className: 'paint-tool paint-exit-btn',
            textContent: 'Exit',
            title: 'Exit (Ctrl+Q)',
            eventListeners: {
                click: () => eventCallbacks.onExit()
            }
        });

        elements.pencilBtn = Utils.createElement('button', {
            className: 'paint-tool',
            innerHTML: pencilSVG,
            title: 'Pencil (P)',
            eventListeners: {
                click: () => eventCallbacks.onToolChange('pencil')
            }
        });
        elements.eraserBtn = Utils.createElement('button', {
            className: 'paint-tool',
            innerHTML: eraserSVG,
            title: 'Eraser (E)',
            eventListeners: {
                click: () => eventCallbacks.onToolChange('eraser')
            }
        });

        elements.shapeToolContainer = Utils.createElement('div', {
            className: 'paint-tool-dropdown'
        });
        elements.shapeSelectBtn = Utils.createElement('button', {
            className: 'paint-tool',
            innerHTML: shapeSVG + dropdownArrowSVG,
            title: 'Shape Tools (L)',
            eventListeners: {
                click: (e) => {
                    e.stopPropagation();
                    eventCallbacks.onShapeSelectToggle();
                }
            }
        });
        elements.shapeDropdown = Utils.createElement('div', {
            id: 'paint-shape-dropdown',
            className: 'paint-dropdown-content'
        });

        const toolsGroup = Utils.createElement('div', {
            className: 'paint-toolbar-group'
        }, [elements.pencilBtn, elements.eraserBtn, elements.shapeToolContainer]);
        const sessionGroup = Utils.createElement('div', {
            className: 'paint-toolbar-group paint-session-group'
        }, [elements.saveBtn, elements.exitBtn]);

        elements.toolbar.append(toolsGroup, sessionGroup);
        elements.canvasWrapper.appendChild(elements.canvas);
        paintContainer.append(elements.toolbar, elements.canvasWrapper, elements.statusBar, elements.charSelectModal, elements.colorSelectModal);

        elements.canvas.addEventListener('mousedown', eventCallbacks.onMouseDown);
        document.addEventListener('mousemove', eventCallbacks.onMouseMove);
        document.addEventListener('mouseup', eventCallbacks.onMouseUp);
        elements.canvas.addEventListener('mouseleave', eventCallbacks.onMouseLeave);
        elements.canvas.addEventListener('contextmenu', e => e.preventDefault());

        eventCallbacks.onDocumentClick = (e) => {
            if (isInitialized) {
                if (elements.shapeToolContainer && !elements.shapeToolContainer.contains(e.target)) {
                    elements.shapeDropdown.classList.remove(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
                }
            }
        };
        document.addEventListener('click', eventCallbacks.onDocumentClick);

        isInitialized = true;
        return paintContainer;
    }

    /**
     * Creates a standard modal overlay structure.
     * @private
     * @param {string} id - The DOM ID for the modal overlay.
     * @param {string} titleText - The title to display in the modal's header.
     * @returns {HTMLElement} The created modal overlay element.
     */
    function _createModal(id, titleText) {
        const modalOverlay = Utils.createElement('div', {
            id: id,
            className: `paint-modal-overlay ${PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN}`
        });
        const modalContent = Utils.createElement('div', {
            className: 'paint-modal-content'
        });
        const modalTitle = Utils.createElement('div', {
            className: 'paint-modal-title',
            textContent: titleText
        });
        const modalBody = Utils.createElement('div', {
            className: 'paint-modal-body'
        });
        modalContent.append(modalTitle, modalBody);
        modalOverlay.appendChild(modalContent);

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
            }
        });
        return modalOverlay;
    }

    /**
     * Tears down the UI and removes event listeners to prevent memory leaks.
     */
    function destroyLayout() {
        if (!isInitialized) return;
        document.removeEventListener('mousemove', eventCallbacks.onMouseMove);
        document.removeEventListener('mouseup', eventCallbacks.onMouseUp);
        document.removeEventListener('click', eventCallbacks.onDocumentClick);
        elements = {};
        eventCallbacks = {};
        isInitialized = false;
    }

    /**
     * Renders the canvas based on the 2D array of cell data.
     * @param {Array<Array<object>>} canvasData - The 2D array representing the canvas state.
     */
    function renderCanvas(canvasData) {
        if (!isInitialized || !elements.canvas) return;
        elements.canvas.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const gridWidth = canvasData[0]?.length || PaintAppConfig.CANVAS.DEFAULT_WIDTH;
        const gridHeight = canvasData.length || PaintAppConfig.CANVAS.DEFAULT_HEIGHT;
        elements.canvas.style.gridTemplateColumns = `repeat(${gridWidth}, 1fr)`;
        elements.canvas.style.gridTemplateRows = `repeat(${gridHeight}, 1fr)`;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = canvasData[y]?.[x] || {
                    char: ' ',
                    fg: PaintAppConfig.DEFAULT_FG_COLOR,
                    bg: 'transparent'
                };
                const span = Utils.createElement('span', {
                    textContent: cell.char || ' '
                });
                span.style.color = cell.fg;
                span.style.backgroundColor = cell.bg;
                fragment.appendChild(span);
            }
        }
        elements.canvas.appendChild(fragment);
    }

    /**
     * Updates the toolbar UI to reflect the current tool and settings.
     * @param {string} activeTool - The name of the currently active tool.
     * @param {boolean} isGridActive - Whether the grid overlay is active.
     */
    function updateToolbar(activeTool, isGridActive) {
        if (!isInitialized) return;
        const {
            ACTIVE_TOOL
        } = PaintAppConfig.CSS_CLASSES;
        elements.pencilBtn.classList.toggle(ACTIVE_TOOL, activeTool === 'pencil');
        elements.eraserBtn.classList.toggle(ACTIVE_TOOL, activeTool === 'eraser');

        const isShapeToolActive = ['line', 'quad', 'ellipse'].includes(activeTool);
        elements.shapeSelectBtn.classList.toggle(ACTIVE_TOOL, isShapeToolActive);
    }

    /**
     * Gets the canvas grid coordinates from mouse event pixel coordinates.
     * @param {number} pixelX - The clientX from a mouse event.
     * @param {number} pixelY - The clientY from a mouse event.
     * @returns {{x: number, y: number}|null} The grid coordinates or null if outside the canvas.
     */
    function getGridCoordinates(pixelX, pixelY) {
        if (!elements.canvas) return null;
        const rect = elements.canvas.getBoundingClientRect();
        const x = pixelX - rect.left;
        const y = pixelY - rect.top;
        const gridX = Math.floor(x / (rect.width / PaintAppConfig.CANVAS.DEFAULT_WIDTH));
        const gridY = Math.floor(y / (rect.height / PaintAppConfig.CANVAS.DEFAULT_HEIGHT));

        if (gridX < 0 || gridX >= PaintAppConfig.CANVAS.DEFAULT_WIDTH || gridY < 0 || gridY >= PaintAppConfig.CANVAS.DEFAULT_HEIGHT) return null;
        return {
            x: gridX,
            y: gridY
        };
    }

    /**
     * Updates the content of the status bar.
     * @param {object} status - An object containing the current status information.
     * @param {string} status.fileName - The name of the current file.
     * @param {boolean} status.isDirty - Whether the file has unsaved changes.
     * @param {string} status.tool - The name of the active tool.
     * @param {string} status.char - The currently selected drawing character.
     * @param {{x: number, y: number}} status.coords - The current cursor coordinates.
     */
    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        const dirtyIndicator = status.isDirty ? "*" : "";
        const fileName = (status.fileName || "Untitled") + dirtyIndicator;
        elements.statusBar.textContent = `File: ${fileName} | Tool: ${status.tool} | Char: '${status.char}' | Coords: ${status.coords.x ?? '-'},${status.coords.y ?? '-'}`;
    }


    return {
        buildLayout,
        destroyLayout,
        renderCanvas,
        getGridCoordinates,
        updateStatusBar,
        updateToolbar
    };
})();

/**
 * @module PaintManager
 * @description The main controller for the paint application. Manages state, user interactions,
 * and coordinates between the UI (PaintUI) and the file system.
 */
const PaintManager = (() => {
    "use strict";
    let isActiveState = false,
        currentFilePath = null,
        canvasData = [],
        isDirty = false;
    let isDrawing = false,
        currentTool = 'pencil',
        drawChar = PaintAppConfig.DEFAULT_CHAR;
    let fgColor = PaintAppConfig.PALETTE[0].value,
        lastCoords = {
            x: -1,
            y: -1
        };
    let undoStack = [],
        redoStack = [],
        saveUndoStateTimeout = null;
    let isGridVisible = false,
        isTempFile = false;
    let shapeStartCoords = null;
    let shapePreviewBaseState = null;
    let brushSize = PaintAppConfig.BRUSH.DEFAULT_SIZE;
    let brushShape = PaintAppConfig.BRUSH.DEFAULT_SHAPE;

    /**
     * @const {object} paintEventCallbacks - An object containing all callback functions passed to the PaintUI module.
     */
    const paintEventCallbacks = {
        onMouseDown: _handleMouseDown,
        onMouseMove: _handleMouseMove,
        onMouseUp: _handleMouseUp,
        onMouseLeave: _handleMouseLeave,
        onToolChange: _setTool,
        onSave: () => _handleSave(),
        onExit: () => exit(),
        onShapeSelectToggle: () => PaintUI.toggleDropdown('shape')
    };

    /**
     * Implements Bresenham's line algorithm to get all points between two coordinates.
     * @private
     * @param {number} x0 - Start X coordinate.
     * @param {number} y0 - Start Y coordinate.
     * @param {number} x1 - End X coordinate.
     * @param {number} y1 - End Y coordinate.
     * @returns {Array<{x: number, y: number}>} An array of points on the line.
     */
    function _getLinePoints(x0, y0, x1, y1) {
        const points = [];
        const dx = Math.abs(x1 - x0),
            dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1,
            sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        while (true) {
            points.push({
                x: x0,
                y: y0
            });
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
        return points;
    }

    /**
     * Creates a blank canvas data structure.
     * @private
     * @param {number} w - The width of the canvas.
     * @param {number} h - The height of the canvas.
     * @returns {Array<Array<object>>} A 2D array representing the blank canvas.
     */
    function _createBlankCanvas(w, h) {
        return Array.from({
            length: h
        }, () => Array.from({
            length: w
        }, () => ({
            char: ' ',
            fg: PaintAppConfig.DEFAULT_FG_COLOR,
            bg: PaintAppConfig.DEFAULT_BG_COLOR
        })));
    }

    /**
     * Updates the status bar UI with the current state.
     * @private
     * @param {object} coords - The current cursor coordinates.
     */
    function _updateStatus(coords) {
        PaintUI.updateStatusBar({
            tool: currentTool,
            char: drawChar,
            coords: coords || lastCoords,
            fileName: currentFilePath,
            isDirty: isDirty
        });
    }

    /**
     * Saves the current canvas state to the undo stack.
     * @private
     */
    function _saveUndoState() {
        redoStack = [];
        const currentState = JSON.parse(JSON.stringify(canvasData));
        const lastState = undoStack[undoStack.length - 1];
        if (JSON.stringify(currentState) === JSON.stringify(lastState)) return;
        undoStack.push(currentState);
        if (undoStack.length > PaintAppConfig.EDITOR.MAX_UNDO_STATES) undoStack.shift();
        isDirty = true;
        _updateStatus(lastCoords);
    }

    /**
     * Triggers a debounced save to the undo stack.
     * @private
     */
    function _triggerSaveUndoState() {
        if (saveUndoStateTimeout) clearTimeout(saveUndoStateTimeout);
        saveUndoStateTimeout = setTimeout(_saveUndoState, PaintAppConfig.EDITOR.DEBOUNCE_DELAY_MS);
    }

    /**
     * Paints a single cell on a given canvas data structure.
     * @private
     * @param {number} x - The X coordinate of the cell.
     * @param {number} y - The Y coordinate of the cell.
     * @param {Array<Array<object>>} targetCanvas - The canvas data to modify.
     * @returns {boolean} True if the cell was changed, false otherwise.
     */
    function _paintCell(x, y, targetCanvas) {
        const canvas = targetCanvas || canvasData;
        if (y < 0 || y >= canvas.length || x < 0 || x >= canvas[0].length) return false;
        const cell = canvas[y][x];
        const isEraser = currentTool === 'eraser';
        const newChar = isEraser ? PaintAppConfig.ERASER_CHAR : drawChar;
        const newFg = isEraser ? PaintAppConfig.DEFAULT_FG_COLOR : fgColor;
        const newBg = isEraser ? PaintAppConfig.ERASER_BG_COLOR : PaintAppConfig.DEFAULT_BG_COLOR;
        if (cell.char !== newChar || cell.fg !== newFg || cell.bg !== newBg) {
            cell.char = newChar;
            cell.fg = newFg;
            cell.bg = newBg;
            return true;
        }
        return false;
    }

    /**
     * Draws on the canvas using the current brush settings.
     * @private
     * @param {number} x - The center X coordinate of the brush.
     * @param {number} y - The center Y coordinate of the brush.
     * @param {Array<Array<object>>} [targetCanvas=null] - An optional temporary canvas for previews.
     */
    function _drawOnCanvas(x, y, targetCanvas = null) {
        const radius = (brushSize - 1) / 2;
        for (let i = 0; i < brushSize; i++) {
            for (let j = 0; j < brushSize; j++) {
                const drawX = Math.round(x - radius + i);
                const drawY = Math.round(y - radius + j);
                let shouldPaint = brushShape === 'square' || Math.hypot(drawX - x, drawY - y) <= radius;
                if (shouldPaint) _paintCell(drawX, drawY, targetCanvas);
            }
        }
    }

    /**
     * Handles the mousedown event on the canvas to start drawing.
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    function _handleMouseDown(e) {
        if (e.button !== 0) return;
        isDrawing = true;
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (!coords) return;
        lastCoords = coords;
        _updateStatus(coords);
        if (['line', 'ellipse', 'quad'].includes(currentTool)) {
            shapeStartCoords = { ...coords
            };
            shapePreviewBaseState = JSON.parse(JSON.stringify(canvasData));
        } else {
            _triggerSaveUndoState();
            _drawOnCanvas(coords.x, coords.y);
            PaintUI.renderCanvas(canvasData);
        }
    }

    /**
     * Handles the mousemove event to draw continuously or preview shapes.
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    function _handleMouseMove(e) {
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) _updateStatus(coords);
        if (!isDrawing || !coords) return;
        if (currentTool === 'pencil' || currentTool === 'eraser') {
            if (coords.x === lastCoords.x && coords.y === lastCoords.y) return;
            _getLinePoints(lastCoords.x, lastCoords.y, coords.x, coords.y).forEach(p => _drawOnCanvas(p.x, p.y));
            lastCoords = coords;
            PaintUI.renderCanvas(canvasData);
        } else if (shapeStartCoords) {
            let tempCanvas = JSON.parse(JSON.stringify(shapePreviewBaseState));
            _getLinePoints(shapeStartCoords.x, shapeStartCoords.y, coords.x, coords.y).forEach(p => _paintCell(p.x, p.y, tempCanvas));
            PaintUI.renderCanvas(tempCanvas);
        }
    }

    /**
     * Handles the mouseup event to finalize a drawing action.
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    function _handleMouseUp(e) {
        if (!isDrawing) return;
        isDrawing = false;
        if (shapeStartCoords) {
            canvasData = JSON.parse(JSON.stringify(shapePreviewBaseState));
            const endCoords = PaintUI.getGridCoordinates(e.clientX, e.clientY) || lastCoords;
            _getLinePoints(shapeStartCoords.x, shapeStartCoords.y, endCoords.x, endCoords.y).forEach(p => _paintCell(p.x, p.y, canvasData));
        }
        _saveUndoState();
        PaintUI.renderCanvas(canvasData);
        shapeStartCoords = null;
        shapePreviewBaseState = null;
    }

    /**
     * Handles the mouseleave event to stop drawing if the cursor leaves the canvas.
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    function _handleMouseLeave(e) {
        if (isDrawing) _handleMouseUp(e);
        _updateStatus({
            x: null,
            y: null
        });
    }

    /**
     * Sets the active drawing tool.
     * @private
     * @param {string} toolName - The name of the tool to activate ('pencil', 'eraser', etc.).
     */
    function _setTool(toolName) {
        currentTool = toolName;
        PaintUI.updateToolbar(currentTool, isGridVisible);
    }

    /**
     * Resets the entire state of the paint manager.
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
        fgColor = PaintAppConfig.PALETTE[0].value;
        lastCoords = {
            x: -1,
            y: -1
        };
        undoStack = [];
        redoStack = [];
        isGridVisible = false;
        isTempFile = false;
        shapeStartCoords = null;
        shapePreviewBaseState = null;
        brushSize = PaintAppConfig.BRUSH.DEFAULT_SIZE;
        brushShape = PaintAppConfig.BRUSH.DEFAULT_SHAPE;
        if (saveUndoStateTimeout) clearTimeout(saveUndoStateTimeout);
    }

    /**
     * Saves the current canvas to a file in the virtual file system.
     * @private
     * @param {string} filePath - The absolute path to save the file to.
     * @returns {Promise<{success: boolean, error?: string}>} The result of the save operation.
     * @async
     */
    async function _performSave(filePath) {
        if (!filePath) return {
            success: false,
            error: 'No filename specified.'
        };
        const fileData = {
            version: "1.1",
            width: canvasData[0].length,
            height: canvasData.length,
            cells: canvasData
        };
        const jsonContent = JSON.stringify(fileData);
        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        if (!primaryGroup) return {
            success: false,
            error: "Critical error: Could not determine primary group for user."
        };

        const saveResult = await FileSystemManager.createOrUpdateFile(filePath, jsonContent, {
            currentUser,
            primaryGroup
        });
        if (saveResult.success) {
            await FileSystemManager.save();
            return {
                success: true
            };
        } else {
            return {
                success: false,
                error: saveResult.error
            };
        }
    }

    /**
     * Handles the user-initiated save action, including prompting for a filename if needed.
     * @private
     * @async
     */
    async function _handleSave() {
        if (!isActiveState) return;
        let savePath = currentFilePath;
        if (isTempFile) {
            const newFilename = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical-input',
                    messageLines: ["Save:"],
                    placeholder: "my-art.oopic",
                    confirmText: "Save",
                    cancelText: "Cancel",
                    onConfirm: (value) => resolve(value.trim() || null),
                    onCancel: () => resolve(null)
                });
            });

            if (!newFilename) {
                await OutputManager.appendToOutput("Save cancelled.", {
                    typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG
                });
                return;
            }
            savePath = FileSystemManager.getAbsolutePath(newFilename);
        }

        if (!savePath.endsWith(`.${PaintAppConfig.FILE_EXTENSION}`)) {
            savePath += `.${PaintAppConfig.FILE_EXTENSION}`;
        }

        const saveResult = await _performSave(savePath);

        if (saveResult.success) {
            const oldPathIfTemp = isTempFile ? currentFilePath : null;
            if (oldPathIfTemp && oldPathIfTemp !== savePath) {
                await FileSystemManager.deleteNodeRecursive(oldPathIfTemp, {
                    force: true,
                    currentUser: UserManager.getCurrentUser().name
                });
                await FileSystemManager.save();
            }
            currentFilePath = savePath;
            isTempFile = false;
            isDirty = false;
            await OutputManager.appendToOutput(`Art saved to '${savePath}'.`, {
                typeClass: Config.CSS_CLASSES.SUCCESS_MSG
            });
            _updateStatus(lastCoords);
        } else {
            await OutputManager.appendToOutput(`Error saving art: ${saveResult.error}`, {
                typeClass: Config.CSS_CLASSES.ERROR_MSG
            });
        }
    }

    /**
     * Enters the paint application, initializing state and UI.
     * @param {string} filePath - The path of the file to open, or null for a new file.
     * @param {string} fileContent - The content of the file if it exists.
     * @async
     */
    async function enter(filePath, fileContent) {
        if (isActiveState) return;
        _resetState();
        isActiveState = true;
        TerminalUI.setInputState(false);

        if (filePath) {
            currentFilePath = filePath;
            if (fileContent) {
                try {
                    const parsedData = JSON.parse(fileContent);
                    if (parsedData && parsedData.cells) canvasData = parsedData.cells;
                    else throw new Error("Invalid .oopic file format.");
                } catch (e) {
                    await OutputManager.appendToOutput(`Error loading paint file: ${e.message}`, {
                        typeClass: Config.CSS_CLASSES.ERROR_MSG
                    });
                    canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
                }
            } else {
                canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
            }
        } else {
            isTempFile = true;
            const tempName = `temp_paint_${Date.now()}.${PaintAppConfig.FILE_EXTENSION}`;
            currentFilePath = FileSystemManager.getAbsolutePath(tempName, FileSystemManager.getCurrentPath());
            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            const blankCanvasData = {
                version: "1.1",
                width: PaintAppConfig.CANVAS.DEFAULT_WIDTH,
                height: PaintAppConfig.CANVAS.DEFAULT_HEIGHT,
                cells: _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT)
            };
            await FileSystemManager.createOrUpdateFile(currentFilePath, JSON.stringify(blankCanvasData), {
                currentUser,
                primaryGroup
            });
            await FileSystemManager.save();
            canvasData = blankCanvasData.cells;
        }

        undoStack = [JSON.parse(JSON.stringify(canvasData))];
        const paintElement = PaintUI.buildLayout(paintEventCallbacks);
        AppLayerManager.show(paintElement);

        PaintUI.renderCanvas(canvasData);
        PaintUI.updateToolbar(currentTool, isGridVisible);
        _updateStatus({
            x: null,
            y: null
        });
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * Exits the paint application, handling unsaved changes prompts.
     * @async
     */
    async function exit() {
        if (!isActiveState) return;

        const performExit = async () => {
            if (isTempFile) {
                await FileSystemManager.deleteNodeRecursive(currentFilePath, {
                    force: true,
                    currentUser: UserManager.getCurrentUser().name
                });
                await FileSystemManager.save();
            }
            AppLayerManager.hide();
            document.removeEventListener('keydown', handleKeyDown);
            PaintUI.destroyLayout();
            _resetState();
        };

        if (isDirty) {
            ModalManager.request({
                context: 'graphical',
                messageLines: ["You have unsaved changes.", "Are you sure you want to exit without saving?"],
                onConfirm: performExit,
                onCancel: () => {},
                confirmText: 'Discard',
                cancelText: 'Cancel'
            });
        } else {
            await performExit();
        }
    }

    /**
     * Handles global keydown events when the paint application is active.
     * @param {KeyboardEvent} event - The keyboard event.
     */
    function handleKeyDown(event) {
        if (!isActiveState || event.target.closest('.paint-hex-input, .graphical-modal-input-field')) return;

        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 's':
                    event.preventDefault();
                    _handleSave();
                    break;
                case 'q':
                    event.preventDefault();
                    exit();
                    break;
            }
            return;
        }

        const key = event.key.toLowerCase();
        if (['p', 'e', 'l'].includes(key)) {
            event.preventDefault();
            if (key === 'p') _setTool('pencil');
            else if (key === 'e') _setTool('eraser');
            else if (key === 'l') {
                const shapeTools = ['line', 'quad', 'ellipse'];
                const currentIndex = shapeTools.indexOf(currentTool);
                _setTool(shapeTools[(currentIndex + 1) % shapeTools.length]);
            }
        } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            event.preventDefault();
            drawChar = event.key;
            _updateStatus(lastCoords);
        }
    }

    return {
        /**
         * Checks if the paint application is currently active.
         * @returns {boolean} True if active, false otherwise.
         */
        isActive: () => isActiveState,
        enter,
        exit,
    };
})();