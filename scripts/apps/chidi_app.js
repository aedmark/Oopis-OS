const ChidiApp = {
    state: {
        loadedFiles: [],
        currentIndex: -1,
        isModalOpen: false,
        isAskingMode: false,
        isVerbose: false,
    },
    elements: {},
    callbacks: {},

    isActive() {
        return this.state.isModalOpen;
    },

    launch(files, callbacks) {
        if (this.state.isModalOpen) {
            console.warn("ChidiApp is already open.");
            return;
        }

        this.state.isModalOpen = true;
        this.state.loadedFiles = files;
        this.state.currentIndex = files.length > 0 ? 0 : -1;
        this.callbacks = callbacks;

        const chidiElement = this.createModal();
        AppLayerManager.show(chidiElement);

        this.cacheDOMElements();
        this._populateFileDropdown();
        this.setupEventListeners();

        this.updateUI();

        if (callbacks.isNewSession) {
            this.showMessage("New session started. AI interaction history is cleared.", true);
        } else {
            this.showMessage("Chidi.md initialized. " + files.length + " files loaded.", true);
        }
    },

    close() {
        if (!this.state.isModalOpen) return;

        AppLayerManager.hide();

        this.state = {
            loadedFiles: [],
            currentIndex: -1,
            isModalOpen: false,
            isAskingMode: false,
        };
        this.elements = {};
        this.callbacks = {};

        if (typeof this.callbacks.onExit === 'function') {
            this.callbacks.onExit();
        }
    },

    createModal() {
        const appContainer = document.createElement('div');
        appContainer.id = 'chidi-console-panel';
        appContainer.innerHTML = this.getHTML();
        return appContainer;
    },

    cacheDOMElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            ...this.elements,
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
    },

    updateUI() {
        if (!this.state.isModalOpen) return;

        const hasFiles = this.state.loadedFiles.length > 0;
        const currentFile = this.getCurrentFile();

        this.elements.fileCountDisplay.textContent = `🖹 ${this.state.loadedFiles.length}`;
        this.elements.exportBtn.disabled = !hasFiles;
        this.elements.saveSessionBtn.disabled = !hasFiles;

        const trigger = this.elements.selectorTrigger;
        trigger.disabled = !hasFiles || this.state.loadedFiles.length <= 1;
        trigger.textContent = currentFile ? currentFile.name : 'No Files Loaded';

        this.elements.summarizeBtn.disabled = !hasFiles;
        this.elements.studyBtn.disabled = !hasFiles;
        this.elements.askBtn.disabled = !hasFiles;

        if (currentFile) {
            this.elements.mainTitle.textContent = currentFile.name.replace(/\.md$/i, '');
            this.elements.markdownDisplay.className = 'chidi-markdown-content'; // Reset class

            if (currentFile.name.toLowerCase().endsWith('.txt')) {
                this.elements.markdownDisplay.innerHTML = `<pre>${currentFile.content || ''}</pre>`;
            } else {
                try {
                    // Reverted to default marked.parse() without custom renderer
                    this.elements.markdownDisplay.innerHTML = marked.parse(currentFile.content);
                } catch (error) {
                    this.elements.markdownDisplay.innerHTML = `<p class="chidi-error-text">Error rendering Markdown for ${currentFile.name}.</p>`;
                    console.error("Markdown parsing error:", error);
                }
            }
        } else {
            this.elements.mainTitle.textContent = "chidi.md";
            this.elements.markdownDisplay.innerHTML = `<p class="chidi-placeholder-text">No files loaded.</p>`;
        }
    },

    _populateFileDropdown() {
        const panel = this.elements.selectorPanel;
        panel.innerHTML = ''; // Clear previous items

        if (this.state.loadedFiles.length === 0) {
            this.elements.selectorTrigger.textContent = "No Files";
            return;
        }

        this.state.loadedFiles.forEach((file, index) => {
            const item = Utils.createElement('button', {
                className: 'chidi-selector-item',
                textContent: file.name,
                title: file.path,
                'data-index': index
            });

            if (index === this.state.currentIndex) {
                item.classList.add('selected');
            }

            item.addEventListener('click', () => {
                this._selectFileByIndex(index);
                this._toggleDropdown(false); // Hide panel on selection
            });

            panel.appendChild(item);
        });
    },

    setupEventListeners() {
        this.elements.closeBtn.addEventListener('click', () => this.close());
        this.elements.exportBtn.addEventListener('click', () => this._handleExport());
        this.elements.saveSessionBtn.addEventListener('click', () => this._handleSaveSession());

        this.elements.verboseToggleBtn.addEventListener('click', () => {
            this.state.isVerbose = !this.state.isVerbose;
            this.elements.verboseToggleBtn.textContent = this.state.isVerbose ? 'Log: On' : 'Log: Off';
            this.showMessage(`Verbose logging ${this.state.isVerbose ? 'enabled' : 'disabled'}.`, true);
        });

        this.elements.selectorTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleDropdown();
        });

        document.addEventListener('keydown', (e) => {
            if (!this.isActive()) return;

            if (e.key === 'Escape') {
                if (this.elements.selectorPanel.classList.contains('hidden')) {
                    this.close();
                } else {
                    this._toggleDropdown(false);
                }
            }

            if (!this.elements.selectorPanel.classList.contains('hidden')) {
                this._handleKeyboardNavigation(e);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.isActive() || this.elements.selectorPanel.classList.contains('hidden')) {
                return;
            }
            if (!this.elements.customSelector.contains(e.target)) {
                this._toggleDropdown(false);
            }
        });

        this.elements.summarizeBtn.addEventListener('click', async () => {
            const currentFile = this.getCurrentFile();
            if (!currentFile) return;
            const prompt = `Please provide a concise summary of the following document:\n\n---\n\n${currentFile.content}`;
            this.toggleLoader(true);
            this.showMessage("Contacting Gemini API...");
            const summary = await this.callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
            this.toggleLoader(false);
            this.appendAiOutput("Summary", summary);
        });

        this.elements.studyBtn.addEventListener('click', async () => {
            if (this.state.isAskingMode) {
                this._exitQuestionMode();
                return;
            }
            const currentFile = this.getCurrentFile();
            if (!currentFile) return;
            const prompt = `Based on the following document, what are some insightful questions a user might ask?\n\n---\n\n${currentFile.content}`;
            this.toggleLoader(true);
            this.showMessage("Contacting Gemini API...");
            const questions = await this.callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
            this.toggleLoader(false);
            this.appendAiOutput("Suggested Questions", questions);
        });

        this.elements.askBtn.addEventListener('click', async () => {
            if (this.state.isAskingMode) {
                await this._submitQuestion();
            } else {
                this._enterQuestionMode();
            }
        });

        this.elements.askInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await this._submitQuestion();
            }
        });
    },

    _toggleDropdown(forceState) {
        const panel = this.elements.selectorPanel;
        const shouldBeVisible = typeof forceState === 'boolean' ? forceState : panel.classList.contains('hidden');

        if (shouldBeVisible) {
            const triggerRect = this.elements.selectorTrigger.getBoundingClientRect();
            const consoleRect = document.getElementById('chidi-console-panel').getBoundingClientRect();
            const maxHeight = consoleRect.bottom - triggerRect.bottom - 10;
            panel.style.maxHeight = `${maxHeight}px`;

            panel.classList.remove('hidden');
            const selected = panel.querySelector('.selected') || panel.firstChild;
            if (selected) selected.focus();
        } else {
            panel.classList.add('hidden');
        }
    },

    _handleKeyboardNavigation(e) {
        const items = Array.from(this.elements.selectorPanel.querySelectorAll('.chidi-selector-item'));
        if (items.length === 0) return;

        const currentIndex = items.findIndex(item => item === document.activeElement);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) % items.length;
            items[nextIndex].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (currentIndex - 1 + items.length) % items.length;
            items[prevIndex].focus();
        } else if (e.key === 'Enter' && currentIndex > -1) {
            e.preventDefault();
            items[currentIndex].click();
        }
    },

    _enterQuestionMode() {
        if (!this.getCurrentFile()) return;
        this.state.isAskingMode = true;

        this.elements.markdownDisplay.classList.add('chidi-hidden');
        this.elements.askInputContainer.classList.remove('chidi-hidden');
        this.elements.askInput.value = '';
        this.elements.askInput.focus();

        this.elements.askBtn.textContent = 'Submit';
        this.elements.studyBtn.textContent = 'Cancel';

        this.elements.summarizeBtn.disabled = true;
        this.elements.exportBtn.disabled = true;
        this.elements.selectorTrigger.disabled = true;


        this.showMessage("Ask a question about all loaded files.", true);
    },

    _exitQuestionMode() {
        this.state.isAskingMode = false;

        this.elements.askInputContainer.classList.add('chidi-hidden');
        this.elements.markdownDisplay.classList.remove('chidi-hidden');

        this.elements.askBtn.textContent = 'Ask';
        this.elements.studyBtn.textContent = 'Study';

        this.updateUI();

        this.showMessage("Question mode cancelled.", true);
    },

    async _submitQuestion() {
        const userQuestion = this.elements.askInput.value.trim();
        if (!userQuestion) return;

        this._exitQuestionMode();
        this.toggleLoader(true);
        this.showMessage(`Analyzing ${this.state.loadedFiles.length} files for relevance...`);

        try {
            const questionLower = userQuestion.toLowerCase();
            const stopWords = new Set(['a', 'an', 'the', 'is', 'in', 'of', 'for', 'to', 'what', 'who', 'where', 'when', 'why', 'how', 'and', 'or', 'but']);
            const allWords = questionLower.split(/[\s!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]+/).filter(Boolean);
            const keywords = allWords.filter(word => word.length > 2 && !stopWords.has(word));

            const bigrams = [];
            for (let i = 0; i < allWords.length - 1; i++) {
                bigrams.push(allWords[i] + ' ' + allWords[i + 1]);
            }

            if (keywords.length === 0 && bigrams.length === 0) {
                this.toggleLoader(false);
                this.showMessage("Your question is too generic. Please be more specific.", true);
                this.appendAiOutput("Refine Your Question", "Please ask a more specific question so I can find relevant documents for you.");
                return;
            }

            const currentFile = this.getCurrentFile();
            const otherFiles = this.state.loadedFiles.filter(file => file.path !== currentFile.path);

            const scoredFiles = otherFiles.map(file => {
                let score = 0;
                const contentLower = file.content.toLowerCase();
                const nameLower = file.name.toLowerCase();

                bigrams.forEach(phrase => {
                    score += (contentLower.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length * 10;
                });

                keywords.forEach(keyword => {
                    if (nameLower.includes(keyword)) {
                        score += 15;
                    }
                });

                const headerRegex = /^(#+)\s+(.*)/gm;
                let match;
                while ((match = headerRegex.exec(file.content)) !== null) {
                    const headerText = match[2].toLowerCase();
                    keywords.forEach(keyword => {
                        if (headerText.includes(keyword)) {
                            score += 5;
                        }
                    });
                }

                keywords.forEach(keyword => {
                    score += (contentLower.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                });

                return {
                    file,
                    score
                };
            });

            scoredFiles.sort((a, b) => b.score - a.score);

            const MAX_CONTEXT_FILES = 5;
            const relevantFiles = [currentFile];
            const uniquePaths = new Set([currentFile.path]);

            scoredFiles.slice(0, MAX_CONTEXT_FILES - 1).forEach(item => {
                if (item.score > 0 && !uniquePaths.has(item.file.path)) {
                    relevantFiles.push(item.file);
                    uniquePaths.add(item.file.path);
                }
            });

            this.showMessage(`Found ${relevantFiles.length} relevant files. Asking Gemini...`);

            let promptContext = "Based on the following documents, please provide a comprehensive answer to the user's question. Prioritize information from the first document if it is relevant, but use all provided documents to form your answer.\n\n";
            relevantFiles.forEach(file => {
                promptContext += `--- START OF DOCUMENT: ${file.name} ---\n\n${file.content}\n\n--- END OF DOCUMENT: ${file.name} ---\n\n`;
            });

            const finalPrompt = `${promptContext}User's Question: "${userQuestion}"`;

            this.appendAiOutput(
                "Constructed Prompt for Gemini",
                "The following block contains the exact context and question being sent to the AI for analysis.\n\n\`\`\`text\n" + finalPrompt + "\n\`\`\`"
            );

            const finalAnswer = await this.callGeminiApi([{
                role: 'user',
                parts: [{
                    text: finalPrompt
                }]
            }]);

            const fileNames = relevantFiles.map(item => item.name).join(', ');
            this.appendAiOutput(`Answer for "${userQuestion}" (based on: ${fileNames})`, finalAnswer || "Could not generate a final answer based on the provided documents.");

        } catch (e) {
            this.showMessage(`An unexpected error occurred: ${e.message}`, true);
            this.appendAiOutput("Error", `An unexpected error occurred during processing: ${e.message}`);
        } finally {
            this.toggleLoader(false);
        }
    },

    _selectFileByIndex(indexStr) {
        const index = parseInt(indexStr, 10);
        if (!isNaN(index) && index >= 0 && index < this.state.loadedFiles.length) {
            this.state.currentIndex = index;
            this.updateUI();
            this._populateFileDropdown(); // Re-populate to update the 'selected' class
        }
    },

    getCurrentFile() {
        if (this.state.currentIndex === -1 || this.state.loadedFiles.length === 0) {
            return null;
        }
        return this.state.loadedFiles[this.state.currentIndex];
    },

    showMessage(msg, forceShow = false) {
        if (this.state.isVerbose || forceShow) {
            if (this.elements.messageBox) {
                this.elements.messageBox.textContent = `֎ ${msg}`;
            }
        }
    },

    appendAiOutput(title, content) {
        const outputBlock = document.createElement('div');
        outputBlock.className = 'chidi-ai-output';
        outputBlock.innerHTML = marked.parse(`### ${title}\n\n${content}`);
        this.elements.markdownDisplay.appendChild(outputBlock);
        outputBlock.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        this.showMessage(`AI Response received for "${title}".`, true);
    },

    toggleLoader(show) {
        if (this.elements.loader) {
            this.elements.loader.classList.toggle('chidi-hidden', !show);
        }
    },

    async callGeminiApi(chatHistory) {
        const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY, "Gemini API Key");
        const provider = 'gemini';
        const model = Config.API.LLM_PROVIDERS[provider].defaultModel;

        const result = await Utils.callLlmApi(provider, model, chatHistory, apiKey);

        if (!result.success) {
            this.showMessage(`Error: ${result.error}`, true);
            this.appendAiOutput("API Error", `Failed to get a response. Details: ${result.error}`);
            return "";
        }

        this.showMessage("Response received.", true);
        return result.answer;
    },

    _packageSessionAsHTML() {
        const currentFile = this.getCurrentFile();
        if (!currentFile) return "";

        const content = this.elements.markdownDisplay.innerHTML;
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
    },

    async _handleSaveSession() {
        if (!this.state.isModalOpen || this.state.loadedFiles.length === 0) {
            this.showMessage("Error: No session to save.", true);
            return;
        }

        const defaultFilename = `chidi_session_${new Date().toISOString().split('T')[0]}.html`;

        const filename = await new Promise(resolve => {
            ModalManager.request({
                context: 'graphical-input',
                messageLines: ["Save Chidi Session As:"],
                placeholder: defaultFilename,
                confirmText: "Save",
                cancelText: "Cancel",
                onConfirm: (value) => resolve(value.trim() || defaultFilename),
                onCancel: () => resolve(null)
            });
        });

        if (!filename) {
            this.showMessage("Save cancelled.", true);
            return;
        }

        const htmlContent = this._packageSessionAsHTML();
        if (!htmlContent) {
            this.showMessage("Error: Could not package session for saving.", true);
            return;
        }

        try {
            const absPath = FileSystemManager.getAbsolutePath(filename);
            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

            if (!primaryGroup) {
                this.showMessage("Critical Error: Cannot determine primary group. Save failed.", true);
                return;
            }

            const saveResult = await FileSystemManager.createOrUpdateFile(
                absPath,
                htmlContent,
                { currentUser, primaryGroup }
            );

            if (!saveResult.success) {
                this.showMessage(`Error: ${saveResult.error}`, true);
                return;
            }

            if (!(await FileSystemManager.save())) {
                this.showMessage("Critical Error: Failed to persist file system changes.", true);
                return;
            }

            this.showMessage(`Session saved to '${filename}'.`, true);
        } catch (e) {
            this.showMessage(`An unexpected error occurred during save: ${e.message}`, true);
        }
    },

    _handleExport() {
        const currentFile = this.getCurrentFile();
        if (!currentFile) {
            this.showMessage("Error: No file to export.", true);
            return;
        }

        const html = this._packageSessionAsHTML();
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
        this.showMessage(`Exported session for ${currentFile.name}.`, true);
    },

    getHTML() {
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
    },
};