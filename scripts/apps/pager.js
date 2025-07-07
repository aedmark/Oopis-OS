const PagerUI = (() => {
    "use strict";
    let elements = {};

    function buildLayout() {
        elements.content = Utils.createElement('div', { id: 'pager-content', className: 'p-2 whitespace-pre-wrap' });
        elements.statusBar = Utils.createElement('div', { id: 'pager-status', className: 'bg-gray-700 text-white p-1 text-center font-bold' });
        elements.container = Utils.createElement('div', { id: 'pager-container', className: 'flex flex-col h-full w-full bg-black text-white font-mono' }, [elements.content, elements.statusBar]);
        return elements.container;
    }

    function render(lines, topVisibleLine, mode, terminalRows) {
        if (!elements.content || !elements.statusBar) return;

        const visibleLines = lines.slice(topVisibleLine, topVisibleLine + terminalRows);
        elements.content.innerHTML = visibleLines.join('<br>');

        const percent = lines.length > 0 ? Math.min(100, Math.round(((topVisibleLine + terminalRows) / lines.length) * 100)) : 100;
        elements.statusBar.textContent = `-- ${mode.toUpperCase()} -- (${percent}%) (q to quit)`;
    }

    function getTerminalRows() {
        if (!elements.content) return 24;
        const screenHeight = elements.content.clientHeight;
        const computedStyle = window.getComputedStyle(elements.content);
        const fontStyle = computedStyle.font;
        const { height: lineHeight } = Utils.getCharacterDimensions(fontStyle);
        if (lineHeight === 0) {
            return 24;
        }

        return Math.max(1, Math.floor(screenHeight / lineHeight));
    }

    function reset() {
        elements = {};
    }

    return { buildLayout, render, getTerminalRows, reset };
})();

const PagerManager = (() => {
    "use strict";
    let isActive = false;
    let lines = [];
    let topVisibleLine = 0;
    let terminalRows = 24;
    let mode = 'more';
    let exitCallback = null;

    function _handleKeyDown(e) {
        if (!isActive) return;

        e.preventDefault();
        let scrolled = false;

        switch (e.key) {
            case 'q':
                exit();
                break;
            case ' ':
            case 'f':
                topVisibleLine = Math.min(topVisibleLine + terminalRows, Math.max(0, lines.length - terminalRows));
                scrolled = true;
                break;
            case 'ArrowDown':
                if (mode === 'less') {
                    topVisibleLine = Math.min(topVisibleLine + 1, Math.max(0, lines.length - terminalRows));
                    scrolled = true;
                }
                break;
            case 'b':
            case 'ArrowUp':
                if (mode === 'less') {
                    topVisibleLine = Math.max(0, topVisibleLine - terminalRows);
                    scrolled = true;
                }
                break;
        }

        if (scrolled) {
            PagerUI.render(lines, topVisibleLine, mode, terminalRows);
        }
    }

    function enter(content, options) {
        if (isActive) return;
        isActive = true;

        lines = content.split('\n');
        topVisibleLine = 0;
        mode = options.mode || 'more';

        const pagerElement = PagerUI.buildLayout();
        AppLayerManager.show(pagerElement);

        document.addEventListener('keydown', _handleKeyDown);

        setTimeout(() => {
            terminalRows = PagerUI.getTerminalRows();
            PagerUI.render(lines, topVisibleLine, mode, terminalRows);
        }, 0);

        return new Promise(resolve => {
            exitCallback = resolve;
        });
    }

    function exit() {
        if (!isActive) return;
        document.removeEventListener('keydown', _handleKeyDown);
        AppLayerManager.hide();
        PagerUI.reset();

        isActive = false;
        lines = [];
        topVisibleLine = 0;

        if (exitCallback) {
            exitCallback();
            exitCallback = null;
        }
    }

    return { enter, isActive: () => isActive };
})();