// REFACTORED: aedmark/oopis-os-dev/Oopis-OS-DEV-cbc33c0961be0b361f0e88490da8362b6de6b93c/scripts/apps/chidi/chidi_ui.js
const ChidiUI = (() => {
    "use strict";

    let elements = {};
    let callbacks = {};

    function buildAndShow(initialState, cb) {
        callbacks = cb;

        // --- Programmatic UI Construction ---
        const header = Utils.createElement('header', {className: 'chidi-console-header'},
            Utils.createElement('div', {id: 'chidi-custom-selector'},
                Utils.createElement('button', {id: 'chidi-selector-trigger', className: 'chidi-btn chidi-select'}),
                Utils.createElement('div', {id: 'chidi-selector-panel', className: 'chidi-selector-panel hidden'})
            ),
            Utils.createElement('h1', {id: 'chidi-mainTitle', textContent: 'chidi.md'}),
            Utils.createElement('div', {className: 'chidi-control-group'},
                Utils.createElement('button', {
                    id: 'chidi-summarizeBtn',
                    className: 'chidi-btn',
                    textContent: 'Summarize'
                }),
                Utils.createElement('button', {
                    id: 'chidi-suggestQuestionsBtn',
                    className: 'chidi-btn',
                    textContent: 'Study'
                }),
                Utils.createElement('button', {id: 'chidi-askAllFilesBtn', className: 'chidi-btn', textContent: 'Ask'}),
                Utils.createElement('button', {
                    id: 'chidi-autolink-btn',
                    className: 'chidi-btn',
                    textContent: 'Auto-Link Summary'
                })
            )
        );

        const mainContent = Utils.createElement('main', {
            id: 'chidi-markdownDisplay',
            className: 'chidi-markdown-content'
        });

        const footer = Utils.createElement('footer', {className: 'chidi-status-readout'},
            Utils.createElement('div', {id: 'chidi-fileCountDisplay', className: 'chidi-status-item'}),
            Utils.createElement('div', {id: 'chidi-messageBox', className: 'chidi-status-message'}), // This is our new indicator
            Utils.createElement('div', {className: 'chidi-control-group'},
                Utils.createElement('div', {id: 'chidi-loader', className: 'chidi-loader chidi-hidden'}),
                Utils.createElement('button', {
                    id: 'chidi-verbose-toggle-btn',
                    className: 'chidi-btn',
                    textContent: 'Log: Off'
                }),
                Utils.createElement('button', {
                    id: 'chidi-saveSessionBtn',
                    className: 'chidi-btn',
                    textContent: 'Save'
                }),
                Utils.createElement('button', {id: 'chidi-exportBtn', className: 'chidi-btn', textContent: 'Export'}),
                Utils.createElement('button', {
                    id: 'chidi-closeBtn',
                    className: 'chidi-btn chidi-exit-btn',
                    textContent: 'Exit'
                })
            )
        );

        const appContainer = Utils.createElement('div', {id: 'chidi-console-panel'}, header, mainContent, footer);
        // --- End Programmatic UI Construction ---

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
        // NEW: Update status message to reflect session state
        elements.messageBox.textContent = `Analyzing ${state.loadedFiles.length} files. Ask a follow-up question.`;

        elements.exportBtn.disabled = !hasFiles;
        elements.saveSessionBtn.disabled = !hasFiles;
        elements.summarizeBtn.disabled = !hasFiles;
        elements.studyBtn.disabled = !hasFiles;
        elements.askBtn.disabled = !hasFiles;
        elements.autoLinkBtn.disabled = !hasFiles;

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
            autoLinkBtn: get('chidi-autolink-btn'),
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

        elements.autoLinkBtn.addEventListener('click', () => callbacks.onAutoLink());

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

    return {buildAndShow, hideAndReset, update, showMessage, appendAiOutput, toggleLoader, packageSessionAsHTML};
})();