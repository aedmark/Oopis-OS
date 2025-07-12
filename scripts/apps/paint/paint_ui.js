// scripts/apps/paint/paint_ui.js

const PaintUI = (() => {
    "use strict";

    let elements = {};
    let managerCallbacks = {};

    function buildAndShow(initialState, callbacks) {
        managerCallbacks = callbacks;

        // --- Create Main Structure ---
        elements.container = Utils.createElement('div', { id: 'paint-container', className: 'paint-container' });

        // --- Toolbar ---
        const createToolBtn = (name, key, label) => Utils.createElement('button', {
            id: `paint-tool-${name}`,
            className: 'btn',
            textContent: label,
            title: `${name.charAt(0).toUpperCase() + name.slice(1)} (${key.toUpperCase()})`
        });

        const toolGroup = Utils.createElement('div', { className: 'paint-tool-group' }, [
            elements.pencilBtn = createToolBtn('pencil', 'p', '✎'),
            elements.eraserBtn = createToolBtn('eraser', 'e', '✐'),
            elements.lineBtn = createToolBtn('line', 'l', '—'),
            elements.rectBtn = createToolBtn('rect', 'r', '▢'),
            elements.circleBtn = createToolBtn('circle', 'c', '◯'),
            elements.fillBtn = createToolBtn('fill', 'f', '⛁'),
            elements.selectBtn = createToolBtn('select', 's', '⬚'),
        ]);

        elements.colorPicker = Utils.createElement('input', {
            type: 'color',
            id: 'paint-color-picker',
            className: 'paint-color-picker',
            title: 'Select Color'
        });
        const colorGroup = Utils.createElement('div', { className: 'paint-tool-group' }, [elements.colorPicker]);

        elements.brushSizeInput = Utils.createElement('input', { type: 'number', className: 'paint-brush-size', value: initialState.brushSize, min: 1, max: 5 });
        const brushSizeUp = Utils.createElement('button', { className: 'btn', textContent: '+' });
        const brushSizeDown = Utils.createElement('button', { className: 'btn', textContent: '-' });
        const brushGroup = Utils.createElement('div', { className: 'paint-brush-controls' }, [brushSizeDown, elements.brushSizeInput, brushSizeUp]);

        elements.charInput = Utils.createElement('input', { type: 'text', className: 'paint-char-selector', value: initialState.currentCharacter, maxLength: 1 });

        elements.undoBtn = Utils.createElement('button', {className: 'btn', textContent: '↩'});
        elements.redoBtn = Utils.createElement('button', {className: 'btn', textContent: '↪'});
        elements.gridBtn = Utils.createElement('button', {className: 'btn', textContent: '▦'});
        const historyGroup = Utils.createElement('div', { className: 'paint-tool-group' }, [elements.undoBtn, elements.redoBtn, elements.gridBtn]);

        elements.cutBtn = Utils.createElement('button', {className: 'btn', textContent: 'Cut', title: 'Cut (Ctrl+X)'});
        elements.copyBtn = Utils.createElement('button', {
            className: 'btn',
            textContent: 'Copy',
            title: 'Copy (Ctrl+C)'
        });
        elements.pasteBtn = Utils.createElement('button', {
            className: 'btn',
            textContent: 'Paste',
            title: 'Paste (Ctrl+V)'
        });
        const clipboardGroup = Utils.createElement('div', {className: 'paint-tool-group'}, [elements.cutBtn, elements.copyBtn, elements.pasteBtn]);

        elements.zoomInBtn = Utils.createElement('button', {
            className: 'btn',
            textContent: '➕'
        });
        elements.zoomOutBtn = Utils.createElement('button', {
            className: 'btn',
            textContent: '➖'
        });
        const zoomGroup = Utils.createElement('div', {className: 'paint-tool-group'}, [elements.zoomOutBtn, elements.zoomInBtn]);

        const toolbarSpacer = Utils.createElement('div', {style: 'flex-grow: 1;'});
        elements.exitBtn = Utils.createElement('button', {
            id: 'paint-exit-btn',
            className: 'btn',
            textContent: '✕',
            title: 'Exit Application'
        });


        const toolbar = Utils.createElement('header', {className: 'paint-toolbar'}, [
            toolGroup,
            colorGroup,
            brushGroup,
            elements.charInput,
            historyGroup,
            clipboardGroup,
            zoomGroup,
            toolbarSpacer,
            elements.exitBtn
        ]);

        // --- Canvas ---
        elements.canvas = Utils.createElement('div', { className: 'paint-canvas', id: 'paint-canvas' });
        elements.previewCanvas = Utils.createElement('div', { className: 'paint-preview-canvas', id: 'paint-preview-canvas' });
        elements.selectionRect = Utils.createElement('div', {className: 'paint-selection-rect hidden'});
        const canvasContainer = Utils.createElement('div', {className: 'paint-canvas-container'}, [elements.canvas, elements.previewCanvas, elements.selectionRect]);
        const mainArea = Utils.createElement('main', { className: 'paint-main' }, [canvasContainer]);

        // --- Status Bar ---
        elements.statusTool = Utils.createElement('span');
        elements.statusChar = Utils.createElement('span');
        elements.statusBrush = Utils.createElement('span');
        elements.statusCoords = Utils.createElement('span');
        elements.statusZoom = Utils.createElement('span');
        elements.statusBar = Utils.createElement('footer', { className: 'paint-statusbar' }, [
            elements.statusTool, elements.statusChar, elements.statusBrush, elements.statusCoords, elements.statusZoom
        ]);

        // --- Assemble & Show ---
        elements.container.append(toolbar, mainArea, elements.statusBar);

        renderInitialCanvas(initialState.canvasData, initialState.canvasDimensions);
        updateToolbar(initialState);
        updateStatusBar(initialState);
        updateZoom(initialState.zoomLevel);
        _addEventListeners();

        AppLayerManager.show(elements.container);
        elements.container.focus();
    }

    function hideAndReset() {
        AppLayerManager.hide();
        elements = {};
        managerCallbacks = {};
    }

    function renderInitialCanvas(canvasData, dimensions) {
        elements.canvas.innerHTML = '';
        elements.previewCanvas.innerHTML = '';

        elements.canvas.style.gridTemplateColumns = `repeat(${dimensions.width}, 1ch)`;
        elements.canvas.style.gridTemplateRows = `repeat(${dimensions.height}, 1em)`;
        elements.previewCanvas.style.gridTemplateColumns = `repeat(${dimensions.width}, 1ch)`;
        elements.previewCanvas.style.gridTemplateRows = `repeat(${dimensions.height}, 1em)`;

        for (let y = 0; y < dimensions.height; y++) {
            for (let x = 0; x < dimensions.width; x++) {
                const dataCell = canvasData[y][x];
                const cell = Utils.createElement('span', { id: `cell-${x}-${y}`, className: 'paint-canvas-cell', textContent: dataCell.char, style: { color: dataCell.color } });
                elements.canvas.appendChild(cell);

                const previewCell = Utils.createElement('span', { id: `preview-cell-${x}-${y}`, className: 'paint-canvas-cell' });
                elements.previewCanvas.appendChild(previewCell);
            }
        }
    }

    function updateCanvas(cellsToUpdate) {
        cellsToUpdate.forEach(data => {
            const cell = document.getElementById(`cell-${data.x}-${data.y}`);
            if (cell) {
                cell.textContent = data.char;
                cell.style.color = data.color;
            }
        });
    }

    function updatePreviewCanvas(cellsToUpdate) {
        // Clear previous preview
        Array.from(elements.previewCanvas.children).forEach(child => {
            if (child.textContent !== ' ') {
                child.textContent = ' ';
                child.style.color = 'transparent';
            }
        });

        // Draw new preview
        cellsToUpdate.forEach(data => {
            const cell = document.getElementById(`preview-cell-${data.x}-${data.y}`);
            if (cell) {
                cell.textContent = data.char;
                cell.style.color = data.color;
            }
        });
    }

    function updateToolbar(state) {
        ['pencil', 'eraser', 'line', 'rect', 'circle', 'fill', 'select'].forEach(tool => {
            elements[`${tool}Btn`].classList.toggle('active', state.currentTool === tool);
        });
        elements.colorPicker.value = state.currentColor;
        elements.brushSizeInput.value = state.brushSize;
        elements.charInput.value = state.currentCharacter;
        elements.undoBtn.disabled = state.undoStack.length <= 1;
        elements.redoBtn.disabled = state.redoStack.length === 0;
    }

    function updateStatusBar(state, coords = null) {
        elements.statusTool.textContent = `Tool: ${state.currentTool}`;
        elements.statusChar.textContent = `Char: ${state.currentCharacter}`;
        elements.statusBrush.textContent = `Brush: ${state.brushSize}`;
        elements.statusCoords.textContent = coords ? `Coords: ${coords.x}, ${coords.y}` : '';
        elements.statusZoom.textContent = `Zoom: ${state.zoomLevel}%`;
    }

    function toggleGrid(visible) {
        elements.canvas.classList.toggle('grid-visible', visible);
    }

    function updateZoom(zoomLevel) {
        const baseFontSize = 20;
        const newSize = baseFontSize * (zoomLevel / 100);
        const gridShouldBeVisible = zoomLevel >= 70 && managerCallbacks.isGridVisible ? managerCallbacks.isGridVisible() : false;

        if (elements.canvas) {
            elements.canvas.style.fontSize = `${newSize}px`;
            elements.canvas.classList.toggle('grid-visible', gridShouldBeVisible);
        }
        if (elements.previewCanvas) {
            elements.previewCanvas.style.fontSize = `${newSize}px`;
        }
    }

    function showSelectionRect(rect) {
        if (!elements.selectionRect) return;
        const charWidth = elements.canvas.firstChild.offsetWidth;
        const charHeight = elements.canvas.firstChild.offsetHeight;

        elements.selectionRect.style.left = `${rect.x * charWidth}px`;
        elements.selectionRect.style.top = `${rect.y * charHeight}px`;
        elements.selectionRect.style.width = `${rect.width * charWidth}px`;
        elements.selectionRect.style.height = `${rect.height * charHeight}px`;
        elements.selectionRect.classList.remove('hidden');
    }

    function hideSelectionRect() {
        if (elements.selectionRect) {
            elements.selectionRect.classList.add('hidden');
        }
    }


    function _getCoordsFromEvent(e) {
        if (!elements.canvas || !elements.canvas.firstChild) return null;
        const rect = elements.canvas.getBoundingClientRect();
        const charWidth = elements.canvas.firstChild.offsetWidth;
        const charHeight = elements.canvas.firstChild.offsetHeight;
        if(charWidth === 0 || charHeight === 0) return null;
        const x = Math.floor((e.clientX - rect.left) / charWidth);
        const y = Math.floor((e.clientY - rect.top) / charHeight);
        return {x, y};
    }

    function _addEventListeners() {
        // Tool selection
        elements.pencilBtn.addEventListener('click', () => managerCallbacks.onToolSelect('pencil'));
        elements.eraserBtn.addEventListener('click', () => managerCallbacks.onToolSelect('eraser'));
        elements.lineBtn.addEventListener('click', () => managerCallbacks.onToolSelect('line'));
        elements.rectBtn.addEventListener('click', () => managerCallbacks.onToolSelect('rect'));
        elements.circleBtn.addEventListener('click', () => managerCallbacks.onToolSelect('circle'));
        elements.fillBtn.addEventListener('click', () => managerCallbacks.onToolSelect('fill'));
        elements.selectBtn.addEventListener('click', () => managerCallbacks.onToolSelect('select'));

        // Color selection
        elements.colorPicker.addEventListener('input', (e) => managerCallbacks.onColorSelect(e.target.value));

        // Brush & Char
        elements.brushSizeInput.addEventListener('change', (e) => managerCallbacks.onBrushSizeChange(parseInt(e.target.value, 10)));
        elements.container.querySelector('.paint-brush-controls .btn:nth-child(1)').addEventListener('click', () => managerCallbacks.onBrushSizeChange(parseInt(elements.brushSizeInput.value, 10) - 1));
        elements.container.querySelector('.paint-brush-controls .btn:nth-child(3)').addEventListener('click', () => managerCallbacks.onBrushSizeChange(parseInt(elements.brushSizeInput.value, 10) + 1));
        elements.charInput.addEventListener('input', (e) => managerCallbacks.onCharChange(e.target.value));

        // History and Grid
        elements.undoBtn.addEventListener('click', () => managerCallbacks.onUndo());
        elements.redoBtn.addEventListener('click', () => managerCallbacks.onRedo());
        elements.gridBtn.addEventListener('click', () => managerCallbacks.onToggleGrid());

        elements.cutBtn.addEventListener('click', () => managerCallbacks.onCut());
        elements.copyBtn.addEventListener('click', () => managerCallbacks.onCopy());
        elements.pasteBtn.addEventListener('click', () => managerCallbacks.onPaste());


        // Zoom
        elements.zoomInBtn.addEventListener('click', () => managerCallbacks.onZoomIn());
        elements.zoomOutBtn.addEventListener('click', () => managerCallbacks.onZoomOut());

        // MODIFICATION: Add exit button listener
        elements.exitBtn.addEventListener('click', () => managerCallbacks.onExitRequest());

        // Canvas mouse events
        elements.canvas.addEventListener('mousedown', (e) => {
            const coords = _getCoordsFromEvent(e);
            if(coords) managerCallbacks.onCanvasMouseDown(coords);
        });
        elements.canvas.addEventListener('mousemove', (e) => {
            const coords = _getCoordsFromEvent(e);
            if(coords) managerCallbacks.onCanvasMouseMove(coords);
        });
        document.addEventListener('mouseup', (e) => {
            managerCallbacks.onCanvasMouseUp(null);
        });
        elements.canvas.addEventListener('mouseleave', () => updateStatusBar({
            currentTool: elements.statusTool.textContent.split(': ')[1],
            currentCharacter: elements.statusChar.textContent.split(': ')[1],
            brushSize: elements.statusBrush.textContent.split(': ')[1],
            zoomLevel: parseInt(elements.statusZoom.textContent.replace(/\D/g, ''))
        }));

        // Keyboard shortcuts
        elements.container.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                switch (e.key.toLowerCase()) {
                    case 's':
                        managerCallbacks.onSaveRequest();
                        break;
                    case 'o':
                        managerCallbacks.onExitRequest();
                        break;
                    case 'z':
                        e.shiftKey ? managerCallbacks.onRedo() : managerCallbacks.onUndo();
                        break;
                    case 'y':
                        managerCallbacks.onRedo();
                        break;
                    case '=':
                        managerCallbacks.onZoomIn();
                        break;
                    case '-':
                        managerCallbacks.onZoomOut();
                        break;
                    case 'x':
                        managerCallbacks.onCut();
                        break;
                    case 'c':
                        managerCallbacks.onCopy();
                        break;
                    case 'v':
                        managerCallbacks.onPaste();
                        break;
                }
            } else {
                switch (e.key.toLowerCase()) {
                    case 'p': managerCallbacks.onToolSelect('pencil'); break;
                    case 'e': managerCallbacks.onToolSelect('eraser'); break;
                    case 'l': managerCallbacks.onToolSelect('line'); break;
                    case 'r': managerCallbacks.onToolSelect('rect'); break;
                    case 'c':
                        managerCallbacks.onToolSelect('circle');
                        break;
                    case 'f':
                        managerCallbacks.onToolSelect('fill');
                        break;
                    case 's':
                        managerCallbacks.onToolSelect('select');
                        break;
                    case 'g': managerCallbacks.onToggleGrid(); break;
                    case 'escape': managerCallbacks.onExitRequest(); break;
                }
            }
        });
        elements.container.setAttribute('tabindex', '-1');
    }

    return {
        buildAndShow,
        hideAndReset,
        updateCanvas,
        updatePreviewCanvas,
        updateToolbar,
        updateStatusBar,
        toggleGrid,
        updateZoom,
        renderCanvas: renderInitialCanvas,
        showSelectionRect,
        hideSelectionRect
    };
})();