/**
 * @file Manages the entire lifecycle and functionality of the OopisOS character-based paint application.
 * This file contains all modules related to the editor, including its configuration,
 * UI management, and the core state/drawing logic.
 * @author Andrew Edmark
 * @author Gemini
 */

/**
 * @module PaintAppConfig
 * @description Provides a centralized configuration object for the paint application.
 */
const PaintAppConfig = {
    CANVAS: {
        DEFAULT_WIDTH: 80,
        DEFAULT_HEIGHT: 24,
    },
    DEFAULT_CHAR: '#',
    DEFAULT_FG_COLOR: 'rgb(34, 197, 94)',
    DEFAULT_BG_COLOR: 'bg-transparent',
    ERASER_CHAR: ' ',
    ERASER_BG_COLOR: 'bg-transparent',
    FILE_EXTENSION: 'oopic',
    ASCII_CHAR_RANGE: { START: 32, END: 126 },
    CSS_CLASSES: {
        MODAL_HIDDEN: 'hidden',
        ACTIVE_TOOL: 'paint-tool-active',
        GRID_ACTIVE: 'paint-grid-active',
        DROPDOWN_ACTIVE: 'paint-dropdown-active',
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
    },
    CUSTOM_COLOR_GRID: [
        '#ffffff', '#f2f2f2', '#e6e6e6', '#d9d9d9', '#cccccc', '#bfbfbf', '#b3b3b3', '#a6a6a6',
        '#999999', '#8c8c8c', '#808080', '#737373', '#666666', '#595959', '#4d4d4d', '#404040',
        '#fed7d7', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d',
        '#fee2d5', '#fdbb7d', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12',
        '#fef3c7', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12',
        '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#14532d',
        '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46',
        '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75',
        '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af',
        '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3'
    ]
};

/**
 * @module PaintUI
 * @description Manages all DOM manipulations for the paint editor.
 */
