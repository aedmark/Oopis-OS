const PaintUI = (() => {
    "use strict";

    let elements = {};
    let eventCallbacks = {};
    let canvasDimensions = { width: 0, height: 0 }; // Caches canvas dimensions for coordinate calculation

    /**
     * Creates all DOM elements for the paint application and displays them.
     * @param {object} initialState - The initial state from PaintManager.
     * @param {object} callbacks - The callbacks object from PaintManager.
     */
    function buildAndShow(initialState, callbacks) {
        eventCallbacks = callbacks;
        canvasDimensions = initialState.canvasDimensions; // Store dimensions on build

        // Create main container
        elements.container = Utils.createElement('div', { id: 'paint-container' });

        // Create and assemble toolbar
        _buildToolbar();

        // Create canvas and status bar
        elements.canvasWrapper = Utils.createElement('div', { id: 'paint-canvas-wrapper' });
        elements.canvas = Utils.createElement('div', { id: 'paint-canvas' });
        elements.statusBar = Utils.createElement('div', { id: 'paint-statusbar' });

        elements.canvasWrapper.appendChild(elements.canvas);
        elements.container.append(elements.toolbar, elements.canvasWrapper, elements.statusBar);

        _attachEventListeners();

        AppLayerManager.show(elements.container);

        // Initial render based on state from manager
        renderCanvas(initialState);
        updateToolbar(initialState);
        updateStatusBar(initialState);
    }

    /**
     * Removes the UI from the DOM and clears all element references.
     */
    function hideAndReset() {
        if (elements.container) {
            AppLayerManager.hide();
        }
        elements = {};
        eventCallbacks = {};
        canvasDimensions = { width: 0, height: 0 };
    }

    /**
     * Renders the entire canvas based on the state's canvasData.
     * @param {object} state - The current state from PaintManager.
     */
    function renderCanvas(state) {
        const { canvasData, canvasDimensions, zoomLevel } = state;
        if (!elements.canvas) return;

        elements.canvas.innerHTML = ''; // Clear existing canvas
        elements.canvas.style.gridTemplateColumns = `repeat(${canvasDimensions.width}, 1fr)`;
        elements.canvas.style.gridTemplateRows = `repeat(${canvasDimensions.height}, 1fr)`;

        for (let y = 0; y < canvasDimensions.height; y++) {
            for (let x = 0; x < canvasDimensions.width; x++) {
                const cellData = canvasData[y][x];
                const cellElement = Utils.createElement('span', {
                    textContent: cellData.char,
                    style: {
                        color: cellData.fg,
                        backgroundColor: cellData.bg
                    }
                });
                elements.canvas.appendChild(cellElement);
            }
        }
    }

    /**
     * Updates the toolbar UI to reflect the current application state.
     * @param {object} state - The current state from PaintManager.
     */
    function updateToolbar(state) {
        const { currentTool, undoStack, redoStack } = state;
        const toolButtons = elements.toolbar.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            if (btn.dataset.tool === currentTool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        elements.undoButton.disabled = undoStack.length <= 1;
        elements.redoButton.disabled = redoStack.length === 0;
    }

    /**
     * Updates the status bar text.
     * @param {object} state - The current state from PaintManager.
     */
    function updateStatusBar(state) {
        if (!elements.statusBar) return;
        const { currentTool, activeColor, brushSize, zoomLevel, isDirty } = state;
        const dirtyIndicator = isDirty ? ' *' : '';
        elements.statusBar.textContent = `Tool: ${currentTool} | Color: ${activeColor} | Brush: ${brushSize} | Zoom: ${zoomLevel}%${dirtyIndicator}`;
    }

    /**
     * Toggles the CSS class that shows or hides the grid overlay.
     * @param {boolean} isVisible - Whether the grid should be visible.
     */
    function toggleGrid(isVisible) {
        if (!elements.canvasWrapper) return;
        elements.canvasWrapper.classList.toggle('paint-canvas-wrapper--grid-active', isVisible);
    }

    function _buildToolbar() {
        elements.toolbar = Utils.createElement('div', { id: 'paint-toolbar' });

        const pencilButton = Utils.createElement('button', { textContent: 'Pencil', className: 'tool-btn paint-toolbar__button', 'data-tool': 'pencil' });
        pencilButton.addEventListener('click', () => eventCallbacks.onToolSelect('pencil'));

        const eraserButton = Utils.createElement('button', { textContent: 'Eraser', className: 'tool-btn paint-toolbar__button', 'data-tool': 'eraser' });
        eraserButton.addEventListener('click', () => eventCallbacks.onToolSelect('eraser'));

        elements.undoButton = Utils.createElement('button', { textContent: 'Undo', className: 'paint-toolbar__button' });
        elements.redoButton = Utils.createElement('button', { textContent: 'Redo', className: 'paint-toolbar__button' });
        elements.undoButton.addEventListener('click', () => eventCallbacks.onUndo());
        elements.redoButton.addEventListener('click', () => eventCallbacks.onRedo());

        elements.toolbar.append(pencilButton, eraserButton, elements.undoButton, elements.redoButton);
    }

    function _attachEventListeners() {
        elements.canvas.addEventListener('mousedown', (e) => _handleMouseEvent(e, eventCallbacks.onCanvasMouseDown));
        elements.canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) {
                _handleMouseEvent(e, eventCallbacks.onCanvasMouseMove);
            }
        });
        document.body.addEventListener('mouseup', (e) => {
            // We need to call mouse up even if it's outside the canvas to stop drawing.
            _handleMouseEvent(e, eventCallbacks.onCanvasMouseUp, true);
        });
    }

    function _handleMouseEvent(e, callback, allowOutside = false) {
        if (!callback) return;
        const rect = elements.canvas.getBoundingClientRect();
        const cellWidth = rect.width / canvasDimensions.width;
        const cellHeight = rect.height / canvasDimensions.height;
        const x = Math.floor((e.clientX - rect.left) / cellWidth);
        const y = Math.floor((e.clientY - rect.top) / cellHeight);

        if (allowOutside || (x >= 0 && x < canvasDimensions.width && y >= 0 && y < canvasDimensions.height)) {
            callback({ x, y });
        }
    }

    return {
        buildAndShow,
        hideAndReset,
        renderCanvas,
        updateToolbar,
        updateStatusBar,
        toggleGrid
    };
})();