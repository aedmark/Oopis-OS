/**
 * @fileoverview Core application logic for Chidi.md, a modal Markdown reader and analyzer for OopisOS.
 * This file handles the UI creation, state management, Markdown rendering, and interaction with the Gemini API.
 * @module ChidiApp
 */

/* global Utils, StorageManager, Config, OutputManager, FileSystemManager, UserManager, ModalManager, AppLayerManager, marked */

const ChidiManager = (() => {
    /**
     * @property {object} state - The current state of the Chidi application.
     */
    let state = {
        loadedFiles: [],
        currentIndex: -1,
        isModalOpen: false,
        isAskingMode: false,
        isVerbose: false,
        callbacks: {}, // Internal callbacks for UI to manager communication
    };

    const callbacks = {
        onExit: exit,
        onSearch: (query) => {
            // Re-render only filtered items if search is active
            const filtered = state.loadedFiles.filter(file =>
                file.name.toLowerCase().includes(query.toLowerCase()) ||
                file.content.toLowerCase().includes(query.toLowerCase())
            );
            ChidiUI.updateFileDropdown(filtered, state.currentIndex);
            if (query === '') {
                ChidiUI.showMessage("Search cleared.", true);
            } else {
                ChidiUI.showMessage(`Found ${filtered.length} files matching "${query}".`, true);
            }
        },
        onSelect: (indexStr) => {
            const index = parseInt(indexStr, 10);
            if (!isNaN(index) && index >= 0 && index < state.loadedFiles.length) {
                state.currentIndex = index;
                ChidiUI.updateUI(state);
                ChidiUI.updateFileDropdown(state.loadedFiles, state.currentIndex); // Re-populate to update the 'selected' class
                ChidiUI.showMessage(`Displaying file: ${state.loadedFiles[index].name}`, true);
            }
        },
        onSummarize: async () => {
            const currentFile = getCurrentFile();
            if (!currentFile) return;
            const prompt = `Please provide a concise summary of the following document:\n\n---\n\n${currentFile.content}`;
            ChidiUI.toggleLoader(true);
            ChidiUI.showMessage("Contacting Gemini API...");
            const summary = await callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Summary", summary);
        },
        onStudy: async () => {
            if (state.isAskingMode) {
                _exitQuestionMode();
                return;
            }
            const currentFile = getCurrentFile();
            if (!currentFile) return;
            const prompt = `Based on the following document, what are some insightful questions a user might ask?\n\n---\n\n${currentFile.content}`;
            ChidiUI.toggleLoader(true);
            ChidiUI.showMessage("Contacting Gemini API...");
            const questions = await callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Suggested Questions", questions);
        },
        onAsk: async () => {
            if (state.isAskingMode) {
                await _submitQuestion();
            } else {
                _enterQuestionMode();
            }
        },
        onSaveSession: _handleSaveSession,
        onVerboseToggle: () => {
            state.isVerbose = !state.isVerbose;
            ChidiUI.updateVerboseToggle(state.isVerbose);
            ChidiUI.showMessage(`Verbose logging ${state.isVerbose ? 'enabled' : 'disabled'}.`, true);
        },
        // Keyboard navigation for dropdown
        onDropdownKeydown: (e, currentFocusIndex, items) => {
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = (currentFocusIndex + 1) % items.length;
                items[nextIndex].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = (currentFocusIndex - 1 + items.length) % items.length;
                items[prevIndex].focus();
            } else if (e.key === 'Enter' && currentFocusIndex > -1) {
                e.preventDefault();
                items[currentFocusIndex].click();
            }
        },
        // Closing dropdown on outside click
        onOutsideClick: (target, customSelectorElement, selectorPanelElement) => {
            if (!selectorPanelElement.classList.contains('hidden') && !customSelectorElement.contains(target)) {
                ChidiUI.toggleDropdown(false);
            }
        },
        onAskInputKeydown: async (e, askInput) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await _submitQuestion();
            }
        }
    };


    /**
     * Launches the Chidi.md application in a modal window.
     * @param {Array<object>} files - An array of file objects ({ name, path, content }) to be loaded.
     * @param {object} launchOptions - An object containing onExit and isNewSession callbacks.
     */
    function launch(files, launchOptions) {
        if (state.isModalOpen) {
            console.warn("ChidiApp is already open.");
            return;
        }

        state.isModalOpen = true;
        state.loadedFiles = files;
        state.currentIndex = files.length > 0 ? 0 : -1;
        state.callbacks = launchOptions; // Store for external communication (e.g., onExit)

        // Initialize UI with manager's internal callbacks
        const chidiElement = ChidiUI.createModal(callbacks);
        AppLayerManager.show(chidiElement);

        ChidiUI.cacheDOMElements(); // Cache elements *after* they are in the DOM
        ChidiUI.updateVerboseToggle(state.isVerbose); // Set initial toggle state
        ChidiUI.setupEventListeners(callbacks); // Setup listeners on UI elements, passing manager's handlers

        ChidiUI.updateUI(state); // Initial UI render
        ChidiUI.updateFileDropdown(state.loadedFiles, state.currentIndex);


        if (launchOptions.isNewSession) {
            ChidiUI.showMessage("New session started. AI interaction history is cleared.", true);
        } else {
            ChidiUI.showMessage("Chidi.md initialized. " + files.length + " files loaded.", true);
        }
    }

    /**
     * Closes the application, removes UI elements and styles, and calls the exit callback.
     */
    function exit() {
        if (!state.isModalOpen) return;

        AppLayerManager.hide();

        // Reset manager state
        state = {
            loadedFiles: [],
            currentIndex: -1,
            isModalOpen: false,
            isAskingMode: false,
            isVerbose: false,
            callbacks: {},
        };

        ChidiUI.reset(); // Reset UI module's elements/state

        if (typeof state.callbacks.onExit === 'function') {
            state.callbacks.onExit(); // Notify original command of exit
        }
    }

    function getCurrentFile() {
        if (state.currentIndex === -1 || state.loadedFiles.length === 0) {
            return null;
        }
        return state.loadedFiles[state.currentIndex];
    }

    function _enterQuestionMode() {
        if (!getCurrentFile()) return; // Ensure there's a file context

        state.isAskingMode = true;
        ChidiUI.toggleAskingMode(true); // Tell UI to show input, hide markdown
        ChidiUI.showMessage("Ask a question about all loaded files.", true);
    }

    function _exitQuestionMode() {
        state.isAskingMode = false;
        ChidiUI.toggleAskingMode(false); // Tell UI to hide input, show markdown
        ChidiUI.updateUI(state); // Re-render UI to reflect changes
        ChidiUI.showMessage("Question mode cancelled.", true);
    }

    async function _submitQuestion() {
        const userQuestion = ChidiUI.getAskInput();
        if (!userQuestion || userQuestion.trim() === "") return;

        _exitQuestionMode(); // Exit question mode immediately after input
        ChidiUI.toggleLoader(true);
        ChidiUI.showMessage(`Analyzing ${state.loadedFiles.length} files for relevance...`);

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
                ChidiUI.toggleLoader(false);
                ChidiUI.showMessage("Your question is too generic. Please be more specific.", true);
                ChidiUI.appendAiOutput("Refine Your Question", "Please ask a more specific question so I can find relevant documents for you.");
                return;
            }

            const currentFile = getCurrentFile();
            // Include current file in scoring to potentially prioritize it
            const filesToScore = [...state.loadedFiles]; // Consider all loaded files for relevance

            const scoredFiles = filesToScore.map(file => {
                let score = 0;
                const contentLower = file.content.toLowerCase();
                const nameLower = file.name.toLowerCase();

                // Score for bigram matches in content (stronger signal)
                bigrams.forEach(phrase => {
                    score += (contentLower.match(new RegExp(Utils.escapeRegExp(phrase), 'g')) || []).length * 10;
                });

                // Score for keywords in filename
                keywords.forEach(keyword => {
                    if (nameLower.includes(keyword)) {
                        score += 15;
                    }
                });

                // Score for keywords in headers (stronger signal)
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

                // Score for keywords in general content
                keywords.forEach(keyword => {
                    score += (contentLower.match(new RegExp(Utils.escapeRegExp(keyword), 'g')) || []).length;
                });

                // Boost for the currently selected file (if it's not too generic)
                if (file.path === currentFile?.path && (keywords.length > 0 || bigrams.length > 0)) {
                    score += 50; // Significant boost for the active document
                }

                return {
                    file,
                    score
                };
            });

            scoredFiles.sort((a, b) => b.score - a.score);

            const MAX_CONTEXT_FILES = 5;
            const relevantFiles = [];
            const uniquePaths = new Set();

            // Always add the currently selected file first, if it exists and scored
            if (currentFile) {
                const currentFileScoreEntry = scoredFiles.find(sf => sf.file.path === currentFile.path);
                if (currentFileScoreEntry && currentFileScoreEntry.score > 0) {
                    relevantFiles.push(currentFile);
                    uniquePaths.add(currentFile.path);
                } else if (currentFile) { // If current file has no score, still include if it's the only one or user asked about it specifically
                    relevantFiles.push(currentFile);
                    uniquePaths.add(currentFile.path);
                }
            }


            // Add other top-scoring files, up to MAX_CONTEXT_FILES, ensuring no duplicates
            scoredFiles.forEach(item => {
                if (item.score > 0 && relevantFiles.length < MAX_CONTEXT_FILES && !uniquePaths.has(item.file.path)) {
                    relevantFiles.push(item.file);
                    uniquePaths.add(item.file.path);
                }
            });

            if (relevantFiles.length === 0) {
                ChidiUI.toggleLoader(false);
                ChidiUI.showMessage("No relevant documents found for your question. Please refine it.", true);
                ChidiUI.appendAiOutput("No Context", "I could not find any relevant documents to answer your question. Please try rephrasing or asking about another topic.");
                return;
            }


            ChidiUI.showMessage(`Found ${relevantFiles.length} relevant files. Asking Gemini...`);

            let promptContext = "Based on the following documents, please provide a comprehensive answer to the user's question. Prioritize information from the first document if it is relevant, but use all provided documents to form your answer.\n\n";
            relevantFiles.forEach(file => {
                promptContext += `--- START OF DOCUMENT: ${file.name} ---\n\n${file.content}\n\n--- END OF DOCUMENT: ${file.name} ---\n\n`;
            });

            const finalPrompt = `${promptContext}User's Question: "${userQuestion}"`;

            if (state.isVerbose) {
                ChidiUI.appendAiOutput(
                    "Constructed Prompt for Gemini",
                    "The following block contains the exact context and question being sent to the AI for analysis.\\n\\n```text\\n" + finalPrompt + "\\n```"
                );
            }


            const finalAnswer = await callGeminiApi([{
                role: 'user',
                parts: [{
                    text: finalPrompt
                }]
            }]);

            const fileNames = relevantFiles.map(item => item.name).join(', ');
            ChidiUI.appendAiOutput(`Answer for "${userQuestion}" (based on: ${fileNames})`, finalAnswer || "Could not generate a final answer based on the provided documents.");

        } catch (e) {
            ChidiUI.showMessage(`An unexpected error occurred: ${e.message}`, true);
            ChidiUI.appendAiOutput("Error", `An unexpected error occurred during processing: ${e.message}`);
        } finally {
            ChidiUI.toggleLoader(false);
        }
    }


    async function callGeminiApi(chatHistory) {
        const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY, "Gemini API Key");

        const provider = 'gemini'; // Currently hardcoded to gemini for Chidi.
        const model = Config.API.LLM_PROVIDERS[provider].defaultModel;

        const result = await Utils.callLlmApi(provider, model, chatHistory, apiKey);

        if (!result.success) {
            ChidiUI.showMessage(`Error: ${result.error}`, true);
            ChidiUI.appendAiOutput("API Error", `Failed to get a response. Details: ${result.error}`);
            return "";
        }

        ChidiUI.showMessage("Response received.", true);
        return result.answer;
    }

    async function _handleSaveSession() {
        if (!state.isModalOpen || state.loadedFiles.length === 0) {
            ChidiUI.showMessage("Error: No session to save.", true);
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
            ChidiUI.showMessage("Save cancelled.", true);
            return;
        }

        const htmlContent = ChidiUI.packageSessionAsHTML(); // UI provides the HTML content
        if (!htmlContent) {
            ChidiUI.showMessage("Error: Could not package session for saving.", true);
            return;
        }

        try {
            const absPath = FileSystemManager.getAbsolutePath(filename);
            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

            if (!primaryGroup) {
                ChidiUI.showMessage("Critical Error: Cannot determine primary group. Save failed.", true);
                return;
            }

            const saveResult = await FileSystemManager.createOrUpdateFile(
                absPath,
                htmlContent,
                { currentUser, primaryGroup }
            );

            if (!saveResult.success) {
                ChidiUI.showMessage(`Error: ${saveResult.error}`, true);
                return;
            }

            if (!(await FileSystemManager.save())) {
                ChidiUI.showMessage("Critical Error: Failed to persist file system changes.", true);
                return;
            }

            ChidiUI.showMessage(`Session saved to '${filename}'.`, true);
        } catch (e) {
            ChidiUI.showMessage(`An unexpected error occurred during save: ${e.message}`, true);
        }
    }


    return {
        launch,
        exit,
        isActive: () => state.isModalOpen,
        getState: () => state, // Expose state for UI to read
        getCurrentFile,
    };
})();