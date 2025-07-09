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
        undoStack: [],
        redoStack: [],
        isGridVisible: false,
        isDrawing: false,
        startCoords: null,
        previewCanvasData: null,
        mouseCoords: { x: -1, y: -1 }
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
            undoStack: [],
            redoStack: [],
            isGridVisible: false,
            isDrawing: false,
            startCoords: null,
            previewCanvasData: null,
            mouseCoords: { x: -1, y: -1 }
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

    function _setCell(x, y, data, tool, char, color) {
        if (y >= 0 && y < state.canvasDimensions.height && x >= 0 && x < state.canvasDimensions.width) {
            const cell = data[y][x];
            const newChar = tool === 'eraser' ? ' ' : char;
            const newColor = tool === 'eraser' ? '#FFFFFF' : color;
            const newBg = '#000000';

            if (cell.char !== newChar || cell.fg !== newColor || cell.bg !== newBg) {
                cell.char = newChar;
                cell.fg = newColor;
                cell.bg = newBg;
                return true;
            }
        }
        return false;
    }

    function _drawAt(coords, data, tool, char, color, brushSize) {
        const halfBrush = Math.floor(brushSize / 2);
        let changed = false;

        for (let i = -halfBrush; i <= halfBrush; i++) {
            for (let j = -halfBrush; j <= halfBrush; j++) {
                if (_setCell(coords.x + j, coords.y + i, data, tool, char, color)) {
                    changed = true;
                }
            }
        }
        return changed;
    }

    function _drawLine(start, end, data, tool, char, color) {
        let { x: x1, y: y1 } = start;
        let { x: x2, y: y2 } = end;
        const dx = Math.abs(x2 - x1);
        const dy = -Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx + dy;

        while (true) {
            _setCell(x1, y1, data, tool, char, color);
            if (x1 === x2 && y1 === y2) break;
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x1 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y1 += sy;
            }
        }
    }

    function _drawRect(start, end, data, tool, char, color) {
        const x1 = Math.min(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const x2 = Math.max(start.x, end.x);
        const y2 = Math.max(start.y, end.y);

        for (let x = x1; x <= x2; x++) {
            _setCell(x, y1, data, tool, char, color);
            _setCell(x, y2, data, tool, char, color);
        }
        for (let y = y1; y <= y2; y++) {
            _setCell(x1, y, data, tool, char, color);
            _setCell(x2, y, data, tool, char, color);
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
        onGridToggle: () => {
            state.isGridVisible = !state.isGridVisible;
            PaintUI.updateToolbar(state);
            PaintUI.toggleGrid(state.isGridVisible);
        },
        onCanvasMouseDown: (coords) => {
            state.isDrawing = true;
            _saveUndoState();

            if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
                if (_drawAt(coords, state.canvasData, state.currentTool, state.activeCharacter, state.activeColor, state.brushSize)) {
                    PaintUI.renderCanvas(state);
                    state.isDirty = true;
                    PaintUI.updateStatusBar(state);
                }
            } else if (['line', 'rect'].includes(state.currentTool)) {
                state.startCoords = coords;
                state.previewCanvasData = JSON.parse(JSON.stringify(state.canvasData));
            }
        },
        onCanvasMouseMove: (coords) => {
            state.mouseCoords = coords;
            PaintUI.updateStatusBar(state);
            if (!state.isDrawing) return;

            if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
                if (_drawAt(coords, state.canvasData, state.currentTool, state.activeCharacter, state.activeColor, state.brushSize)) {
                    PaintUI.renderCanvas(state);
                    state.isDirty = true;
                }
            } else if (['line', 'rect'].includes(state.currentTool) && state.startCoords) {
                state.previewCanvasData = JSON.parse(JSON.stringify(state.canvasData));
                const drawFunc = state.currentTool === 'line' ? _drawLine : _drawRect;
                drawFunc(state.startCoords, coords, state.previewCanvasData, state.currentTool, state.activeCharacter, state.activeColor);
                PaintUI.renderCanvas({ ...state, canvasData: state.previewCanvasData });
            }
        },
        onCanvasMouseUp: (coords) => {
            if (!state.isDrawing) return;
            state.isDrawing = false;

            if (['line', 'rect'].includes(state.currentTool) && state.startCoords) {
                const drawFunc = state.currentTool === 'line' ? _drawLine : _drawRect;
                drawFunc(state.startCoords, coords, state.canvasData, state.currentTool, state.activeCharacter, state.activeColor);
                PaintUI.renderCanvas(state);
                state.isDirty = true;
                _saveUndoState();
            }

            state.startCoords = null;
            state.previewCanvasData = null;
        },
        onUndo: () => {
            if (state.undoStack.length > 1) {
                state.redoStack.push(state.undoStack.pop());
                state.canvasData = JSON.parse(JSON.stringify(state.undoStack.at(-1)));
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
        onReplaceAll: (findChar, replaceChar) => {
            if (!findChar || !replaceChar || findChar === replaceChar) return;
            _saveUndoState();
            let changed = false;
            state.canvasData.forEach(row => {
                row.forEach(cell => {
                    if (cell.char === findChar) {
                        cell.char = replaceChar;
                        changed = true;
                    }
                });
            });
            if (changed) {
                PaintUI.renderCanvas(state);
                state.isDirty = true;
                _saveUndoState();
                PaintUI.updateStatusBar(state);
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

    const debouncedSaveUndo = Utils.debounce(() => {
        state.undoStack.push(JSON.parse(JSON.stringify(state.canvasData)));
        if (state.undoStack.length > 50) {
            state.undoStack.shift();
        }
        state.redoStack = [];
        PaintUI.updateToolbar(state);
    }, 300);


    function _saveUndoState() {
        debouncedSaveUndo();
    }

    function _handleKeyDown(e) {
        if (!state.isActive) return;

        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 's': e.preventDefault(); callbacks.onSaveRequest(); break;
                case 'z': e.preventDefault(); e.shiftKey ? callbacks.onRedo() : callbacks.onUndo(); break;
                case 'y': e.preventDefault(); callbacks.onRedo(); break;
            }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            switch (e.key.toLowerCase()) {
                case 'p': callbacks.onToolSelect('pencil'); break;
                case 'e': callbacks.onToolSelect('eraser'); break;
                case 'l': callbacks.onToolSelect('line'); break;
                case 'r': callbacks.onToolSelect('rect'); break;
                default:
                    if ("`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./".includes(e.key.toLowerCase())) {
                        callbacks.onCharSelect(e.key);
                    }
                    break;
            }
        } else if (e.key === 'Escape') {
            exit();
        }
    }


    function enter(filePath, fileContent) {
        if (state.isActive) return;
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
        document.addEventListener('keydown', _handleKeyDown);
        PaintUI.buildAndShow(state, callbacks);
    }

    async function exit() {
        if (!state.isActive) return;

        if (state.isDirty) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: ["You have unsaved changes. Save before exiting?"],
                    confirmText: "Save & Exit",
                    cancelText: "Discard & Exit",
                    onConfirm: async () => {
                        await callbacks.onSaveRequest();
                        resolve(true);
                    },
                    onCancel: async () => {
                        const discardConfirmed = await new Promise(res => {
                            ModalManager.request({
                                context: 'graphical',
                                messageLines: ["Are you sure you want to discard all changes?"],
                                onConfirm: () => res(true),
                                onCancel: () => res(false)
                            });
                        });
                        resolve(discardConfirmed);
                    }
                });
            });

            if (!confirmed) {
                await OutputManager.appendToOutput("Exit cancelled.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                return;
            }
        }

        document.removeEventListener('keydown', _handleKeyDown);
        PaintUI.hideAndReset();
        _resetState();
    }

    return {
        enter,
        exit,
        isActive: () => state.isActive,
    };
})();