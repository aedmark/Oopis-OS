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

        state = { ...defaultState, PALETTE };
        state.isActive = true;
        state.currentFilePath = filePath;

        loadContent(fileContent);

        // Store the initial full state for the first undo
        state.undoStack.push(JSON.stringify(state.canvasData));

        PaintUI.buildAndShow(state, callbacks);
    }

    async function exit() {
        if (!state.isActive) return;
        if (state.isDirty) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: ["You have unsaved changes.", "Exit and discard them?"],
                    confirmText: "Discard Changes",
                    cancelText: "Cancel",
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            });
            if (!confirmed) return;
        }
        _performExit();
    }

    function _performExit() {
        PaintUI.hideAndReset();
        state = {}; // Reset state
    }

    // --- Content & File Handling ---
    function loadContent(fileContent) {
        if (fileContent) {
            try {
                const parsed = JSON.parse(fileContent);
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
        } else {
            state.statusMessage = `Error: ${saveResult.error || "Failed to save to filesystem."}`;
        }
        PaintUI.updateToolbar(state);
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
    function _getCellsInBrush(x, y, char, color) {
        const affectedCells = [];
        const offset = Math.floor(state.brushSize / 2);
        for (let i = 0; i < state.brushSize; i++) {
            for (let j = 0; j < state.brushSize; j++) {
                const drawX = x + i - offset;
                const drawY = y + j - offset;
                if (drawY >= 0 && drawY < state.canvasDimensions.height && drawX >= 0 && drawX < state.canvasDimensions.width) {
                    affectedCells.push({ x: drawX, y: drawY, char, color });
                }
            }
        }
        return affectedCells;
    }

    function _getCellsForLine(x0, y0, x1, y1, char, color) {
        const affectedCells = [];
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy, e2;

        for (;;) {
            affectedCells.push(..._getCellsInBrush(x0, y0, char, color));
            if (x0 === x1 && y0 === y1) break;
            e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return affectedCells;
    }

    function _getCellsForRect(x0, y0, x1, y1, char, color) {
        let affectedCells = [];
        affectedCells.push(..._getCellsForLine(x0, y0, x1, y0, char, color));
        affectedCells.push(..._getCellsForLine(x0, y1, x1, y1, char, color));
        affectedCells.push(..._getCellsForLine(x0, y0, x0, y1, char, color));
        affectedCells.push(..._getCellsForLine(x1, y0, x1, y1, char, color));
        return affectedCells;
    }

    function _applyCellsToData(cells) {
        const preState = JSON.stringify(state.canvasData);
        cells.forEach(cell => {
            if (cell.y >= 0 && cell.y < state.canvasDimensions.height && cell.x >= 0 && cell.x < state.canvasDimensions.width) {
                state.canvasData[cell.y][cell.x] = { char: cell.char, color: cell.color };
            }
        });
        const postState = JSON.stringify(state.canvasData);
        return PatchUtils.createPatch(preState, postState);
    }

    // --- State & History ---
    function _pushToUndoStack(patch) {
        if (patch) {
            state.undoStack.push(patch);
            if (state.undoStack.length > 50) { // Keep history manageable
                state.undoStack.shift();
            }
            state.redoStack = []; // Clear redo stack on new action
            state.isDirty = true;
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        }
    }

    // --- UI Callbacks ---
    const callbacks = {
        onToolSelect: (tool) => {
            state.currentTool = tool;
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        },
        onColorSelect: (color) => {
            state.currentColor = color;
            PaintUI.updateToolbar(state);
        },
        onCharChange: (char) => {
            if (char.length > 0) state.currentCharacter = char.slice(0, 1);
            PaintUI.updateStatusBar(state);
        },
        onBrushSizeChange: (newSize) => {
            state.brushSize = Math.max(1, Math.min(5, newSize));
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        },
        onUndo: () => {
            if (state.undoStack.length > 1) { // The first element is always the full state
                const patch = state.undoStack.pop();
                state.redoStack.push(patch);
                state.canvasData = JSON.parse(PatchUtils.applyInverse(JSON.stringify(state.canvasData), patch));
                PaintUI.renderCanvas(state.canvasData, state.canvasDimensions);
                state.isDirty = state.undoStack.length > 1;
                PaintUI.updateToolbar(state);
                PaintUI.updateStatusBar(state);
            }
        },
        onRedo: () => {
            if (state.redoStack.length > 0) {
                const patch = state.redoStack.pop();
                state.undoStack.push(patch);
                state.canvasData = JSON.parse(PatchUtils.applyPatch(JSON.stringify(state.canvasData), patch));
                PaintUI.renderCanvas(state.canvasData, state.canvasDimensions);
                state.isDirty = true;
                PaintUI.updateToolbar(state);
                PaintUI.updateStatusBar(state);
            }
        },
        onToggleGrid: () => {
            state.gridVisible = !state.gridVisible;
            PaintUI.toggleGrid(state.gridVisible);
        },
        onCanvasMouseDown: (coords) => {
            state.isDrawing = true;
            state.startCoords = coords;
        },
        onCanvasMouseMove: (coords) => {
            const char = state.currentTool === 'eraser' ? ' ' : state.currentCharacter;
            const color = state.currentTool === 'eraser' ? '#000000' : state.currentColor;

            let previewCells = [];
            if (state.isDrawing) {
                if (state.currentTool === 'line') {
                    previewCells = _getCellsForLine(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                } else if (state.currentTool === 'rect') {
                    previewCells = _getCellsForRect(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                } else if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
                    const cells = _getCellsForLine(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                    const patch = _applyCellsToData(cells);
                    _pushToUndoStack(patch);
                    PaintUI.updateCanvas(cells);
                    state.startCoords = coords;
                }
            } else {
                previewCells = _getCellsInBrush(coords.x, coords.y, char, color);
            }

            PaintUI.updatePreviewCanvas(previewCells);
            PaintUI.updateStatusBar(state, coords);
        },
        onCanvasMouseUp: (coords) => {
            if (!state.isDrawing) return;
            state.isDrawing = false;
            PaintUI.updatePreviewCanvas([]);

            const char = state.currentTool === 'eraser' ? ' ' : state.currentCharacter;
            const color = state.currentTool === 'eraser' ? '#000000' : state.currentColor;

            let finalCells = [];
            if (state.currentTool === 'line') {
                finalCells = _getCellsForLine(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
            } else if (state.currentTool === 'rect') {
                finalCells = _getCellsForRect(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
            }

            if (finalCells.length > 0) {
                const patch = _applyCellsToData(finalCells);
                _pushToUndoStack(patch);
                PaintUI.updateCanvas(finalCells);
            }
        },
        onSaveRequest: saveContent,
        onExitRequest: exit,
    };

    return { enter, exit, isActive: () => state.isActive };
})();