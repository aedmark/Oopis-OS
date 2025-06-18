// paint.js - OopisOS ASCII/ANSI Art Editor v1.1 (Drawing Logic Implemented)

const PaintAppConfig = {
    CANVAS: {
        DEFAULT_WIDTH: 80,
        DEFAULT_HEIGHT: 24,
    },
    DEFAULT_CHAR: '#', // NEW: Default to a visible character
    DEFAULT_FG_COLOR: 'text-green-500',
    DEFAULT_BG_COLOR: 'bg-transparent', // NEW: Use transparent BG for drawing
    FILE_EXTENSION: 'oopic',
    CSS_CLASSES: {
        MODAL_HIDDEN: 'hidden',
    },
};

const PaintUI = (() => {
    "use strict";
    let elements = {};
    let isInitialized = false;
    let eventCallbacks = {}; // NEW: To hold callbacks from the manager
    let cellDimensions = { width: 0, height: 0 }; // NEW: To store character size

    function _initDOM(callbacks) {
        if (isInitialized) return true;

        eventCallbacks = callbacks; // NEW: Store callbacks

        elements.modal = document.getElementById('paint-modal');
        elements.toolbar = document.getElementById('paint-toolbar');
        elements.canvas = document.getElementById('paint-canvas');
        elements.statusBar = document.getElementById('paint-statusbar');

        if (!elements.modal || !elements.toolbar || !elements.canvas || !elements.statusBar) {
            console.error("PaintUI: Critical UI elements for the paint modal are missing from the DOM!");
            isInitialized = false;
            return false;
        }

        // NEW: Add all mouse event listeners
        elements.canvas.addEventListener('mousedown', eventCallbacks.onMouseDown);
        elements.canvas.addEventListener('mousemove', eventCallbacks.onMouseMove);
        elements.canvas.addEventListener('mouseup', eventCallbacks.onMouseUp);
        elements.canvas.addEventListener('mouseleave', eventCallbacks.onMouseUp); // Treat leaving as mouse up

        _calculateCellSize();
        isInitialized = true;
        return true;
    }

    // NEW: Dynamically calculate the size of a single character cell
    function _calculateCellSize() {
        if (!elements.canvas) return;
        const testSpan = Utils.createElement('span', { textContent: 'W' });
        elements.canvas.appendChild(testSpan);
        cellDimensions.width = testSpan.offsetWidth;
        cellDimensions.height = testSpan.offsetHeight;
        elements.canvas.removeChild(testSpan);
    }

    // NEW: Translate pixel coordinates to grid coordinates
    function getGridCoordinates(pixelX, pixelY) {
        if (!elements.canvas || cellDimensions.width === 0 || cellDimensions.height === 0) {
            return null;
        }
        const rect = elements.canvas.getBoundingClientRect();
        const localX = pixelX - rect.left;
        const localY = pixelY - rect.top;

        const gridX = Math.floor(localX / cellDimensions.width);
        const gridY = Math.floor(localY / cellDimensions.height);

        return { x: gridX, y: gridY };
    }

    // NEW: Update the status bar with live data
    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        elements.statusBar.textContent = `Tool: ${status.tool} | Char: '${status.char}' | Coords: ${status.coords.x},${status.coords.y}`;
    }

    function show(callbacks) {
        if (!_initDOM(callbacks) || !elements.modal) return;
        elements.modal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
    }

    function hide() {
        if (!_initDOM({}) || !elements.modal) return;

        // NEW: Remove listeners on hide
        elements.canvas.removeEventListener('mousedown', eventCallbacks.onMouseDown);
        elements.canvas.removeEventListener('mousemove', eventCallbacks.onMouseMove);
        elements.canvas.removeEventListener('mouseup', eventCallbacks.onMouseUp);
        elements.canvas.removeEventListener('mouseleave', eventCallbacks.onMouseUp);

        elements.modal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
    }

    function renderCanvas(canvasData) {
        if (!_initDOM({}) || !elements.canvas || !canvasData) return;

        // Using a fragment for performance is excellent.
        const fragment = document.createDocumentFragment();
        canvasData.forEach(row => {
            const rowDiv = Utils.createElement('div');
            row.forEach(cell => {
                const span = Utils.createElement('span', {
                    textContent: cell.char,
                    className: `${cell.fg || ''} ${cell.bg || ''}`.trim()
                });
                rowDiv.appendChild(span);
            });
            fragment.appendChild(rowDiv);
        });

        elements.canvas.innerHTML = '';
        elements.canvas.appendChild(fragment);
    }

    function reset() {
        isInitialized = false;
        eventCallbacks = {};
        elements = {};
    }

    return { show, hide, renderCanvas, reset, getGridCoordinates, updateStatusBar };
})();


