const PaintManager = (() => {
    "use strict";

    let state = {
        isActive: false,
        currentFilePath: null,
        canvasData: [],
        canvasDimensions: { width: 80, height: 24 },
        isDirty: false,
        currentTool: 'pencil',
        activeCharacter: '#',
        activeColor: '#00FF00',
        brushSize: 1,
        zoomLevel: 100,
        undoStack: [],
        redoStack: [],
        isGridVisible: false,
        isDrawing: false,
    };

    function _resetState() {
        state = {
            isActive: false,
            currentFilePath: null,
            canvasData: [],
            canvasDimensions: { width: 80, height: 24 },
            isDirty: false,
            currentTool: 'pencil',
            activeCharacter: '#',
            activeColor: '#00FF00',
            brushSize: 1,
            zoomLevel: 100,
            undoStack: [],
            redoStack: [],
            isGridVisible: false,
            isDrawing: false,
        };
    }

    function _createBlankCanvas() {
        const { width, height } = state.canvasDimensions;
        const data = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push({ char: ' ', fg: '#FFFFFF', bg: '#000000' });
            }
            data.push(row);
        }
        return data;
    }

    function _drawAt({ x, y }) {
        const halfBrush = Math.floor(state.brushSize / 2);
        let changed = false;

        for (let i = -halfBrush; i <= halfBrush; i++) {
            for (let j = -halfBrush; j <= halfBrush; j++) {
                const currentX = x + j;
                const currentY = y + i;

                if (currentY >= 0 && currentY < state.canvasDimensions.height && currentX >= 0 && currentX < state.canvasDimensions.width) {
                    const cell = state.canvasData[currentY][currentX];
                    const newChar = state.currentTool === 'eraser' ? ' ' : state.activeCharacter;
                    const newColor = state.currentTool === 'eraser' ? '#FFFFFF' : state.activeColor;
                    const newBg = '#000000';

                    if (cell.char !== newChar || cell.fg !== newColor || cell.bg !== newBg) {
                        cell.char = newChar;
                        cell.fg = newColor;
                        cell.bg = newBg;
                        changed = true;
                    }
                }
            }
        }
        if (changed) {
            PaintUI.renderCanvas(state);
            state.isDirty = true;
            PaintUI.updateStatusBar(state);
        }
    }

    const callbacks = {
        onToolSelect: (toolName) => {
            state.currentTool = toolName;
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        },
        onColorSelect: (colorValue) => {
            state.activeColor = colorValue;
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        },
        onCharSelect: (char) => {
            state.activeCharacter = char;
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        },
        onBrushSizeChange: (delta) => {
            const newSize = state.brushSize + delta;
            state.brushSize = Math.max(1, Math.min(newSize, 5));
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        },
        onZoomChange: (delta) => {
            const newZoom = state.zoomLevel + delta;
            state.zoomLevel = Math.max(25, Math.min(newZoom, 400));
            PaintUI.renderCanvas(state);
            PaintUI.updateStatusBar(state);
        },
        onGridToggle: () => {
            state.isGridVisible = !state.isGridVisible;
            PaintUI.updateToolbar(state);
            PaintUI.toggleGrid(state.isGridVisible);
        },
        onCanvasMouseDown: (coords) => {
            state.isDrawing = true;
            _drawAt(coords);
        },
        onCanvasMouseMove: (coords) => {
            if (state.isDrawing) {
                _drawAt(coords);
            }
        },
        onCanvasMouseUp: (coords) => {
            if (state.isDrawing) {
                state.isDrawing = false;
                _saveUndoState();
            }
        },
        onUndo: () => {
            if (state.undoStack.length > 1) {
                state.redoStack.push(state.undoStack.pop());
                state.canvasData = JSON.parse(JSON.stringify(state.undoStack[state.undoStack.length - 1]));
                PaintUI.renderCanvas(state);
                PaintUI.updateToolbar(state);
            }
        },
        onRedo: () => {
            if (state.redoStack.length > 0) {
                const nextState = state.redoStack.pop();
                state.undoStack.push(nextState);
                state.canvasData = JSON.parse(JSON.stringify(nextState));
                PaintUI.renderCanvas(state);
                PaintUI.updateToolbar(state);
            }
        },
        onSaveRequest: async () => {
            const { currentFilePath, canvasData, canvasDimensions } = state;
            const fileData = {
                width: canvasDimensions.width,
                height: canvasDimensions.height,
                cells: canvasData
            };
            const jsonContent = JSON.stringify(fileData, null, 2);

            const saveResult = await FileSystemManager.createOrUpdateFile(currentFilePath, jsonContent, {
                currentUser: UserManager.getCurrentUser().name,
                primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name)
            });

            if (saveResult.success && await FileSystemManager.save()) {
                state.isDirty = false;
                PaintUI.updateStatusBar(state);
            } else {
                console.error("Failed to save file:", saveResult.error);
            }
        }
    };

    function _saveUndoState() {
        if (!state.isDirty) return; // Don't save state if nothing changed
        state.redoStack = [];
        state.undoStack.push(JSON.parse(JSON.stringify(state.canvasData)));
        if (state.undoStack.length > 50) {
            state.undoStack.shift();
        }
        PaintUI.updateToolbar(state);
    }

    function enter(filePath, fileContent) {
        if (state.isActive) {
            return;
        }
        _resetState();
        state.isActive = true;
        state.currentFilePath = filePath;

        if (fileContent) {
            try {
                const parsed = JSON.parse(fileContent);
                state.canvasData = parsed.cells;
                state.canvasDimensions = { width: parsed.width, height: parsed.height };
            } catch (e) {
                state.canvasData = _createBlankCanvas();
            }
        } else {
            state.canvasData = _createBlankCanvas();
        }

        state.undoStack.push(JSON.parse(JSON.stringify(state.canvasData)));
        PaintUI.buildAndShow(state, callbacks);
    }

    async function exit() {
        if (!state.isActive) {
            return;
        }

        if (state.isDirty) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: ["You have unsaved changes.", "Do you want to save before exiting?"],
                    confirmText: "Save & Exit",
                    cancelText: "Discard & Exit",
                    onConfirm: async () => {
                        await callbacks.onSaveRequest();
                        resolve(true);
                    },
                    onCancel: () => resolve(true)
                });
            });
            if (!confirmed) return;
        }

        PaintUI.hideAndReset();
        _resetState();
    }

    return {
        enter,
        exit,
        isActive: () => state.isActive,
    };
})();