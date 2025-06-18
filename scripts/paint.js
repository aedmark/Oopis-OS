// paint.js - OopisOS ASCII/ANSI Art Editor v1.3

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
    ]
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

        const leftGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.pencilBtn, elements.eraserBtn);
        const rightGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.saveExitBtn);

        elements.toolbar.appendChild(leftGroup);
        elements.toolbar.appendChild(colorPaletteContainer);
        elements.toolbar.appendChild(rightGroup);

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
        if (!elements.canvas || !cellDimensions.width || !cellDimensions.height) {
            return null;
        }

        const rect = elements.canvas.getBoundingClientRect();
        const x = pixelX - rect.left;
        const y = pixelY - rect.top;

        if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
            return null; // Outside the canvas
        }

        const gridX = Math.floor(x / cellDimensions.width);
        const gridY = Math.floor(y / cellDimensions.height);

        return { x: gridX, y: gridY };
    }


    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        const colorName = status.fg.replace('text-', '').replace(/-\d+/, '');
        elements.statusBar.textContent = `Tool: ${status.tool} | Char: '${status.char}' | Color: ${colorName} | Coords: ${status.coords.x},${status.coords.y}`;
    }

    function updateToolbar(activeTool, activeColor) {
        if (!isInitialized) return;
        elements.pencilBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'pencil');
        elements.eraserBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'eraser');

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

    function _createBlankCanvas(w, h) {
        let data = [];
        for (let y = 0; y < h; y++) {
            let row = [];
            for (let x = 0; x < w; x++) {
                row.push({
                    char: ' ',
                    fg: PaintAppConfig.DEFAULT_FG_COLOR,
                    bg: PaintAppConfig.ERASER_BG_COLOR
                });
            }
            data.push(row);
        }
        return data;
    }

    function _drawOnCanvas(x, y) {
        if (y < 0 || y >= canvasData.length || x < 0 || x >= canvasData[0].length) {
            return;
        }
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
        PaintUI.renderCanvas(canvasData);
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
        if(coords) {
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords });
        }
        if (!isDrawing || !coords) return;

        if (coords.x !== lastCoords.x || coords.y !== lastCoords.y) {
            // Simple line drawing logic (Bresenham's is overkill for this)
            // This just draws point by point as the mouse moves
            _drawOnCanvas(coords.x, coords.y);
            lastCoords = coords;
        }
    }

    function _handleMouseUp(e) {
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
    }

    function _handleMouseLeave(e) {
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
    }

    function _setTool(toolName) {
        currentTool = toolName;
        PaintUI.updateToolbar(currentTool, fgColor);
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
    }

    function _setColor(colorClass) {
        fgColor = colorClass;
        PaintUI.updateToolbar(currentTool, fgColor);
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
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
                if (parsed.cells && parsed.width && parsed.height) {
                    canvasData = parsed.cells;
                } else {
                    throw new Error("Invalid .oopic file format.");
                }
            } else {
                canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
            }
        } catch (e) {
            OutputManager.appendToOutput(`Error loading paint file: ${e.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
        }

        PaintUI.show({
            onMouseDown: _handleMouseDown,
            onMouseMove: _handleMouseMove,
            onMouseUp: _handleMouseUp,
            onMouseLeave: _handleMouseLeave,
            onToolChange: _setTool,
            onColorChange: _setColor,
            onSaveAndExit: () => exit(true)
        });

        PaintUI.renderCanvas(canvasData);
        PaintUI.updateToolbar(currentTool, fgColor);
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: {x: -1, y: -1} });

        document.addEventListener('keydown', handleKeyDown);
    }

    async function exit(save = false) {
        if (save && isDirty && currentFilePath) {
            const fileData = {
                version: "1.1",
                width: canvasData[0].length,
                height: canvasData.length,
                cells: canvasData
            };
            const jsonContent = JSON.stringify(fileData);

            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

            const saveResult = await FileSystemManager.createOrUpdateFile(
                currentFilePath, jsonContent, { currentUser, primaryGroup }
            );

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
        TerminalUI.setInputState(true);
        TerminalUI.focusInput();
    }

    function handleKeyDown(event) {
        if (!isActiveState) return;
        const key = event.key.toLowerCase();

        // Let browser handle developer tools, etc.
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const isAppKey = ['s', 'p', 'e', '1', '2', '3', '4', '5', '6'].includes(key);
        const isCharKey = key.length === 1;

        if (isAppKey || isCharKey) {
            event.preventDefault();

            if (key === 's') { exit(true); return; }
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