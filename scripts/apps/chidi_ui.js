/**
 * @fileoverview UI logic for Chidi.md, a modal Markdown reader and analyzer for OopisOS.
 * This file handles the UI creation, state management, Markdown rendering, and interaction with the Gemini API.
 * @module ChidiApp
 */

/* global Utils, Config, marked, ChidiManager */ // ChidiManager is the brain

const ChidiUI = (() => {
    /**
     * @property {Object.<string, HTMLElement>} elements - A cache of frequently accessed DOM elements.
     */
    let elements = {};
    let callbacks = {}; // Callbacks from UI to Manager

    /**
     * Creates the main modal element containing the application's UI.
     * @returns {HTMLElement} The root element of the Chidi application.
     */
    function createModal(managerCallbacks) {
        callbacks = managerCallbacks; // Store callbacks from Manager
        const appContainer = Utils.createElement('div', { id: 'chidi-console-panel' });
        appContainer.innerHTML = getHTML(); // Populate inner HTML once
        return appContainer;
    }

    /**
     * Caches references to frequently used DOM elements for performance.
     */
    function cacheDOMElements() {
        const get = (id) => document.getElementById(id);
        elements = {
            customSelector: get('chidi-custom-selector'),
            selectorTrigger: get('chidi-selector-trigger'),
            selectorPanel: get('chidi-selector-panel'),
            summarizeBtn: get('chidi-summarizeBtn'),
            studyBtn: get('chidi-suggestQuestionsBtn'),
            askBtn: get('chidi-askAllFilesBtn'),
            saveSessionBtn: get('chidi-saveSessionBtn'),
            verboseToggleBtn: get('chidi-verbose-toggle-btn'),
            exportBtn: get('chidi-exportBtn'),
            closeBtn: get('chidi-closeBtn'),
            markdownDisplay: get('chidi-markdownDisplay'),
            messageBox: get('chidi-messageBox'),
            loader: get('chidi-loader'),
            mainTitle: get('chidi-mainTitle'),
            fileCountDisplay: get('chidi-fileCountDisplay'),
            askInputContainer: get('chidi-ask-input-container'),
            askInput: get('chidi-ask-input'),
        };
    }

    /**
     * Sets up all event listeners for the UI elements, delegating to manager callbacks.
     */
    function setupEventListeners() {
        elements.closeBtn.addEventListener('click', callbacks.onExit);
        elements.exportBtn.addEventListener('click', _handleExport);
        elements.saveSessionBtn.addEventListener('click', callbacks.onSaveSession);

        elements.verboseToggleBtn.addEventListener('click', callbacks.onVerboseToggle);

        // Listener for the main trigger button
        elements.selectorTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the global click listener from immediately closing it
            toggleDropdown();
        });

        // Global keydown listener for Escape and dropdown navigation
        document.addEventListener('keydown', (e) => {
            if (!ChidiManager.isActive()) return; // Only active if Chidi is open

            if (e.key === 'Escape') {
                if (elements.selectorPanel.classList.contains('hidden')) {
                    callbacks.onExit(); // Exit app if dropdown is closed
                } else {
                    toggleDropdown(false); // Hide panel on Escape if open
                }
            }

            if (!elements.selectorPanel.classList.contains('hidden')) {
                callbacks.onDropdownKeydown(e, document.activeElement ? Array.from(elements.selectorPanel.querySelectorAll('.chidi-selector-item')).indexOf(document.activeElement) : -1, Array.from(elements.selectorPanel.querySelectorAll('.chidi-selector-item')));
            }
        });

        // Add a new listener to handle clicks outside the dropdown
        document.addEventListener('click', (e) => {
            callbacks.onOutsideClick(e.target, elements.customSelector, elements.selectorPanel);
        });

        elements.summarizeBtn.addEventListener('click', callbacks.onSummarize);
        elements.studyBtn.addEventListener('click', callbacks.onStudy);
        elements.askBtn.addEventListener('click', callbacks.onAsk);
        elements.askInput.addEventListener('keydown', (e) => callbacks.onAskInputKeydown(e, elements.askInput));
        elements.searchBar.addEventListener('input', (e) => callbacks.onSearch(e.target.value));
    }


    /**
     * Updates the entire UI based on the current application state.
     */
    function updateUI(state) {
        if (!state.isModalOpen) return;

        const hasFiles = state.loadedFiles.length > 0;
        const currentFile = ChidiManager.getCurrentFile(); // Get current file from manager

        elements.fileCountDisplay.textContent = `🖹 ${state.loadedFiles.length}`;
        elements.exportBtn.disabled = !hasFiles;
        elements.saveSessionBtn.disabled = !hasFiles;

        const trigger = elements.selectorTrigger;
        trigger.disabled = !hasFiles || state.loadedFiles.length <= 1;
        trigger.textContent = currentFile ? currentFile.name : 'No Files Loaded';

        elements.summarizeBtn.disabled = !hasFiles;
        elements.studyBtn.disabled = !hasFiles;
        elements.askBtn.disabled = !hasFiles;

        if (currentFile) {
            elements.mainTitle.textContent = currentFile.name.replace(/\.md$/i, '');
            elements.markdownDisplay.className = 'chidi-markdown-content'; // Reset class

            if (currentFile.name.toLowerCase().endsWith('.txt')) {
                elements.markdownDisplay.innerHTML = `<pre>${currentFile.content || ''}</pre>`;
            } else {
                try {
                    elements.markdownDisplay.innerHTML = marked.parse(currentFile.content);
                } catch (error) {
                    elements.markdownDisplay.innerHTML = `<p class="chidi-error-text">Error rendering Markdown for ${currentFile.name}.</p>`;
                    console.error("Markdown parsing error:", error);
                }
            }
        } else {
            elements.mainTitle.textContent = "chidi.md";
            elements.markdownDisplay.innerHTML = `<p class="chidi-placeholder-text">No files loaded.</p>`;
        }
    }

    function updateFileDropdown(files, currentIndex) {
        const panel = elements.selectorPanel;
        panel.innerHTML = ''; // Clear previous items

        if (files.length === 0) {
            elements.selectorTrigger.textContent = "No Files";
            return;
        }

        files.forEach((file, index) => {
            const item = Utils.createElement('button', {
                className: 'chidi-selector-item',
                textContent: file.name,
                title: file.path,
                'data-index': index
            });

            if (index === currentIndex) {
                item.classList.add('selected');
            }

            item.addEventListener('click', () => {
                callbacks.onSelect(index);
                toggleDropdown(false); // Hide panel on selection
            });

            panel.appendChild(item);
        });
    }

    function toggleDropdown(forceState) {
        const panel = elements.selectorPanel;
        const shouldBeVisible = typeof forceState === 'boolean' ? forceState : panel.classList.contains('hidden');

        if (shouldBeVisible) {
            const triggerRect = elements.selectorTrigger.getBoundingClientRect();
            const consoleRect = document.getElementById('chidi-console-panel').getBoundingClientRect();

            // This is the fix for the dimensional rift.
            // We constrain the dropdown's height to the available space below the trigger.
            const maxHeight = consoleRect.bottom - triggerRect.bottom - 10; // 10px buffer
            panel.style.maxHeight = `${maxHeight}px`;

            panel.classList.remove('hidden');
            // Focus the selected item when opening
            const selected = panel.querySelector('.selected') || panel.firstChild;
            if (selected) selected.focus();
        } else {
            panel.classList.add('hidden');
        }
    }

    function toggleAskingMode(isAsking) {
        elements.markdownDisplay.classList.toggle('chidi-hidden', isAsking);
        elements.askInputContainer.classList.toggle('chidi-hidden', !isAsking);

        elements.askBtn.textContent = isAsking ? 'Submit' : 'Ask';
        elements.studyBtn.textContent = isAsking ? 'Cancel' : 'Study';

        elements.summarizeBtn.disabled = isAsking;
        elements.exportBtn.disabled = isAsking;
        elements.selectorTrigger.disabled = isAsking;

        if (isAsking) {
            elements.askInput.value = '';
            elements.askInput.focus();
        }
    }

    function showMessage(msg, forceShow = false) {
        const state = ChidiManager.getState(); // Get current state from manager
        if (state.isVerbose || forceShow) {
            if (elements.messageBox) {
                elements.messageBox.textContent = `֎ ${msg}`;
            }
        }
    }

    function appendAiOutput(title, content) {
        const outputBlock = Utils.createElement('div', { className: 'chidi-ai-output' });
        outputBlock.innerHTML = marked.parse(`### ${title}\n\n${content}`);
        elements.markdownDisplay.appendChild(outputBlock);
        outputBlock.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        showMessage(`AI Response received for "${title}".`, true);
    }

    function toggleLoader(show) {
        if (elements.loader) {
            elements.loader.classList.toggle('chidi-hidden', !show);
        }
    }

    function updateVerboseToggle(isVerbose) {
        if (elements.verboseToggleBtn) {
            elements.verboseToggleBtn.textContent = isVerbose ? 'Log: On' : 'Log: Off';
        }
    }

    function getAskInput() {
        return elements.askInput.value.trim();
    }

    function packageSessionAsHTML() {
        const currentFile = ChidiManager.getCurrentFile(); // Get current file from manager
        if (!currentFile) return "";

        const content = elements.markdownDisplay.innerHTML;
        const title = `Chidi Session: ${currentFile.name}`;
        const styles = `
            body { background-color: #0d0d0d; color: #e4e4e7; font-family: 'VT323', monospace; line-height: 1.6; padding: 2rem; }
            h1, h2, h3, h4, h5, h6 { border-bottom: 1px solid #444; padding-bottom: 0.3rem; color: #60a5fa; }
            a { color: #34d399; }
            pre { white-space: pre-wrap; word-break: break-all; background-color: #000; padding: 1rem; border-radius: 4px; border: 1px solid #333; }
            code:not(pre > code) { background-color: #27272a; color: #facc15; padding: 0.2rem 0.4rem; border-radius: 3px; }
            blockquote { border-left: 4px solid #60a5fa; padding-left: 1rem; margin-left: 0; color: #a1a1aa; }
            .chidi-ai-output { border-top: 2px dashed #60a5fa; margin-top: 2rem; padding-top: 1rem; }
        `;
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet">
                <title>${title}</title>
                <style>${styles}</style>
            </head>
            <body>
                <h1>${title}</h1>
                ${content}
            </body>
            </html>
        `;
    }

    /**
     * Handles exporting the current view as an HTML file.
     * @private
     */
    function _handleExport() {
        const currentFile = ChidiManager.getCurrentFile();
        if (!currentFile) {
            showMessage("Error: No file to export.", true);
            return;
        }

        const html = packageSessionAsHTML();
        if (!html) return;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentFile.name.replace(/\.(md|txt)$/, '')}_session.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage(`Exported session for ${currentFile.name}.`, true);
    }


    /**
     * Resets all UI elements and callbacks.
     */
    function reset() {
        elements = {};
        callbacks = {};
    }

    /**
     * Returns the HTML structure for the application modal.
     * @returns {string} The HTML content as a string.
     */
    function getHTML() {
        return `
            <header class="chidi-console-header">
                <div class="chidi-header-controls">
                    <div id="chidi-custom-selector" class="chidi-selector-container">
                        <button id="chidi-selector-trigger" class="chidi-btn chidi-select"></button>
                        <div id="chidi-selector-panel" class="chidi-selector-panel hidden"></div>
                    </div>
                </div>
                <h1 id="chidi-mainTitle">chidi.md</h1>
                <div class="chidi-header-controls">
                    <div class="chidi-control-group">
                        <button id="chidi-summarizeBtn" class="chidi-btn" title="Summarize the current document">Summarize</button>
                        <button id="chidi-suggestQuestionsBtn" class="chidi-btn" title="Suggest questions about the document">Study</button>
                        <button id="chidi-askAllFilesBtn" class="chidi-btn" title="Ask a question across all loaded documents">Ask</button>
                    </div>
                    
                </div>
            </header>

            <main id="chidi-markdownDisplay" class="chidi-markdown-content">
                <p class="chidi-placeholder-text">Awaiting file selection...</p>
            </main>

            <div id="chidi-ask-input-container" class="chidi-ask-container chidi-hidden">
                <textarea id="chidi-ask-input" class="chidi-ask-textarea" placeholder="Ask a question across all loaded documents... (Press Enter to submit)"></textarea>
            </div>
            
            <footer class="chidi-status-readout">
                <div id="chidi-fileCountDisplay" class="chidi-status-item">🖹 0</div>
                <div id="chidi-messageBox" class="chidi-status-message">֎ Standby.</div>
                <div class="chidi-control-group">
                    <div id="chidi-loader" class="chidi-loader chidi-hidden"></div>
                    <button id="chidi-verbose-toggle-btn" class="chidi-btn" title="Toggle verbose operation log">Log: Off</button>
                    <button id="chidi-saveSessionBtn" class="chidi-btn" title="Save current session to a new file">Save</button>
                    <button id="chidi-exportBtn" class="chidi-btn" title="Export current view as HTML">Export</button>
                    <button id="chidi-closeBtn" class="chidi-btn chidi-exit-btn" title="Close Chidi (Esc)">Exit</button>
                </div>
            </footer>
        `;
    }

    return {
        createModal,
        cacheDOMElements,
        setupEventListeners,
        updateUI,
        updateFileDropdown,
        toggleDropdown,
        toggleAskingMode,
        showMessage,
        appendAiOutput,
        toggleLoader,
        updateVerboseToggle,
        getAskInput,
        packageSessionAsHTML, // Expose for manager to use
        reset,
    };
})();