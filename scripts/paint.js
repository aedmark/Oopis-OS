// paint.js - OopisOS ASCII/ANSI Art Editor v1.3 (UI, Save/Load, and Bugfixes)

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
        ACTIVE_TOOL: 'paint-tool-active', // NEW
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

    // UPDATED: Now builds an interactive toolbar
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

        // --- NEW: Interactive Toolbar Creation ---
        elements.toolbar.innerHTML = ''; // Clear static text

        // Tool Buttons
        elements.pencilBtn = Utils.createElement('button', { className: 'paint-tool', textContent: '[P]encil', eventListeners: { click: () => eventCallbacks.onToolChange('pencil') }});
        elements.eraserBtn = Utils.createElement('button', { className: 'paint-tool', textContent: '[E]raser', eventListeners: { click: () => eventCallbacks.onToolChange('eraser') }});

        // Color Palette
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

        // Exit Button
        elements.saveExitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: '[S]ave & Exit', eventListeners: { click: () => eventCallbacks.onSaveAndExit() }});

        const leftGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.pencilBtn, elements.eraserBtn);
        const rightGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.saveExitBtn);

        elements.toolbar.appendChild(leftGroup);
        elements.toolbar.appendChild(colorPaletteContainer);
        elements.toolbar.appendChild(rightGroup);
        // --- END: Toolbar Creation ---

        elements.canvas.addEventListener('mousedown', eventCallbacks.onMouseDown);
        document.addEventListener('mousemove', eventCallbacks.onMouseMove);
        document.addEventListener('mouseup', eventCallbacks.onMouseUp);
        elements.canvas.addEventListener('mouseleave', eventCallbacks.onMouseLeave);

        isInitialized = true;
        return true;
    }

    function _calculateCellSize() {
        if (!elements.canvas) return;
        const testSpan = Utils.createElement('span', { textContent: 'W' });
        elements.canvas.appendChild(testSpan);
        cellDimensions.width = testSpan.offsetWidth;
        cellDimensions.height = testSpan.offsetHeight;
        elements.canvas.removeChild(testSpan);
    }

    function getGridCoordinates(pixelX, pixelY) { /* ... (no changes here) ... */ return null; }

    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        const colorName = status.fg.replace('text-', '').replace(/-\d+/, '');
        elements.statusBar.textContent = `Tool: ${status.tool} | Char: '${status.char}' | Color: ${colorName} | Coords: ${status.coords.x},${status.coords.y}`;
    }

    // NEW: Function to update the visual state of the toolbar
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
        // THE FIX: Call _initDOM *after* removing the hidden class
        if (!elements.modal) _initDOM(callbacks); // Initial call to get the modal element
        elements.modal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);

        // Initialize or re-initialize DOM references and event listeners
        if(!isInitialized) _initDOM(callbacks);
        // Now that it's visible, calculate cell size
        _calculateCellSize();
    }

    function hide() { /* ... (no changes here) ... */ }
    function renderCanvas(canvasData) { /* ... (no changes here) ... */ }
    function reset() { /* ... (no changes here) ... */ }

    return { show, hide, renderCanvas, reset, getGridCoordinates, updateStatusBar, updateToolbar };
})();


const PaintManager = (() => {
    "use strict";
    let isActiveState = false, currentFilePath = null, canvasData = [], isDirty = false;
    let isDrawing = false, currentTool = 'pencil', drawChar = PaintAppConfig.DEFAULT_CHAR;
    let fgColor = PaintAppConfig.DEFAULT_FG_COLOR, lastCoords = { x: -1, y: -1 };

    function _createBlankCanvas(w, h) { /* ... (no changes here) ... */ }
    function _drawOnCanvas(x, y) { /* ... (no changes here) ... */ }
    function _handleMouseDown(e) { /* ... (no changes here) ... */ }
    function _handleMouseMove(e) { /* ... (no changes here) ... */ }
    function _handleMouseUp(e) { /* ... (no changes here) ... */ }
    function _handleMouseLeave(e) { /* ... (no changes here) ... */ }

    // --- NEW: Handlers for UI interaction ---
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

        if (fileContent) { /* ... (load logic) ... */ }
        else { canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT); }

        // UPDATED: Pass the new UI callbacks
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
        PaintUI.updateToolbar(currentTool, fgColor); // Set initial toolbar state
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: {x: -1, y: -1} });

        document.addEventListener('keydown', handleKeyDown);
    }

    // UPDATED: Full save logic
    async function exit(save = false) {
        if (save && isDirty && currentFilePath) {
            const fileData = {
                version: "1.0",
                width: PaintAppConfig.CANVAS.DEFAULT_WIDTH,
                height: PaintAppConfig.CANVAS.DEFAULT_HEIGHT,
                cells: canvasData
            };
            const jsonContent = JSON.stringify(fileData, null, 2);

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
        const isAppKey = ['s', 'p', 'e', '1', '2', '3', '4', '5', '6'].includes(key);
        const isCharKey = key.length === 1 && !event.ctrlKey && !event.metaKey;

        if (isAppKey || (isCharKey && !['s','p','e'].includes(key))) {
            // THE FIX: Only prevent default for keys our app is actively handling.
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
        // If the key is not one of ours (e.g., Ctrl+Shift+I, F12), we do nothing,
        // allowing the browser to handle it normally.
    }

    return { enter, exit, isActive: () => isActiveState };
})();