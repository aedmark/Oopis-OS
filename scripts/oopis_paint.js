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
    DEFAULT_FG_COLOR: '#22c55e',
    DEFAULT_BG_COLOR: 'bg-transparent',
    ERASER_CHAR: ' ',
    ERASER_BG_COLOR: 'bg-transparent',
    FILE_EXTENSION: 'oopic',
    ASCII_CHAR_RANGE: { START: 32, END: 126 },
    BRUSH: {
        DEFAULT_SIZE: 1,
        MAX_SIZE: 10,
        DEFAULT_SHAPE: 'round',
    },
    LOCAL_STORAGE_KEY: 'oopisPaintSettings',
    CSS_CLASSES: {
        MODAL_HIDDEN: 'hidden',
        ACTIVE_TOOL: 'paint-tool-active',
        GRID_ACTIVE: 'paint-grid-active',
        DROPDOWN_ACTIVE: 'paint-dropdown-active',
    },
    PALETTE: [
        { name: 'green',   value: '#22c55e' },
        { name: 'red',     value: '#ef4444' },
        { name: 'sky',     value: '#38bdf8' },
        { name: 'amber',   value: '#fbb724' },
        { name: 'lime',    value: '#a3e635' },
        { name: 'neutral', value: '#d4d4d4' }
    ],
    EDITOR: {
        DEBOUNCE_DELAY_MS: 300,
        MAX_UNDO_STATES: 50,
    },
    CUSTOM_COLOR_GRID: [
        // Greyscale Ramp
        '#ffffff', '#f0f0f0', '#e0e0e0', '#cfcfcf', '#bfbfbf', '#afafaf', '#9f9f9f', '#8f8f8f',
        '#7f7f7f', '#6f6f6f', '#5f5f5f', '#4f4f4f', '#3f3f3f', '#2f2f2f', '#1f1f1f', '#000000',
        // Reds -> Pinks
        '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#d32f2f', '#b71c1c', '#880e4f',
        '#f8bbd0', '#f48fb1', '#f06292', '#ec407a', '#e91e63', '#d81b60', '#c2185b', '#ad1457',
        // Oranges -> Browns
        '#ffccbc', '#ffab91', '#ff8a65', '#ff7043', '#ff5722', '#e64a19', '#bf360c', '#8d6e63',
        '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#795548',
        // Yellows
        '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#ffeb3b', '#fdd835', '#fbc02d', '#f57f17',
        // Greens
        '#dcedc8', '#c5e1a5', '#aed581', '#9ccc65', '#8bc34a', '#7cb342', '#689f38', '#33691e',
        '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#1b5e20',
        // Blues & Teals
        '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00796b', '#004d40', '#01579b',
        '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#0288d1', '#0277bd', '#01579b',
        // Purples & Indigos
        '#d1c4e9', '#b39ddb', '#9575cd', '#7e57c2', '#673ab7', '#5e35b1', '#512da8', '#311b92',
        '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0', '#3f51b5', '#3949ab', '#303f9f', '#1a237e'
    ]
};

/**
 * @module PaintUI
 * @description Manages all DOM manipulations for the paint editor.
 */
