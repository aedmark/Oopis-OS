const PaintManager = (() => {
    "use strict";

    // --- State Management ---
    let state = {};

    const defaultState = {
        isActive: false,
        currentFilePath: null,
        canvasData: [],
        canvasDimensions: { width: 80, height: 24 },
        currentTool: 'pencil',
        currentCharacter: '#',
        currentColor: '#FFFFFF',
        brushSize: 1,
        isDirty: false,
        gridVisible: false,
        isDrawing: false,
        startCoords: null,
        undoStack: [],
        redoStack: [],
        statusMessage: 'Ready'
    };

    const PALETTE = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];

    // --- Core Lifecycle ---
    function enter(filePath, fileContent) {
        if (state.isActive) return;

        state = { ...defaultState, PALETTE }; // Add palette to state for UI
        state.isActive = true;
        state.currentFilePath = filePath;

        loadContent(fileContent);

        state.undoStack.push(JSON.stringify(state.canvasData));

        PaintUI.buildAndShow(state, callbacks);
    }

    async function exit() {
        if (!state.isActive) return;
        if (state.isDirty) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: ["You have unsaved changes. Exit anyway?"],
                    onConfirm: () => resolve(true), onCancel: () => resolve(false)
                });
            });
            if (!confirmed) return;
        }
        _performExit();
    }

    function _performExit() {
        PaintUI.hideAndReset();
        state = {};
    }

    // --- Content & File Handling ---
    function loadContent(fileContent) {
        if (fileContent) {
            try {
                const parsed = JSON.parse(fileContent);
                // Basic validation
                if (parsed.dimensions && parsed.cells) {
                    state.canvasDimensions = parsed.dimensions;
                    state.canvasData = parsed.cells;
                    return;
                }
            } catch (e) {
                console.error("PaintManager: Error parsing .oopic file.", e);
                state.statusMessage = "Error: Could not load corrupted file.";
            }
        }
        // If no content or parsing fails, create a blank canvas
        _createBlankCanvas();
    }

    async function saveContent() {
        if (!state.isActive) return;

        const dataToSave = {
            format: "oopis-paint-v1",
            dimensions: state.canvasDimensions,
            cells: state.canvasData
        };
        const jsonContent = JSON.stringify(dataToSave, null, 2);

        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

        const saveResult = await FileSystemManager.createOrUpdateFile(state.currentFilePath, jsonContent, { currentUser, primaryGroup });

        if (saveResult.success && await FileSystemManager.save()) {
            state.isDirty = false;
            state.statusMessage = `Saved to ${state.currentFilePath}`;
        } else {
            state.statusMessage = `Error: ${saveResult.error || "Failed to save to filesystem."}`;
        }
        PaintUI.updateStatusBar(state);
    }

    function _createBlankCanvas() {
        state.canvasData = [];
        for (let y = 0; y < state.canvasDimensions.height; y++) {
            const row = [];
            for (let x = 0; x < state.canvasDimensions.width; x++) {
                row.push({ char: ' ', color: '#000000', bgColor: '#000000' });
            }
            state.canvasData.push(row);
        }
    }

    // --- Drawing Logic ---

    function _drawPoint(x, y, char, color) {
        if (y >= 0 && y < state.canvasDimensions.height && x >= 0 && x < state.canvasDimensions.width) {
            state.canvasData[y][x] = { char, color };
            return {x, y, char, color};
        }
        return null;
    }

    function _applyBrush(x, y, char, color) {
        const affectedCells = [];
        const offset = Math.floor(state.brushSize / 2);
        for (let i = 0; i < state.brushSize; i++) {
            for (let j = 0; j < state.brushSize; j++) {
                const drawX = x + i - offset;
                const drawY = y + j - offset;
                const cell = _drawPoint(drawX, drawY, char, color);
                if (cell) affectedCells.push(cell);
            }
        }
        PaintUI.updateCanvas(affectedCells);
    }

    function _drawLine(x0, y0, x1, y1, char, color) {
        const affectedCells = [];
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy, e2;

        for (;;) {
            const cell = _drawPoint(x0, y0, char, color);
            if(cell) affectedCells.push(cell);

            if (x0 === x1 && y0 === y1) break;
            e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return affectedCells;
    }

    function _drawRect(x0, y0, x1, y1, char, color) {
        let affectedCells = [];
        affectedCells.push(..._drawLine(x0, y0, x1, y0, char, color));
        affectedCells.push(..._drawLine(x0, y1, x1, y1, char, color));
        affectedCells.push(..._drawLine(x0, y0, x0, y1, char, color));
        affectedCells.push(..._drawLine(x1, y0, x1, y1, char, color));
        return affectedCells;
    }

    // --- State & History ---
    function _pushToUndoStack() {
        const currentStateString = JSON.stringify(state.canvasData);
        if (state.undoStack.at(-1) !== currentStateString) {
            state.undoStack.push(currentStateString);
            if (state.undoStack.length > 30) { // Limit undo history
                state.undoStack.shift();
            }
            state.redoStack = []; // Clear redo stack on new action
            state.isDirty = true;
            PaintUI.updateToolbar(state);
        }
    }

    // --- UI Callbacks ---
    const callbacks = {
        onToolSelect: (tool) => {
            state.currentTool = tool;
            state.statusMessage = `Tool: ${tool}`;
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        },
        onColorSelect: (color) => {
            state.currentColor = color;
            PaintUI.updateToolbar(state);
        },
        onCharChange: (char) => {
            if (char.length > 0) {
                state.currentCharacter = char.slice(0, 1);
            }
            PaintUI.updateStatusBar(state);
        },
        onBrushSizeChange: (newSize) => {
            state.brushSize = Math.max(1, Math.min(5, newSize));
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        },
        onUndo: () => {
            if (state.undoStack.length > 1) {
                state.redoStack.push(state.undoStack.pop());
                state.canvasData = JSON.parse(state.undoStack.at(-1));
                PaintUI.renderCanvas(state.canvasData, state.canvasDimensions);
                PaintUI.updateToolbar(state);
            }
        },
        onRedo: () => {
            if (state.redoStack.length > 0) {
                const nextState = state.redoStack.pop();
                state.undoStack.push(nextState);
                state.canvasData = JSON.parse(nextState);
                PaintUI.renderCanvas(state.canvasData, state.canvasDimensions);
                PaintUI.updateToolbar(state);
            }
        },
        onToggleGrid: () => {
            state.gridVisible = !state.gridVisible;
            PaintUI.toggleGrid(state.gridVisible);
        },
        onCanvasMouseDown: (coords) => {
            _pushToUndoStack();
            state.isDrawing = true;
            state.startCoords = coords;
            if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
                const char = state.currentTool === 'eraser' ? ' ' : state.currentCharacter;
                const color = state.currentTool === 'eraser' ? '#000000' : state.currentColor;
                _applyBrush(coords.x, coords.y, char, color);
            }
        },
        onCanvasMouseMove: (coords) => {
            if (!state.isDrawing) return;

            const char = state.currentTool === 'eraser' ? ' ' : state.currentCharacter;
            const color = state.currentTool === 'eraser' ? '#000000' : state.currentColor;


            if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
                const affected = _drawLine(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                PaintUI.updateCanvas(affected);
                state.startCoords = coords; // Update start for continuous lines
            } else {
                let previewCells = [];
                if (state.currentTool === 'line') {
                    previewCells = _drawLine(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                } else if (state.currentTool === 'rect') {
                    previewCells = _drawRect(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                }
                PaintUI.updatePreviewCanvas(previewCells);
            }
            PaintUI.updateStatusBar(state, coords);
        },
        onCanvasMouseUp: (coords) => {
            if (!state.isDrawing) return;
            state.isDrawing = false;
            PaintUI.updatePreviewCanvas([]); // Clear preview

            const char = state.currentTool === 'eraser' ? ' ' : state.currentCharacter;
            const color = state.currentTool === 'eraser' ? '#000000' : state.currentColor;

            let affectedCells = [];
            if (state.currentTool === 'line') {
                affectedCells = _drawLine(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
            } else if (state.currentTool === 'rect') {
                affectedCells = _drawRect(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
            }

            if (affectedCells.length > 0) {
                PaintUI.updateCanvas(affectedCells);
            }
        },
        onSaveRequest: async () => { await saveContent(); _performExit(); },
        onExitRequest: () => exit(),
    };

    return { enter, exit, isActive: () => state.isActive };
})();