const PaintUI = (() => {
    "use strict";

    let elements = {};
    let eventCallbacks = {};
    let canvasDimensions = { width: 0, height: 0 };

    function buildAndShow(initialState, callbacks) {
        eventCallbacks = callbacks;
        canvasDimensions = initialState.canvasDimensions;

        elements.container = Utils.createElement('div', { id: 'paint-container' });

        _buildToolbar(initialState);

        elements.canvasWrapper = Utils.createElement('div', { id: 'paint-canvas-wrapper' });
        elements.canvas = Utils.createElement('div', { id: 'paint-canvas' });
        elements.statusBar = Utils.createElement('div', { id: 'paint-statusbar' });

        elements.canvasWrapper.appendChild(elements.canvas);
        elements.container.append(elements.toolbar, elements.canvasWrapper, elements.statusBar);

        _attachEventListeners();

        AppLayerManager.show(elements.container);

        renderCanvas(initialState);
        updateToolbar(initialState);
        updateStatusBar(initialState);
    }

    function hideAndReset() {
        if (elements.container) {
            AppLayerManager.hide();
        }
        elements = {};
        eventCallbacks = {};
        canvasDimensions = { width: 0, height: 0 };
    }

    function renderCanvas(state) {
        const { canvasData, canvasDimensions, zoomLevel } = state;
        if (!elements.canvas) return;

        elements.canvas.innerHTML = '';
        elements.canvas.style.gridTemplateColumns = `repeat(${canvasDimensions.width}, 1fr)`;
        elements.canvas.style.gridTemplateRows = `repeat(${canvasDimensions.height}, 1fr)`;
        elements.canvas.style.fontSize = `${zoomLevel / 100}em`;


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

    function updateToolbar(state) {
        const { currentTool, undoStack, redoStack, brushSize, activeCharacter, activeColor, isGridVisible } = state;
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

        elements.brushSizeSpan.textContent = brushSize;
        elements.charDisplay.textContent = activeCharacter;

        const colorSwatches = elements.toolbar.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            if (swatch.dataset.color === activeColor) {
                swatch.classList.add('active');
            } else {
                swatch.classList.remove('active');
            }
        });

        elements.gridButton.classList.toggle('active', isGridVisible);
    }

    function updateStatusBar(state) {
        if (!elements.statusBar) return;
        const { currentTool, activeColor, brushSize, zoomLevel, isDirty } = state;
        const dirtyIndicator = isDirty ? ' *' : '';
        elements.statusBar.textContent = `Tool: ${currentTool} | Color: ${activeColor} | Brush: ${brushSize} | Zoom: ${zoomLevel}%${dirtyIndicator}`;
    }

    function toggleGrid(isVisible) {
        if (!elements.canvasWrapper) return;
        elements.canvasWrapper.classList.toggle('paint-canvas-wrapper--grid-active', isVisible);
    }

    function _buildToolbar(initialState) {
        elements.toolbar = Utils.createElement('div', { id: 'paint-toolbar' });

        // Tool Group
        const toolGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        const pencilButton = Utils.createElement('button', { textContent: 'Pencil', className: 'tool-btn paint-toolbar__button', 'data-tool': 'pencil' });
        pencilButton.addEventListener('click', () => eventCallbacks.onToolSelect('pencil'));
        const eraserButton = Utils.createElement('button', { textContent: 'Eraser', className: 'tool-btn paint-toolbar__button', 'data-tool': 'eraser' });
        eraserButton.addEventListener('click', () => eventCallbacks.onToolSelect('eraser'));
        toolGroup.append(pencilButton, eraserButton);

        // Brush Size Group
        const brushGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        const brushMinusButton = Utils.createElement('button', { textContent: '-', className: 'paint-toolbar__button' });
        brushMinusButton.addEventListener('click', () => eventCallbacks.onBrushSizeChange(-1));
        elements.brushSizeSpan = Utils.createElement('span', { textContent: initialState.brushSize, className: 'paint-toolbar__button' });
        const brushPlusButton = Utils.createElement('button', { textContent: '+', className: 'paint-toolbar__button' });
        brushPlusButton.addEventListener('click', () => eventCallbacks.onBrushSizeChange(1));
        brushGroup.append(brushMinusButton, elements.brushSizeSpan, brushPlusButton);

        // Character Group
        const charGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        elements.charDisplay = Utils.createElement('button', { textContent: initialState.activeCharacter, className: 'paint-toolbar__button' });
        elements.charDisplay.addEventListener('click', () => _showCharModal());
        charGroup.append(elements.charDisplay);

        // Color Group
        const colorGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];
        colors.forEach(color => {
            const swatch = Utils.createElement('button', { className: 'color-swatch paint-toolbar__button', style: { backgroundColor: color }, 'data-color': color });
            swatch.addEventListener('click', () => eventCallbacks.onColorSelect(color));
            colorGroup.appendChild(swatch);
        });

        // Action Group
        const actionGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        elements.undoButton = Utils.createElement('button', { textContent: 'Undo', className: 'paint-toolbar__button' });
        elements.redoButton = Utils.createElement('button', { textContent: 'Redo', className: 'paint-toolbar__button' });
        elements.undoButton.addEventListener('click', () => eventCallbacks.onUndo());
        elements.redoButton.addEventListener('click', () => eventCallbacks.onRedo());
        actionGroup.append(elements.undoButton, elements.redoButton);

        // View Group
        const viewGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        elements.gridButton = Utils.createElement('button', { textContent: 'Grid', className: 'paint-toolbar__button' });
        elements.gridButton.addEventListener('click', () => eventCallbacks.onGridToggle());
        viewGroup.append(elements.gridButton);

        elements.toolbar.append(toolGroup, brushGroup, charGroup, colorGroup, actionGroup, viewGroup);
    }

    function _showCharModal() {
        const charModalBody = Utils.createElement('div', { className: 'paint-modal-body' });
        const chars = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'.split('');

        chars.forEach(char => {
            const charButton = Utils.createElement('button', { textContent: char, className: 'paint-toolbar__button' });
            charButton.addEventListener('click', () => {
                eventCallbacks.onCharSelect(char);
                ModalManager.hide();
            });
            charModalBody.appendChild(charButton);
        });

        ModalManager.request({
            context: 'graphical',
            title: 'Select Character',
            body: charModalBody,
            hideConfirm: true,
            cancelText: "Close"
        });
    }

    function _attachEventListeners() {
        elements.canvas.addEventListener('mousedown', (e) => _handleMouseEvent(e, eventCallbacks.onCanvasMouseDown));
        elements.canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) {
                _handleMouseEvent(e, eventCallbacks.onCanvasMouseMove);
            }
        });
        document.body.addEventListener('mouseup', (e) => {
            if (state.isDrawing) {
                _handleMouseEvent(e, eventCallbacks.onCanvasMouseUp, true);
            }
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