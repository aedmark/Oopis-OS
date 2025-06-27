/**
 * @fileoverview Core application logic for Chidi.md, a modal Markdown reader and analyzer for OopisOS.
 * This file handles the UI creation, state management, Markdown rendering, and interaction with the Gemini API.
 * @module ChidiApp
 */

const ChidiApp = {
    /**
     * @property {object} state - The current state of the Chidi application.
     */
    state: {
        loadedFiles: [],
        currentIndex: -1,
        isModalOpen: false,
        isAskingMode: false,
        isVerbose: false,
    },

    /**
     * @property {Object.<string, HTMLElement>} elements - A cache of frequently accessed DOM elements.
     */
    elements: {},
    callbacks: {},

    /**
     * Checks if the Chidi modal is currently open and active.
     * @returns {boolean} True if the modal is open, false otherwise.
     */
    isActive() {
        return this.state.isModalOpen;
    },

    /**
     * Launches the Chidi.md application in a modal window.
     * @param {Array<object>} files - An array of file objects ({ name, path, content }) to be loaded.
     * @param {object} callbacks - An object containing onExit and onSaveSession callbacks.
     */
    launch(files, callbacks) {
        if (this.state.isModalOpen) {
            console.warn("ChidiApp is already open.");
            return;
        }

        this.state.isModalOpen = true;
        this.state.loadedFiles = files;
        this.state.currentIndex = files.length > 0 ? 0 : -1;
        this.callbacks = callbacks;

        this.injectStyles();

        const chidiElement = this.createModal();
        AppLayerManager.show(chidiElement);

        this.cacheDOMElements();
        this._populateFileDropdown();
        this.setupEventListeners();

        this.updateUI();

        if (callbacks.isNewSession) {
            this.showMessage("New session started. AI interaction history is cleared.");
        } else {
            this.showMessage("Chidi.md initialized. " + files.length + " files loaded.");
        }
    },

    /**
     * Closes the application, removes UI elements and styles, and calls the exit callback.
     */
    close() {
        if (!this.state.isModalOpen) return;

        AppLayerManager.hide();
        if (this.elements.styleTag) {
            this.elements.styleTag.remove();
        }

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
     * Creates the main modal element containing the application's UI.
     * @returns {HTMLElement} The root element of the Chidi application.
     */
    createModal() {
        const appContainer = document.createElement('div');
        appContainer.id = 'chidi-console-panel';
        appContainer.innerHTML = this.getHTML();
        return appContainer;
    },

    /**
     * Caches references to frequently used DOM elements for performance.
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
            saveSessionBtn: get('chidi-saveSessionBtn'), // New button
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

    /**
     * Updates the entire UI based on the current application state.
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
        this.elements.saveSessionBtn.disabled = !hasFiles; // New button state

        if (hasFiles) {
            this.elements.fileSelector.value = this.state.currentIndex;
        }

        this.elements.summarizeBtn.disabled = !hasFiles;
        this.elements.studyBtn.disabled = !hasFiles;
        this.elements.askBtn.disabled = !hasFiles;

        if (currentFile) {
            this.elements.mainTitle.textContent = currentFile.name.replace(/\.md$/i, '');
            // For .txt files, we need to wrap the content in <pre> to preserve whitespace.
            if (currentFile.name.toLowerCase().endsWith('.txt')) {
                this.elements.markdownDisplay.innerHTML = `<pre>${Utils.escapeHTML(currentFile.content)}</pre>`;
            } else {
                try {
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

    /**
     * Sets up all necessary event listeners for the application's interactive elements.
     */
    setupEventListeners() {
        this.elements.closeBtn.addEventListener('click', () => this.close());
        this.elements.exportBtn.addEventListener('click', () => this._handleExport());
        this.elements.saveSessionBtn.addEventListener('click', () => this._handleSaveSession()); // New listener

        this.elements.verboseToggleBtn.addEventListener('click', () => {
            this.state.isVerbose = !this.state.isVerbose;
            this.elements.verboseToggleBtn.textContent = this.state.isVerbose ? 'Log: On' : 'Log: Off';
            this.showMessage(`Verbose logging ${this.state.isVerbose ? 'enabled' : 'disabled'}.`);
        });
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
            if (this.state.isAskingMode) this._exitQuestionMode();
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
     * Exits question-asking mode and reverts the UI to its normal state.
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
     * Submits the user's question. This implementation first finds the most relevant
     * files using a local keyword search before sending a single, focused request to the AI.
     * This is a Retrieval-Augmented Generation (RAG) strategy.
     * @private
     * @async
     */
    async _submitQuestion() {
        const userQuestion = this.elements.askInput.value.trim();
        if (!userQuestion) return;

        this._exitQuestionMode();
        this.toggleLoader(true);
        if (this.state.isVerbose) {
            this.showMessage(`Analyzing ${this.state.loadedFiles.length} files for relevance...`);
        }

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
                this.showMessage("Your question is too generic. Please be more specific.");
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

            if (this.state.isVerbose) {
                this.showMessage(`Found ${relevantFiles.length} relevant files. Asking Gemini...`);
            } else {
                this.showMessage("Asking Gemini...");
            }

            let promptContext = "Based on the following documents, please provide a comprehensive answer to the user's question. Prioritize information from the first document if it is relevant, but use all provided documents to form your answer.\n\n";
            relevantFiles.forEach(file => {
                promptContext += `--- START OF DOCUMENT: ${file.name} ---\n\n${file.content}\n\n--- END OF DOCUMENT: ${file.name} ---\n\n`;
            });

            const finalPrompt = `${promptContext}User's Question: "${userQuestion}"`;

            this.appendAiOutput(
                "Constructed Prompt for Gemini",
                "The following block contains the exact context and question being sent to the AI for analysis.\n\n```text\n" + finalPrompt + "\n```"
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
        outputBlock.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
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
            /* BEGIN ADDED STYLES */
            p, ul, ol, blockquote, pre, table {
                margin-bottom: 1rem;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            th, td {
                border: 1px solid #444;
                padding: 0.5rem;
                text-align: left;
            }
            th {
                background-color: #27272a;
            }
            /* END ADDED STYLES */
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

        const blob = new Blob([html], {
            type: 'text/html'
        });
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

    /**
     * Calls the Gemini API with a given chat history.
     * Assumes API key is already present in StorageManager.
     * @param {Array<object>} chatHistory - The conversation history to send to the model.
     * @returns {Promise<string>} A promise that resolves to the model's text response.
     * @async
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
            const payload = {
                contents: chatHistory
            };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({
                    error: {
                        message: response.statusText
                    }
                }));
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

    /**
     * Packages the current view (including original content and AI responses) into a complete HTML string.
     * @private
     * @returns {string} A string containing the full HTML document for the session.
     */
    _packageSessionAsHTML() {
        const currentFile = this.getCurrentFile();
        if (!currentFile) return "";

        const content = this.elements.markdownDisplay.innerHTML;
        const title = `Chidi Session: ${currentFile.name}`;
        const styles = `
            body { background-color: #0d0d0d; color: #e4e4e7; font-family: 'VT323', monospace; line-height: 1.6; padding: 2rem; }
            h1, h2, h3 { border-bottom: 1px solid #444; padding-bottom: 0.3rem; color: #60a5fa; }
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

    /**
     * Handles the "Export" button click. Packages the session and triggers a browser download.
     * @private
     */
    _handleExport() {
        const currentFile = this.getCurrentFile();
        if (!currentFile) {
            this.showMessage("Error: No file to export.");
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
        this.showMessage(`Exported session for ${currentFile.name}.`);
    },

    /**
     * Handles the "Save Session" button click. Packages the session and saves it to a new file in the VFS.
     * @private
     */
    async _handleSaveSession() {
        if (!this.state.isModalOpen || this.state.loadedFiles.length === 0) {
            this.showMessage("Error: No session to save.");
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
            this.showMessage("Save cancelled.");
            return;
        }

        const htmlContent = this._packageSessionAsHTML();
        if (!htmlContent) {
            this.showMessage("Error: Could not package session for saving.");
            return;
        }

        try {
            const absPath = FileSystemManager.getAbsolutePath(filename);
            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

            if (!primaryGroup) {
                this.showMessage("Critical Error: Cannot determine primary group. Save failed.");
                return;
            }

            const saveResult = await FileSystemManager.createOrUpdateFile(
                absPath,
                htmlContent,
                { currentUser, primaryGroup }
            );

            if (!saveResult.success) {
                this.showMessage(`Error: ${saveResult.error}`);
                return;
            }

            if (!(await FileSystemManager.save())) {
                this.showMessage("Critical Error: Failed to persist file system changes.");
                return;
            }

            this.showMessage(`Session saved to '${filename}'.`);
        } catch (e) {
            this.showMessage(`An unexpected error occurred during save: ${e.message}`);
        }
    },


    /**
     * Returns the HTML structure for the application modal.
     * @returns {string} The HTML content as a string.
     */
    getHTML() {
        return `
            <div id="chidi-console-panel">
                <header class="chidi-console-header">
                    <h1 id="chidi-mainTitle">chidi.md</h1>
                </header>

                <main id="chidi-markdownDisplay" class="chidi-markdown-content">
                    <p class="chidi-placeholder-text">Awaiting file selection...</p>
                </main>

                <div id="chidi-ask-input-container" class="chidi-ask-container chidi-hidden">
                    <textarea id="chidi-ask-input" class="chidi-ask-textarea" placeholder="Ask a question across all loaded documents... (Press Enter to submit)"></textarea>
                </div>
                
                <div class="chidi-progress-bar">
                    <div class="chidi-progress-bar-inner"></div>
                </div>

                <div class="chidi-controls-container">
                    <div class="chidi-control-group">
                        <button id="chidi-prevBtn" class="chidi-btn" disabled>&larr; PREV</button>
                        <button id="chidi-nextBtn" class="chidi-btn" disabled>NEXT &rarr;</button>
                    </div>
                    <div class="chidi-control-group">
                        <select id="chidi-file-selector" class="chidi-btn chidi-select"></select>
                    </div>
                    <div class="chidi-control-group">
                        <button id="chidi-summarizeBtn" class="chidi-btn" title="Summarize the current document">Summarize</button>
                        <button id="chidi-suggestQuestionsBtn" class="chidi-btn" title="Suggest questions about the document">Study</button>
                        <button id="chidi-askAllFilesBtn" class="chidi-btn" title="Ask a question across all loaded documents">Ask</button>
                    </div>
                </div>

                <footer class="chidi-status-readout">
                    <div id="chidi-fileCountDisplay" class="chidi-status-item">FILES: 0</div>
                    <div id="chidi-messageBox" class="chidi-status-message">SYSTEM LOG: Standby.</div>
                    <div class="chidi-control-group">
                        <div id="chidi-loader" class="chidi-loader chidi-hidden"></div>
                        <button id="chidi-verbose-toggle-btn" class="chidi-btn" title="Toggle verbose operation log">Log: Off</button>
                        <button id="chidi-saveSessionBtn" class="chidi-btn" title="Save current session to a new file">Save Session</button>
                        <button id="chidi-exportBtn" class="chidi-btn" title="Export current view as HTML">Export</button>
                        <button id="chidi-closeBtn" class="chidi-btn chidi-exit-btn" title="Close Chidi (Esc)">Exit</button>
                    </div>
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
            :root {
                --chidi-bg: #1e1e1e;
                --chidi-screen-bg: #111;
                --chidi-border: #4a4a4a;
                --chidi-text: #dcdcdc;
                --chidi-accent-green: #4ade80;
                --chidi-accent-blue: #60a5fa;
                --chidi-font: 'VT323', monospace;
            }

            #chidi-console-panel {
                width: 95%;
                height: 95%;
                max-width: 1000px;
                background-color: var(--chidi-bg);
                border: 2px solid var(--chidi-border);
                border-radius: 8px;
                box-shadow: inset 0 0 15px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                padding: 1rem;
                font-family: var(--chidi-font);
                color: var(--chidi-text);
                position: relative;
                overflow: hidden;
            }

            .chidi-console-header {
                background-color: var(--chidi-accent-green);
                padding: 0.25rem 0.5rem;
                margin-bottom: 1rem;
            }

            #chidi-mainTitle {
                font-size: 1.5rem;
                color: #000;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            #chidi-markdownDisplay, .chidi-ask-container {
                flex-grow: 1;
                background-color: var(--chidi-screen-bg);
                color: var(--chidi-text);
                padding: 1.5rem;
                border: 1px solid var(--chidi-border);
                box-shadow: inset 0 0 10px rgba(0,0,0,0.7);
                border-radius: 4px;
                overflow-y: auto;
                line-height: 1.6;
                scrollbar-width: thin;
                scrollbar-color: var(--chidi-accent-green) var(--chidi-screen-bg);
            }

            /* Webkit Scrollbar Styles */
            #chidi-markdownDisplay::-webkit-scrollbar, .chidi-ask-container::-webkit-scrollbar { width: 8px; }
            #chidi-markdownDisplay::-webkit-scrollbar-track, .chidi-ask-container::-webkit-scrollbar-track { background: var(--chidi-screen-bg); }
            #chidi-markdownDisplay::-webkit-scrollbar-thumb, .chidi-ask-container::-webkit-scrollbar-thumb { background-color: var(--chidi-accent-green); border-radius: 4px; border: 2px solid var(--chidi-screen-bg); }

            /* Markdown Content Styles */
            .chidi-markdown-content h1, .chidi-markdown-content h2, .chidi-markdown-content h3 { margin-top: 1.5rem; margin-bottom: 1rem; border-bottom: 1px solid #444; padding-bottom: 0.3rem; color: var(--chidi-accent-blue); }
            .chidi-markdown-content a { color: var(--chidi-accent-green); text-decoration: none; }
            .chidi-markdown-content p { margin-bottom: 1rem; }
            .chidi-markdown-content a:hover { text-decoration: underline; }
            .chidi-markdown-content code { background-color: #27272a; color: #facc15; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
            .chidi-markdown-content pre { background-color: #000; padding: 1rem; border-radius: 4px; overflow-x: auto; border: 1px solid #333; }
            .chidi-markdown-content blockquote { border-left: 4px solid var(--chidi-accent-blue); padding-left: 1rem; margin-left: 0; font-style: italic; color: #a1a1aa; }
            .chidi-ai-output { border-top: 2px dashed var(--chidi-accent-blue); margin-top: 2rem; padding-top: 1rem; }
            
            /* Add these rules for tables inside .chidi-markdown-content */
            .chidi-markdown-content table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 1rem;
            }
            .chidi-markdown-content th, .chidi-markdown-content td {
                border: 1px solid #444;
                padding: 0.5rem;
                text-align: left;
            }
            .chidi-markdown-content th {
                background-color: #27272a;
            }

            /* Ask Input Styles */
            .chidi-ask-textarea { width: 100%; height: 100%; background: transparent; border: none; color: var(--chidi-text); font-size: 1.1rem; resize: none; outline: none; }
            
            /* Controls Styles */
            .chidi-controls-container { display: flex; justify-content: space-between; padding-top: 1rem; margin-bottom: 0.5rem; align-items: center; }
            .chidi-control-group { display: flex; gap: 0.5rem; align-items: center;}
            .chidi-btn { background-color: #333; color: var(--chidi-accent-green); border: 1px solid var(--chidi-border); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 1.1rem; cursor: pointer; transition: all 0.2s ease; }
            .chidi-btn:hover:not(:disabled) { background-color: #444; color: #fff; }
            .chidi-btn:disabled { background-color: #222; color: #555; border-color: #444; cursor: not-allowed; }
            .chidi-exit-btn { background-color: #3f1212; color: #fca5a5; border-color: #ef4444; }
            .chidi-exit-btn:hover:not(:disabled) { background-color: #5b2121; }
            .chidi-select { max-width: 300px; text-overflow: ellipsis; }

            /* Progress Bar */
            .chidi-progress-bar { width: 100%; background-color: #111; border: 1px solid var(--chidi-border); height: 10px; padding: 1px; margin-top: 0.5rem; }
            .chidi-progress-bar-inner { width: 45%; height: 100%; background-color: var(--chidi-accent-green); }

            /* Footer Styles */
            .chidi-status-readout { display: flex; justify-content: space-between; align-items: center; gap: 1rem; border-top: 1px solid var(--chidi-border); padding-top: 0.5rem; margin-top: 0.5rem; font-size: 1.1rem; color: #888; }
            .chidi-status-message { flex-grow: 1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .chidi-loader { width: 10px; height: 16px; background-color: var(--chidi-accent-green); animation: chidi-blink-cursor 1.2s steps(2, start) infinite; }
            
            .chidi-hidden { display: none !important; }
            @keyframes chidi-blink-cursor { to { visibility: hidden; } }
        `;
    }
};