const PaintUI = (() => {
    "use strict";
    let elements = {};
    let isInitialized = false;
    let eventCallbacks = {};
    let cellDimensions = { width: 0, height: 0 };
    let gridOffset = { x: 0, y: 0 };

    function _initDOM(callbacks) {
        if (isInitialized) return true;
        eventCallbacks = callbacks;

        elements.modal = document.getElementById('paint-modal');
        elements.toolbar = document.getElementById('paint-toolbar');
        elements.canvas = document.getElementById('paint-canvas');
        elements.statusBar = document.getElementById('paint-statusbar');
        elements.charSelectModal = document.getElementById('paint-char-select-modal');
        elements.charSelectGrid = document.getElementById('paint-char-select-grid');
        elements.colorSelectModal = document.getElementById('paint-color-select-modal');
        elements.colorSelectContainer = document.getElementById('paint-color-select-container');

        if (!elements.modal || !elements.toolbar || !elements.canvas || !elements.statusBar || !elements.charSelectModal || !elements.colorSelectContainer) {
            console.error("PaintUI: Critical UI elements missing!");
            return false;
        }

        elements.toolbar.innerHTML = '';

        // SVG definitions for all our tools
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
        const brushSVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12 21.75C10.0716 21.75 8.18657 21.1782 6.58319 20.1068C4.97981 19.0355 3.73013 17.5127 2.99217 15.7312C2.25422 13.9496 2.06113 11.9892 2.43734 10.0979C2.81355 8.20655 3.74214 6.46927 5.10571 5.10571C6.46927 3.74214 8.20655 2.81355 10.0979 2.43734C11.9892 2.06113 13.9496 2.25422 15.7312 2.99217C17.5127 3.73013 19.0355 4.97981 20.1068 6.58319C21.1782 8.18657 21.75 10.0716 21.75 12C21.7473 14.585 20.7193 17.0635 18.8914 18.8914C17.0635 20.7193 14.585 21.7473 12 21.75ZM12 3.75C10.3683 3.75 8.77325 4.23385 7.41654 5.14037C6.05984 6.04689 5.00241 7.33537 4.37799 8.84286C3.75357 10.3503 3.59019 12.0091 3.90852 13.6095C4.22685 15.2098 5.01258 16.6798 6.16637 17.8336C7.32015 18.9874 8.79016 19.7731 10.3905 20.0915C11.9908 20.4098 13.6496 20.2464 15.1571 19.622C16.6646 18.9976 17.9531 17.9402 18.8596 16.5835C19.7661 15.2267 20.25 13.6317 20.25 12C20.2474 9.81277 19.3773 7.71589 17.8307 6.16929C16.2841 4.62269 14.1872 3.75264 12 3.75Z" fill="#ffffff"></path> <path d="M12 9.25C11.8019 9.24741 11.6126 9.16756 11.4725 9.02747C11.3324 8.88737 11.2526 8.69811 11.25 8.5V3.5C11.25 3.30109 11.329 3.11032 11.4697 2.96967C11.6103 2.82902 11.8011 2.75 12 2.75C12.1989 2.75 12.3897 2.82902 12.5303 2.96967C12.671 3.11032 12.75 3.30109 12.75 3.5V8.5C12.7474 8.69811 12.6676 8.88737 12.5275 9.02747C12.3874 9.16756 12.1981 9.24741 12 9.25Z" fill="#ffffff"></path> <path d="M12 21.25C11.8019 21.2474 11.6126 21.1676 11.4725 21.0275C11.3324 20.8874 11.2526 20.6981 11.25 20.5V15.5C11.25 15.3011 11.329 15.1103 11.4697 14.9697C11.6103 14.829 11.8011 14.75 12 14.75C12.1989 14.75 12.3897 14.829 12.5303 14.9697C12.671 15.1103 12.75 15.3011 12.75 15.5V20.5C12.7474 20.6981 12.6676 20.8874 12.5275 21.0275C12.3874 21.1676 12.1981 21.2474 12 21.25Z" fill="#ffffff"></path> <path d="M8.5 12.75H3.5C3.30109 12.75 3.11032 12.671 2.96967 12.5303C2.82902 12.3897 2.75 12.1989 2.75 12C2.75 11.8011 2.82902 11.6103 2.96967 11.4697C3.11032 11.329 3.30109 11.25 3.5 11.25H8.5C8.69891 11.25 8.88968 11.329 9.03033 11.4697C9.17098 11.6103 9.25 11.8011 9.25 12C9.25 12.1989 9.17098 12.3897 9.03033 12.5303C8.88968 12.671 8.69891 12.75 8.5 12.75Z" fill="#ffffff"></path> <path d="M20.5 12.75H15.5C15.3011 12.75 15.1103 12.671 14.9697 12.5303C14.829 12.3897 14.75 12.1989 14.75 12C14.75 11.8011 14.829 11.6103 14.9697 11.4697C15.1103 11.329 15.3011 11.25 15.5 11.25H20.5C20.6989 11.25 20.8897 11.329 21.0303 11.4697C21.171 11.6103 21.25 11.8011 21.25 12C21.25 12.1989 21.171 12.3897 21.0303 12.5303C20.8897 12.671 20.6989 12.75 20.5 12.75Z" fill="#ffffff"></path></svg>';
        const shapeSVG = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M9.072 15.25h13.855c0.69-0 1.249-0.56 1.249-1.25 0-0.23-0.062-0.446-0.171-0.631l0.003 0.006-6.927-12c-0.237-0.352-0.633-0.58-1.083-0.58s-0.846 0.228-1.080 0.575l-0.003 0.005-6.928 12c-0.105 0.179-0.167 0.395-0.167 0.625 0 0.69 0.56 1.25 1.25 1.25 0 0 0 0 0.001 0h-0zM16 4.5l4.764 8.25h-9.526zM7.838 16.75c-0.048-0.001-0.104-0.002-0.161-0.002-4.005 0-7.252 3.247-7.252 7.252s3.247 7.252 7.252 7.252c0.056 0 0.113-0.001 0.169-0.002l-0.008 0c0.048 0.001 0.104 0.002 0.161 0.002 4.005 0 7.252-3.247 7.252-7.252s-3.247-7.252-7.252-7.252c-0.056 0-0.113 0.001-0.169 0.002l0.008-0zM7.838 28.75c-0.048 0.002-0.103 0.003-0.16 0.003-2.625 0-4.753-2.128-4.753-4.753s2.128-4.753 4.753-4.753c0.056 0 0.112 0.001 0.168 0.003l-0.008-0c0.048-0.002 0.103-0.003 0.16-0.003 2.625 0 4.753 2.128 4.753 4.753s-2.128 4.753-4.753 4.753c-0.056 0-0.112-0.001-0.168-0.003l0.008 0zM28 16.75h-8c-1.794 0.001-3.249 1.456-3.25 3.25v8c0.001 1.794 1.456 3.249 3.25 3.25h8c1.794-0.001 3.249-1.456 3.25-3.25v-8c-0.001-1.794-1.456-3.249-3.25-3.25h-0zM28.75 28c-0 0.414-0.336 0.75-0.75 0.75h-8c-0.414-0-0.75-0.336-0.75-0.75v0-8c0-0.414 0.336-0.75 0.75-0.75h8c0.414 0 0.75 0.336 0.75 0.75v0z"></path></svg>';
        const dropdownArrowSVG = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:0.8em; height:0.8em; margin-left:4px;"><path d="M7 10l5 5 5-5z"></path></svg>';


        elements.undoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: undoSVG, title: 'Undo (Ctrl+Z)', eventListeners: { click: () => eventCallbacks.onUndo() } });
        elements.redoBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: redoSVG, title: 'Redo (Ctrl+Y)', eventListeners: { click: () => eventCallbacks.onRedo() } });
        elements.pencilBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: pencilSVG, title: 'Pencil (P)', eventListeners: { click: () => eventCallbacks.onToolChange('pencil') }});
        elements.eraserBtn = Utils.createElement('button', { className: 'paint-tool', innerHTML: eraserSVG, title: 'Eraser (E)', eventListeners: { click: () => eventCallbacks.onToolChange('eraser') }});

        // --- START RE-ARCHITECTED SHAPE TOOLS ---
        elements.shapeToolContainer = Utils.createElement('div', { className: 'paint-tool-dropdown' });
        elements.shapeSelectBtn = Utils.createElement('button', {
            className: 'paint-tool',
            innerHTML: shapeSVG + dropdownArrowSVG,
            title: 'Shape Tools (L)',
            eventListeners: { click: (e) => { e.stopPropagation(); eventCallbacks.onShapeSelectToggle(); } }
        });
        elements.shapeDropdown = Utils.createElement('div', { id: 'paint-shape-modal', className: 'paint-dropdown-content' });

        const shapeToolButtons = Utils.createElement('div', { className: 'paint-button-group' });
        elements.lineBtn = Utils.createElement('button', { innerHTML: lineSVG, title: 'Line Tool', eventListeners: { click: () => eventCallbacks.onToolChange('line') } });
        elements.quadBtn = Utils.createElement('button', { innerHTML: quadSVG, title: 'Rectangle Tool', eventListeners: { click: () => eventCallbacks.onToolChange('quad') } });
        elements.ellipseBtn = Utils.createElement('button', { innerHTML: ellipseSVG, title: 'Ellipse Tool', eventListeners: { click: () => eventCallbacks.onToolChange('ellipse') } });

        shapeToolButtons.append(elements.lineBtn, elements.quadBtn, elements.ellipseBtn);
        elements.shapeDropdown.append(shapeToolButtons);
        elements.shapeToolContainer.append(elements.shapeSelectBtn, elements.shapeDropdown);
        // --- END RE-ARCHITECTED SHAPE TOOLS ---

        // Create brush tool dropdown
        elements.brushToolContainer = Utils.createElement('div', { className: 'paint-tool-dropdown' });
        elements.brushSelectBtn = Utils.createElement('button', {
            className: 'paint-tool',
            innerHTML: brushSVG + dropdownArrowSVG,
            title: 'Brush Settings',
            eventListeners: { click: (e) => { e.stopPropagation(); eventCallbacks.onBrushSelectToggle(); } }
        });
        elements.brushModal = Utils.createElement('div', { id: 'paint-brush-modal', className: 'paint-dropdown-content' });

        const shapeContainer = Utils.createElement('div', { className: 'paint-dropdown-section' });
        shapeContainer.appendChild(Utils.createElement('label', { textContent: 'Shape' }));
        const shapeButtons = Utils.createElement('div', { className: 'paint-button-group' });
        elements.brushRoundBtn = Utils.createElement('button', { textContent: 'Round', eventListeners: { click: () => eventCallbacks.onBrushShapeChange('round') }});
        elements.brushSquareBtn = Utils.createElement('button', { textContent: 'Square', eventListeners: { click: () => eventCallbacks.onBrushShapeChange('square') }});
        shapeButtons.append(elements.brushRoundBtn, elements.brushSquareBtn);
        shapeContainer.appendChild(shapeButtons);

        const sizeContainer = Utils.createElement('div', { className: 'paint-dropdown-section' });
        const sizeLabelContainer = Utils.createElement('div', { className: 'paint-slider-label' });
        sizeLabelContainer.appendChild(Utils.createElement('label', { htmlFor: 'paint-brush-size', textContent: 'Size' }));
        elements.brushSizeLabel = Utils.createElement('span', { textContent: `${PaintAppConfig.BRUSH.DEFAULT_SIZE}px` });
        sizeLabelContainer.append(elements.brushSizeLabel);
        elements.brushSizeSlider = Utils.createElement('input', {
            id: 'paint-brush-size', type: 'range', min: 1, max: PaintAppConfig.BRUSH.MAX_SIZE, value: PaintAppConfig.BRUSH.DEFAULT_SIZE,
            eventListeners: { input: (e) => eventCallbacks.onBrushSizeChange(e.target.value) }
        });
        sizeContainer.append(sizeLabelContainer, elements.brushSizeSlider);

        elements.brushModal.append(shapeContainer, sizeContainer);
        elements.brushToolContainer.append(elements.brushSelectBtn, elements.brushModal);

        document.addEventListener('click', (e) => {
            if (isInitialized) {
                if (elements.brushToolContainer && !elements.brushToolContainer.contains(e.target)) {
                    elements.brushModal.classList.remove(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
                }
                if (elements.shapeToolContainer && !elements.shapeToolContainer.contains(e.target)) {
                    elements.shapeDropdown.classList.remove(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
                }
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
            style: { display: 'none' }
        });
        elements.customColorSwatch.addEventListener('click', () => {
            if (elements.customColorSwatch.style.backgroundColor) {
                eventCallbacks.onColorChange(elements.customColorSwatch.style.backgroundColor);
            }
        });
        colorPaletteContainer.insertBefore(elements.customColorSwatch, colorPaletteContainer.firstChild);
        elements.colorPalleteBtn = Utils.createElement('button', {
            className: 'paint-tool',
            innerHTML: colorPaletteSVG,
            title: 'Select Custom Color',
            eventListeners: {
                click: () => eventCallbacks.onColorSelectOpen()
            }
        });

        elements.saveExitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: 'Save & Exit', title: 'Save & Exit (Ctrl+S)', eventListeners: { click: () => eventCallbacks.onSaveAndExit() }});
        elements.exitBtn = Utils.createElement('button', { className: 'paint-tool paint-exit-btn', textContent: 'Exit', title: 'Exit without Saving (Ctrl+O)', eventListeners: { click: () => eventCallbacks.onExit() }});

        const leftGroup = Utils.createElement('div', {className: 'paint-toolbar-group'},
            elements.undoBtn,
            elements.redoBtn,
            elements.pencilBtn,
            elements.eraserBtn,
            elements.brushToolContainer,
            elements.shapeToolContainer, // Added shape tools here
            elements.gridBtn,
            elements.charSelectBtn
        );
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

        elements.colorSelectModal.addEventListener('click', (e) => {
            if (e.target === elements.colorSelectModal) {
                hideColorSelect();
            }
        });

        isInitialized = true;
        return true;
    }

    function updateBrushUI(brushShape, brushSize) {
        if (!isInitialized) return;

        if (elements.brushSizeLabel) {
            elements.brushSizeLabel.textContent = `${brushSize}px`;
        }

        if (elements.brushSizeSlider) {
            elements.brushSizeSlider.value = brushSize;
        }

        if (elements.brushRoundBtn && elements.brushSquareBtn) {
            const { ACTIVE_TOOL } = PaintAppConfig.CSS_CLASSES;
            elements.brushRoundBtn.classList.toggle(ACTIVE_TOOL, brushShape === 'round');
            elements.brushSquareBtn.classList.toggle(ACTIVE_TOOL, brushShape === 'square');
        }
    }

    function updateToolbar(activeTool, activeColor, undoPossible, redoPossible, isGridActive, brushShape, brushSize) {
        if (!isInitialized) return;
        const { ACTIVE_TOOL } = PaintAppConfig.CSS_CLASSES;

        elements.pencilBtn.classList.toggle(ACTIVE_TOOL, activeTool === 'pencil');
        elements.eraserBtn.classList.toggle(ACTIVE_TOOL, activeTool === 'eraser');
        elements.gridBtn.classList.toggle(ACTIVE_TOOL, isGridActive);

        // Update shape tools
        const isShapeToolActive = ['line', 'quad', 'ellipse'].includes(activeTool);
        elements.shapeSelectBtn.classList.toggle(ACTIVE_TOOL, isShapeToolActive);
        elements.lineBtn.classList.toggle(ACTIVE_TOOL, activeTool === 'line');
        elements.quadBtn.classList.toggle(ACTIVE_TOOL, activeTool === 'quad');
        elements.ellipseBtn.classList.toggle(ACTIVE_TOOL, activeTool === 'ellipse');

        updateBrushUI(brushShape, brushSize);

        let isCustomColorActive = true;
        elements.colorButtons.forEach((btn, index) => {
            const colorValue = PaintAppConfig.PALETTE[index].value;
            const isActive = colorValue === activeColor;
            if (isActive) isCustomColorActive = false;
            btn.classList.toggle(ACTIVE_TOOL, isActive);
        });

        if (isCustomColorActive) {
            elements.customColorSwatch.style.backgroundColor = activeColor;
            elements.customColorSwatch.style.display = 'block';
            elements.customColorSwatch.classList.add(ACTIVE_TOOL);
        } else {
            elements.customColorSwatch.classList.remove(ACTIVE_TOOL);
        }

        elements.undoBtn.disabled = !undoPossible;
        elements.redoBtn.disabled = !redoPossible;
    }

    function show(callbacks) {
        if (!isInitialized) {
            if (!_initDOM(callbacks)) return;
        }
        elements.modal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        OutputManager.setEditorActive(true);
    }

    function hide() {
        if (elements.modal) elements.modal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        hideCharSelect();
        hideColorSelect();
        if (elements.brushModal) elements.brushModal.classList.remove(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
        if (elements.shapeDropdown) elements.shapeDropdown.classList.remove(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
        OutputManager.setEditorActive(false);
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
        if (elements.charSelectModal) elements.charSelectModal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
    }

    function populateAndShowColorSelect(onSelectCallback) {
        if (!elements.colorSelectContainer || !elements.colorSelectModal) return;
        elements.colorSelectContainer.innerHTML = '';
        const grid = Utils.createElement('div', { className: 'paint-color-select-grid' });
        const fragment = document.createDocumentFragment();
        PaintAppConfig.CUSTOM_COLOR_GRID.forEach(colorValue => {
            const btn = Utils.createElement('button', {
                className: 'paint-color-swatch', style: { backgroundColor: colorValue }, title: colorValue,
                eventListeners: { click: () => onSelectCallback(colorValue) }
            });
            fragment.appendChild(btn);
        });
        grid.appendChild(fragment);
        const customInputContainer = Utils.createElement('div', { className: 'paint-custom-hex-container' });
        const hexInput = Utils.createElement('input', { type: 'text', className: 'paint-hex-input', placeholder: '#RRGGBB', maxLength: 7 });
        const setButton = Utils.createElement('button', { className: 'paint-hex-set-btn', textContent: 'Set' });

        setButton.addEventListener('click', () => {
            const inputValue = hexInput.value.trim();
            if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(inputValue)) onSelectCallback(inputValue);
            else {
                hexInput.style.borderColor = 'red';
                setTimeout(() => { hexInput.style.borderColor = ''; }, 1000);
            }
        });
        hexInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                setButton.click();
            }
        });
        customInputContainer.append(hexInput, setButton);
        elements.colorSelectContainer.append(grid, customInputContainer);
        elements.colorSelectModal.classList.remove(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
        hexInput.focus();
    }

    function hideColorSelect() {
        if (elements.colorSelectModal) elements.colorSelectModal.classList.add(PaintAppConfig.CSS_CLASSES.MODAL_HIDDEN);
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

    function handleResize() {
        if (!isInitialized) return;
        _calculateGridMetrics();
    }

    function getGridCoordinates(pixelX, pixelY) {
        if (!elements.canvas || !cellDimensions.width || !cellDimensions.height) return null;
        const rect = elements.canvas.getBoundingClientRect();
        const x = pixelX - rect.left - gridOffset.x;
        const y = pixelY - rect.top - gridOffset.y;
        const gridX = Math.floor(x / cellDimensions.width);
        const gridY = Math.floor(y / cellDimensions.height);
        const gridColumnCount = PaintAppConfig.CANVAS.DEFAULT_WIDTH;
        const gridRowCount = PaintAppConfig.CANVAS.DEFAULT_HEIGHT;
        if (gridX < 0 || gridX >= gridColumnCount || gridY < 0 || gridY >= gridRowCount) return null;
        return { x: gridX, y: gridY };
    }

    function updateStatusBar(status) {
        if (!elements.statusBar) return;
        const paletteEntry = PaintAppConfig.PALETTE.find(p => p.value === status.fg);
        const colorName = paletteEntry ? paletteEntry.name : status.fg;
        elements.statusBar.textContent = `Tool: ${status.tool} | Char: '${status.char}' | Color: ${colorName} | Brush: ${status.brushSize}px ${status.brushShape} | Coords: ${status.coords.x},${status.coords.y}`;
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
        if (elements.canvas) elements.canvas.innerHTML = '';
        if (elements.statusBar) elements.statusBar.textContent = '';
        if (elements.toolbar) elements.toolbar.innerHTML = '';
        isInitialized = false;
    }

    return { show, hide, renderCanvas, reset, getGridCoordinates, updateStatusBar, updateToolbar, toggleGrid, populateAndShowCharSelect, hideCharSelect, populateAndShowColorSelect, hideColorSelect, handleResize };
})();