const PaintUI = (() => {
    "use strict";
    let elements = {};
    let eventCallbacks = {};
    let cellDimensions = { width: 0, height: 0 };
    let gridOffset = { x: 0, y: 0 };

    // SVGs are defined once and reused
    const pencilSVG = '<svg fill="#ffffff" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" id="memory-pencil"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M16 2H17V3H18V4H19V5H20V6H19V7H18V8H17V7H16V6H15V5H14V4H15V3H16M12 6H14V7H15V8H16V10H15V11H14V12H13V13H12V14H11V15H10V16H9V17H8V18H7V19H6V20H2V16H3V15H4V14H5V13H6V12H7V11H8V10H9V9H10V8H11V7H12"></path></g></svg>';
    const eraserSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M17.9995 13L10.9995 6.00004M20.9995 21H7.99955M10.9368 20.0628L19.6054 11.3941C20.7935 10.2061 21.3875 9.61207 21.6101 8.92709C21.8058 8.32456 21.8058 7.67551 21.6101 7.07298C21.3875 6.388 20.7935 5.79397 19.6054 4.60592L19.3937 4.39415C18.2056 3.2061 17.6116 2.61207 16.9266 2.38951C16.3241 2.19373 15.675 2.19373 15.0725 2.38951C14.3875 2.61207 13.7935 3.2061 12.6054 4.39415L4.39366 12.6059C3.20561 13.794 2.61158 14.388 2.38902 15.073C2.19324 15.6755 2.19324 16.3246 2.38902 16.9271C2.61158 17.6121 3.20561 18.2061 4.39366 19.3941L5.06229 20.0628C5.40819 20.4087 5.58114 20.5816 5.78298 20.7053C5.96192 20.815 6.15701 20.8958 6.36108 20.9448C6.59126 21 6.83585 21 7.32503 21H8.67406C9.16324 21 9.40784 21 9.63801 20.9448C9.84208 20.8958 10.0372 20.815 10.2161 20.7053C10.418 20.5816 10.5909 20.4087 10.9368 20.0628Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>';
    const lineSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20L20 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const ellipseSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21C16.9706 21 21 16.4183 21 12C21 7.58172 16.9706 4 12 4C7.02944 4 3 7.58172 3 12C3 16.4183 7.02944 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const quadSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const undoSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 8H5V3M5.29102 16.3569C6.22284 17.7918 7.59014 18.8902 9.19218 19.4907C10.7942 20.0913 12.547 20.1624 14.1925 19.6937C15.8379 19.225 17.2893 18.2413 18.3344 16.8867C19.3795 15.5321 19.963 13.878 19.9989 12.1675C20.0347 10.4569 19.5211 8.78001 18.5337 7.38281C17.5462 5.98561 16.1366 4.942 14.5122 4.40479C12.8878 3.86757 11.1341 3.86499 9.5083 4.39795C7.88252 4.93091 6.47059 5.97095 5.47949 7.36556" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    const redoSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.9998 8H18.9998V3M18.7091 16.3569C17.7772 17.7918 16.4099 18.8902 14.8079 19.4907C13.2059 20.0913 11.4534 20.1624 9.80791 19.6937C8.16246 19.225 6.71091 18.2413 5.66582 16.8867C4.62073 15.5321 4.03759 13.878 4.00176 12.1675C3.96593 10.4569 4.47903 8.78001 5.46648 7.38281C6.45392 5.98561 7.86334 4.942 9.48772 4.40479C11.1121 3.86757 12.8661 3.86499 14.4919 4.39795C16.1177 4.93091 17.5298 5.97095 18.5209 7.36556" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    const gridSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 9.33333V6C20 4.89543 19.1046 4 18 4H14.6667M20 9.33333H14.6667M20 9.33333V14.6667M4 9.33333V6C4 4.89543 4.89543 4 6 4H9.33333M4 9.33333H9.33333M4 9.33333V14.6667M14.6667 9.33333H9.33333M14.6667 9.33333V4M14.6667 9.33333V14.6667M9.33333 9.33333V4M9.33333 9.33333V14.6667M20 14.6667V18C20 19.1046 19.1046 20 18 20H14.6667M20 14.6667H14.6667M4 14.6667V18C4 19.1046 4.89543 20 6 20H9.33333M4 14.6667H9.33333M14.6667 14.6667H9.33333M14.6667 14.6667V20M9.33333 14.6667V20M9.33333 4H14.6667M9.33333 20H14.6667" stroke="#fafafa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    const charSelectSVG = '<svg fill="#ffffff" height="200px" width="200px" id="Capa_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 197.974 197.974" xml:space="preserve" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M1.64,0l21.735,197.974l53.912-67.637l85.473-13.261L1.64,0z M69.205,116.411l-34.889,43.771L20.25,32.064l104.267,75.766 L69.205,116.411z M131.334,136.462h65v17.541h-15v-2.541h-10v28.82h7.334v15H149v-15h7.334v-28.82h-10v2.541h-15V136.462z"></path> </g></svg>';
    const colorPaletteSVG = '<svg fill="#ffffff" height="200px" width="200px" id="Capa_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297 297" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M254.141,53.244C224.508,18.909,185.299,0,143.736,0c-35.062,0-68.197,13.458-93.302,37.9 C10.383,76.892-2.822,123.282,14.207,165.178c13.868,34.122,45.625,57.954,77.227,57.954c0.841,0,1.671-0.016,2.508-0.053 c4.705-0.194,9.249-0.586,13.646-0.966c5.309-0.462,10.325-0.895,14.77-0.895c10.54,0,19.645,0,19.645,26.846 c0,28.811,17.538,48.934,42.65,48.936c0.002,0,0.002,0,0.004,0c17.864,0,37.651-10.342,57.215-29.903 c25.882-25.88,43.099-62.198,47.234-99.64C293.762,125.326,281.343,84.763,254.141,53.244z M227.315,252.54 c-15.397,15.398-30.55,23.877-42.66,23.875c-16.288,0-22.064-15.274-22.064-28.352c0-32.357-12.786-47.43-40.232-47.43 c-5.333,0-10.778,0.472-16.545,0.969c-4.169,0.359-8.481,0.733-12.724,0.909c-0.553,0.024-1.102,0.034-1.655,0.034 c-23.07,0-47.529-18.975-58.156-45.118c-13.714-33.738-2.225-71.927,31.519-104.779c21.239-20.676,49.272-32.063,78.939-32.063 c35.485,0,69.159,16.373,94.82,46.107C289.187,125.359,272.6,207.256,227.315,252.54z"></path> <path d="M192.654,165.877c0,17.213,13.918,31.217,31.026,31.217c17.107,0,31.025-14.004,31.025-31.217 c0-17.215-13.918-31.219-31.025-31.219C206.572,134.658,192.654,148.662,192.654,165.877z M234.118,165.877 c0,5.861-4.682,10.633-10.438,10.633c-5.756,0-10.438-4.771-10.438-10.633c0-5.863,4.683-10.633,10.438-10.633 C229.436,155.244,234.118,160.014,234.118,165.877z"></path> <path d="M226.914,93.489c0-17.215-13.917-31.219-31.025-31.219c-17.107,0-31.025,14.004-31.025,31.219 c0,17.211,13.918,31.218,31.025,31.218C212.997,124.707,226.914,110.7,226.914,93.489z M185.45,93.489 c0-5.865,4.684-10.632,10.439-10.632c5.756,0,10.438,4.767,10.438,10.632c0,5.86-4.683,10.633-10.438,10.633 C190.133,104.122,185.45,99.35,185.45,93.489z"></path> <path d="M124.863,39.627c-17.107,0-31.025,14.004-31.025,31.217c0,17.213,13.918,31.217,31.025,31.217s31.025-14.004,31.025-31.217 C155.888,53.631,141.97,39.627,124.863,39.627z M124.863,81.478c-5.756,0-10.438-4.771-10.438-10.634 c0-5.863,4.682-10.633,10.438-10.633c5.756,0,10.438,4.77,10.438,10.633C135.3,76.707,130.619,81.478,124.863,81.478z"></path> <path d="M70.821,92.809c-17.107,0-31.026,14.004-31.026,31.217c0,17.214,13.919,31.219,31.026,31.219s31.024-14.005,31.024-31.219 C101.845,106.813,87.928,92.809,70.821,92.809z M70.821,134.658c-5.757,0-10.439-4.77-10.439-10.633 c0-5.861,4.683-10.63,10.439-10.63c5.755,0,10.438,4.769,10.438,10.63C81.259,129.889,76.576,134.658,70.821,134.658z"></path> </g> </g></svg>';

    function buildLayout(callbacks) {
        eventCallbacks = callbacks;

        elements.undoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: undoSVG, title: 'Undo (Ctrl+Z)', eventListeners: { click: () => eventCallbacks.onUndo() } });
        elements.redoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: redoSVG, title: 'Redo (Ctrl+Y)', eventListeners: { click: () => eventCallbacks.onRedo() } });
        elements.pencilBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: pencilSVG, title: 'Pencil (P)', eventListeners: { click: () => eventCallbacks.onToolChange('pencil') }});
        elements.eraserBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: eraserSVG, title: 'Eraser (E)', eventListeners: { click: () => eventCallbacks.onToolChange('eraser') }});

        elements.shapeToolContainer = Utils.createElement('div', { className: 'paint-tool-dropdown' });
        elements.shapeToolBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: lineSVG, title: 'Shape Tool (L)' });

        elements.shapeDropdown = Utils.createElement('div', { className: 'paint-dropdown-content' },
            Utils.createElement('button', { className: 'paint-tool', innerHTML: lineSVG, title: 'Line', eventListeners: { click: () => eventCallbacks.onToolChange('line') } }),
            Utils.createElement('button', { className: 'paint-tool', innerHTML: quadSVG, title: 'Rectangle', eventListeners: { click: () => eventCallbacks.onToolChange('quad') } }),
            Utils.createElement('button', { className: 'paint-tool', innerHTML: ellipseSVG, title: 'Ellipse', eventListeners: { click: () => eventCallbacks.onToolChange('ellipse') } })
        );

        elements.shapeToolContainer.append(elements.shapeToolBtn, elements.shapeDropdown);
        elements.shapeToolBtn.addEventListener('click', () => {
            elements.shapeDropdown.classList.toggle(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
        });
        document.addEventListener('click', (e) => {
            if (elements.shapeToolContainer && !elements.shapeToolContainer.contains(e.target)) {
                elements.shapeDropdown.classList.remove(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
            }
        });

        elements.gridBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: gridSVG, title: 'Toggle Grid (G)', eventListeners: { click: () => eventCallbacks.onGridToggle() } });
        elements.charSelectBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: charSelectSVG, title: 'Select Character (C)', eventListeners: { click: () => eventCallbacks.onCharSelectOpen() } });
        elements.colorButtons = [];
        const colorPaletteContainer = Utils.createElement('div', { className: 'paint-palette' });
        PaintAppConfig.PALETTE.forEach((color, index) => {
            const colorBtn = Utils.createElement('button', {
                className: `paint-color-swatch`,
                style: { backgroundColor: color.value },
                title: `Color ${index + 1} (${color.name}) (${index + 1})`,
                eventListeners: { click: () => eventCallbacks.onColorChange(color.value) }
            });
            elements.colorButtons.push(colorBtn);
            colorPaletteContainer.appendChild(colorBtn);
        });
        elements.customColorSwatch = Utils.createElement('button', {
            className: 'paint-color-swatch',
            title: 'Your Custom Color',
            style: { display: 'none' },
            eventListeners: { click: () => { if (elements.customColorSwatch.style.backgroundColor) eventCallbacks.onColorChange(elements.customColorSwatch.style.backgroundColor); } }
        });
        colorPaletteContainer.insertBefore(elements.customColorSwatch, colorPaletteContainer.firstChild);
        elements.colorPalleteBtn = Utils.createElement('button', {
            className: 'paint-tool',
            innerHTML: colorPaletteSVG,
            title: 'Select Custom Color',
            eventListeners: { click: () => eventCallbacks.onColorSelectOpen() }
        });

        elements.saveBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: 'Save', title: 'Save (Ctrl+S)', eventListeners: { click: () => eventCallbacks.onSave() }});
        elements.exitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: 'Exit', title: 'Exit Application (Ctrl+O)', eventListeners: { click: () => eventCallbacks.onExit() }});

        const leftGroup = Utils.createElement('div', {className: 'paint-toolbar-group'}, elements.undoBtn, elements.redoBtn, elements.pencilBtn, elements.eraserBtn, elements.shapeToolContainer, elements.gridBtn, elements.charSelectBtn);
        const rightGroup = Utils.createElement('div', {className: 'paint-toolbar-group paint-session-group'}, elements.saveBtn, elements.exitBtn);

        elements.toolbar = Utils.createElement('div', { id: 'paint-toolbar' }, leftGroup, elements.colorPalleteBtn, colorPaletteContainer, rightGroup);

        elements.canvas = Utils.createElement('div', { id: 'paint-canvas', eventListeners: { mousedown: eventCallbacks.onMouseDown, mouseleave: eventCallbacks.onMouseLeave } });
        document.addEventListener('mousemove', eventCallbacks.onMouseMove);
        document.addEventListener('mouseup', eventCallbacks.onMouseUp);

        elements.canvasWrapper = Utils.createElement('div', { id: 'paint-canvas-wrapper' }, elements.canvas);
        elements.statusBar = Utils.createElement('div', { id: 'paint-statusbar' });

        elements.charSelectGrid = Utils.createElement('div', { id: 'paint-char-select-grid' });
        elements.charSelectModal = Utils.createElement('div', { id: 'paint-char-select-modal', className: 'paint-modal-overlay hidden', eventListeners: { click: e => { if (e.target === elements.charSelectModal) hideCharSelect(); } } },
            Utils.createElement('div', { className: 'paint-modal-content' },
                Utils.createElement('h2', { className: 'paint-modal-title', textContent: 'Select a Character' }),
                Utils.createElement('div', { className: 'paint-modal-body' }, elements.charSelectGrid)
            )
        );

        elements.colorSelectGrid = Utils.createElement('div', { id: 'paint-color-select-grid' });
        elements.colorSelectModal = Utils.createElement('div', { id: 'paint-color-select-modal', className: 'paint-modal-overlay hidden', eventListeners: { click: e => { if (e.target === elements.colorSelectModal) hideColorSelect(); } } },
            Utils.createElement('div', { className: 'paint-modal-content' },
                Utils.createElement('h2', { className: 'paint-modal-title', textContent: 'Select a Color' }),
                Utils.createElement('div', { className: 'paint-modal-body' }, elements.colorSelectGrid)
            )
        );

        elements.container = Utils.createElement('div', { id: 'paint-container' },
            elements.toolbar,
            elements.canvasWrapper,
            elements.statusBar,
            elements.charSelectModal,
            elements.colorSelectModal
        );

        return elements.container;
    }

    function toggleGrid(isActive) {
        if (!elements.canvas) return;
        elements.canvas.classList.toggle(PaintAppConfig.CSS_CLASSES.GRID_ACTIVE, isActive);
    }

    function populateAndShowCharSelect(onSelectCallback) {
        if (!elements.charSelectGrid || !elements.charSelectModal) return;
        elements.charSelectGrid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const { START, END } = PaintAppConfig.ASCII_CHAR_RANGE;
        for (let i = START; i <= END; i++) {
            const char = String.fromCharCode(i);
            const btn = Utils.createElement('button', {
                className: 'paint-char-btn', textContent: char,
                eventListeners: { click: () => onSelectCallback(char) }
            });
            fragment.appendChild(btn);
        }
        elements.charSelectGrid.appendChild(fragment);
        elements.charSelectModal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
    }

    function hideCharSelect() {
        if (elements.charSelectModal) {
            elements.charSelectModal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        }
    }

    function populateAndShowColorSelect(onSelectCallback) {
        if (!elements.colorSelectGrid || !elements.colorSelectModal) return;
        elements.colorSelectGrid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        PaintAppConfig.CUSTOM_COLOR_GRID.forEach(colorValue => {
            const btn = Utils.createElement('button', {
                className: 'paint-color-swatch', style: { backgroundColor: colorValue }, title: colorValue,
                eventListeners: { click: () => onSelectCallback(colorValue) }
            });
            fragment.appendChild(btn);
        });
        elements.colorSelectGrid.appendChild(fragment);
        elements.colorSelectModal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
    }

    function hideColorSelect() {
        if (elements.colorSelectModal) {
            elements.colorSelectModal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        }
    }

    function _calculateGridMetrics() {
        if (!elements.canvas) return;
        const containerRect = elements.canvas.getBoundingClientRect();
        const style = window.getComputedStyle(elements.canvas);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const borderLeft = parseFloat(style.borderLeftWidth) || 0;
        const borderRight = parseFloat(style.borderRightWidth) || 0;
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;
        const borderTop = parseFloat(style.borderTopWidth) || 0;
        const borderBottom = parseFloat(style.borderBottomWidth) || 0;
        const contentWidth = containerRect.width - paddingLeft - paddingRight - borderLeft - borderRight;
        const contentHeight = containerRect.height - paddingTop - paddingBottom - borderTop - borderBottom;
        cellDimensions.width = contentWidth / PaintAppConfig.CANVAS.DEFAULT_WIDTH;
        cellDimensions.height = contentHeight / PaintAppConfig.CANVAS.DEFAULT_HEIGHT;
        gridOffset.x = paddingLeft + borderLeft;
        gridOffset.y = paddingTop + borderTop;
    }

    function handleResize() { _calculateGridMetrics(); }

    function getGridCoordinates(pixelX, pixelY) {
        if (!elements.canvas || !cellDimensions.width || !cellDimensions.height) return null;
        const rect = elements.canvas.getBoundingClientRect();
        const x = pixelX - rect.left - gridOffset.x;
        const y = pixelY - rect.top - gridOffset.y;
        const gridX = Math.floor(x / cellDimensions.width);
        const gridY = Math.floor(y / cellDimensions.height);
        if (gridX < 0 || gridX >= PaintAppConfig.CANVAS.DEFAULT_WIDTH || gridY < 0 || gridY >= PaintAppConfig.CANVAS.DEFAULT_HEIGHT) {
            return null;
        }
        return { x: gridX, y: gridY };
    }

    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        const paletteEntry = PaintAppConfig.PALETTE.find(p => p.value === status.fg);
        const colorName = paletteEntry ? paletteEntry.name : (status.fg.startsWith('rgb') ? 'custom' : status.fg);
        elements.statusBar.textContent = `Tool: ${status.tool} | Char: '${status.char}' | Color: ${colorName} | Coords: ${status.coords.x},${status.coords.y}`;
    }

    function updateToolbar(activeTool, activeColor, undoPossible, redoPossible, isGridActive) {
        if (!elements.pencilBtn) return;
        elements.pencilBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'pencil');
        elements.eraserBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, activeTool === 'eraser');
        const shapeTools = ['line', 'quad', 'ellipse'];
        elements.shapeToolBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, shapeTools.includes(activeTool));

        if (activeTool === 'line') {
            elements.shapeToolBtn.innerHTML = lineSVG;
        } else if (activeTool === 'quad') {
            elements.shapeToolBtn.innerHTML = quadSVG;
        } else if (activeTool === 'ellipse') {
            elements.shapeToolBtn.innerHTML = ellipseSVG;
        }

        elements.undoBtn.disabled = !undoPossible;
        elements.redoBtn.disabled = !redoPossible;
        elements.gridBtn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, isGridActive);
        let isCustomColorActive = true;
        elements.colorButtons.forEach((btn, index) => {
            const colorValue = PaintAppConfig.PALETTE[index].value;
            const isActive = colorValue === activeColor;
            if (isActive) {
                isCustomColorActive = false;
            }
            btn.classList.toggle(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL, isActive);
        });
        if (isCustomColorActive && activeColor) {
            elements.customColorSwatch.style.backgroundColor = activeColor;
            elements.customColorSwatch.style.display = 'block';
            elements.customColorSwatch.classList.add(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL);
        } else {
            elements.customColorSwatch.classList.remove(PaintAppConfig.CSS_CLASSES.ACTIVE_TOOL);
        }
    }

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
                const span = Utils.createElement('span', { textContent: cell.char });
                span.style.color = cell.fg;
                span.classList.add(cell.bg);
                fragment.appendChild(span);
            }
        }
        elements.canvas.appendChild(fragment);
        _calculateGridMetrics();
    }

    function reset() {
        elements = {};
    }

    return { buildLayout, reset, getGridCoordinates, updateStatusBar, updateToolbar, toggleGrid, populateAndShowCharSelect, hideCharSelect, populateAndShowColorSelect, hideColorSelect, handleResize, renderCanvas };
})();

