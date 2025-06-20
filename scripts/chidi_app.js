/**
 * @fileoverview Core application logic for Chidi.md, a modal Markdown reader and analyzer for OopisOS.
 * This file handles the UI creation, state management, Markdown rendering, and interaction with the Gemini API.
 */

const ChidiApp = {
    // Application state
    state: {
        loadedFiles: [],
        currentIndex: -1,
        isModalOpen: false,
        isAskingMode: false, // State to track if user is in "Ask" mode
    },

    // DOM element references
    elements: {},

    /**
     * Checks if the Chidi modal is currently open and active.
     * @returns {boolean} True if the modal is open, false otherwise.
     */
    isActive() {
        return this.state.isModalOpen;
    },

    // --- Core Application Flow ---

    /**
     * Launches the Chidi.md application in a modal window.
     * @param {Array<object>} files - An array of file objects ({ name, path, content }) to be loaded.
     * @param {function} onExit - Callback function to execute when the application is closed.
     */
    launch(files, onExit) {
        if (this.state.isModalOpen) {
            console.warn("ChidiApp is already open.");
            return;
        }

        this.state.isModalOpen = true;
        this.state.loadedFiles = files;
        this.state.currentIndex = files.length > 0 ? 0 : -1;
        this.onExit = onExit;

        this.injectStyles();
        this.createModal();
        this.cacheDOMElements();
        this._populateFileDropdown();
        this.setupEventListeners();

        this.updateUI();
        this.showMessage("Chidi.md initialized. " + files.length + " files loaded.");
    },

    /**
     * Closes the application, removes UI elements and styles, and calls the exit callback.
     */
    close() {
        if (!this.state.isModalOpen) return;

        this.elements.modal.remove();
        this.elements.styleTag.remove();

        // Reset state
        this.state = {
            loadedFiles: [],
            currentIndex: -1,
            isModalOpen: false,
            isAskingMode: false,
        };
        this.elements = {};

        if (typeof this.onExit === 'function') {
            this.onExit();
        }
    },

    // --- UI and DOM Management ---

    /**
     * Injects the application's CSS into the document's head.
     */
    injectStyles() {
        const styleTag = document.createElement('style');
        styleTag.id = 'chidi-app-styles';
        styleTag.textContent = this.getStyles();
        document.head.appendChild(styleTag);
        this.elements.styleTag = styleTag;
    },

    /**
     * Creates and appends the main modal structure to the terminal div.
     */
    createModal() {
        if (!DOM.terminalDiv) {
            console.error("ChidiApp Error: Cannot create modal, DOM.terminalDiv not found.");
            if (this.onExit) {
                this.onExit();
            }
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'chidi-modal';
        modal.className = 'chidi-modal-overlay';
        modal.innerHTML = this.getHTML();
        DOM.terminalDiv.appendChild(modal);
        this.elements.modal = modal;
    },

    /**
     * Caches references to frequently used DOM elements.
     */
    cacheDOMElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            ...this.elements,
            prevBtn: get('chidi-prevBtn'),
            nextBtn: get('chidi-nextBtn'),
            fileSelector: get('chidi-file-selector'),
            summarizeBtn: get('chidi-summarizeBtn'),
            studyBtn: get('chidi-suggestQuestionsBtn'),
            askBtn: get('chidi-askAllFilesBtn'),
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

    /**
     * Updates the entire UI based on the current state.
     */
    updateUI() {
        if (!this.state.isModalOpen) return;

        const hasFiles = this.state.loadedFiles.length > 0;
        const currentFile = this.getCurrentFile();

        this.elements.fileCountDisplay.textContent = `FILES: ${this.state.loadedFiles.length}`;
        this.elements.prevBtn.disabled = this.state.currentIndex <= 0;
        this.elements.nextBtn.disabled = this.state.currentIndex >= this.state.loadedFiles.length - 1;
        this.elements.fileSelector.disabled = !hasFiles;
        this.elements.exportBtn.disabled = !hasFiles;

        if (hasFiles) {
            this.elements.fileSelector.value = this.state.currentIndex;
        }

        this.elements.summarizeBtn.disabled = !hasFiles;
        this.elements.studyBtn.disabled = !hasFiles;
        this.elements.askBtn.disabled = !hasFiles;

        if (currentFile) {
            this.elements.mainTitle.textContent = currentFile.name.replace(/\.md$/i, '');
            try {
                this.elements.markdownDisplay.innerHTML = marked.parse(currentFile.content);
            } catch (error) {
                this.elements.markdownDisplay.innerHTML = `<p class="chidi-error-text">Error rendering Markdown for ${currentFile.name}.</p>`;
                console.error("Markdown parsing error:", error);
            }
        } else {
            this.elements.mainTitle.textContent = "chidi.md";
            this.elements.markdownDisplay.innerHTML = `<p class="chidi-placeholder-text">No Markdown files loaded.</p>`;
        }

        this._adjustTitleFontSize();
    },

    /**
     * Dynamically adjusts the title's font size to prevent it from overflowing its container.
     * @private
     */
    _adjustTitleFontSize() {
        const titleEl = this.elements.mainTitle;
        if (!titleEl) return;

        titleEl.style.fontSize = '1.5rem';

        const minFontSize = 0.8;
        let currentFontSize = 1.5;

        while (titleEl.scrollWidth > titleEl.offsetWidth + 1 && currentFontSize > minFontSize) {
            currentFontSize -= 0.05;
            titleEl.style.fontSize = `${currentFontSize}rem`;
        }
    },

    /**
     * Populates the file selector dropdown with the names of all loaded files.
     * @private
     */
    _populateFileDropdown() {
        const selector = this.elements.fileSelector;
        selector.innerHTML = '';
        if (this.state.loadedFiles.length === 0) {
            const defaultOption = document.createElement('option');
            defaultOption.textContent = "No Files";
            selector.appendChild(defaultOption);
            return;
        }
        this.state.loadedFiles.forEach((file, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = file.name;
            selector.appendChild(option);
        });
    },

    // --- Event Handling ---

    /**
     * Sets up all necessary event listeners for the application's interactive elements.
     */
    setupEventListeners() {
        this.elements.closeBtn.addEventListener('click', () => this.close());
        this.elements.exportBtn.addEventListener('click', () => this._exportConversation());

        document.addEventListener('keydown', (e) => {
            if (!this.isActive()) return;

            if (e.key === 'Escape') {
                if (this.state.isAskingMode) {
                    this._exitQuestionMode();
                } else {
                    this.close();
                }
            }
        });

        this.elements.prevBtn.addEventListener('click', () => this.navigate(-1));
        this.elements.nextBtn.addEventListener('click', () => this.navigate(1));

        this.elements.fileSelector.addEventListener('change', (e) => {
            if (this.state.isAskingMode) {
                this._exitQuestionMode();
            }
            this._selectFileByIndex(e.target.value);
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

    // --- Core Logic & Helpers ---

    /**
     * Switches the UI into question-asking mode.
     * @private
     */
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
        this.elements.prevBtn.disabled = true;
        this.elements.nextBtn.disabled = true;
        this.elements.fileSelector.disabled = true;

        this.showMessage("Ask a question about all loaded files.");
    },

    /**
     * Exits question-asking mode and reverts the UI.
     * @private
     */
    _exitQuestionMode() {
        this.state.isAskingMode = false;

        this.elements.askInputContainer.classList.add('chidi-hidden');
        this.elements.markdownDisplay.classList.remove('chidi-hidden');

        this.elements.askBtn.textContent = 'Ask';
        this.elements.studyBtn.textContent = 'Study';

        this.updateUI();

        this.showMessage("Question mode cancelled.");
    },

    /**
     * **[REVISED]**
     * Submits the user's question. This new implementation first finds the most relevant
     * files using a local keyword search before sending a single, focused request to the AI.
     * @private
     */
    async _submitQuestion() {
        const userQuestion = this.elements.askInput.value.trim();
        if (!userQuestion) return;

        this._exitQuestionMode();
        this.toggleLoader(true);
        this.showMessage(`Analyzing ${this.state.loadedFiles.length} files for relevance...`);

        try {
            // 1. Retrieval Phase: Find the most relevant files locally.
            const stopWords = new Set(['a', 'an', 'the', 'is', 'in', 'of', 'for', 'to', 'what', 'who', 'where', 'when', 'why', 'how']);
            const questionKeywords = userQuestion.toLowerCase().split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word));

            if (questionKeywords.length === 0) {
                this.toggleLoader(false);
                this.showMessage("Your question is too generic. Please be more specific.");
                this.appendAiOutput("Refine Your Question", "Please ask a more specific question so I can find relevant documents for you.");
                return;
            }

            const scoredFiles = this.state.loadedFiles.map(file => {
                let score = 0;
                const contentLower = file.content.toLowerCase();
                questionKeywords.forEach(keyword => {
                    score += (contentLower.match(new RegExp(keyword, 'g')) || []).length;
                });
                return { file, score };
            });

            scoredFiles.sort((a, b) => b.score - a.score);

            const topN = 5; // We'll take the top 5 most relevant files
            const relevantFiles = scoredFiles.slice(0, topN).filter(item => item.score > 0);

            if (relevantFiles.length === 0) {
                this.toggleLoader(false);
                this.showMessage("Could not find any relevant files for your question.");
                this.appendAiOutput("No Relevant Files Found", "I could not find any files that seem relevant to your question.");
                return;
            }

            this.showMessage(`Found ${relevantFiles.length} relevant files. Asking Gemini...`);

            // 2. Augmentation & Generation Phase: Build the prompt and call the API once.
            let promptContext = "Based on the following documents, please provide a comprehensive answer to the user's question.\n\n";
            relevantFiles.forEach(item => {
                promptContext += `--- START OF DOCUMENT: ${item.file.name} ---\n\n${item.file.content}\n\n--- END OF DOCUMENT: ${item.file.name} ---\n\n`;
            });

            const finalPrompt = `${promptContext}User's Question: "${userQuestion}"`;

            const finalAnswer = await this.callGeminiApi([{ role: 'user', parts: [{ text: finalPrompt }] }]);

            const fileNames = relevantFiles.map(item => item.file.name).join(', ');
            this.appendAiOutput(`Answer for "${userQuestion}" (based on: ${fileNames})`, finalAnswer || "Could not generate a final answer based on the provided documents.");

        } catch (e) {
            this.showMessage(`An unexpected error occurred: ${e.message}`);
            this.appendAiOutput("Error", `An unexpected error occurred during processing: ${e.message}`);
        } finally {
            this.toggleLoader(false);
        }
    },


    /**
     * Navigates to the next or previous file.
     * @param {number} direction - -1 for previous, 1 for next.
     */
    navigate(direction) {
        if (this.state.isAskingMode) this._exitQuestionMode();

        const newIndex = this.state.currentIndex + direction;
        if (newIndex >= 0 && newIndex < this.state.loadedFiles.length) {
            this.state.currentIndex = newIndex;
            this.updateUI();
        }
    },

    /**
     * Sets the current file based on the dropdown selection.
     * @param {string} indexStr - The index of the file to select, as a string.
     * @private
     */
    _selectFileByIndex(indexStr) {
        const index = parseInt(indexStr, 10);
        if (!isNaN(index) && index >= 0 && index < this.state.loadedFiles.length) {
            this.state.currentIndex = index;
            this.updateUI();
        }
    },

    /**
     * Gets the currently selected file object.
     * @returns {object|null} The current file object or null if none is selected.
     */
    getCurrentFile() {
        if (this.state.currentIndex === -1 || this.state.loadedFiles.length === 0) {
            return null;
        }
        return this.state.loadedFiles[this.state.currentIndex];
    },

    /**
     * Displays a message in the application's status bar.
     * @param {string} msg - The message to display.
     */
    showMessage(msg) {
        if (this.elements.messageBox) {
            this.elements.messageBox.textContent = `LOG: ${msg}`;
        }
    },

    /**
     * Appends AI-generated output to the markdown display area.
     * @param {string} title - The title for the output block (e.g., "Summary").
     * @param {string} content - The AI-generated content (in Markdown format).
     */
    appendAiOutput(title, content) {
        const outputBlock = document.createElement('div');
        outputBlock.className = 'chidi-ai-output';
        outputBlock.innerHTML = marked.parse(`### ${title}\n\n${content}`);
        this.elements.markdownDisplay.appendChild(outputBlock);
        this.elements.markdownDisplay.scrollTop = this.elements.markdownDisplay.scrollHeight;
        this.showMessage(`AI Response received for "${title}".`);
    },

    /**
     * Shows or hides the loading spinner.
     * @param {boolean} show - True to show the loader, false to hide it.
     */
    toggleLoader(show) {
        if (this.elements.loader) {
            this.elements.loader.classList.toggle('chidi-hidden', !show);
        }
    },

    /**
     * Exports the current view (including original content and AI responses) as an HTML file.
     * @private
     */
    _exportConversation() {
        const currentFile = this.getCurrentFile();
        if (!currentFile) {
            this.showMessage("Error: No file to export.");
            return;
        }

        const content = this.elements.markdownDisplay.innerHTML;
        const title = `Chidi Export: ${currentFile.name}`;
        const styles = `
            body { background-color: #0d0d0d; color: #e4e4e7; font-family: 'VT323', monospace; line-height: 1.6; padding: 2rem; }
            h1, h2, h3 { border-bottom: 1px solid #444; padding-bottom: 0.3rem; color: #60a5fa; }
            a { color: #34d399; }
            code { background-color: #27272a; color: #facc15; padding: 0.2rem 0.4rem; border-radius: 3px; }
            pre { background-color: #000; padding: 1rem; border-radius: 4px; border: 1px solid #333; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
            blockquote { border-left: 4px solid #60a5fa; padding-left: 1rem; margin-left: 0; color: #a1a1aa; }
            .chidi-ai-output { border-top: 2px dashed #60a5fa; margin-top: 2rem; padding-top: 1rem; }
        `;
        const html = `
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

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentFile.name.replace(/\.md$/, '')}_export.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showMessage(`Exported view for ${currentFile.name}.`);
    },

    // --- Gemini API Interaction ---

    /**
     * Calls the Gemini API with a given chat history.
     * Assumes API key is already present in StorageManager.
     * @param {Array<object>} chatHistory - The conversation history to send to the model.
     * @returns {Promise<string>} A promise that resolves to the model's text response.
     */
    async callGeminiApi(chatHistory) {
        const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY, "Gemini API Key");
        if (!apiKey) {
            const errorMsg = "API key not found. Please exit and run `chidi` again to set it.";
            this.showMessage(`Error: ${errorMsg}`);
            this.appendAiOutput("API Error", errorMsg);
            return "";
        }

        try {
            const apiUrl = Config.API.GEMINI_URL;
            const headers = {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            };
            const payload = { contents: chatHistory };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
                let errorMsg = `API request failed with status ${response.status}: ${errorBody.error.message}`;
                if (response.status === 400 && errorBody?.error?.message.includes("API key not valid")) {
                    StorageManager.removeItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
                    errorMsg = "Invalid API key. It has been removed. Please exit and run `chidi` again to enter a new one.";
                }
                this.showMessage(`Error: ${errorMsg}`);
                this.appendAiOutput("API Error", `Failed to get a response. Details: ${errorMsg}`);
                return "";
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0) {
                const candidate = result.candidates[0];

                if (candidate.finishReason && candidate.finishReason !== "STOP") {
                    const blockReason = candidate.finishReason;
                    const safetyRatings = candidate.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'No details';
                    const errorMsg = `Request was blocked. Reason: ${blockReason}. Details: [${safetyRatings}]`;
                    this.showMessage(`Error: ${errorMsg}`);
                    this.appendAiOutput("API Error", errorMsg);
                    return "";
                }

                if (candidate.content && candidate.content.parts) {
                    const fullText = candidate.content.parts.map(part => part.text || "").join("");
                    if (fullText) {
                        this.showMessage("Response received from Gemini.");
                        return fullText;
                    }
                }
            }

            if (result.promptFeedback?.blockReason) {
                const errorMsg = `Request was blocked. Reason: ${result.promptFeedback.blockReason}`;
                this.showMessage(`Error: ${errorMsg}`);
                this.appendAiOutput("API Error", errorMsg);
                return "";
            }

            this.appendAiOutput("API Error", "The AI returned an empty or un-parsable response. The context might be too large or the query unsupported.");
            return "";

        } catch (networkError) {
            this.toggleLoader(false);
            this.showMessage(`Error: ${networkError.message}`);
            this.appendAiOutput("Network Error", networkError.message);
            return "";
        }
    },

    // --- HTML and CSS Definitions ---

    /**
     * Returns the HTML structure for the application modal.
     * @returns {string} The HTML content as a string.
     */
    getHTML() {
        return `
            <div id="chidi-console-panel">
                <header class="chidi-console-header">
                    <h1 id="chidi-mainTitle">chidi.md</h1>
                    <div class="chidi-header-right-group">
                        <div id="chidi-loader" class="chidi-loader chidi-hidden"></div>
                        <button id="chidi-exportBtn" class="chidi-btn" title="Export current view as HTML">Export</button>
                        <button id="chidi-closeBtn" class="chidi-btn chidi-exit-btn" title="Close Chidi (Esc)">Exit</button>
                    </div>
                </header>
                <main id="chidi-markdownDisplay" class="chidi-markdown-content">
                    <p class="chidi-placeholder-text">Awaiting file selection...</p>
                </main>
                <div id="chidi-ask-input-container" class="chidi-ask-container chidi-hidden">
                    <textarea id="chidi-ask-input" class="chidi-ask-textarea" placeholder="Ask a question across all loaded documents... (Press Enter to submit)"></textarea>
                </div>
                <div class="chidi-controls-container">
                    <div class="chidi-control-group chidi-group-left">
                        <button id="chidi-prevBtn" class="chidi-btn" disabled>&larr; PREV</button>
                        <button id="chidi-nextBtn" class="chidi-btn" disabled>NEXT &rarr;</button>
                    </div>
                    <div class="chidi-control-group chidi-group-center">
                        <select id="chidi-file-selector" class="chidi-btn chidi-select"></select>
                    </div>
                    <div class="chidi-control-group chidi-group-right">
                        <button id="chidi-summarizeBtn" class="chidi-btn" title="Summarize the current document">Summarize</button>
                        <button id="chidi-suggestQuestionsBtn" class="chidi-btn" title="Suggest questions about the document">Study</button>
                        <button id="chidi-askAllFilesBtn" class="chidi-btn" title="Ask a question across all loaded documents">Ask</button>
                    </div>
                </div>
                <footer class="chidi-status-readout">
                    <div id="chidi-fileCountDisplay" class="chidi-status-item">FILES: 0</div>
                    <div id="chidi-messageBox" class="chidi-status-message">SYSTEM LOG: Standby.</div>
                </footer>
            </div>
        `;
    },

    /**
     * Returns the CSS styles for the application.
     * @returns {string} The CSS rules as a string.
     */
    getStyles() {
        return `
            #chidi-modal {
                --panel-bg: #1a1a1d;
                --screen-bg: #0d0d0d;
                --text-primary: #e4e4e7;
                --text-secondary: #a1a1aa;
                --accent-green: #34d399;
                --accent-blue: #60a5fa;
                --accent-red: #f87171;
                --border-color: #52525b;
                --font-family: 'VT323', monospace;
            }
            .chidi-modal-overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(10, 10, 10, 0.9);
                display: flex; align-items: center; justify-content: center;
                z-index: 998; font-family: var(--font-family);
            }
            #chidi-console-panel {
                width: 95%; height: 95%; max-width: 1000px;
                background-color: var(--panel-bg);
                border: 2px solid var(--border-color); border-radius: 8px;
                box-shadow: inset 0 0 10px rgba(0,0,0,0.5), 0 5px 25px rgba(0,0,0,0.4);
                display: flex; flex-direction: column;
                padding: 1rem; color: var(--text-primary);
            }
            .chidi-console-header {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                align-items: center;
                border-bottom: 2px solid var(--border-color);
                padding-bottom: 0.5rem;
                margin-bottom: 1rem;
            }
            #chidi-mainTitle {
                grid-column: 2;
                font-size: 1.5rem;
                color: var(--accent-green);
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding: 0 1rem;
            }
            .chidi-header-right-group {
                grid-column: 3;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 1.25rem;
            }
            .chidi-markdown-content {
                flex-grow: 1; background-color: var(--screen-bg); color: var(--text-primary);
                padding: 1.5rem; border-radius: 4px; overflow-y: auto;
                line-height: 1.6;
                scrollbar-width: thin; scrollbar-color: var(--accent-green) var(--screen-bg);
            }
            .chidi-markdown-content::-webkit-scrollbar { width: 8px; }
            .chidi-markdown-content::-webkit-scrollbar-track { background: var(--screen-bg); }
            .chidi-markdown-content::-webkit-scrollbar-thumb { background-color: var(--accent-green); border-radius: 4px; border: 2px solid var(--screen-bg); }

            .chidi-markdown-content h1, .chidi-markdown-content h2, .chidi-markdown-content h3 { margin-top: 1.5rem; border-bottom: 1px solid #444; padding-bottom: 0.3rem; color: var(--accent-blue); }
            .chidi-markdown-content a { color: var(--accent-green); text-decoration: none; }
            .chidi-markdown-content a:hover { text-decoration: underline; }
            .chidi-markdown-content code { background-color: #27272a; color: #facc15; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
            .chidi-markdown-content pre { background-color: #000; padding: 1rem; border-radius: 4px; overflow-x: auto; border: 1px solid #333; }
            .chidi-markdown-content blockquote { border-left: 4px solid var(--accent-blue); padding-left: 1rem; margin-left: 0; font-style: italic; color: #a1a1aa; }
            .chidi-placeholder-text, .chidi-error-text { color: #888; text-align: center; margin-top: 3rem; font-style: italic; }
            .chidi-error-text { color: var(--accent-red); }
            .chidi-ai-output { border-top: 2px dashed var(--accent-blue); margin-top: 2rem; padding-top: 1rem; }

            .chidi-ask-container { flex-grow: 1; display: flex; }
            .chidi-ask-textarea {
                width: 100%; height: 100%; background-color: var(--screen-bg);
                border: 1px solid var(--accent-blue); border-radius: 4px;
                color: var(--text-primary); font-family: var(--font-family);
                font-size: 1.1rem; line-height: 1.6; padding: 1rem; resize: none;
                outline: none;
            }
            
            .chidi-controls-container { display: flex; justify-content: space-between; padding-top: 1rem; align-items: center; }
            .chidi-control-group { display: flex; gap: 0.5rem; align-items: center;}
            
            .chidi-btn {
                background-color: #3f3f46;
                color: #a7f3d0;
                border: 1px solid #52525b;
                padding: 0.4rem 0.8rem;
                border-radius: 0.375rem;
                font-family: 'VT323', monospace;
                font-size: 1.1rem;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            .chidi-btn:hover:not(:disabled) {
                background-color: #52525b;
                color: #d1fae5;
            }
            .chidi-btn:disabled {
                background-color: #27272a;
                color: #52525b;
                border-color: #3f3f46;
                cursor: not-allowed;
            }
            .chidi-select {
                -webkit-appearance: none;
                -moz-appearance: none;
                appearance: none;
                text-align: left;
                padding-right: 2.5rem;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a7f3d0' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                background-position: right 0.5rem center;
                background-repeat: no-repeat;
                background-size: 1.5em 1.5em;
                max-width: 300px;
                text-overflow: ellipsis;
            }
             .chidi-select:disabled {
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2352525b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
            }
            .chidi-exit-btn {
                background-color: #3f1212;
                color: #fca5a5;
                border-color: #ef4444;
            }
            .chidi-exit-btn:hover:not(:disabled) {
                background-color: #5b2121;
                color: #fecaca;
            }

            .chidi-status-readout {
                display: flex; justify-content: space-between; border-top: 2px solid var(--border-color);
                padding-top: 0.5rem; margin-top: 1rem;
                font-size: 1.2rem; color: var(--text-secondary);
            }
            .chidi-status-message { text-align: right; }
            .chidi-loader {
                width: 10px;
                height: 18px;
                background-color: var(--accent-green);
                animation: chidi-blink-cursor 1.2s steps(2, start) infinite;
            }
            @keyframes chidi-blink-cursor {
                to {
                    visibility: hidden;
                }
            }
            .chidi-hidden { display: none !important; }
        `;
    }
};