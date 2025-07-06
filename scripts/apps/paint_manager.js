// scripts/apps/paint_manager.js
/**
 * @file Manages the main controller for the paint application.
 */
/* global Utils, DOM, Config, FileSystemManager, OutputManager, TerminalUI, UserManager, ModalManager, AppLayerManager, PaintUI */
const PaintManager = (() => {
    "use strict";
    let isActiveState = false, currentFilePath = null, canvasData = [], isDirty = false;
    let isDrawing = false, currentTool = 'pencil', drawChar; // Initialized below
    let fgColor, lastCoords = { x: -1, y: -1 }; // Initialized below
    let currentBrushSize; // Initialized below
    let zoomLevel; // Initialized below
    let undoStack = [], redoStack = [], saveUndoStateTimeout = null;
    let isGridVisible = false;
    let shapeStartCoords = null;
    let shapePreviewBaseState = null;
    let paintContainerElement = null;
    let _boundGlobalClickListener = null;
    let customColorValue = null;
    let pointsToDraw = [];
    let isFrameScheduled = false;

    let currentCanvasWidth = 0;
    let currentCanvasHeight = 0;

    // Defensive initialization of PaintAppConfig.
    // This ensures it's always defined, even if Config.PaintAppConfig is not yet fully populated.
    const PaintAppConfig = window.Config && window.Config.PaintAppConfig ? window.Config.PaintAppConfig : {
        // Minimal fallback structure to prevent errors if CSS_CLASSES or other properties are accessed early
        CSS_CLASSES: { ACTIVE_TOOL: "active", GRID_ACTIVE: "grid-active" },
        PALETTE: [{ value: "#00ff5b" }],
        CANVAS: { DEFAULT_WIDTH: 80, DEFAULT_HEIGHT: 24, BASE_FONT_SIZE_PX: 16 },
        BRUSH: { MIN_SIZE: 1, MAX_SIZE: 5 },
        ZOOM: { DEFAULT_ZOOM: 100, MIN_ZOOM: 50, MAX_ZOOM: 400, ZOOM_STEP: 25 },
        ASCII_CHAR_RANGE: { START: 32, END: 126 },
        DEFAULT_CHAR: ' ',
        ERASER_CHAR: ' ',
        DEFAULT_FG_COLOR: '#00ff5b',
        ERASER_BG_COLOR: 'bg-black',
        DEFAULT_BG_COLOR: 'bg-transparent',
        FILE_EXTENSION: 'oopic',
        EDITOR: { MAX_UNDO_STATES: 100, DEBOUNCE_DELAY_MS: 300 }
    };

    // Initialize these global-like variables using the local alias
    drawChar = PaintAppConfig.DEFAULT_CHAR;
    fgColor = PaintAppConfig.PALETTE[0].value;
    currentBrushSize = PaintAppConfig.BRUSH.DEFAULT_SIZE;
    zoomLevel = PaintAppConfig.ZOOM.DEFAULT_ZOOM;


    const paintEventCallbacks = {
        onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onToolChange: _setTool, onColorChange: _setColor,
        onSave: _handleSave, onExit: () => exit(), onUndo: _performUndo, onRedo: _performRedo,
        onGridToggle: _toggleGrid, onCharSelectOpen: _openCharSelect, onColorSelectOpen: _openColorSelect,
        onBrushSizeUp: () => _setBrushSize(1), onBrushSizeDown: () => _setBrushSize(-1),
        onZoomIn: _handleZoomIn, onZoomOut: _handleZoomOut, onZoomReset: _resetZoom,
        onCustomHexSet: _setCustomHexColor,
        onCustomSwatchClick: () => {
            if (customColorValue) {
                _setColor(customColorValue);
            } else {
                _openColorSelect();
            }
        },
        onResize: _handleResize,
    };

    function _getLinePoints(x0, y0, x1, y1) {
        const points = [];
        const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        while (true) {
            points.push({ x: x0, y: y0 });
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return points;
    }

    function _getRectanglePoints(x0, y0, x1, y1) {
        const points = new Set();
        _getLinePoints(x0, y0, x1, y0).forEach(p => points.add(`${p.x},${p.y}`));
        _getLinePoints(x1, y0, x1, y1).forEach(p => points.add(`${p.x},${p.y}`));
        _getLinePoints(x1, y1, x0, y1).forEach(p => points.add(`${p.x},${p.y}`));
        _getLinePoints(x0, y1, x0, y0).forEach(p => points.add(`${p.x},${p.y}`));
        return Array.from(points).map(p => { const [x, y] = p.split(',').map(Number); return { x, y }; });
    }

    function _getEllipsePoints(cx, cy, rx, ry) {
        if (rx < 0 || ry < 0) return [];
        const points = new Set();
        let x = 0, y = ry;
        let p1 = (ry * ry) - (rx * rx * ry) + (0.25 * rx * rx);
        let dx = 2 * ry * ry * x;
        let dy = 2 * rx * rx * y;
        while (dx < dy) {
            points.add(`${cx + x},${cy + y}`); points.add(`${cx - x},${cy + y}`); points.add(`${cx + x},${cy - y}`); points.add(`${cx - x},${cy - y}`);
            if (p1 < 0) { x++; dx = dx + (2 * ry * ry); p1 = p1 + dx + (ry * ry); }
            else { x++; y--; dx = dx + (2 * ry * ry); dy = dy - (2 * rx * rx); p1 = p1 + dx - dy + (ry * ry); }
        }
        let p2 = ((ry * ry) * ((x + 0.5) * (x + 0.5))) + ((rx * rx) * ((y - 1) * (y - 1))) - (rx * rx * ry * ry);
        while (y >= 0) {
            points.add(`${cx + x},${cy + y}`); points.add(`${cx - x},${cy + y}`); points.add(`${cx + x},${cy - y}`); points.add(`${cx - x},${cy - y}`);
            if (p2 > 0) { y--; dy = dy - (2 * rx * rx); p2 = p2 + (rx * rx) - dy; }
            else { y--; x++; dx = dx + (2 * ry * ry); dy = dy - (2 * rx * rx); p2 = p2 + dx - dy + (rx * rx); }
        }
        return Array.from(points).map(p => { const [px, py] = p.split(',').map(Number); return { x: px, y: py }; });
    }

    function _createBlankCanvas(w, h) {
        let data = [];
        for (let y = 0; y < h; y++) {
            data.push(Array.from({ length: w }, () => ({ char: ' ', fg: PaintAppConfig.DEFAULT_FG_COLOR, bg: PaintAppConfig.ERASER_BG_COLOR })));
        }
        return data;
    }

    function _initializeNewCanvasDimensions() {
        const wrapper = document.getElementById('paint-canvas-wrapper');
        const canvasEl = document.getElementById('paint-canvas');

        if (!wrapper || !canvasEl) {
            currentCanvasWidth = PaintAppConfig.CANVAS.DEFAULT_WIDTH;
            currentCanvasHeight = PaintAppConfig.CANVAS.DEFAULT_HEIGHT;
            canvasData = _createBlankCanvas(currentCanvasWidth, currentCanvasHeight);
            return;
        }

        canvasEl.style.fontSize = `${PaintAppConfig.CANVAS.BASE_FONT_SIZE_PX}px`;
        const charDims = Utils.getCharacterDimensions(canvasEl.style.font);

        if (charDims.width <= 0 || charDims.height <= 0) {
            currentCanvasWidth = PaintAppConfig.CANVAS.DEFAULT_WIDTH;
            currentCanvasHeight = PaintAppConfig.CANVAS.DEFAULT_HEIGHT;
        } else {
            const availableWidth = wrapper.clientWidth;
            const availableHeight = wrapper.clientHeight;
            const targetAspectRatio = 4 / 3;

            let newCanvasPixelWidth, newCanvasPixelHeight;

            // Determine if the canvas should be letterboxed or pillarboxed
            if (availableWidth / availableHeight > targetAspectRatio) {
                // Container is wider than the target aspect ratio (pillarbox)
                newCanvasPixelHeight = availableHeight;
                newCanvasPixelWidth = newCanvasPixelHeight * targetAspectRatio;
            } else {
                // Container is taller than the target aspect ratio (letterbox)
                newCanvasPixelWidth = availableWidth;
                newCanvasPixelHeight = newCanvasPixelWidth / targetAspectRatio;
            }

            currentCanvasWidth = Math.floor(newCanvasPixelWidth / charDims.width);
            currentCanvasHeight = Math.floor(newCanvasPixelHeight / charDims.height);
        }

        canvasData = _createBlankCanvas(currentCanvasWidth, currentCanvasHeight);
    }

    function _handleResize() {
        // The function is left as a placeholder for the event listener but does nothing.
    }


    function _updateToolbarState() { PaintUI.updateToolbar(currentTool, fgColor, undoStack.length > 1, redoStack.length > 0, isGridVisible, currentBrushSize); }
    function _saveUndoState() {
        redoStack = [];
        undoStack.push(JSON.parse(JSON.stringify(canvasData)));
        if (undoStack.length > PaintAppConfig.EDITOR.MAX_UNDO_STATES) { undoStack.shift(); }
        _updateToolbarState();
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
        PaintUI.renderCanvas(canvasData, zoomLevel);
        _updateToolbarState();
    }
    function _performRedo() {
        if (redoStack.length === 0) return;
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        canvasData = JSON.parse(JSON.stringify(nextState));
        PaintUI.renderCanvas(canvasData, zoomLevel);
        _updateToolbarState();
    }
    function _toggleGrid() { isGridVisible = !isGridVisible; PaintUI.toggleGrid(isGridVisible); _updateToolbarState(); }
    function _openCharSelect() { PaintUI.populateAndShowCharSelect(_setDrawCharFromSelection); }
    function _openColorSelect() { PaintUI.populateAndShowColorSelect(_setColor, _setCustomHexColor); }
    function _setDrawCharFromSelection(char) {
        drawChar = char;
        PaintUI.hideCharSelect();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords, brushSize: currentBrushSize, zoomLevel: zoomLevel });
    }

    function _setCustomHexColor(hex) {
        if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) {
            customColorValue = hex;
            _setColor(hex);
        } else {
            alert("Invalid hex color format. Please use #RRGGBB or #RGB.");
        }
    }

    function _setBrushSize(delta) {
        const newSize = currentBrushSize + delta;
        currentBrushSize = Math.max(PaintAppConfig.BRUSH.MIN_SIZE, Math.min(newSize, PaintAppConfig.BRUSH.MAX_SIZE));
        _updateToolbarState();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords, brushSize: currentBrushSize, zoomLevel: zoomLevel });
    }

    function _handleZoomIn() {
        zoomLevel = Math.min(zoomLevel + PaintAppConfig.ZOOM.ZOOM_STEP, PaintAppConfig.ZOOM.MAX_ZOOM);
        PaintUI.renderCanvas(canvasData, zoomLevel);
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords, brushSize: currentBrushSize, zoomLevel: zoomLevel });
    }
    function _handleZoomOut() {
        zoomLevel = Math.max(zoomLevel - PaintAppConfig.ZOOM.ZOOM_STEP, PaintAppConfig.ZOOM.MIN_ZOOM);
        PaintUI.renderCanvas(canvasData, zoomLevel);
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords, brushSize: currentBrushSize, zoomLevel: zoomLevel });
    }
    function _resetZoom() {
        zoomLevel = PaintAppConfig.ZOOM.DEFAULT_ZOOM;
        PaintUI.renderCanvas(canvasData, zoomLevel);
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords, brushSize: currentBrushSize, zoomLevel: zoomLevel });
    }

    function _drawOnCanvas(x, y, targetCanvas = null) {
        const canvas = targetCanvas || canvasData;
        const drawLogic = (cx, cy) => {
            if (cy < 0 || cy >= canvas.length || cx < 0 || cx >= canvas[0].length) return false;
            const cell = canvas[cy][cx];
            let changed = false;
            if (currentTool !== 'eraser') {
                if (cell.char !== drawChar || cell.fg !== fgColor || cell.bg !== PaintAppConfig.DEFAULT_BG_COLOR) {
                    cell.char = drawChar; cell.fg = fgColor; cell.bg = PaintAppConfig.DEFAULT_BG_COLOR;
                    changed = true;
                }
            } else {
                if (cell.char !== PaintAppConfig.ERASER_CHAR || cell.bg !== PaintAppConfig.ERASER_BG_COLOR) {
                    cell.char = PaintAppConfig.ERASER_CHAR; cell.fg = PaintAppConfig.DEFAULT_FG_COLOR; cell.bg = PaintAppConfig.ERASER_BG_COLOR;
                    changed = true;
                }
            }
            if (changed && !targetCanvas) {
                PaintUI.updateCell(cx, cy, cell);
            }
            return changed;
        };

        let anyCellChanged = false;
        if (currentTool === 'pencil' || currentTool === 'eraser') {
            const halfBrush = Math.floor(currentBrushSize / 2);
            for (let dy = 0; dy < currentBrushSize; dy++) {
                for (let dx = 0; dx < currentBrushSize; dx++) {
                    // FIX: Call drawLogic directly instead of _drawOnCanvas recursively
                    if (drawLogic(x - halfBrush + dx, y - halfBrush + dy)) {
                        anyCellChanged = true;
                    }
                }
            }
        } else {
            if (drawLogic(x, y)) {
                anyCellChanged = true;
            }
        }

        if (anyCellChanged && !targetCanvas) {
            isDirty = true;
        }
        return anyCellChanged;
    }


    function drawScheduledPoints() {
        if (!isDrawing || pointsToDraw.length < 2) {
            isFrameScheduled = false;
            return;
        }

        for (let i = 0; i < pointsToDraw.length - 1; i++) {
            const start = pointsToDraw[i];
            const end = pointsToDraw[i + 1];
            const linePoints = _getLinePoints(start.x, start.y, end.x, end.y);
            linePoints.forEach(p => _drawOnCanvas(p.x, p.y));
        }

        pointsToDraw = [pointsToDraw.at(-1)];
        isFrameScheduled = false;
    }

    function onMouseDown(e) {
        e.preventDefault();
        const coords = (e.touches)
            ? PaintUI.getGridCoordinates(e.touches[0].clientX, e.touches[0].clientY, currentCanvasWidth, currentCanvasHeight)
            : PaintUI.getGridCoordinates(e.clientX, e.clientY, currentCanvasWidth, currentCanvasHeight);

        isDrawing = true;
        if (!coords) return;

        lastCoords = coords;
        if (['line', 'ellipse', 'quad'].includes(currentTool)) {
            shapeStartCoords = { ...coords };
            shapePreviewBaseState = JSON.parse(JSON.stringify(canvasData));
        } else {
            pointsToDraw = [];
            pointsToDraw.push(coords);
            _drawOnCanvas(coords.x, coords.y);
        }
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords, brushSize: currentBrushSize, zoomLevel: zoomLevel });
    }

    function onMouseMove(e) {
        e.preventDefault();
        const coords = (e.touches)
            ? PaintUI.getGridCoordinates(e.touches[0].clientX, e.touches[0].clientY, currentCanvasWidth, currentCanvasHeight)
            : PaintUI.getGridCoordinates(e.clientX, e.clientY, currentCanvasWidth, currentCanvasHeight);

        if (coords) {
            lastCoords = coords;
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords, brushSize: currentBrushSize, zoomLevel: zoomLevel });
        }
        if (!isDrawing || !coords) return;

        if (currentTool === 'pencil' || currentTool === 'eraser') {
            pointsToDraw.push(coords);
            if (!isFrameScheduled) {
                isFrameScheduled = true;
                requestAnimationFrame(drawScheduledPoints);
            }
        } else if (shapeStartCoords) {
            let tempCanvasData = JSON.parse(JSON.stringify(shapePreviewBaseState));
            let points = [];
            if (currentTool === 'line') { points = _getLinePoints(shapeStartCoords.x, shapeStartCoords.y, coords.x, coords.y); }
            else if (currentTool === 'quad') { points = _getRectanglePoints(shapeStartCoords.x, shapeStartCoords.y, coords.x, coords.y); }
            else if (currentTool === 'ellipse') {
                let rx = Math.abs(coords.x - shapeStartCoords.x); let ry = Math.abs(coords.y - shapeStartCoords.y);
                if (e.shiftKey) { rx = ry = Math.max(rx, ry); }
                points = _getEllipsePoints(shapeStartCoords.x, shapeStartCoords.y, rx, ry);
            }
            points.forEach(p => _drawOnCanvas(p.x, p.y, tempCanvasData));
            PaintUI.renderCanvas(tempCanvasData, zoomLevel);
        }
    }

    function onMouseUp(e) {
        if (!isDrawing) return;
        const endCoords = (e.changedTouches)
            ? PaintUI.getGridCoordinates(e.changedTouches[0].clientX, e.changedTouches[0].clientY, currentCanvasWidth, currentCanvasHeight) || lastCoords
            : PaintUI.getGridCoordinates(e.clientX, e.clientY, currentCanvasWidth, currentCanvasHeight) || lastCoords;

        if (shapeStartCoords) {
            let points = [];
            if (currentTool === 'line') { points = _getLinePoints(shapeStartCoords.x, shapeStartCoords.y, endCoords.x, endCoords.y); }
            else if (currentTool === 'quad') { points = _getRectanglePoints(shapeStartCoords.x, shapeStartCoords.y, endCoords.x, endCoords.y); }
            else if (currentTool === 'ellipse') {
                let rx = Math.abs(endCoords.x - shapeStartCoords.x); let ry = Math.abs(endCoords.y - shapeStartCoords.y);
                if (e.shiftKey) { rx = ry = Math.max(rx, ry); }
                points = _getEllipsePoints(shapeStartCoords.x, shapeStartCoords.y, rx, ry);
            }
            points.forEach(p => _drawOnCanvas(p.x, p.y));
        }

        isDrawing = false;
        if (pointsToDraw.length > 1) {
            drawScheduledPoints();
        }

        if (isDirty) { _triggerSaveUndoState(); }
        pointsToDraw = [];
        shapeStartCoords = null;
        shapePreviewBaseState = null;
    }

    function onMouseLeave(e) { if (isDrawing) { onMouseUp(e); } }
    function _setTool(toolName) {
        currentTool = toolName;
        _updateToolbarState();
        const dropdown = document.querySelector('.paint-dropdown-content');
        if (dropdown) { dropdown.classList.remove(Config.CSS_CLASSES.DROPDOWN_ACTIVE); }
    }
    function _setColor(colorValue) { fgColor = colorValue; _updateToolbarState(); PaintUI.hideColorSelect(); }
    function _resetState() {
        isActiveState = false; currentFilePath = null; canvasData = []; isDirty = false;
        isDrawing = false; currentTool = 'pencil'; drawChar = PaintAppConfig.DEFAULT_CHAR;
        fgColor = PaintAppConfig.PALETTE[0].value; lastCoords = { x: -1, y: -1 };
        currentBrushSize = PaintAppConfig.BRUSH.DEFAULT_SIZE;
        zoomLevel = PaintAppConfig.ZOOM.DEFAULT_ZOOM;
        undoStack = []; redoStack = []; isGridVisible = false;
        shapeStartCoords = null; shapePreviewBaseState = null; paintContainerElement = null;
        customColorValue = null;
        currentCanvasWidth = 0;
        currentCanvasHeight = 0;
        pointsToDraw = [];
        isFrameScheduled = false;
        if (saveUndoStateTimeout) { clearTimeout(saveUndoStateTimeout); saveUndoStateTimeout = null; }
    }

    async function _performSave(filePath) {
        if (!filePath) {
            await OutputManager.appendToOutput(`Cannot save. No filename specified.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return false;
        }
        const fileData = { version: "1.1", width: currentCanvasWidth, height: currentCanvasHeight, cells: canvasData };
        const jsonContent = JSON.stringify(fileData, null, 2);
        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        if (!primaryGroup) {
            await OutputManager.appendToOutput(`Critical Error: Could not determine primary group for user. Save failed.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return false;
        }
        const saveResult = await FileSystemManager.createOrUpdateFile(filePath, jsonContent, { currentUser, primaryGroup });
        if (saveResult.success) {
            if (await FileSystemManager.save()) {
                await OutputManager.appendToOutput(`Art saved to '${filePath}'.`, { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });
                isDirty = false;
                _updateToolbarState();
                return true;
            } else {
                await OutputManager.appendToOutput(`Error saving file system after art save.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                return false;
            }
        } else {
            await OutputManager.appendToOutput(`Error saving art: ${saveResult.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return false;
        }
    }

    async function _handleSave() {
        let savePath = currentFilePath;
        if (!savePath) {
            AppLayerManager.hide();
            const prospectivePathResult = await new Promise(resolve => {
                ModalInputManager.requestInput(
                    "Enter filename to save as:",
                    (filename) => {
                        if (!filename || filename.trim() === "") {
                            resolve({ path: null, reason: "Save cancelled. No filename provided." });
                        } else {
                            if (!filename.endsWith(`.${PaintAppConfig.FILE_EXTENSION}`)) {
                                filename += `.${PaintAppConfig.FILE_EXTENSION}`;
                            }
                            resolve({ path: FileSystemManager.getAbsolutePath(filename, FileSystemManager.getCurrentPath()), reason: null });
                        }
                    },
                    () => { resolve({ path: null, reason: "Save cancelled." }); },
                    false
                );
            });

            if (prospectivePathResult.path) {
                savePath = prospectivePathResult.path;
            } else {
                await OutputManager.appendToOutput(prospectivePathResult.reason, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                AppLayerManager.show(paintContainerElement); // Re-show paint UI
                return;
            }
        }

        const pathInfo = FileSystemManager.validatePath("paint save", savePath, { allowMissing: true });
        if (pathInfo.node) {
            const confirmedOverwrite = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: [`File '${pathInfo.resolvedPath.split('/').pop()}' already exists. Overwrite?`],
                    onConfirm: () => resolve(true), onCancel: () => resolve(false)
                });
            });
            if (!confirmedOverwrite) {
                await OutputManager.appendToOutput("Save cancelled by user.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                if (!currentFilePath) AppLayerManager.show(paintContainerElement); // Re-show if we were hidden
                return;
            }
        }

        const wasSaveSuccessful = await _performSave(savePath);
        if (wasSaveSuccessful) {
            currentFilePath = savePath;
        }

        if (!AppLayerManager.isActive()) {
            AppLayerManager.show(paintContainerElement);
        }
    }

    function enter(filePath, fileContent) {
        if (isActiveState) return;
        _resetState();
        isActiveState = true;

        paintContainerElement = PaintUI.buildLayout(paintEventCallbacks);
        AppLayerManager.show(paintContainerElement);

        setTimeout(() => {
            if (fileContent) {
                // ----------- REFACTORED BLOCK START -----------
                try {
                    const parsedData = JSON.parse(fileContent);
                    if (parsedData && parsedData.cells && parsedData.width && parsedData.height) {
                        canvasData = parsedData.cells;
                        currentCanvasWidth = parsedData.width;
                        currentCanvasHeight = parsedData.height;
                    } else {
                        // Handle invalid format directly instead of throwing.
                        void OutputManager.appendToOutput("Error loading paint file: Invalid .oopic file format.", { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                        _initializeNewCanvasDimensions();
                    }
                } catch (e) {
                    // This catch block now only handles JSON parsing errors.
                    void OutputManager.appendToOutput(`Error loading paint file: ${e.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                    _initializeNewCanvasDimensions(); // Fallback for corrupt files.
                }
                // ----------- REFACTORED BLOCK END -----------
            } else {
                _initializeNewCanvasDimensions();
            }

            undoStack = [JSON.parse(JSON.stringify(canvasData))];
            PaintUI.renderCanvas(canvasData, zoomLevel);
            PaintUI.toggleGrid(isGridVisible);
            _updateToolbarState();
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: {x: -1, y: -1}, brushSize: currentBrushSize, zoomLevel: zoomLevel });
        }, 0);


        _boundGlobalClickListener = (e) => {
            if (paintContainerElement) {
                const dropdown = paintContainerElement.querySelector('.paint-dropdown-content');
                const shapeContainer = paintContainerElement.querySelector('.paint-tool-dropdown');
                if (dropdown && shapeContainer && !shapeContainer.contains(e.target)) {
                    dropdown.classList.remove(Config.CSS_CLASSES.DROPDOWN_ACTIVE);
                }
            }
        };
        document.addEventListener('click', _boundGlobalClickListener);
        document.addEventListener('keydown', handleKeyDown);

        currentFilePath = filePath;
    }

    async function exit() {
        if (!isActiveState) return;

        if (isDirty) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: ["You have unsaved changes. Are you sure you want to exit and discard them?"],
                    confirmText: "Discard Changes",
                    cancelText: "Keep Painting",
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                });
            });
            if (!confirmed) {
                return;
            }
        }

        document.removeEventListener('keydown', handleKeyDown);
        if (_boundGlobalClickListener) {
            document.removeEventListener('click', _boundGlobalClickListener);
        }

        AppLayerManager.hide();
        PaintUI.reset();
        _resetState();
    }

    function handleKeyDown(event) {
        if (!isActiveState) return;
        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            if (key === 'z') { event.preventDefault(); _performUndo(); }
            else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); _performRedo(); }
            else if (key === 's') { event.preventDefault(); void _handleSave(); }
            else if (key === 'o') { event.preventDefault(); void exit(); }
            else if (key === '=' || key === '+') { event.preventDefault(); _handleZoomIn(); }
            else if (key === '-') { event.preventDefault(); _handleZoomOut(); }
            else if (key === '0') { event.preventDefault(); _resetZoom(); }
            return;
        }
        const key = event.key.toLowerCase();
        const shapeTools = ['line', 'quad', 'ellipse'];
        const isAppKey = ['p', 'e', 'l', 'g', 'c', '1', '2', '3', '4', '5', '6'].includes(key);
        const isCharKey = event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey;
        if (isAppKey) {
            event.preventDefault();
            if (key === 'p') { _setTool('pencil'); }
            else if (key === 'e') { _setTool('eraser'); }
            else if (key === 'l') {
                const currentShapeIndex = shapeTools.indexOf(currentTool);
                if (currentShapeIndex !== -1) {
                    const nextShapeIndex = (currentShapeIndex + 1) % shapeTools.length;
                    _setTool(shapeTools[nextShapeIndex]);
                } else { _setTool('line'); }
            }
            else if (key === 'g') { _toggleGrid(); }
            else if (key === 'c') { _openCharSelect(); }
            else {
                const colorIndex = parseInt(key, 10) - 1;
                if (colorIndex >= 0 && colorIndex < PaintAppConfig.PALETTE.length) {
                    _setColor(PaintAppConfig.PALETTE[colorIndex].value);
                }
            }
        } else if (isCharKey) {
            event.preventDefault();
            drawChar = event.key;
        }
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords, brushSize: currentBrushSize, zoomLevel: zoomLevel });
    }

    return { enter, exit, isActive: () => isActiveState };
})();

// Expose PaintManager globally for main.js and other modules
window.PaintManager = PaintManager;