/**
 * @module PaintManager
 * @description The main controller for the paint application.
 */
const PaintManager = (() => {
    "use strict";
    let isActiveState = false, currentFilePath = null, canvasData = [], isDirty = false;
    let isDrawing = false, currentTool = 'pencil', drawChar = PaintAppConfig.DEFAULT_CHAR;
    let fgColor = PaintAppConfig.PALETTE[0].value, lastCoords = { x: -1, y: -1 };
    let undoStack = [], redoStack = [], saveUndoStateTimeout = null;
    let isGridVisible = false;
    let shapeStartCoords = null;
    let shapePreviewBaseState = null;
    let paintContainerElement = null;

    const paintEventCallbacks = {
        onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onToolChange: _setTool, onColorChange: _setColor,
        onSave: _handleSave, onExit: () => exit(), onUndo: _performUndo, onRedo: _performRedo,
        onGridToggle: _toggleGrid, onCharSelectOpen: _openCharSelect, onColorSelectOpen: _openColorSelect,
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

    function _updateToolbarState() { PaintUI.updateToolbar(currentTool, fgColor, undoStack.length > 1, redoStack.length > 0, isGridVisible); }
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
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
    }
    function _performRedo() {
        if (redoStack.length === 0) return;
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        canvasData = JSON.parse(JSON.stringify(nextState));
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
    }
    function _toggleGrid() { isGridVisible = !isGridVisible; PaintUI.toggleGrid(isGridVisible); _updateToolbarState(); }
    function _openCharSelect() { PaintUI.populateAndShowCharSelect(_setDrawCharFromSelection); }
    function _openColorSelect() { PaintUI.populateAndShowColorSelect(_setColor); }
    function _setDrawCharFromSelection(char) {
        drawChar = char;
        PaintUI.hideCharSelect();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
    }

    function _drawOnCanvas(x, y, targetCanvas = null) {
        const canvas = targetCanvas || canvasData;
        if (y < 0 || y >= canvas.length || x < 0 || x >= canvas[0].length) return;
        const cell = canvas[y][x];
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
        if (changed && !targetCanvas) { isDirty = true; PaintUI.renderCanvas(canvasData); }
        return changed;
    }

    function onMouseDown(e) {
        isDrawing = true;
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (!coords) return;
        lastCoords = coords;
        if (['line', 'ellipse', 'quad'].includes(currentTool)) {
            shapeStartCoords = { ...coords };
            shapePreviewBaseState = JSON.parse(JSON.stringify(canvasData));
        } else {
            _drawOnCanvas(coords.x, coords.y);
        }
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords });
    }

    function onMouseMove(e) {
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) { PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords }); }
        if (!isDrawing || !coords) return;
        if (currentTool === 'pencil' || currentTool === 'eraser') {
            if (coords.x === lastCoords.x && coords.y === lastCoords.y) return;
            const linePoints = _getLinePoints(lastCoords.x, lastCoords.y, coords.x, coords.y);
            linePoints.forEach(p => _drawOnCanvas(p.x, p.y));
            lastCoords = coords;
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
            PaintUI.renderCanvas(tempCanvasData);
        }
    }

    function onMouseUp(e) {
        if (!isDrawing) return;
        if (shapeStartCoords) {
            const endCoords = PaintUI.getGridCoordinates(e.clientX, e.clientY) || lastCoords;
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
        if (isDirty) { _triggerSaveUndoState(); }
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
        shapeStartCoords = null;
        shapePreviewBaseState = null;
    }

    function onMouseLeave(e) { if (isDrawing) { onMouseUp(e); } }
    function _setTool(toolName) {
        currentTool = toolName;
        _updateToolbarState();
        const dropdown = document.querySelector('.paint-dropdown-content');
        if (dropdown) { dropdown.classList.remove(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE); }
    }
    function _setColor(colorValue) { fgColor = colorValue; _updateToolbarState(); PaintUI.hideColorSelect(); }
    function _resetState() {
        isActiveState = false; currentFilePath = null; canvasData = []; isDirty = false;
        isDrawing = false; currentTool = 'pencil'; drawChar = PaintAppConfig.DEFAULT_CHAR;
        fgColor = PaintAppConfig.PALETTE[0].value; lastCoords = { x: -1, y: -1 };
        undoStack = []; redoStack = []; isGridVisible = false;
        shapeStartCoords = null; shapePreviewBaseState = null; paintContainerElement = null;
        if (saveUndoStateTimeout) { clearTimeout(saveUndoStateTimeout); saveUndoStateTimeout = null; }
    }

    async function _performSave(filePath) {
        if (!filePath) {
            await OutputManager.appendToOutput(`Cannot save. No filename specified.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return false;
        }
        const fileData = { version: "1.1", width: canvasData[0].length, height: canvasData.length, cells: canvasData };
        const jsonContent = JSON.stringify(fileData, null, 2);
        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        if (!primaryGroup) {
            await OutputManager.appendToOutput(`Critical Error: Cannot determine primary group for user. Save failed.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
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

        currentFilePath = filePath;
        if (fileContent) {
            try {
                const parsedData = JSON.parse(fileContent);
                if (parsedData && parsedData.cells && parsedData.width && parsedData.height) {
                    canvasData = parsedData.cells;
                } else { throw new Error("Invalid .oopic file format."); }
            } catch (e) {
                void OutputManager.appendToOutput(`Error loading paint file: ${e.message}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
            }
        } else {
            canvasData = _createBlankCanvas(PaintAppConfig.CANVAS.DEFAULT_WIDTH, PaintAppConfig.CANVAS.DEFAULT_HEIGHT);
        }
        undoStack = [JSON.parse(JSON.stringify(canvasData))];
        PaintUI.renderCanvas(canvasData);
        PaintUI.toggleGrid(isGridVisible);
        _updateToolbarState();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: {x: -1, y: -1} });
        document.addEventListener('keydown', handleKeyDown);
    }

    async function exit() {
        if (!isActiveState) return;
        document.removeEventListener('keydown', handleKeyDown);

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
                document.addEventListener('keydown', handleKeyDown); // Re-attach listener if not exiting
                return;
            }
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
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords });
    }

    return { enter, exit, isActive: () => isActiveState };
})();