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
            summarizeBtn: get('chidi-summarizeBtn'),
            suggestQuestionsBtn: get('chidi-suggestQuestionsBtn'),
            askAllFilesBtn: get('chidi-askAllFilesBtn'),
            closeBtn: get('chidi-closeBtn'),
            markdownDisplay: get('chidi-markdownDisplay'),
            messageBox: get('chidi-messageBox'),
            loader: get('chidi-loader'),
            mainTitle: get('chidi-mainTitle'),
            fileCountDisplay: get('chidi-fileCountDisplay'),
            // No longer need to cache the nested input modal elements
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

        this.elements.summarizeBtn.disabled = !hasFiles;
        this.elements.suggestQuestionsBtn.disabled = !hasFiles;
        this.elements.askAllFilesBtn.disabled = !hasFiles;

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
    },

    // --- Event Handling ---

    /**
     * Sets up all necessary event listeners for the application's interactive elements.
     */
    setupEventListeners() {
        this.elements.closeBtn.addEventListener('click', () => this.close());
        document.addEventListener('keydown', (e) => {
            if (this.isActive() && e.key === 'Escape') {
                this.close();
            }
        });

        this.elements.prevBtn.addEventListener('click', () => this.navigate(-1));
        this.elements.nextBtn.addEventListener('click', () => this.navigate(1));

        this.elements.summarizeBtn.addEventListener('click', async () => {
            const currentFile = this.getCurrentFile();
            if (!currentFile) return;
            const prompt = `Please provide a concise summary of the following document:\n\n---\n\n${currentFile.content}`;
            const summary = await this.callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
            this.appendAiOutput("Summary", summary);
        });

        this.elements.suggestQuestionsBtn.addEventListener('click', async () => {
            const currentFile = this.getCurrentFile();
            if (!currentFile) return;
            const prompt = `Based on the following document, what are some insightful questions a user might ask?\n\n---\n\n${currentFile.content}`;
            const questions = await this.callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
            this.appendAiOutput("Suggested Questions", questions);
        });

        // The askAllFilesBtn needs its own input modal, which is a different use case
        // than the API key prompt. So we will keep that functionality.
        this.elements.askAllFilesBtn.addEventListener('click', async () => {
            const userQuestion = await this.showInputModal({
                title: "Ask All Files",
                prompt: "What question would you like to ask across all loaded documents?",
                placeholder: "e.g., 'Summarize the main points from all documents'",
                confirmText: "Ask"
            });
            if (!userQuestion || userQuestion.trim() === '') return;

            let combinedContent = "You have access to the following documents:\n\n";
            this.state.loadedFiles.forEach(file => {
                combinedContent += `--- DOCUMENT: ${file.name} ---\n${file.content}\n\n`;
            });

            const prompt = `${combinedContent}Based on all the documents provided, please answer the following question: ${userQuestion}`;
            const answer = await this.callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
            this.appendAiOutput(`Answer based on all files`, answer);
        });
    },

    // --- Core Logic & Helpers ---

    /**
     * Navigates to the next or previous file.
     * @param {number} direction - -1 for previous, 1 for next.
     */
    navigate(direction) {
        const newIndex = this.state.currentIndex + direction;
        if (newIndex >= 0 && newIndex < this.state.loadedFiles.length) {
            this.state.currentIndex = newIndex;
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

    // --- Gemini API Interaction ---

    /**
     * Calls the Gemini API with a given chat history.
     * Assumes API key is already present in StorageManager.
     * @param {Array<object>} chatHistory - The conversation history to send to the model.
     * @returns {Promise<string>} A promise that resolves to the model's text response.
     */
    async callGeminiApi(chatHistory) {
        this.toggleLoader(true);
        this.showMessage("Contacting Gemini API...");

        const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY, "Gemini API Key");
        if (!apiKey) {
            this.toggleLoader(false);
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

            this.toggleLoader(false);

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
            if (result.candidates && result.candidates.length > 0 && result.candidates[0]?.content?.parts[0]?.text) {
                this.showMessage("Response received from Gemini.");
                return result.candidates[0].content.parts[0].text;
            }
            if (result.promptFeedback?.blockReason) {
                const errorMsg = `Request was blocked. Reason: ${result.promptFeedback.blockReason}`;
                this.showMessage(`Error: ${errorMsg}`);
                this.appendAiOutput("API Error", errorMsg);
            } else {
                this.showMessage("Error: Invalid or empty response structure from API.");
                this.appendAiOutput("API Error", "Invalid or empty response structure from API.");
            }
            return "";

        } catch (networkError) {
            this.toggleLoader(false);
            this.showMessage(`Error: ${networkError.message}`);
            this.appendAiOutput("Network Error", networkError.message);
            return "";
        }
    },

    /**
     * Displays a modal to get user input for general questions (not for API key).
     * @param {object} options - Configuration for the input modal.
     * @returns {Promise<string|null>} A promise that resolves with the user's input or null if canceled.
     */
    showInputModal({ title, prompt, placeholder, confirmText }) {
        // This is a separate input modal for asking questions, defined in getHTML
        const inputModal = document.getElementById('chidi-inputModal');
        const inputModalField = document.getElementById('chidi-inputModalField');
        if (!inputModal || !inputModalField) return Promise.resolve(null);

        document.getElementById('chidi-inputModalTitle').textContent = title;
        document.getElementById('chidi-inputModalText').textContent = prompt;
        inputModalField.placeholder = placeholder;
        document.getElementById('chidi-confirmInputBtn').textContent = confirmText;

        return new Promise((resolve) => {
            inputModal.classList.remove('chidi-hidden');
            inputModalField.focus();

            const confirmHandler = () => {
                cleanup();
                resolve(inputModalField.value);
            };
            const cancelHandler = () => {
                cleanup();
                resolve(null);
            };
            const keyHandler = (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') confirmHandler();
                else if (e.key === 'Escape') cancelHandler();
            };

            const cleanup = () => {
                inputModal.classList.add('chidi-hidden');
                document.getElementById('chidi-confirmInputBtn').removeEventListener('click', confirmHandler);
                document.getElementById('chidi-cancelInputBtn').removeEventListener('click', cancelHandler);
                inputModalField.removeEventListener('keydown', keyHandler);
                inputModalField.value = '';
            };

            document.getElementById('chidi-confirmInputBtn').addEventListener('click', confirmHandler, { once: true });
            document.getElementById('chidi-cancelInputBtn').addEventListener('click', cancelHandler, { once: true });
            inputModalField.addEventListener('keydown', keyHandler);
        });
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
                    <div id="chidi-loader" class="chidi-loader chidi-hidden"></div>
                    <button id="chidi-closeBtn" class="chidi-btn chidi-exit-btn" title="Close Chidi (Esc)">Exit</button>
                </header>
                <main id="chidi-markdownDisplay" class="chidi-markdown-content">
                    <p class="chidi-placeholder-text">Awaiting file selection...</p>
                </main>
                <div class="chidi-controls-container">
                    <div class="chidi-control-group">
                        <button id="chidi-prevBtn" class="chidi-btn" disabled>&larr; PREV</button>
                        <button id="chidi-nextBtn" class="chidi-btn" disabled>NEXT &rarr;</button>
                    </div>
                    <div class="chidi-control-group">
                        <button id="chidi-summarizeBtn" class="chidi-btn" title="Summarize the current document">Summarize</button>
                        <button id="chidi-suggestQuestionsBtn" class="chidi-btn" title="Suggest questions about the document">Suggest Q's</button>
                        <button id="chidi-askAllFilesBtn" class="chidi-btn" title="Ask a question across all loaded documents">Ask All</button>
                    </div>
                </div>
                <footer class="chidi-status-readout">
                    <div id="chidi-fileCountDisplay" class="chidi-status-item">FILES: 0</div>
                    <div id="chidi-messageBox" class="chidi-status-message">SYSTEM LOG: Standby.</div>
                </footer>
            </div>
            <div id="chidi-inputModal" class="chidi-modal-overlay-nested chidi-hidden">
                 <div class="chidi-modal-content">
                    <h3 id="chidi-inputModalTitle">Input Required</h3>
                    <p id="chidi-inputModalText">Please provide input.</p>
                    <input type="text" id="chidi-inputModalField" class="chidi-modal-input" placeholder="Enter value...">
                    <div class="chidi-modal-actions">
                        <button id="chidi-confirmInputBtn" class="chidi-btn">Confirm</button>
                        <button id="chidi-cancelInputBtn" class="chidi-btn chidi-exit-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Returns the CSS styles for the application.
     * @returns {string} The CSS rules as a string.
     */
    getStyles() {
        // CSS remains the same as previous version, but z-index on nested modal is now less critical.
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
                display: flex; justify-content: space-between; align-items: center;
                border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem;
                position: relative;
            }
            #chidi-mainTitle {
                font-size: 1.5rem;
                color: var(--accent-green);
                text-align: center;
                flex-grow: 1;
                padding: 0 1rem; /* Space around title */
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
            
            .chidi-controls-container { display: flex; justify-content: space-between; padding-top: 1rem; }
            .chidi-control-group { display: flex; gap: 0.5rem; }
            
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
                border: 4px solid #3f3f46;
                border-top: 4px solid var(--accent-blue);
                border-radius: 50%;
                width: 20px;
                height: 20px;
                animation: chidi-spin 1s linear infinite;
            }
            @keyframes chidi-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .chidi-hidden { display: none !important; }

            /* Nested Input Modal Styles */
            .chidi-modal-overlay-nested {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex; align-items: center; justify-content: center; z-index: 1000;
            }
            .chidi-modal-content { background: var(--panel-bg); padding: 2rem; border-radius: 8px; text-align: center; color: var(--text-primary); border: 1px solid var(--border-color); }
            .chidi-modal-input { width: 100%; padding: 0.5rem; margin-top: 1rem; margin-bottom: 1.5rem; border: 1px solid var(--border-color); background-color: var(--screen-bg); color: var(--text-primary); font-family: var(--font-family); }
            .chidi-modal-actions { display: flex; justify-content: center; gap: 1rem; }
        `;
    }
};