const PaintManager = (() => {
    "use strict";

    let isActiveState = false, currentFilePath = null, canvasData = [], isDirty = false;
    let isDrawing = false, currentTool = 'pencil', drawChar = PaintAppConfig.DEFAULT_CHAR;
    let fgColor = PaintAppConfig.PALETTE[0].value, lastCoords = { x: -1, y: -1 };
    let undoStack = [], redoStack = [], saveUndoStateTimeout = null;
    let isGridVisible = false;
    let shapeStartCoords = null;
    let shapePreviewBaseState = null;
    let brushSize = PaintAppConfig.BRUSH.DEFAULT_SIZE;
    let brushShape = PaintAppConfig.BRUSH.DEFAULT_SHAPE;

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
        onColorSelectOpen: _openColorSelect,
        onBrushSelectToggle: _toggleBrushModal,
        onBrushSizeChange: _setBrushSize,
        onBrushShapeChange: _setBrushShape,
        onShapeSelectToggle: _toggleShapeModal
    };

    function _getLinePoints(x0, y0, x1, y1) {
        const points = [];
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
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
        const startX = Math.min(x0, x1);
        const endX = Math.max(x0, x1);
        const startY = Math.min(y0, y1);
        const endY = Math.max(y0, y1);

        // Top and bottom edges
        for (let x = startX; x <= endX; x++) {
            points.add(`${x},${startY}`);
            points.add(`${x},${endY}`);
        }
        // Left and right edges
        for (let y = startY; y <= endY; y++) {
            points.add(`${startX},${y}`);
            points.add(`${endX},${y}`);
        }
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
            points.add(`${cx + x},${cy + y}`);
            points.add(`${cx - x},${cy + y}`);
            points.add(`${cx + x},${cy - y}`);
            points.add(`${cx - x},${cy - y}`);
            if (p1 < 0) { x++; dx = dx + (2 * ry * ry); p1 = p1 + dx + (ry * ry); }
            else { x++; y--; dx = dx + (2 * ry * ry); dy = dy - (2 * rx * rx); p1 = p1 + dx - dy + (ry * ry); }
        }
        let p2 = ((ry * ry) * ((x + 0.5) * (x + 0.5))) + ((rx * rx) * ((y - 1) * (y - 1))) - (rx * rx * ry * ry);
        while (y >= 0) {
            points.add(`${cx + x},${cy + y}`);
            points.add(`${cx - x},${cy + y}`);
            points.add(`${cx + x},${cy - y}`);
            points.add(`${cx - x},${cy - y}`);
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

    function _updateToolbarState() {
        PaintUI.updateToolbar(currentTool, fgColor, undoStack.length > 1, redoStack.length > 0, isGridVisible, brushShape, brushSize);
    }

    function _saveSettings() {
        const settings = { brushSize, brushShape, drawChar, fgColor, isGridVisible };
        localStorage.setItem(PaintAppConfig.LOCAL_STORAGE_KEY, JSON.stringify(settings));
    }

    function _loadSettings() {
        const savedSettings = localStorage.getItem(PaintAppConfig.LOCAL_STORAGE_KEY);
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                brushSize = settings.brushSize ?? PaintAppConfig.BRUSH.DEFAULT_SIZE;
                brushShape = settings.brushShape ?? PaintAppConfig.BRUSH.DEFAULT_SHAPE;
                drawChar = settings.drawChar ?? PaintAppConfig.DEFAULT_CHAR;
                fgColor = settings.fgColor ?? PaintAppConfig.DEFAULT_FG_COLOR;
                isGridVisible = settings.isGridVisible ?? false;
            } catch (e) { console.error("Failed to parse saved paint settings.", e); }
        }
    }

    function _saveUndoState() {
        redoStack = [];
        undoStack.push(JSON.parse(JSON.stringify(canvasData)));
        if (undoStack.length > PaintAppConfig.EDITOR.MAX_UNDO_STATES) undoStack.shift();
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

    function _toggleGrid() {
        isGridVisible = !isGridVisible;
        PaintUI.toggleGrid(isGridVisible);
        _saveSettings();
        _updateToolbarState();
    }

    function _openCharSelect() { PaintUI.populateAndShowCharSelect(_setDrawCharFromSelection); }
    function _openColorSelect() { PaintUI.populateAndShowColorSelect(_setColor); }

    function _paintCell(x, y, targetCanvas) {
        const canvas = targetCanvas || canvasData;
        if (y < 0 || y >= canvas.length || x < 0 || x >= canvas[0].length) return false;
        const cell = canvas[y][x];
        let changed = false;
        const charToDraw = (currentTool === 'eraser') ? PaintAppConfig.ERASER_CHAR : drawChar;
        const fgToDraw = (currentTool === 'eraser') ? PaintAppConfig.DEFAULT_FG_COLOR : fgColor;
        const bgToDraw = (currentTool === 'eraser') ? PaintAppConfig.ERASER_BG_COLOR : PaintAppConfig.DEFAULT_BG_COLOR;
        if (cell.char !== charToDraw || cell.fg !== fgToDraw || cell.bg !== bgToDraw) {
            cell.char = charToDraw;
            cell.fg = fgToDraw;
            cell.bg = bgToDraw;
            changed = true;
        }
        return changed;
    }

    function _drawOnCanvas(x, y, targetCanvas = null) {
        let anyCellChanged = false;
        const radius = (brushSize - 1) / 2;
        const startX = Math.round(x - radius);
        const startY = Math.round(y - radius);
        for (let i = 0; i < brushSize; i++) {
            for (let j = 0; j < brushSize; j++) {
                const drawX = startX + i;
                const drawY = startY + j;
                let shouldPaint = false;
                if (brushShape === 'square') shouldPaint = true;
                else {
                    const dx = drawX - x;
                    const dy = drawY - y;
                    if ((dx * dx) + (dy * dy) <= (radius * radius)) shouldPaint = true;
                }
                if (shouldPaint) {
                    if (_paintCell(drawX, drawY, targetCanvas)) anyCellChanged = true;
                }
            }
        }
        if (anyCellChanged && !targetCanvas) {
            isDirty = true;
            PaintUI.renderCanvas(canvasData);
        }
    }

    function _handleMouseDown(e) {
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
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords, brushSize: brushSize, brushShape: brushShape });
    }

    function _handleMouseMove(e) {
        const coords = PaintUI.getGridCoordinates(e.clientX, e.clientY);
        if (coords) PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: coords, brushSize: brushSize, brushShape: brushShape });
        if (!isDrawing || !coords) return;
        if (currentTool === 'pencil' || currentTool === 'eraser') {
            if (coords.x === lastCoords.x && coords.y === lastCoords.y) return;
            const points = _getLinePoints(lastCoords.x, lastCoords.y, coords.x, coords.y);
            points.forEach(p => _drawOnCanvas(p.x, p.y));
            lastCoords = coords;
        } else if (shapeStartCoords) {
            let tempCanvasData = JSON.parse(JSON.stringify(shapePreviewBaseState));
            let points = [];
            if (currentTool === 'line') points = _getLinePoints(shapeStartCoords.x, shapeStartCoords.y, coords.x, coords.y);
            else if (currentTool === 'quad') points = _getRectanglePoints(shapeStartCoords.x, shapeStartCoords.y, coords.x, coords.y);
            else if (currentTool === 'ellipse') {
                const cx = Math.round((shapeStartCoords.x + coords.x) / 2);
                const cy = Math.round((shapeStartCoords.y + coords.y) / 2);
                let rx = Math.abs(coords.x - shapeStartCoords.x) / 2;
                let ry = Math.abs(coords.y - shapeStartCoords.y) / 2;
                if (e.shiftKey) rx = ry = Math.max(rx, ry);
                points = _getEllipsePoints(shapeStartCoords.x, shapeStartCoords.y, Math.round(rx), Math.round(ry));
            }
            points.forEach(p => _paintCell(p.x, p.y, tempCanvasData));
            PaintUI.renderCanvas(tempCanvasData);
        }
    }

    function _handleMouseUp(e) {
        if (!isDrawing) return;
        if (shapeStartCoords) {
            const endCoords = PaintUI.getGridCoordinates(e.clientX, e.clientY) || lastCoords;
            let points = [];
            let tempCanvasData = JSON.parse(JSON.stringify(shapePreviewBaseState));
            if (currentTool === 'line') points = _getLinePoints(shapeStartCoords.x, shapeStartCoords.y, endCoords.x, endCoords.y);
            else if (currentTool === 'quad') points = _getRectanglePoints(shapeStartCoords.x, shapeStartCoords.y, endCoords.x, endCoords.y);
            else if (currentTool === 'ellipse') {
                let rx = Math.abs(endCoords.x - shapeStartCoords.x) / 2;
                let ry = Math.abs(endCoords.y - shapeStartCoords.y) / 2;
                if (e.shiftKey) rx = ry = Math.max(rx, ry);
                points = _getEllipsePoints(shapeStartCoords.x, shapeStartCoords.y, Math.round(rx), Math.round(ry));
            }
            points.forEach(p => _paintCell(p.x, p.y, tempCanvasData));
            canvasData = tempCanvasData;
            PaintUI.renderCanvas(canvasData);
            isDirty = true;
        }
        if (isDirty) _triggerSaveUndoState();
        isDrawing = false;
        lastCoords = { x: -1, y: -1 };
        shapeStartCoords = null;
        shapePreviewBaseState = null;
    }

    function _handleMouseLeave(e) { if (isDrawing) _handleMouseUp(e); }

    function _toggleBrushModal() {
        const modal = document.getElementById('paint-brush-modal');
        if (modal) modal.classList.toggle(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
        _updateToolbarState();
    }

    function _toggleShapeModal() {
        const modal = document.getElementById('paint-shape-modal');
        if (modal) modal.classList.toggle(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
        _updateToolbarState();
    }

    function _setBrushSize(size) {
        brushSize = parseInt(size, 10);
        _updateToolbarState();
        _saveSettings();
    }



    function _setBrushShape(shape) {
        brushShape = shape;
        _updateToolbarState();
        _saveSettings();
    }

    function _setTool(toolName) {
        currentTool = toolName;
        _updateToolbarState();
        // Close all dropdowns when a tool is selected
        const activeDropdowns = document.querySelectorAll('.paint-dropdown-content.' + PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE);
        activeDropdowns.forEach(dropdown => dropdown.classList.remove(PaintAppConfig.CSS_CLASSES.DROPDOWN_ACTIVE));
    }


    function _setColor(colorValue) {
        fgColor = colorValue;
        _updateToolbarState();
        PaintUI.hideColorSelect();
        _saveSettings();
    }

    function _setDrawCharFromSelection(char) {
        drawChar = char;
        PaintUI.hideCharSelect();
        _saveSettings();
        _updateToolbarState();
    }

    function _resetState() {
        isActiveState = false; currentFilePath = null; canvasData = []; isDirty = false;
        isDrawing = false; currentTool = 'pencil'; drawChar = PaintAppConfig.DEFAULT_CHAR;
        fgColor = PaintAppConfig.DEFAULT_FG_COLOR; lastCoords = { x: -1, y: -1 };
        undoStack = []; redoStack = []; isGridVisible = false; shapeStartCoords = null;
        shapePreviewBaseState = null; brushSize = PaintAppConfig.BRUSH.DEFAULT_SIZE;
        brushShape = PaintAppConfig.BRUSH.DEFAULT_SHAPE;
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

    function _reenterPaint(logMessage) {
        if (logMessage) void OutputManager.appendToOutput(logMessage, {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
        PaintUI.show(paintEventCallbacks);
        PaintUI.renderCanvas(canvasData);
        _updateToolbarState();
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords, brushSize: brushSize, brushShape: brushShape });
        document.addEventListener('keydown', handleKeyDown);
        TerminalUI.setInputState(false);
    }

    function enter(filePath, fileContent) {
        if (isActiveState) return;
        isActiveState = true;
        TerminalUI.setInputState(false);
        currentFilePath = filePath;
        isDirty = false;
        _loadSettings();
        currentTool = 'pencil';
        if (fileContent) {
            let parsedData = null;
            let parseError = null;
            try { parsedData = JSON.parse(fileContent); } catch (e) { parseError = e; }
            if (!parseError && parsedData && parsedData.cells && parsedData.width && parsedData.height) canvasData = parsedData.cells;
            else {
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
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: {x: -1, y: -1}, brushSize: brushSize, brushShape: brushShape });
        document.addEventListener('keydown', handleKeyDown);
    }

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
                            if (!filename || filename.trim() === "") resolve({ path: null, reason: "Save cancelled. No filename provided." });
                            else {
                                if (!filename.endsWith(`.${PaintAppConfig.FILE_EXTENSION}`)) filename += `.${PaintAppConfig.FILE_EXTENSION}`;
                                resolve({ path: FileSystemManager.getAbsolutePath(filename, FileSystemManager.getCurrentPath()), reason: null });
                            }
                        },
                        () => { resolve({ path: null, reason: "Save cancelled." }); }, false
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
                                onConfirm: () => resolve(true), onCancel: () => resolve(false)
                            });
                        });
                        if (!confirmedOverwrite) {
                            proceedWithSave = false;
                            await OutputManager.appendToOutput("Save cancelled. File not overwritten.", { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                        }
                    }
                    if (proceedWithSave) {
                        wasSaveSuccessful = await _performSave(prospectivePath.path);
                        if(wasSaveSuccessful) currentFilePath = prospectivePath.path;
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

    function handleKeyDown(event) {
        if (!isActiveState) return;
        const target = event.target;
        if (target && target.classList.contains('paint-hex-input')) return;
        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            if (key === 'z') { event.preventDefault(); _performUndo(); }
            else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); _performRedo(); }
            else if (key === 's') { event.preventDefault(); void exit(true); }
            else if (key === 'o') { event.preventDefault(); void exit(false); }
            return;
        }
        const key = event.key.toLowerCase();
        const shapeTools = ['line', 'quad', 'ellipse'];
        const isAppKey = ['p', 'e', 'l', 'g', 'c', '1', '2', '3', '4', '5', '6'].includes(key);
        const isCharKey = event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey;
        if (isAppKey) {
            event.preventDefault();
            if (key === 'p') _setTool('pencil');
            else if (key === 'e') _setTool('eraser');
            else if (key === 'l') {
                const currentShapeIndex = shapeTools.indexOf(currentTool);
                if (currentShapeIndex !== -1) _setTool(shapeTools[(currentShapeIndex + 1) % shapeTools.length]);
                else _setTool('line');
            }
            else if (key === 'g') _toggleGrid();
            else if (key === 'c') _openCharSelect();
            else {
                const colorIndex = parseInt(key, 10) - 1;
                if (colorIndex >= 0 && colorIndex < PaintAppConfig.PALETTE.length) _setColor(PaintAppConfig.PALETTE[colorIndex].value);
            }
        } else if (isCharKey) {
            event.preventDefault();
            drawChar = event.key;
            _saveSettings();
        }
        PaintUI.updateStatusBar({ tool: currentTool, char: drawChar, fg: fgColor, coords: lastCoords, brushSize: brushSize, brushShape: brushShape });
    }

    return { enter, exit, isActive: () => isActiveState };
})();