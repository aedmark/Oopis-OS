/**
 * @file Manages the entire lifecycle and functionality of the OopisOS character-based paint application.
 * This includes the configuration, UI management, and the core state/drawing logic.
 * @author Andrew Edmark
 * @author Gemini
 */

/**
 * @module PaintAppConfig
 * @description Provides a centralized configuration object for the paint application.
 * This includes constants for canvas dimensions, tools, colors, and UI elements.
 */
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
    ASCII_CHAR_RANGE: { START: 32, END: 126 },
    CSS_CLASSES: {
        MODAL_HIDDEN: 'hidden',
        ACTIVE_TOOL: 'paint-tool-active',
        GRID_ACTIVE: 'paint-grid-active',
    },
    PALETTE: [
        { name: 'green',   class: 'text-green-500',   value: 'rgb(34, 197, 94)' },
        { name: 'red',     class: 'text-red-500',     value: 'rgb(239, 68, 68)' },
        { name: 'sky',     class: 'text-sky-400',     value: 'rgb(56, 189, 248)' },
        { name: 'amber',   class: 'text-amber-400',   value: 'rgb(251, 191, 36)' },
        { name: 'lime',    class: 'text-lime-400',    value: 'rgb(163, 230, 53)' },
        { name: 'neutral', class: 'text-neutral-300', value: 'rgb(212, 212, 212)' }
    ],
    EDITOR: {
        DEBOUNCE_DELAY_MS: 300,
        MAX_UNDO_STATES: 50,
    }
};

/**
 * @module PaintUI
 * @description Manages all DOM manipulations for the paint editor. This includes building the UI,
 * handling display updates, and calculating coordinates. It is a pure UI controller
 * that receives its instructions and data from the PaintManager.
 */
