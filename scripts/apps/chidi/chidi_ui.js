const ChidiUI = (() => {
    "use strict";

    let elements = {};
    let callbacks = {};

    function buildAndShow(initialState, cb) {
        callbacks = cb;

        const appContainer = Utils.createElement('div', {id: 'chidi-console-panel'});
        appContainer.innerHTML = _getHTML();
        AppLayerManager.show(appContainer);

        _cacheDOMElements();
        _setupEventListeners();
        update(initialState);
    }

    function hideAndReset() {
        AppLayerManager.hide();
        elements = {};
        callbacks = {};
    }

    function update(state) {
        if (!elements.container) return;

        const hasFiles = state.loadedFiles.length > 0;
        const currentFile = hasFiles ? state.loadedFiles[state.currentIndex] : null;

        elements.fileCountDisplay.textContent = `🖹 ${state.loadedFiles.length}`;
        elements.exportBtn.disabled = !hasFiles;
        elements.saveSessionBtn.disabled = !hasFiles;
        elements.summarizeBtn.disabled = !hasFiles;
        elements.studyBtn.disabled = !hasFiles;
        elements.askBtn.disabled = !hasFiles;

        _populateFileDropdown(state.loadedFiles, state.currentIndex);

        if (currentFile) {
            elements.mainTitle.textContent = currentFile.name.replace(/\.(md|txt|js|sh)$/i, '');
            elements.markdownDisplay.className = 'chidi-markdown-content';
            if (currentFile.isCode || Utils.getFileExtension(currentFile.name) === 'txt') {
                elements.markdownDisplay.innerHTML = `<pre>${currentFile.content || ''}</pre>`;
            } else {
                elements.markdownDisplay.innerHTML = DOMPurify.sanitize(marked.parse(currentFile.content));
            }
        } else {
            elements.mainTitle.textContent = "chidi.md";
            elements.markdownDisplay.innerHTML = `<p>No files loaded.</p>`;
        }
    }

    function _cacheDOMElements() {
        const get = (id) => document.getElementById(id);
        elements = {
            container: get('chidi-console-panel'),
            selectorTrigger: get('chidi-selector-trigger'),
            selectorPanel: get('chidi-selector-panel'),
            mainTitle: get('chidi-mainTitle'),
            markdownDisplay: get('chidi-markdownDisplay'),
            fileCountDisplay: get('chidi-fileCountDisplay'),
            messageBox: get('chidi-messageBox'),
            loader: get('chidi-loader'),
            summarizeBtn: get('chidi-summarizeBtn'),
            studyBtn: get('chidi-suggestQuestionsBtn'),
            askBtn: get('chidi-askAllFilesBtn'),
            saveSessionBtn: get('chidi-saveSessionBtn'),
            verboseToggleBtn: get('chidi-verbose-toggle-btn'),
            exportBtn: get('chidi-exportBtn'),
            closeBtn: get('chidi-closeBtn')
        };
    }

    function _setupEventListeners() {
        elements.closeBtn.addEventListener('click', () => callbacks.onClose());
        elements.exportBtn.addEventListener('click', () => callbacks.onExport());

        elements.selectorTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            _toggleDropdown();
        });

        elements.verboseToggleBtn.addEventListener('click', () => {
            const isVerbose = callbacks.onVerboseToggle();
            elements.verboseToggleBtn.textContent = isVerbose ? 'Log: On' : 'Log: Off';
        });

        elements.askBtn.addEventListener('click', async () => {
            const userQuestion = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical-input',
                    messageLines: ["Ask a question about all loaded documents:"],
                    onConfirm: resolve, onCancel: () => resolve(null)
                });
            });
            if (userQuestion) callbacks.onAsk(userQuestion);
        });

        elements.summarizeBtn.addEventListener('click', () => callbacks.onSummarize());
        elements.studyBtn.addEventListener('click', () => callbacks.onStudy());
        elements.saveSessionBtn.addEventListener('click', async () => {
            const filename = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical-input',
                    messageLines: ["Save Chidi Session As:"],
                    placeholder: `chidi_session_${new Date().toISOString().split('T')[0]}.html`,
                    onConfirm: (value) => resolve(value.trim()),
                    onCancel: () => resolve(null)
                });
            });
            if (filename) callbacks.onSaveSession(filename);
        });

        document.addEventListener('keydown', (e) => {
            if (!AppLayerManager.isActive() || !elements.container) return;
            if (e.key === 'Escape') {
                elements.selectorPanel.classList.contains('hidden') ? callbacks.onClose() : _toggleDropdown(false);
            }
        });
    }

    function _populateFileDropdown(files, currentIndex) {
        const panel = elements.selectorPanel;
        panel.innerHTML = '';
        elements.selectorTrigger.textContent = files.length > 0 ? files[currentIndex].name : 'No Files';

        files.forEach((file, index) => {
            const item = Utils.createElement('button', {
                className: 'chidi-selector-item',
                textContent: file.name, 'data-index': index
            });
            if (index === currentIndex) item.classList.add('selected');
            item.addEventListener('click', () => {
                callbacks.onFileSelect(index);
                _toggleDropdown(false);
            });
            panel.appendChild(item);
        });
    }

    function _toggleDropdown(forceState) {
        const panel = elements.selectorPanel;
        const shouldBeVisible = typeof forceState === 'boolean' ? forceState : panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !shouldBeVisible);
    }

    function showMessage(msg, forceShow = false) {
        if (elements.messageBox) elements.messageBox.textContent = `֎ ${msg}`;
    }

    function appendAiOutput(title, content) {
        const outputBlock = Utils.createElement('div', {className: 'chidi-ai-output'});
        outputBlock.innerHTML = DOMPurify.sanitize(marked.parse(`### ${title}\n\n${content}`));
        elements.markdownDisplay.appendChild(outputBlock);
        outputBlock.scrollIntoView({behavior: 'smooth', block: 'start'});
        showMessage(`AI Response received for "${title}".`, true);
    }

    function toggleLoader(show) {
        if (elements.loader) elements.loader.classList.toggle('chidi-hidden', !show);
    }

    function packageSessionAsHTML(state) {
        const currentFile = state.loadedFiles[state.currentIndex];
        const content = elements.markdownDisplay.innerHTML;
        const title = `Chidi Session: ${currentFile.name}`;
        const styles = "body{background-color:#0d0d0d;color:#e4e4e7;font-family:'VT323',monospace;line-height:1.6;padding:2rem}h1,h2,h3{border-bottom:1px solid #444;padding-bottom:.3rem;color:#60a5fa}a{color:#34d399}pre{white-space:pre-wrap;background-color:#000;padding:1rem;border-radius:4px}.chidi-ai-output{border-top:2px dashed #60a5fa;margin-top:2rem;padding-top:1rem}";
        return `<!DOCTYPE html><html lang="en"><head><title>${title}</title><style>${styles}</style></head><body><h1>${title}</h1>${content}</body></html>`;
    }

    function _getHTML() {
        return `
            <header class="chidi-console-header">
                <div id="chidi-custom-selector">
                    <button id="chidi-selector-trigger" class="chidi-btn chidi-select"></button>
                    <div id="chidi-selector-panel" class="chidi-selector-panel hidden"></div>
                </div>
                <h1 id="chidi-mainTitle">chidi.md</h1>
                <div class="chidi-control-group">
                    <button id="chidi-summarizeBtn" class="chidi-btn">Summarize</button>
                    <button id="chidi-suggestQuestionsBtn" class="chidi-btn">Study</button>
                    <button id="chidi-askAllFilesBtn" class="chidi-btn">Ask</button>
                </div>
            </header>
            <main id="chidi-markdownDisplay" class="chidi-markdown-content"></main>
            <footer class="chidi-status-readout">
                <div id="chidi-fileCountDisplay" class="chidi-status-item"></div>
                <div id="chidi-messageBox" class="chidi-status-message"></div>
                <div class="chidi-control-group">
                    <div id="chidi-loader" class="chidi-loader chidi-hidden"></div>
                    <button id="chidi-verbose-toggle-btn" class="chidi-btn">Log: Off</button>
                    <button id="chidi-saveSessionBtn" class="chidi-btn">Save</button>
                    <button id="chidi-exportBtn" class="chidi-btn">Export</button>
                    <button id="chidi-closeBtn" class="chidi-btn chidi-exit-btn">Exit</button>
                </div>
            </footer>
        `;
    }

    return {buildAndShow, hideAndReset, update, showMessage, appendAiOutput, toggleLoader, packageSessionAsHTML};
})();