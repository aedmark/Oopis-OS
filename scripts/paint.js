// paint.js - OopisOS ASCII/ANSI Art Editor v1.4

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
    CSS_CLASSES: {
        MODAL_HIDDEN: 'hidden',
        ACTIVE_TOOL: 'paint-tool-active',
    },
    PALETTE: [
        'text-green-500', 'text-red-500', 'text-sky-400', 'text-amber-400',
        'text-lime-400', 'text-neutral-300'
    ],
    EDITOR: {
        DEBOUNCE_DELAY_MS: 300,
        MAX_UNDO_STATES: 50,
    }
};

const PaintUI = (() => {
    "use strict";
    let elements = {};
    let isInitialized = false;
    let eventCallbacks = {};
    let cellDimensions = { width: 0, height: 0 };

    function _initDOM(callbacks) {
        if (isInitialized) return true;
        eventCallbacks = callbacks;

        elements.modal = document.getElementById('paint-modal');
        elements.toolbar = document.getElementById('paint-toolbar');
        elements.canvas = document.getElementById('paint-canvas');
        elements.statusBar = document.getElementById('paint-statusbar');

        if (!elements.modal || !elements.toolbar || !elements.canvas || !elements.statusBar) {
            console.error("PaintUI: Critical UI elements missing!");
            return false;
        }

        elements.toolbar.innerHTML = '';

        // --- Toolbar Buttons ---
        elements.undoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M12.5 8C9.81 8 7.5 10.27 7.5 13S9.81 18 12.5 18c2.04 0 3.84-1.18 4.63-2.92l1.48 1.48C17.34 18.23 15.06 20 12.5 20 8.91 20 6 16.91 6 13.5S8.91 7 12.5 7c1.78 0 3.4.71 4.59 1.86L19 7v6h-6l1.92-1.92C14.04 9.82 13.3 9 12.5 9c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5c.83 0 1.55-.4 2-1h1.53c-.64 1.9-2.51 3.25-4.53 3.25-2.76 0-5-2.24-5-5s2.24-5 5-5c1.38 0 2.64.56 3.54 1.46L18.5 6H12.5z"/></svg>', title: 'Undo (Ctrl+Z)', eventListeners: { click: () => eventCallbacks.onUndo() } });
        elements.redoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-2.76 0-5 2.24-5 5s2.24 5 5 5c2.65 0 4.85-2 5.8-4.59l-1.5-1.53C15.05 13.6 13.38 15 11.5 15c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5c.82 0 1.55.39 2 1h-1.5v1.5l2.42-.01.08-.08.01-.01 2-2H18.4z"/></svg>', title: 'Redo (Ctrl+Y)', eventListeners: { click: () => eventCallbacks.onRedo() } });
        elements.pencilBtn = Utils.createElement('button', { className: 'paint-tool', textContent: '[P]encil', eventListeners: { click: () => eventCallbacks.onToolChange('pencil') }});
        elements.eraserBtn = Utils.createElement('button', { className: 'paint-tool', textContent: '[E]raser', eventListeners: { click: () => eventCallbacks.onToolChange('eraser') }});

        elements.colorButtons = [];
        const colorPaletteContainer = Utils.createElement('div', { className: 'paint-palette' });
        PaintAppConfig.PALETTE.forEach((colorClass, index) => {
            const colorBtn = Utils.createElement('button', {
                className: `paint-color-swatch ${colorClass.replace('text-', 'bg-')}`,
                title: `[${index + 1}]`,
                eventListeners: { click: () => eventCallbacks.onColorChange(colorClass) }
            });
            elements.colorButtons.push(colorBtn);
            colorPaletteContainer.appendChild(colorBtn);
        });

        elements.saveExitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: '[S]ave & Exit', eventListeners: { click: () => eventCallbacks.onSaveAndExit() }});

        const leftGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.undoBtn, elements.redoBtn, elements.pencilBtn, elements.eraserBtn);
        const rightGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.saveExitBtn);

        elements.toolbar.append(leftGroup, colorPaletteContainer, rightGroup);

        elements.canvas.addEventListener('mousedown', eventCallbacks.onMouseDown);
        document.addEventListener('mousemove', eventCallbacks.onMouseMove);
        document.addEventListener('mouseup', eventCallbacks.onMouseUp);
        elements.canvas.addEventListener('mouseleave', eventCallbacks.onMouseLeave);

        isInitialized = true;
        return true;
    }

    function _calculateCellSize() {
        if (!elements.canvas || !elements.canvas.firstChild) return;
        const testCell = elements.canvas.firstChild;
        cellDimensions.width = testCell.offsetWidth;
        cellDimensions.height = testCell.offsetHeight;
    }

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

    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        const colorName = status.fg.replace('text-', '').replace(/-\d+/, '');
        elements.statusBar.textContent = `Tool: ${status.tool} | Char: '${status.char}' | Color: ${colorName} | Coords: ${status.coords.x},${status.coords.y}`;
    }

    function updateToolbar(activeTool, activeColor, undoPossible, redoPossible) {
        if (!isInitialized) return;
        elements.pencilBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'pencil');
        elements.eraserBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'eraser');
        elements.undoBtn.disabled = !undoPossible;
        elements.redoBtn.disabled = !redoPossible;

        elements.colorButtons.forEach((btn, index) => {
            const colorClass = PaintAppConfig.PALETTE[index];
            btn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, colorClass === activeColor);
        });
    }

    function show(callbacks) {
        if (!isInitialized) {
            _initDOM(callbacks);
        }
        if (elements.modal) {
            elements.modal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        } else {
            console.error("PaintUI: Modal element not found, cannot show.");
            return;
        }
    }

    function hide() {
        if (elements.modal) {
            elements.modal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        }
        isInitialized = false;
    }

    function renderCanvas(canvasData) {
        if (!elements.canvas) return;
        elements.canvas.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let y = 0; y < canvasData.length; y++) {
            for (let x = 0; x < canvasData[y].length; x++) {
                const cell = canvasData[y][x];
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

    function reset() {
        if (elements.canvas) elements.canvas.innerHTML = '';
        if (elements.statusBar) elements.statusBar.textContent = '';
        if (elements.toolbar) elements.toolbar.innerHTML = '';
        isInitialized = false;
    }

    return { show, hide, renderCanvas, reset, getGridCoordinates, updateStatusBar, updateToolbar };
})();