const PaintManager = (() => {
    "use strict";
    let isActiveState = false;
    let currentFilePath = null;
    let canvasData = [];
    let isDirty = false;

    // NEW: State for drawing tools
    let isDrawing = false;
    let currentTool = 'pencil';
    let drawChar = PaintAppConfig.DEFAULT_CHAR;
    let fgColor = PaintAppConfig.DEFAULT_FG_COLOR;
    let bgColor = PaintAppConfig.DEFAULT_BG_COLOR;

    function _createBlankCanvas(width, height) {
        const newCanvas = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push({
                    char: ' ', // Start truly blank
                    fg: PaintAppConfig.DEFAULT_FG_COLOR,
                    bg: 'bg-neutral-950', // Match terminal background
                });
            }
            newCanvas.push(row);
        }
        return newCanvas;
    }

    // NEW: The core drawing function
    function _drawOnCanvas(x, y) {
        if (!canvasData[y] || !canvasData[y][x]) return; // Boundary check

        // For now, only the pencil tool is implemented
        if (currentTool === 'pencil') {
            const cell = canvasData[y][x];
            if (cell.char !== drawChar || cell.fg !== fgColor || cell.bg !== bgColor) {
                cell.char = drawChar;
                cell.fg = fgColor;
                cell.bg = bgColor;
                isDirty = true;
                PaintUI.renderCanvas(canvasData);
            }
        }
    }

    // --- NEW: Mouse Event Handlers ---
    function _handleMouseDown(event) {
        isDrawing = true;
        const coords = PaintUI.getGridCoordinates(event.clientX, event.clientY);
        if (coords) {
            _drawOnCanvas(coords.x, coords.y);
        }
    }

    function _handleMouseMove(event) {
        const coords = PaintUI.getGridCoordinates(event.clientX, event.clientY);
        if (coords) {
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, coords: coords });
            if (isDrawing) {
                _drawOnCanvas(coords.x, coords.y);
            }
        }
    }

    function _handleMouseUp(event) {
        isDrawing = false;
    }

    function enter(filePath, fileContent) {
        if (isActiveState) return;

        isActiveState = true;
        OutputManager.setEditorActive(true);
        TerminalUI.setInputState(false);
        currentFilePath = filePath;

        if (fileContent) {
            try {
                const parsed = JSON.parse(fileContent);
                canvasData = parsed.cells;
            } catch (e) {
                canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
            }
        } else {
            canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
        }

        // NEW: Pass callbacks to the UI
        PaintUI.show({
            onMouseDown: _handleMouseDown,
            onMouseMove: _handleMouseMove,
            onMouseUp: _handleMouseUp,
        });
        PaintUI.renderCanvas(canvasData);

        document.addEventListener('keydown', handleKeyDown);
    }

    function exit(save = false) {
        document.removeEventListener('keydown', handleKeyDown);

        PaintUI.hide();
        PaintUI.reset();

        isActiveState = false;
        isDrawing = false; // Reset drawing state
        OutputManager.setEditorActive(false);
        TerminalUI.setInputState(true);
        TerminalUI.focusInput();
    }

    function handleKeyDown(event) {
        if (!isActiveState) return;
        if (event.key.toLowerCase() === 's') {
            event.preventDefault();
            exit(true);
        }
    }

    return {
        enter,
        exit,
        isActive: () => isActiveState,
    };
})();