const PaintUI = (() => {
    "use strict";
    let elements = {};
    let isInitialized = false;
    let eventCallbacks = {};
    let cellDimensions = { width: 0, height: 0 };

    /**
     * Initializes DOM elements, builds the toolbar, and attaches initial event listeners.
     * This function is designed to run only once.
     * @private
     * @param {object} callbacks - An object containing callback functions from PaintManager for UI events.
     * @returns {boolean} True if initialization is successful, false otherwise.
     */
    function _initDOM(callbacks) {
        if (isInitialized) return true;
        eventCallbacks = callbacks;

        elements.modal = document.getElementById('paint-modal');
        elements.toolbar = document.getElementById('paint-toolbar');
        elements.canvas = document.getElementById('paint-canvas');
        elements.statusBar = document.getElementById('paint-statusbar');
        elements.charSelectModal = document.getElementById('paint-char-select-modal');
        elements.charSelectGrid = document.getElementById('paint-char-select-grid');

        if (!elements.modal || !elements.toolbar || !elements.canvas || !elements.statusBar || !elements.charSelectModal || !elements.charSelectGrid) {
            console.error("PaintUI: Critical UI elements missing!");
            return false;
        }

        elements.toolbar.innerHTML = '';

        const pencilSVG = '<svg fill="#ffffff" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" id="memory-pencil"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M16 2H17V3H18V4H19V5H20V6H19V7H18V8H17V7H16V6H15V5H14V4H15V3H16M12 6H14V7H15V8H16V10H15V11H14V12H13V13H12V14H11V15H10V16H9V17H8V18H7V19H6V20H2V16H3V15H4V14H5V13H6V12H7V11H8V10H9V9H10V8H11V7H12"></path></g></svg>';
        const eraserSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M17.9995 13L10.9995 6.00004M20.9995 21H7.99955M10.9368 20.0628L19.6054 11.3941C20.7935 10.2061 21.3875 9.61207 21.6101 8.92709C21.8058 8.32456 21.8058 7.67551 21.6101 7.07298C21.3875 6.388 20.7935 5.79397 19.6054 4.60592L19.3937 4.39415C18.2056 3.2061 17.6116 2.61207 16.9266 2.38951C16.3241 2.19373 15.675 2.19373 15.0725 2.38951C14.3875 2.61207 13.7935 3.2061 12.6054 4.39415L4.39366 12.6059C3.20561 13.794 2.61158 14.388 2.38902 15.073C2.19324 15.6755 2.19324 16.3246 2.38902 16.9271C2.61158 17.6121 3.20561 18.2061 4.39366 19.3941L5.06229 20.0628C5.40819 20.4087 5.58114 20.5816 5.78298 20.7053C5.96192 20.815 6.15701 20.8958 6.36108 20.9448C6.59126 21 6.83585 21 7.32503 21H8.67406C9.16324 21 9.40784 21 9.63801 20.9448C9.84208 20.8958 10.0372 20.815 10.2161 20.7053C10.418 20.5816 10.5909 20.4087 10.9368 20.0628Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>';
        const undoSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g id="Edit / Undo"> <path id="Vector" d="M10 8H5V3M5.29102 16.3569C6.22284 17.7918 7.59014 18.8902 9.19218 19.4907C10.7942 20.0913 12.547 20.1624 14.1925 19.6937C15.8379 19.225 17.2893 18.2413 18.3344 16.8867C19.3795 15.5321 19.963 13.878 19.9989 12.1675C20.0347 10.4569 19.5211 8.78001 18.5337 7.38281C17.5462 5.98561 16.1366 4.942 14.5122 4.40479C12.8878 3.86757 11.1341 3.86499 9.5083 4.39795C7.88252 4.93091 6.47059 5.97095 5.47949 7.36556" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g> </g></svg>';
        const redoSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g id="Edit / Redo"> <path id="Vector" d="M13.9998 8H18.9998V3M18.7091 16.3569C17.7772 17.7918 16.4099 18.8902 14.8079 19.4907C13.2059 20.0913 11.4534 20.1624 9.80791 19.6937C8.16246 19.225 6.71091 18.2413 5.66582 16.8867C4.62073 15.5321 4.03759 13.878 4.00176 12.1675C3.96593 10.4569 4.47903 8.78001 5.46648 7.38281C6.45392 5.98561 7.86334 4.942 9.48772 4.40479C11.1121 3.86757 12.8661 3.86499 14.4919 4.39795C16.1177 4.93091 17.5298 5.97095 18.5209 7.36556" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g> </g></svg>';
        const gridSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M20 9.33333V6C20 4.89543 19.1046 4 18 4H14.6667M20 9.33333H14.6667M20 9.33333V14.6667M4 9.33333V6C4 4.89543 4.89543 4 6 4H9.33333M4 9.33333H9.33333M4 9.33333V14.6667M14.6667 9.33333H9.33333M14.6667 9.33333V4M14.6667 9.33333V14.6667M9.33333 9.33333V4M9.33333 9.33333V14.6667M20 14.6667V18C20 19.1046 19.1046 20 18 20H14.6667M20 14.6667H14.6667M4 14.6667V18C4 19.1046 4.89543 20 6 20H9.33333M4 14.6667H9.33333M14.6667 14.6667H9.33333M14.6667 14.6667V20M9.33333 14.6667V20M9.33333 4H14.6667M9.33333 20H14.6667" stroke="#fafafa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>';
        const charSelectSVG = '<svg fill="#ffffff" height="200px" width="200px"" id="Capa_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 197.974 197.974" xml:space="preserve" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M1.64,0l21.735,197.974l53.912-67.637l85.473-13.261L1.64,0z M69.205,116.411l-34.889,43.771L20.25,32.064l104.267,75.766 L69.205,116.411z M131.334,136.462h65v17.541h-15v-2.541h-10v28.82h7.334v15H149v-15h7.334v-28.82h-10v2.541h-15V136.462z"></path> </g></svg>';
        const colorPalleteSVG = '<svg fill="#ffffff" height="200px" width="200px" id="Capa_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297 297" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M254.141,53.244C224.508,18.909,185.299,0,143.736,0c-35.062,0-68.197,13.458-93.302,37.9 C10.383,76.892-2.822,123.282,14.207,165.178c13.868,34.122,45.625,57.954,77.227,57.954c0.841,0,1.671-0.016,2.508-0.053 c4.705-0.194,9.249-0.586,13.646-0.966c5.309-0.462,10.325-0.895,14.77-0.895c10.54,0,19.645,0,19.645,26.846 c0,28.811,17.538,48.934,42.65,48.936c0.002,0,0.002,0,0.004,0c17.864,0,37.651-10.342,57.215-29.903 c25.882-25.88,43.099-62.198,47.234-99.64C293.762,125.326,281.343,84.763,254.141,53.244z M227.315,252.54 c-15.397,15.398-30.55,23.877-42.66,23.875c-16.288,0-22.064-15.274-22.064-28.352c0-32.357-12.786-47.43-40.232-47.43 c-5.333,0-10.778,0.472-16.545,0.969c-4.169,0.359-8.481,0.733-12.724,0.909c-0.553,0.024-1.102,0.034-1.655,0.034 c-23.07,0-47.529-18.975-58.156-45.118c-13.714-33.738-2.225-71.927,31.519-104.779c21.239-20.676,49.272-32.063,78.939-32.063 c35.485,0,69.159,16.373,94.82,46.107C289.187,125.359,272.6,207.256,227.315,252.54z"></path> <path d="M192.654,165.877c0,17.213,13.918,31.217,31.026,31.217c17.107,0,31.025-14.004,31.025-31.217 c0-17.215-13.918-31.219-31.025-31.219C206.572,134.658,192.654,148.662,192.654,165.877z M234.118,165.877 c0,5.861-4.682,10.633-10.438,10.633c-5.756,0-10.438-4.771-10.438-10.633c0-5.863,4.683-10.633,10.438-10.633 C229.436,155.244,234.118,160.014,234.118,165.877z"></path> <path d="M226.914,93.489c0-17.215-13.917-31.219-31.025-31.219c-17.107,0-31.025,14.004-31.025,31.219 c0,17.211,13.918,31.218,31.025,31.218C212.997,124.707,226.914,110.7,226.914,93.489z M185.45,93.489 c0-5.865,4.684-10.632,10.439-10.632c5.756,0,10.438,4.767,10.438,10.632c0,5.86-4.683,10.633-10.438,10.633 C190.133,104.122,185.45,99.35,185.45,93.489z"></path> <path d="M124.863,39.627c-17.107,0-31.025,14.004-31.025,31.217c0,17.213,13.918,31.217,31.025,31.217s31.025-14.004,31.025-31.217 C155.888,53.631,141.97,39.627,124.863,39.627z M124.863,81.478c-5.756,0-10.438-4.771-10.438-10.634 c0-5.863,4.682-10.633,10.438-10.633c5.756,0,10.438,4.77,10.438,10.633C135.3,76.707,130.619,81.478,124.863,81.478z"></path> <path d="M70.821,92.809c-17.107,0-31.026,14.004-31.026,31.217c0,17.214,13.919,31.219,31.026,31.219s31.024-14.005,31.024-31.219 C101.845,106.813,87.928,92.809,70.821,92.809z M70.821,134.658c-5.757,0-10.439-4.77-10.439-10.633 c0-5.861,4.683-10.63,10.439-10.63c5.755,0,10.438,4.769,10.438,10.63C81.259,129.889,76.576,134.658,70.821,134.658z"></path> </g> </g></svg>';

        elements.undoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: undoSVG, title: 'Undo (Ctrl+Z)', eventListeners: { click: () => eventCallbacks.onUndo() } });
        elements.redoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: redoSVG, title: 'Redo (Ctrl+Y)', eventListeners: { click: () => eventCallbacks.onRedo() } });
        elements.pencilBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: pencilSVG, title: 'Pencil (P)', eventListeners: { click: () => eventCallbacks.onToolChange('pencil') }});
        elements.eraserBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: eraserSVG, title: 'Eraser (E)', eventListeners: { click: () => eventCallbacks.onToolChange('eraser') }});
        elements.gridBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: gridSVG, title: 'Toggle Grid (G)', eventListeners: { click: () => eventCallbacks.onGridToggle() } });
        elements.charSelectBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: charSelectSVG, title: 'Select Character (C)', eventListeners: { click: () => eventCallbacks.onCharSelectOpen() } });
        elements.colorButtons = [];
        const colorPaletteContainer = Utils.createElement('div', { className: 'paint-palette' });
        PaintAppConfig.PALETTE.forEach((color, index) => {
            const colorBtn = Utils.createElement('button', {
                className: `paint-color-swatch`,
                style: { backgroundColor: color.value },
                title: `Color ${index + 1} (${color.name}) (${index + 1})`,
                eventListeners: { click: () => eventCallbacks.onColorChange(color.class) }
            });
            elements.colorButtons.push(colorBtn);
            colorPaletteContainer.appendChild(colorBtn);
        });
        elements.colorPalleteBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: colorPalleteSVG, title: 'Select Color', eventListeners: { click: () => colorPaletteContainer.click() } }); //Implement a color selector modal later, much like the character select

        elements.saveExitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: 'Save & Exit', title: 'Save & Exit (Ctrl+S)', eventListeners: { click: () => eventCallbacks.onSaveAndExit() }});
        elements.exitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: 'Exit', title: 'Exit without Saving (Ctrl+O)', eventListeners: { click: () => eventCallbacks.onExit() }});

        const leftGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.undoBtn, elements.redoBtn, elements.pencilBtn, elements.eraserBtn, elements.gridBtn, elements.charSelectBtn);
        const rightGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.saveExitBtn, elements.exitBtn);

        elements.toolbar.append(leftGroup, elements.colorPalleteBtn, colorPaletteContainer, rightGroup);

        elements.canvas.addEventListener('mousedown', eventCallbacks.onMouseDown);
        document.addEventListener('mousemove', eventCallbacks.onMouseMove);
        document.addEventListener('mouseup', eventCallbacks.onMouseUp);
        elements.canvas.addEventListener('mouseleave', eventCallbacks.onMouseLeave);
        elements.charSelectModal.addEventListener('click', (e) => {
            if (e.target === elements.charSelectModal) {
                hideCharSelect();
            }
        });

        isInitialized = true;
        return true;
    }

    /**
     * Toggles the visibility of the grid overlay on the canvas.
     * @param {boolean} isActive - True to show the grid, false to hide it.
     */
    function toggleGrid(isActive) {
        if (!elements.canvas) return;
        elements.canvas.classList.toggle(PaintAppConfig.CSS_CLASSES.GRID_ACTIVE, isActive);
    }

    /**
     * Populates the character selection grid with all available ASCII characters and shows the modal.
     * @param {function(string): void} onSelectCallback - The callback to execute when a character is chosen.
     */
    function populateAndShowCharSelect(onSelectCallback) {
        if (!elements.charSelectGrid || !elements.charSelectModal) return;
        elements.charSelectGrid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const { START, END } = PaintAppConfig.ASCII_CHAR_RANGE;

        for (let i = START; i <= END; i++) {
            const char = String.fromCharCode(i);
            const btn = Utils.createElement('button', {
                className: 'paint-char-btn',
                textContent: char,
                eventListeners: {
                    click: () => onSelectCallback(char)
                }
            });
            fragment.appendChild(btn);
        }
        elements.charSelectGrid.appendChild(fragment);
        elements.charSelectModal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
    }

    /**
     * Hides the character selection modal.
     */
    function hideCharSelect() {
        if (elements.charSelectModal) {
            elements.charSelectModal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        }
    }

    /**
     * Calculates the rendered width and height of a single canvas grid cell.
     * @private
     */
    function _calculateCellSize() {
        if (!elements.canvas || !elements.canvas.firstChild) return;
        const testCell = elements.canvas.firstChild;
        cellDimensions.width = testCell.offsetWidth;
        cellDimensions.height = testCell.offsetHeight;
    }

    /**
     * Converts mouse pixel coordinates to canvas grid coordinates.
     * @param {number} pixelX - The clientX coordinate from a mouse event.
     * @param {number} pixelY - The clientY coordinate from a mouse event.
     * @returns {{x: number, y: number}|null} An object with x and y grid coordinates, or null if outside the canvas.
     */
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

    /**
     * Updates the status bar text with the current tool, character, color, and coordinates.
     * @param {object} status - The current status object.
     * @param {string} status.tool - The name of the active tool.
     * @param {string} status.char - The current drawing character.
     * @param {string} status.fg - The current foreground color class.
     * @param {{x: number, y: number}} status.coords - The current mouse grid coordinates.
     */
    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        const colorName = status.fg.replace('text-', '').replace(/-\d+/, '');
        elements.statusBar.textContent = `Tool: ${status.tool} | Char: '${status.char}' | Color: ${colorName} | Coords: ${status.coords.x},${status.coords.y}`;
    }

    /**
     * Updates the toolbar UI to reflect the current state (active tool, color, undo/redo availability).
     * @param {string} activeTool - The name of the currently active tool ('pencil' or 'eraser').
     * @param {string} activeColor - The CSS class of the currently active color.
     * @param {boolean} undoPossible - Whether an undo action is available.
     * @param {boolean} redoPossible - Whether a redo action is available.
     * @param {boolean} isGridActive - Whether the grid overlay is currently visible.
     */
    function updateToolbar(activeTool, activeColor, undoPossible, redoPossible, isGridActive) {
        if (!isInitialized) return;
        elements.pencilBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'pencil');
        elements.eraserBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'eraser');
        elements.undoBtn.disabled = !undoPossible;
        elements.redoBtn.disabled = !redoPossible;
        elements.gridBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, isGridActive);

        elements.colorButtons.forEach((btn, index) => {
            const colorClass = PaintAppConfig.PALETTE[index].class;
            btn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, colorClass === activeColor);
        });
    }

    /**
     * Shows the main paint application modal.
     * @param {object} callbacks - An object of event callbacks from the PaintManager.
     */
    function show(callbacks) {
        if (!isInitialized) {
            if (!_initDOM(callbacks)) return;
        }
        elements.modal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        OutputManager.setEditorActive(true);
    }

    /**
     * Hides the main paint application modal.
     */
    function hide() {
        if (elements.modal) {
            elements.modal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        }
        hideCharSelect();
        OutputManager.setEditorActive(false);
    }

    /**
     * Renders the entire canvas based on the provided data model.
     * @param {Array<Array<{char: string, fg: string, bg: string}>>} canvasData - A 2D array representing the canvas state.
     */
    function renderCanvas(canvasData) {
        if (!elements.canvas) return;
        elements.canvas.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const gridWidth = canvasData[0]?.length || PaintAppConfig.CANVAS.DEFAULT_WIDTH;
        const gridHeight = canvasData.length || PaintAppConfig.CANVAS.DEFAULT_HEIGHT;

        elements.canvas.style.gridTemplateColumns = `repeat(${gridWidth}, 1fr)`;
        elements.canvas.style.gridTemplateRows = `repeat(${gridHeight}, 1fr)`;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = canvasData[y]?.[x] || { char: ' ', fg: PaintAppConfig.DEFAULT_FG_COLOR, bg: PaintAppConfig.ERASER_BG_COLOR };
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

    /**
     * Resets the UI to its initial state, clearing all dynamically generated elements.
     */
    function reset() {
        if (elements.canvas) elements.canvas.innerHTML = '';
        if (elements.statusBar) elements.statusBar.textContent = '';
        if (elements.toolbar) elements.toolbar.innerHTML = '';
        isInitialized = false;
    }

    return { show, hide, renderCanvas, reset, getGridCoordinates, updateStatusBar, updateToolbar, toggleGrid, populateAndShowCharSelect, hideCharSelect };
})();