const PaintManager = (() => {
    "use strict";
    let isActiveState = false, currentFilePath = null, canvasData = [], isDirty = false;
    let isDrawing = false, currentTool = 'pencil', drawChar = PaintAppConfig.DEFAULT_CHAR;
    let fgColor = PaintAppConfig.DEFAULT_FG_COLOR, lastCoords = { x: -1, y: -1 };
    let undoStack = [], redoStack = [], saveUndoStateTimeout = null;

    function _createBlankCanvas(w, h) {
        let data = [];
        for (let y = 0; y < h; y++) {
            data.push(Array.from({ length: w }, () => ({
                char: ' ', fg: PaintAppConfig.DEFAULT_FG_COLOR, bg: PaintAppConfig.ERASER_BG_COLOR
            })));
        }
        return data;
    }

    function _updateUndoRedoButtonStates() {
        PaintUI.updateToolbar(currentTool, fgColor, undoStack.length > 1, redoStack.length > 0);
    }

    function _saveUndoState() {
        redoStack = []; // Any new action clears the redo stack
        undoStack.push(JSON.parse(JSON.stringify(canvasData))); // Deep copy
        if (undoStack.length > PaintAppConfig.EDITOR.MAX_UNDO_STATES) {
            undoStack.shift();
        }
        _updateUndoRedoButtonStates();
    }

    function _triggerSaveUndoState() {
        if (saveUndoStateTimeout) clearTimeout(saveUndoStateTimeout);
        saveUndoStateTimeout = setTimeout(_saveUndoState, PaintAppConfig.EDITOR.DEBOUNCE_DELAY_MS);
    }

    function _performUndo() {
        if (undoStack.length <= 1) return;
        const currentState = undoStack.pop();
        redoStack.push(currentState);
        canvasData = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
        PaintUI.renderCanvas(canvasData);
        _updateUndoRedoButtonStates();
    }

    function _performRedo() {
        if (redoStack.length === 0) return;
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        canvasData = JSON.parse(JSON.stringify(nextState));
        PaintUI.renderCanvas(canvasData);
        _updateUndoRedoButtonStates();
    }

    function _drawOnCanvas(x, y) {
        if (y < 0 || y >= canvasData.length || x < 0 || x >= canvasData[0].length) return;
        isDirty = true;
        const cell = canvasData[y][x];
        if (currentTool === 'pencil') {
            cell.char = drawChar;
            cell.fg = fgColor;
            cell.bg = PaintAppConfig.DEFAULT_BG_COLOR;
        } else if (currentTool === 'eraser') {
            cell.char = PaintAppConfig.ERASER_CHAR;
            cell.fg = PaintAppConfig.DEFAULT_FG_COLOR;
            cell.bg = PaintAppConfig.ERASER_BG_COLOR;
        }
        PaintUI.renderCanvas(canvasData); // Re-render the whole canvas for simplicity
    }

    function _handleMouseDown(e) {
        isDrawing = true;
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) {
            lastCoords = coords;
            _drawOnCanvas(coords.x, coords.y);
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords });
        }
    }

    function _handleMouseMove(e) {
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) {
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords });
        }
        if (!isDrawing || !coords || (coords.x === lastCoords.x && coords.y === lastCoords.y)) return;

        // Simple point-by-point drawing for now
        _drawOnCanvas(coords.x, coords.y);
        lastCoords = coords;
    }

    function _handleMouseUp(e) {
        if (isDrawing) {
            _triggerSaveUndoState();
        }
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
    }

    function _handleMouseLeave(e) {
        if (isDrawing) {
            _triggerSaveUndoState();
        }
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
    }

    function _setTool(toolName) {
        currentTool = toolName;
        _updateUndoRedoButtonStates();
    }

    function _setColor(colorClass) {
        fgColor = colorClass;
        _updateUndoRedoButtonStates();
    }

    function enter(filePath, fileContent) {
        if (isActiveState) return;
        isActiveState = true;
        TerminalUI.setInputState(false);
        currentFilePath = filePath;
        isDirty = false;
        currentTool = 'pencil';
        drawChar = PaintAppConfig.DEFAULT_CHAR;
        fgColor = PaintAppConfig.DEFAULT_FG_COLOR;

        try {
            if (fileContent) {
                const parsed = JSON.parse(fileContent);
                if (parsed.cells && parsed.width && parsed.height) canvasData = parsed.cells;
                else throw new Error("Invalid .oopic file format.");
            } else {
                canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
            }
        } catch (e) {
            OutputManager.appendToOutput(`Error loading paint file: ${e.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
        }

        undoStack = [JSON.parse(JSON.stringify(canvasData))];
        redoStack = [];

        PaintUI.show({
            onMouseDown: _handleMouseDown,
            onMouseMove: _handleMouseMove,
            onMouseUp: _handleMouseUp,
            onMouseLeave: _handleMouseLeave,
            onToolChange: _setTool,
            onColorChange: _setColor,
            onSaveAndExit: () => exit(true),
            onUndo: _performUndo,
            onRedo: _performRedo
        });

        PaintUI.renderCanvas(canvasData);
        _updateUndoRedoButtonStates();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: {x: -1, y: -1} });

        document.addEventListener('keydown', handleKeyDown);
    }

    async function exit(save = false) {
        if (save && isDirty && currentFilePath) {
            const fileData = {
                version: "1.1", width: canvasData[0].length, height: canvasData.length, cells: canvasData
            };
            const jsonContent = JSON.stringify(fileData);
            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            const saveResult = await FileSystemManager.createOrUpdateFile(currentFilePath, jsonContent, { currentUser, primaryGroup });
            if (saveResult.success) {
                await FileSystemManager.save();
                await OutputManager.appendToOutput(`Art saved to '${currentFilePath}'.`, { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });
            } else {
                await OutputManager.appendToOutput(`Error saving art: ${saveResult.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            }
        } else if (save && !currentFilePath) {
            await OutputManager.appendToOutput(`Cannot save. Please provide a filename when launching paint.`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
        }

        document.removeEventListener('keydown', handleKeyDown);
        PaintUI.hide();
        PaintUI.reset();
        isActiveState = false; isDrawing = false;
        undoStack = []; redoStack = [];
        if(saveUndoStateTimeout) clearTimeout(saveUndoStateTimeout);
        TerminalUI.setInputState(true);
        TerminalUI.focusInput();
    }

    function handleKeyDown(event) {
        if (!isActiveState) return;

        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            if (key === 'z') {
                event.preventDefault();
                _performUndo();
            } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault();
                _performRedo();
            } else if (key === 's') {
                event.preventDefault();
                exit(true);
            }
            return;
        }

        const key = event.key.toLowerCase();
        const isAppKey = ['p', 'e', '1', '2', '3', '4', '5', '6'].includes(key);
        const isCharKey = event.key.length === 1;

        if (isAppKey || isCharKey) {
            event.preventDefault();
            if (key === 'p') { _setTool('pencil'); return; }
            if (key === 'e') { _setTool('eraser'); return; }

            const colorIndex = parseInt(key, 10) - 1;
            if (colorIndex >= 0 && colorIndex < PaintAppConfig.PALETTE.length) {
                _setColor(PaintAppConfig.PALETTE[colorIndex]);
                return;
            }

            if (isCharKey) {
                drawChar = event.key;
            }
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
        }
    }

    return { enter, exit, isActive: () => isActiveState };
})();