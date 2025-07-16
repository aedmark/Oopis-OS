// scripts/apps/chidi/chidi_manager.js

const ChidiManager = (() => {
    "use strict";

    // Define the core system prompt at the top for easy maintenance.
    const CHIDI_SYSTEM_PROMPT = `You are Chidi, an AI-powered document analyst. You are having a conversation with a user about a specific set of documents they have loaded.

**Rules:**
- Your answers MUST be based *only* on the provided document context and the ongoing conversation history.
- If the answer is not in the documents, state that clearly. Do not use outside knowledge.
- Be concise, helpful, and directly answer the user's question.

--- PROVIDED DOCUMENT CONTEXT ---
{{documentContext}}
--- END DOCUMENT CONTEXT ---`;

    let state = {};

    const defaultState = {
        loadedFiles: [],
        currentIndex: -1,
        isModalOpen: false,
        isVerbose: false,
        conversationHistory: [],
        provider: 'gemini',
        model: null,
        sessionContext: "", // Holds the combined text of all loaded files.
    };

    // This single function now handles all questions to the AI.
    async function _askQuestion(userQuestion) {
        if (!userQuestion || !userQuestion.trim()) return;

        ChidiUI.toggleLoader(true);
        ChidiUI.showMessage("Analyzing...");

        // Add the user's new question to the history.
        state.conversationHistory.push({ role: 'user', parts: [{ text: userQuestion }] });

        // On every turn, inject the full document context into the system prompt.
        const systemPromptWithContext = CHIDI_SYSTEM_PROMPT.replace('{{documentContext}}', state.sessionContext);

        // The entire conversation history is sent with the system prompt each time.
        const llmResult = await _callLlmApi(state.conversationHistory, systemPromptWithContext);

        if (llmResult) {
            // Add the AI's response to the history for the next turn.
            state.conversationHistory.push({ role: 'model', parts: [{ text: llmResult }] });
        } else {
            // If the AI fails, remove the user's question from history to allow a retry.
            state.conversationHistory.pop();
        }

        ChidiUI.toggleLoader(false);
        ChidiUI.appendAiOutput(`Answer for "${userQuestion}"`, llmResult || "I could not generate an answer based on the provided context.");
    }

    // This function is now simplified to accept the system prompt.
    async function _callLlmApi(chatHistory, systemPrompt) {
        let apiKey = null;
        if (state.provider === 'gemini') {
            apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
            if (!apiKey) {
                ChidiUI.showMessage("Error: Gemini API key not found.", true);
                ChidiUI.appendAiOutput("API Error", "A Gemini API key is required. Please run `gemini` once in the terminal to set it up.");
                return "";
            }
        }

        const result = await Utils.callLlmApi(state.provider, state.model, chatHistory, apiKey, systemPrompt);

        if (!result.success) {
            const errorMsg = `Failed to get a response. Details: ${result.error}`;
            ChidiUI.showMessage(`Error: ${result.error}`, true);
            ChidiUI.appendAiOutput("API Error", errorMsg);
            return "";
        }
        ChidiUI.showMessage("Response received.", true);
        return result.answer;
    }

    const callbacks = {
        // The `onAsk` callback now points to our single, robust function.
        onAsk: _askQuestion,

        onFileSelect: (index) => {
            state.currentIndex = index;
            ChidiUI.update(state);
        },
        onSummarize: async () => {
            const currentFile = state.loadedFiles[state.currentIndex];
            if (!currentFile) return;
            ChidiUI.toggleLoader(true);
            ChidiUI.showMessage(`Contacting ${state.provider} API...`);
            const contentToSummarize = currentFile.isCode ? Utils.extractComments(currentFile.content, Utils.getFileExtension(currentFile.name)) : currentFile.content;
            const prompt = `Please provide a concise summary of the following document:\n\n---\n\n${contentToSummarize}`;
            const summary = await _callLlmApi([{ role: 'user', parts: [{ text: prompt }] }]);
            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Summary", summary);
        },
        onStudy: async () => {
            const currentFile = state.loadedFiles[state.currentIndex];
            if (!currentFile) return;
            ChidiUI.toggleLoader(true);
            ChidiUI.showMessage(`Contacting ${state.provider} API...`);
            const contentForQuestions = currentFile.isCode ? Utils.extractComments(currentFile.content, Utils.getFileExtension(currentFile.name)) : currentFile.content;
            const prompt = `Based on the following document, what are some insightful questions a user might ask?\n\n---\n\n${contentForQuestions}`;
            const questions = await _callLlmApi([{ role: 'user', parts: [{ text: prompt }] }]);
            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Suggested Questions", questions);
        },
        onSaveSession: async (filename) => {
            const htmlContent = ChidiUI.packageSessionAsHTML(state);
            const absPath = FileSystemManager.getAbsolutePath(filename);
            const saveResult = await FileSystemManager.createOrUpdateFile(absPath, htmlContent, {
                currentUser: UserManager.getCurrentUser().name,
                primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name)
            });
            if (saveResult.success && await FileSystemManager.save()) {
                ChidiUI.showMessage(`Session saved to '${filename}'.`, true);
            } else {
                ChidiUI.showMessage(`Error: ${saveResult.error || "Failed to save file system."}`, true);
            }
        },
        onExport: () => {
            const htmlContent = ChidiUI.packageSessionAsHTML(state);
            const currentFile = state.loadedFiles[state.currentIndex];
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = Utils.createElement('a', {
                href: url,
                download: `${currentFile.name.replace(/\.(md|txt|js|sh)$/, '')}_session.html`
            });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            ChidiUI.showMessage(`Exported session for ${currentFile.name}.`, true);
        },
        onVerboseToggle: () => {
            state.isVerbose = !state.isVerbose;
            ChidiUI.showMessage(`Verbose logging ${state.isVerbose ? 'enabled' : 'disabled'}.`, true);
            return state.isVerbose;
        },
        onClose: () => {
            close();
        },
        onAutoLink: async () => {
            ChidiUI.toggleLoader(true);
            ChidiUI.showMessage("Analyzing documents for key concepts...");
            const conceptsPrompt = `From the following text, extract a list of up to 15 key concepts, names, and technical terms. Return ONLY a comma-separated list.\n\nTEXT:\n${state.sessionContext}`;
            const conceptsResult = await _callLlmApi([{ role: 'user', parts: [{ text: conceptsPrompt }] }]);
            if (!conceptsResult) {
                ChidiUI.toggleLoader(false);
                ChidiUI.showMessage("Failed to extract key concepts.");
                return;
            }
            const keyConcepts = conceptsResult.split(',').map(c => c.trim());
            ChidiUI.showMessage("Generating cross-referenced summary...");
            const summaryPrompt = `The following key concepts have been identified in a set of documents: ${keyConcepts.join(', ')}.\n\nPlease write a concise, one-paragraph summary of the document set below. Your main goal is to naturally incorporate as many of the key concepts as possible.\n\nDOCUMENT SET:\n${state.sessionContext}`;
            const summaryResult = await _callLlmApi([{ role: 'user', parts: [{ text: summaryPrompt }] }]);
            if (!summaryResult) {
                ChidiUI.toggleLoader(false);
                ChidiUI.showMessage("Failed to generate summary.");
                return;
            }
            let linkedSummary = summaryResult;
            keyConcepts.forEach(concept => {
                const regex = new RegExp(`\\b(${concept})\\b`, 'gi');
                linkedSummary = linkedSummary.replace(regex, '[[<b>$1</b>]]');
            });
            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Auto-Linked Summary", linkedSummary);
        }
    };

    function launch(initialFiles, launchOptions) {
        if (state.isModalOpen) return;
        state = { ...defaultState };
        state.isModalOpen = true;
        state.loadedFiles = initialFiles.map(file => ({
            ...file,
            isCode: ['js', 'sh'].includes(Utils.getFileExtension(file.name))
        }));
        state.currentIndex = state.loadedFiles.length > 0 ? 0 : -1;
        state.sessionContext = state.loadedFiles.map(file => `--- START OF DOCUMENT: ${file.name} ---\n\n${file.content}\n\n--- END OF DOCUMENT ---`).join('\n\n');
        if (launchOptions.provider) state.provider = launchOptions.provider;
        if (launchOptions.model) state.model = launchOptions.model;
        if (launchOptions.isNewSession) {
            state.conversationHistory = [];
        }
        ChidiUI.buildAndShow(state, callbacks);
        const initialMessage = launchOptions.isNewSession ?
            `New session started. Analyzing ${state.loadedFiles.length} files.` :
            `Chidi.md initialized. Analyzing ${state.loadedFiles.length} files.`;
        ChidiUI.showMessage(initialMessage, true);
    }

    function close() {
        if (!state.isModalOpen) return;
        state = {};
        ChidiUI.hideAndReset();
    }

    return { launch };
})();