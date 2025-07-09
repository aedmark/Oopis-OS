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
        const { canvasData, canvasDimensions } = state;
        if (!elements.canvas) return;

        elements.canvas.innerHTML = '';
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

    function updateToolbar(state) {
        const { currentTool, undoStack, redoStack, brushSize, activeCharacter, activeColor, isGridVisible } = state;
        const toolButtons = elements.toolbar.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === currentTool);
        });

        elements.undoButton.disabled = undoStack.length <= 1;
        elements.redoButton.disabled = redoStack.length === 0;

        elements.brushSizeSpan.textContent = brushSize;
        elements.charDisplay.textContent = activeCharacter;

        const colorSwatches = elements.toolbar.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            swatch.classList.toggle('active', swatch.dataset.color === activeColor);
        });

        elements.gridButton.classList.toggle('active', isGridVisible);
    }

    function updateStatusBar(state) {
        if (!elements.statusBar) return;
        const { currentTool, activeColor, brushSize, isDirty, mouseCoords } = state;
        const dirtyIndicator = isDirty ? ' *' : '';
        const coordsText = mouseCoords.x !== -1 ? `[${mouseCoords.x}, ${mouseCoords.y}]` : '';
        elements.statusBar.textContent = `Tool: ${currentTool} | Char: ${state.activeCharacter} | Brush: ${brushSize} | ${coordsText}${dirtyIndicator}`;
    }

    function toggleGrid(isVisible) {
        if (!elements.canvasWrapper) return;
        elements.canvasWrapper.classList.toggle('paint-canvas-wrapper--grid-active', isVisible);
    }

    function _buildToolbar(initialState) {
        elements.toolbar = Utils.createElement('div', { id: 'paint-toolbar' });

        const createToolButton = (text, tool) => {
            const btn = Utils.createElement('button', { textContent: text, className: 'tool-btn paint-toolbar__button', 'data-tool': tool });
            btn.addEventListener('click', () => eventCallbacks.onToolSelect(tool));
            return btn;
        };

        const toolGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        toolGroup.append(
            createToolButton('Pencil', 'pencil'),
            createToolButton('Eraser', 'eraser'),
            createToolButton('Line', 'line'),
            createToolButton('Rect', 'rect')
        );

        const brushGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        const brushMinusButton = Utils.createElement('button', { textContent: '-', className: 'paint-toolbar__button' });
        brushMinusButton.addEventListener('click', () => eventCallbacks.onBrushSizeChange(-1));
        elements.brushSizeSpan = Utils.createElement('span', { textContent: initialState.brushSize, className: 'paint-toolbar__button' });
        const brushPlusButton = Utils.createElement('button', { textContent: '+', className: 'paint-toolbar__button' });
        brushPlusButton.addEventListener('click', () => eventCallbacks.onBrushSizeChange(1));
        brushGroup.append(brushMinusButton, elements.brushSizeSpan, brushPlusButton);

        const colorGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];
        colors.forEach(color => {
            const swatch = Utils.createElement('button', { className: 'color-swatch paint-toolbar__button', style: { backgroundColor: color }, 'data-color': color });
            swatch.addEventListener('click', () => eventCallbacks.onColorSelect(color));
            colorGroup.appendChild(swatch);
        });

        const actionGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        elements.undoButton = Utils.createElement('button', { textContent: 'Undo', className: 'paint-toolbar__button' });
        elements.redoButton = Utils.createElement('button', { textContent: 'Redo', className: 'paint-toolbar__button' });
        elements.undoButton.addEventListener('click', () => eventCallbacks.onUndo());
        elements.redoButton.addEventListener('click', () => eventCallbacks.onRedo());
        actionGroup.append(elements.undoButton, elements.redoButton);

        const viewGroup = Utils.createElement('div', { className: 'paint-toolbar__group' });
        elements.gridButton = Utils.createElement('button', { textContent: 'Grid', className: 'paint-toolbar__button' });
        elements.gridButton.addEventListener('click', () => eventCallbacks.onGridToggle());
        viewGroup.append(elements.gridButton);

        elements.toolbar.append(toolGroup, brushGroup, colorGroup, actionGroup, viewGroup);
    }

    function _showCharModal() {
        const charModalBody = Utils.createElement('div', { className: 'paint-modal-body', style: { display: 'flex', 'flex-wrap': 'wrap', gap: '5px' } });
        const chars = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'.split('');

        chars.forEach(char => {
            const charButton = Utils.createElement('button', { textContent: char, className: 'btn' });
            charButton.addEventListener('click', () => {
                eventCallbacks.onCharSelect(char);
                ModalManager.hide();
            });
            charModalBody.appendChild(charButton);
        });

        ModalManager.request({
            context: 'graphical-input',
            title: 'Select Character',
            bodyElement: charModalBody,
            hideInput: true,
            hideConfirm: true,
            cancelText: 'Close',
            onCancel: () => ModalManager.hide()
        });
    }

    function _showFindReplaceModal() {
        const findInput = Utils.createElement('input', { type: 'text', maxLength: 1, placeholder: 'Find Char' });
        const replaceInput = Utils.createElement('input', { type: 'text', maxLength: 1, placeholder: 'Replace Char' });

        const body = Utils.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
            Utils.createElement('p', { textContent: 'Replace all occurrences of a character.' }),
            findInput,
            replaceInput
        ]);

        ModalManager.request({
            context: 'graphical-input',
            messageLines: ['Find and Replace'],
            bodyElement: body,
            hideInput: true,
            confirmText: 'Replace All',
            onConfirm: () => {
                const findChar = findInput.value[0];
                const replaceChar = replaceInput.value[0];
                eventCallbacks.onReplaceAll(findChar, replaceChar);
            },
        });
    }

    function _attachEventListeners() {
        elements.canvas.addEventListener('mousedown', (e) => _handleMouseEvent(e, eventCallbacks.onCanvasMouseDown));
        elements.canvas.addEventListener('mousemove', (e) => _handleMouseEvent(e, eventCallbacks.onCanvasMouseMove));
        document.addEventListener('mouseup', (e) => _handleMouseEvent(e, eventCallbacks.onCanvasMouseUp, true));
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