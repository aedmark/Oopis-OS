// scripts/apps/paint/paint_manager.js

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
        lastCoords: null,
        undoStack: [],
        redoStack: [],
        statusMessage: 'Ready',
        zoomLevel: 100,
        ZOOM_MIN: 50,
        ZOOM_MAX: 200,
        ZOOM_STEP: 10,
        selection: null,
        clipboard: null,
    };

    // --- Core Lifecycle ---
    function enter(filePath, fileContent) {
        if (state.isActive) return;

        state = { ...defaultState };
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
        state = {};
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

    function _getCellsForEllipse(xc, yc, rx, ry, char, color) {
        if (rx < 0 || ry < 0) return [];
        const allPoints = [];

        function plotPoints(x, y) {
            allPoints.push(..._getCellsInBrush(xc + x, yc + y, char, color));
            allPoints.push(..._getCellsInBrush(xc - x, yc + y, char, color));
            allPoints.push(..._getCellsInBrush(xc + x, yc - y, char, color));
            allPoints.push(..._getCellsInBrush(xc - x, yc - y, char, color));
        }

        let x = 0;
        let y = ry;
        let rx2 = rx * rx;
        let ry2 = ry * ry;
        let twoRx2 = 2 * rx2;
        let twoRy2 = 2 * ry2;
        let p;
        let px = 0;
        let py = twoRx2 * y;

        // Region 1
        plotPoints(x, y);
        p = Math.round(ry2 - (rx2 * ry) + (0.25 * rx2));
        while (px < py) {
            x++;
            px += twoRy2;
            if (p < 0) {
                p += ry2 + px;
            } else {
                y--;
                py -= twoRx2;
                p += ry2 + px - py;
            }
            plotPoints(x, y);
        }

        // Region 2
        p = Math.round(ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2);
        while (y > 0) {
            y--;
            py -= twoRx2;
            if (p > 0) {
                p += rx2 - py;
            } else {
                x++;
                px += twoRy2;
                p += rx2 - py + px;
            }
            plotPoints(x, y);
        }

        const uniqueCells = [];
        const seen = new Set();
        for (const cell of allPoints) {
            const key = `${cell.x},${cell.y}`;
            if (!seen.has(key)) {
                uniqueCells.push(cell);
                seen.add(key);
            }
        }
        return uniqueCells;
    }

    // Flood Fill algorithm
    function _getCellsForFill(startX, startY, fillColor, fillChar) {
        const {width, height} = state.canvasDimensions;
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
            return [];
        }

        const targetColor = state.canvasData[startY][startX].color;
        const targetChar = state.canvasData[startY][startX].char;

        if (targetColor === fillColor && targetChar === fillChar) {
            return []; // No need to fill if the target is already the fill color/char
        }

        const affectedCells = [];
        const queue = [[startX, startY]];
        const visited = new Set([`${startX},${startY}`]);

        while (queue.length > 0) {
            const [x, y] = queue.shift();

            if (x < 0 || x >= width || y < 0 || y >= height) {
                continue;
            }

            const currentCell = state.canvasData[y][x];
            if (currentCell.color === targetColor && currentCell.char === targetChar) {
                affectedCells.push({x, y, char: fillChar, color: fillColor});

                const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
                for (const [nx, ny] of neighbors) {
                    const key = `${nx},${ny}`;
                    if (!visited.has(key)) {
                        queue.push([nx, ny]);
                        visited.add(key);
                    }
                }
            }
        }
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
            if (state.undoStack.length > 50) {
                state.undoStack.shift();
            }
            state.redoStack = [];
            state.isDirty = true;
            PaintUI.updateToolbar(state);
            PaintUI.updateStatusBar(state);
        }
    }

    function _copySelectionToClipboard() {
        if (!state.selection) return;
        const {x, y, width, height} = state.selection;
        const clipboardData = [];
        for (let i = 0; i < height; i++) {
            const row = [];
            for (let j = 0; j < width; j++) {
                row.push(state.canvasData[y + i][x + j]);
            }
            clipboardData.push(row);
        }
        state.clipboard = clipboardData;
    }


    // --- UI Callbacks ---
    const callbacks = {
        onToolSelect: (tool) => {
            if (state.currentTool === 'select' && tool !== 'select') {
                state.selection = null;
                PaintUI.hideSelectionRect();
            }
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
            if (state.undoStack.length > 1) {
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
            if (state.currentTool === 'fill') {
                const char = state.currentCharacter;
                const color = state.currentColor;
                const fillCells = _getCellsForFill(coords.x, coords.y, color, char);
                if (fillCells.length > 0) {
                    const patch = _applyCellsToData(fillCells);
                    _pushToUndoStack(patch);
                    PaintUI.updateCanvas(fillCells);
                }
                return;
            }
            state.isDrawing = true;
            state.startCoords = coords;
            state.lastCoords = coords;
        },
        onCanvasMouseMove: (coords) => {
            state.lastCoords = coords;

            const char = state.currentTool === 'eraser' ? ' ' : state.currentCharacter;
            const color = state.currentTool === 'eraser' ? '#000000' : state.currentColor;

            let previewCells = [];
            if (state.isDrawing) {
                if (state.currentTool === 'select') {
                    const x = Math.min(state.startCoords.x, coords.x);
                    const y = Math.min(state.startCoords.y, coords.y);
                    const width = Math.abs(state.startCoords.x - coords.x) + 1;
                    const height = Math.abs(state.startCoords.y - coords.y) + 1;
                    PaintUI.showSelectionRect({x, y, width, height});
                } else if (state.currentTool === 'line') {
                    previewCells = _getCellsForLine(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                } else if (state.currentTool === 'rect') {
                    previewCells = _getCellsForRect(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                } else if (state.currentTool === 'circle') {
                    const rx = Math.abs(state.startCoords.x - coords.x);
                    const ry = Math.abs(state.startCoords.y - coords.y);
                    previewCells = _getCellsForEllipse(state.startCoords.x, state.startCoords.y, rx, ry, char, color);
                } else if (state.currentTool === 'pencil' || state.currentTool === 'eraser') {
                    const cells = _getCellsForLine(state.startCoords.x, state.startCoords.y, coords.x, coords.y, char, color);
                    const patch = _applyCellsToData(cells);
                    _pushToUndoStack(patch);
                    PaintUI.updateCanvas(cells);
                    state.startCoords = coords;
                }
            } else if (state.currentTool !== 'select') {
                previewCells = _getCellsInBrush(coords.x, coords.y, char, color);
            }

            PaintUI.updatePreviewCanvas(previewCells);
            PaintUI.updateStatusBar(state, coords);
        },
        onCanvasMouseUp: (coords) => {
            if (!state.isDrawing) return;

            const endCoords = coords || state.lastCoords;

            state.isDrawing = false;
            PaintUI.updatePreviewCanvas([]);

            if (state.currentTool === 'select' && state.startCoords) {
                const x = Math.min(state.startCoords.x, endCoords.x);
                const y = Math.min(state.startCoords.y, endCoords.y);
                const width = Math.abs(state.startCoords.x - endCoords.x) + 1;
                const height = Math.abs(state.startCoords.y - endCoords.y) + 1;
                state.selection = {x, y, width, height};
            } else if (state.currentTool !== 'select') {
                if (!state.startCoords || !endCoords) {
                    state.startCoords = null;
                    state.lastCoords = null;
                    return;
                }

                const char = state.currentTool === 'eraser' ? ' ' : state.currentCharacter;
                const color = state.currentTool === 'eraser' ? '#000000' : state.currentColor;

                let finalCells = [];
                if (state.currentTool === 'line') {
                    finalCells = _getCellsForLine(state.startCoords.x, state.startCoords.y, endCoords.x, endCoords.y, char, color);
                } else if (state.currentTool === 'rect') {
                    finalCells = _getCellsForRect(state.startCoords.x, state.startCoords.y, endCoords.x, endCoords.y, char, color);
                } else if (state.currentTool === 'circle') {
                    const rx = Math.abs(state.startCoords.x - endCoords.x);
                    const ry = Math.abs(state.startCoords.y - endCoords.y);
                    finalCells = _getCellsForEllipse(state.startCoords.x, state.startCoords.y, rx, ry, char, color);
                }

                if (finalCells.length > 0) {
                    const patch = _applyCellsToData(finalCells);
                    _pushToUndoStack(patch);
                    PaintUI.updateCanvas(finalCells);
                }
            }


            state.startCoords = null;
            state.lastCoords = null;
        },
        onCut: () => {
            _copySelectionToClipboard();
            const {x, y, width, height} = state.selection;
            const erasedCells = [];
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    erasedCells.push({x: x + j, y: y + i, char: ' ', color: '#000000'});
                }
            }
            if (erasedCells.length > 0) {
                const patch = _applyCellsToData(erasedCells);
                _pushToUndoStack(patch);
                PaintUI.updateCanvas(erasedCells);
            }
            state.selection = null;
            PaintUI.hideSelectionRect();
        },

        onCopy: () => {
            _copySelectionToClipboard();
            state.selection = null;
            PaintUI.hideSelectionRect();
        },

        onPaste: () => {
            if (!state.clipboard || !state.lastCoords) return;
            const pasteX = state.lastCoords.x;
            const pasteY = state.lastCoords.y;
            const pastedCells = [];

            for (let i = 0; i < state.clipboard.length; i++) {
                for (let j = 0; j < state.clipboard[i].length; j++) {
                    pastedCells.push({
                        x: pasteX + j,
                        y: pasteY + i,
                        ...state.clipboard[i][j]
                    });
                }
            }
            if (pastedCells.length > 0) {
                const patch = _applyCellsToData(pastedCells);
                _pushToUndoStack(patch);
                PaintUI.updateCanvas(pastedCells);
            }
        },
        onSaveRequest: saveContent,
        onExitRequest: exit,
        onZoomIn: () => {
            state.zoomLevel = Math.min(state.ZOOM_MAX, state.zoomLevel + state.ZOOM_STEP);
            PaintUI.updateZoom(state.zoomLevel);
            PaintUI.updateStatusBar(state);
        },
        onZoomOut: () => {
            state.zoomLevel = Math.max(state.ZOOM_MIN, state.zoomLevel - state.ZOOM_STEP);
            PaintUI.updateZoom(state.zoomLevel);
            PaintUI.updateStatusBar(state);
        }
    };

    return { enter, exit, isActive: () => state.isActive };
})();