/**
 * @module PaintManager
 * @description The main controller for the paint application. It manages the application's state,
 * user interactions (mouse and keyboard), the canvas data model, and the undo/redo stack.
 */
const PaintManager = (() => {
    "use strict";
    let isActiveState = false, currentFilePath = null, canvasData = [], isDirty = false;
    let isDrawing = false, currentTool = 'pencil', drawChar = PaintAppConfig.DEFAULT_CHAR;
    let fgColor = PaintAppConfig.DEFAULT_FG_COLOR, lastCoords = { x: -1, y: -1 };
    let undoStack = [], redoStack = [], saveUndoStateTimeout = null;
    let isGridVisible = false;

    /**
     * A collection of callbacks passed to the PaintUI module to handle events.
     * @private
     */
    const paintEventCallbacks = {
        onMouseDown: _handleMouseDown,
        onMouseMove: _handleMouseMove,
        onMouseUp: _handleMouseUp,
        onMouseLeave: _handleMouseLeave,
        onToolChange: _setTool,
        onColorChange: _setColor,
        onSaveAndExit: () => exit(true),
        onExit: () => exit(false),
        onUndo: _performUndo,
        onRedo: _performRedo,
        onGridToggle: _toggleGrid,
        onCharSelectOpen: _openCharSelect,
    };

    /**
     * Creates a new, empty 2D array to represent a blank canvas.
     * @private
     * @param {number} w - The width of the canvas.
     * @param {number} h - The height of the canvas.
     * @returns {Array<Array<object>>} The new canvas data model.
     */
    function _createBlankCanvas(w, h) {
        let data = [];
        for (let y = 0; y < h; y++) {
            data.push(Array.from({ length: w }, () => ({
                char: ' ', fg: PaintAppConfig.DEFAULT_FG_COLOR, bg: PaintAppConfig.ERASER_BG_COLOR
            })));
        }
        return data;
    }

    /**
     * Updates the UI toolbar based on the current state of the manager.
     * @private
     */
    function _updateToolbarState() {
        PaintUI.updateToolbar(currentTool, fgColor, undoStack.length > 1, redoStack.length > 0, isGridVisible);
    }

    /**
     * Saves the current canvas state to the undo stack.
     * @private
     */
    function _saveUndoState() {
        redoStack = [];
        undoStack.push(JSON.parse(JSON.stringify(canvasData)));
        if (undoStack.length > PaintAppConfig.EDITOR.MAX_UNDO_STATES) {
            undoStack.shift();
        }
        _updateToolbarState();
    }

    /**
     * Debounces the saving of the undo state to improve performance during rapid drawing.
     * @private
     */
    function _triggerSaveUndoState() {
        if (saveUndoStateTimeout) clearTimeout(saveUndoStateTimeout);
        saveUndoStateTimeout = setTimeout(_saveUndoState, PaintAppConfig.EDITOR.DEBOUNCE_DELAY_MS);
    }

    /**
     * Reverts the canvas to the previous state in the undo stack.
     * @private
     */
    function _performUndo() {
        if (undoStack.length <= 1) return;
        const currentState = undoStack.pop();
        redoStack.push(currentState);
        canvasData = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
    }

    /**
     * Re-applies a state from the redo stack.
     * @private
     */
    function _performRedo() {
        if (redoStack.length === 0) return;
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        canvasData = JSON.parse(JSON.stringify(nextState));
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
    }

    /**
     * Toggles the grid visibility state and updates the UI.
     * @private
     */
    function _toggleGrid() {
        isGridVisible = !isGridVisible;
        PaintUI.toggleGrid(isGridVisible);
        _updateToolbarState();
    }

    /**
     * Opens the character selection modal.
     * @private
     */
    function _openCharSelect() {
        PaintUI.populateAndShowCharSelect(_setDrawCharFromSelection);
    }

    /**
     * Sets the drawing character based on the user's selection from the modal.
     * @private
     * @param {string} char - The character selected by the user.
     */
    function _setDrawCharFromSelection(char) {
        drawChar = char;
        PaintUI.hideCharSelect();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
    }

    /**
     * The core drawing logic. Modifies the canvas data model at specific coordinates based on the current tool.
     * @private
     * @param {number} x - The x-coordinate of the cell to draw on.
     * @param {number} y - The y-coordinate of the cell to draw on.
     */
    function _drawOnCanvas(x, y) {
        if (y < 0 || y >= canvasData.length || x < 0 || x >= canvasData[0].length) return;

        const cell = canvasData[y][x];
        let changed = false;

        if (currentTool === 'pencil') {
            if (cell.char !== drawChar || cell.fg !== fgColor || cell.bg !== PaintAppConfig.DEFAULT_BG_COLOR) {
                cell.char = drawChar;
                cell.fg = fgColor;
                cell.bg = PaintAppConfig.DEFAULT_BG_COLOR;
                changed = true;
            }
        } else if (currentTool === 'eraser') {
            if (cell.char !== PaintAppConfig.ERASER_CHAR || cell.bg !== PaintAppConfig.ERASER_BG_COLOR) {
                cell.char = PaintAppConfig.ERASER_CHAR;
                cell.fg = PaintAppConfig.DEFAULT_FG_COLOR;
                cell.bg = PaintAppConfig.ERASER_BG_COLOR;
                changed = true;
            }
        }

        if (changed) {
            isDirty = true;
            PaintUI.renderCanvas(canvasData);
        }
    }

    /**
     * Handles the mousedown event on the canvas to begin a drawing action.
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    function _handleMouseDown(e) {
        isDrawing = true;
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) {
            lastCoords = coords;
            _drawOnCanvas(coords.x, coords.y);
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords });
        }
    }

    /**
     * Handles the mousemove event to continue a drawing action or update status.
     * @private
     * @param {MouseEvent} e - The mouse event.
     */
    function _handleMouseMove(e) {
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) {
            PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords });
        }
        if (!isDrawing || !coords || (coords.x === lastCoords.x && coords.y === lastCoords.y)) return;

        _drawOnCanvas(coords.x, coords.y);
        lastCoords = coords;
    }

    /**
     * Handles the mouseup event to end a drawing action.
     * @private
     */
    function _handleMouseUp() {
        if (isDrawing && isDirty) {
            _triggerSaveUndoState();
        }
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
    }

    /**
     * Handles the mouseleave event to end a drawing action if the mouse leaves the canvas.
     * @private
     */
    function _handleMouseLeave() {
        if (isDrawing && isDirty) {
            _triggerSaveUndoState();
        }
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
    }

    /**
     * Sets the active drawing tool.
     * @private
     * @param {string} toolName - The name of the tool to activate ('pencil' or 'eraser').
     */
    function _setTool(toolName) {
        currentTool = toolName;
        _updateToolbarState();
    }

    /**
     * Sets the active drawing color.
     * @private
     * @param {string} colorClass - The CSS class of the color to activate.
     */
    function _setColor(colorClass) {
        fgColor = colorClass;
        _updateToolbarState();
    }

    /**
     * Resets all internal state variables to their defaults.
     * @private
     */
    function _resetState() {
        isActiveState = false;
        currentFilePath = null;
        canvasData = [];
        isDirty = false;
        isDrawing = false;
        currentTool = 'pencil';
        drawChar = PaintAppConfig.DEFAULT_CHAR;
        fgColor = PaintAppConfig.DEFAULT_FG_COLOR;
        lastCoords = { x: -1, y: -1 };
        undoStack = [];
        redoStack = [];
        isGridVisible = false;
        if (saveUndoStateTimeout) {
            clearTimeout(saveUndoStateTimeout);
            saveUndoStateTimeout = null;
        }
    }

    /**
     * Serializes the canvas data and saves it to a file in the virtual file system.
     * @private
     * @param {string} filePath - The absolute path to save the file to.
     * @returns {Promise<boolean>} A promise that resolves to true on success, false otherwise.
     */
    async function _performSave(filePath) {
        if (!filePath) {
            await OutputManager.appendToOutput(`Cannot save. No filename specified.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return false;
        }

        const fileData = {
            version: "1.1",
            width: canvasData[0].length,
            height: canvasData.length,
            cells: canvasData
        };
        const jsonContent = JSON.stringify(fileData, null, 2);
        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(filePath, jsonContent, { currentUser, primaryGroup });

        if (saveResult.success) {
            if (await FileSystemManager.save()) {
                await OutputManager.appendToOutput(`Art saved to '${filePath}'.`, { typeClass: Config.CSS_CLASSES.SUCCESS_MSG });
                isDirty = false;
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

    /**
     * Helper function to re-show the paint UI after a modal confirmation is cancelled.
     * @private
     * @param {string} [logMessage] - An optional message to log to the terminal.
     */
    function _reenterPaint(logMessage) {
        if (logMessage) {
            void OutputManager.appendToOutput(logMessage, {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
        }
        PaintUI.show(paintEventCallbacks);
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
        document.addEventListener('keydown', handleKeyDown);
        TerminalUI.setInputState(false);
    }

    /**
     * Enters the paint application, initializing the UI and state.
     * @param {string|null} filePath - The path of the file to edit, or null for a new file.
     * @param {string} fileContent - The initial content of the file if it exists.
     */
    function enter(filePath, fileContent) {
        if (isActiveState) return;
        isActiveState = true;
        TerminalUI.setInputState(false);
        currentFilePath = filePath;
        isDirty = false;
        currentTool = 'pencil';
        drawChar = PaintAppConfig.DEFAULT_CHAR;
        fgColor = PaintAppConfig.DEFAULT_FG_COLOR;
        isGridVisible = false;

        if (fileContent) {
            let parsedData = null;
            let parseError = null;
            try {
                parsedData = JSON.parse(fileContent);
            } catch (e) {
                parseError = e;
            }

            if (!parseError && parsedData && parsedData.cells && parsedData.width && parsedData.height) {
                canvasData = parsedData.cells;
            } else {
                const errorMessage = parseError ? parseError.message : "Invalid .oopic file format.";
                void OutputManager.appendToOutput(`Error loading paint file: ${errorMessage}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
            }
        } else {
            canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
        }

        undoStack = [JSON.parse(JSON.stringify(canvasData))];
        redoStack = [];

        PaintUI.show(paintEventCallbacks);
        PaintUI.renderCanvas(canvasData);
        PaintUI.toggleGrid(isGridVisible);
        _updateToolbarState();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: {x: -1, y: -1} });

        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * Exits the paint application, handling save logic and confirmation prompts.
     * @param {boolean} [save=false] - If true, attempts to save the file before exiting.
     * @returns {Promise<void>}
     * @async
     */
    async function exit(save = false) {
        if (!isActiveState) return;

        document.removeEventListener('keydown', handleKeyDown);

        if (isDirty && !save) {
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
                _reenterPaint();
                return;
            }
        }

        if (save && isDirty) {
            let savePath = currentFilePath;
            let wasSaveSuccessful = false;

            if (savePath) {
                wasSaveSuccessful = await _performSave(savePath);
            } else {
                PaintUI.hide();

                const prospectivePath = await new Promise(resolve => {
                    ModalInputManager.requestInput(
                        "Enter filename to save as (.oopic extension will be added if missing):",
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
                        () => {
                            resolve({ path: null, reason: "Save cancelled." });
                        },
                        false
                    );
                });

                if (prospectivePath.path) {
                    let proceedWithSave = true;
                    const pathInfo = FileSystemManager.validatePath("paint save", prospectivePath.path, { allowMissing: true });

                    if (pathInfo.node) {
                        const confirmedOverwrite = await new Promise(resolve => {
                            ModalManager.request({
                                context: 'graphical',
                                messageLines: [`File '${prospectivePath.path.split('/').pop()}' already exists. Overwrite?`],
                                onConfirm: () => resolve(true),
                                onCancel: () => resolve(false)
                            });
                        });
                        if (!confirmedOverwrite) {
                            proceedWithSave = false;
                            await OutputManager.appendToOutput("Save cancelled. File not overwritten.", { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                        }
                    }

                    if (proceedWithSave) {
                        wasSaveSuccessful = await _performSave(prospectivePath.path);
                        if(wasSaveSuccessful) {
                            currentFilePath = prospectivePath.path;
                        }
                    }
                } else {
                    await OutputManager.appendToOutput(prospectivePath.reason, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                }
            }

            if (!wasSaveSuccessful) {
                _reenterPaint("Returning to paint editor.");
                return;
            }
        }

        PaintUI.hide();
        PaintUI.reset();
        _resetState();
        TerminalUI.setInputState(true);
        TerminalUI.focusInput();
    }

    /**
     * Global keydown handler for the paint editor, processing shortcuts.
     * @param {KeyboardEvent} event - The keydown event object.
     * @private
     */
    function handleKeyDown(event) {
        if (!isActiveState) return;

        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            if (key === 'z') {
                event.preventDefault(); _performUndo();
            } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault(); _performRedo();
            } else if (key === 's') {
                event.preventDefault(); void exit(true);
            } else if (key === 'o') {
                event.preventDefault(); void exit(false);
            }
            return;
        }

        const key = event.key.toLowerCase();
        const isAppKey = ['p', 'e', 'g', 'c', '1', '2', '3', '4', '5', '6'].includes(key);
        const isCharKey = event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey;

        if (isAppKey) {
            event.preventDefault();
            if (key === 'p') { _setTool('pencil'); }
            else if (key === 'e') { _setTool('eraser'); }
            else if (key === 'g') { _toggleGrid(); }
            else if (key === 'c') { _openCharSelect(); }
            else {
                const colorIndex = parseInt(key, 10) - 1;
                if (colorIndex >= 0 && colorIndex < PaintAppConfig.PALETTE.length) {
                    _setColor(PaintAppConfig.PALETTE[colorIndex].class);
                }
            }
        } else if (isCharKey) {
            event.preventDefault();
            drawChar = event.key;
        }

        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
    }

    return { enter, exit, isActive: () => isActiveState };
})();