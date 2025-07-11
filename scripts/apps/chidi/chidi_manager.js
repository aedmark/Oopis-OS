// scripts/apps/chidi/chidi_manager.js

const ChidiManager = (() => {
    "use strict";

    let state = {};

    const defaultState = {
        loadedFiles: [],
        currentIndex: -1,
        isModalOpen: false,
        isVerbose: false,
        conversationHistory: [],
        provider: 'gemini',
        model: null,
    };

    const callbacks = {
        onFileSelect: (index) => {
            state.currentIndex = index;
            ChidiUI.update(state);
        },
        onSummarize: async () => {
            const currentFile = state.loadedFiles[state.currentIndex];
            if (!currentFile) return;

            ChidiUI.toggleLoader(true);
            ChidiUI.showMessage(`Contacting ${state.provider} API...`);

            const contentToSummarize = currentFile.isCode
                ? Utils.extractComments(currentFile.content, Utils.getFileExtension(currentFile.name))
                : currentFile.content;
            const prompt = `Please provide a concise summary of the following document:\n\n---\n\n${contentToSummarize}`;

            // Pass the provider to the API call
            const summary = await _callLlmApi([{role: 'user', parts: [{text: prompt}]}]);

            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Summary", summary);
        },
        onStudy: async () => {
            const currentFile = state.loadedFiles[state.currentIndex];
            if (!currentFile) return;

            ChidiUI.toggleLoader(true);
            ChidiUI.showMessage(`Contacting ${state.provider} API...`);

            const contentForQuestions = currentFile.isCode
                ? Utils.extractComments(currentFile.content, Utils.getFileExtension(currentFile.name))
                : currentFile.content;
            const prompt = `Based on the following document, what are some insightful questions a user might ask?\n\n---\n\n${contentForQuestions}`;

            // Pass the provider to the API call
            const questions = await _callLlmApi([{role: 'user', parts: [{text: prompt}]}]);

            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Suggested Questions", questions);
        },
        onAsk: async (userQuestion) => {
            await _submitQuestion(userQuestion);
        },
        onSaveSession: async (filename) => {
            const htmlContent = ChidiUI.packageSessionAsHTML(state);
            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            const absPath = FileSystemManager.getAbsolutePath(filename);

            const saveResult = await FileSystemManager.createOrUpdateFile(absPath, htmlContent, {
                currentUser,
                primaryGroup
            });
            if (saveResult.success && await FileSystemManager.save()) {
                ChidiUI.showMessage(`Session saved to '${filename}'.`, true);
            } else {
                ChidiUI.showMessage(`Error: ${saveResult.error || "Failed to save file system changes."}`, true);
            }
        },
        onExport: () => {
            const htmlContent = ChidiUI.packageSessionAsHTML(state);
            const currentFile = state.loadedFiles[state.currentIndex];
            const blob = new Blob([htmlContent], {type: 'text/html'});
            const url = URL.createObjectURL(blob);
            const a = Utils.createElement('a', {
                href: url,
                download: `${currentFile.name.replace(/\.(md|txt)$/, '')}_session.html`
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

            const allContent = state.loadedFiles.map(f => f.content).join('\n\n---\n\n');

            const conceptsPrompt = `From the following text, extract a list of up to 15 key concepts, names, and technical terms. Return ONLY a comma-separated list.

            TEXT:
            ${allContent}`;

            const conceptsResult = await _callLlmApi([{role: 'user', parts: [{text: conceptsPrompt}]}]);
            if (!conceptsResult) {
                ChidiUI.toggleLoader(false);
                ChidiUI.showMessage("Failed to extract key concepts.");
                return;
            }
            const keyConcepts = conceptsResult.split(',').map(c => c.trim());

            ChidiUI.showMessage("Generating cross-referenced summary...");

            const summaryPrompt = `The following key concepts have been identified in a set of documents: ${keyConcepts.join(', ')}.

            Please write a concise, one-paragraph summary of the document set below. Your main goal is to naturally incorporate as many of the key concepts as possible.

            DOCUMENT SET:
            ${allContent}`;

            const summaryResult = await _callLlmApi([{role: 'user', parts: [{text: summaryPrompt}]}]);
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

        state = {...defaultState};
        state.isModalOpen = true;
        state.loadedFiles = initialFiles.map(file => ({
            ...file,
            isCode: ['js', 'sh'].includes(Utils.getFileExtension(file.name))
        }));
        state.currentIndex = state.loadedFiles.length > 0 ? 0 : -1;

        if (launchOptions.provider) state.provider = launchOptions.provider;
        if (launchOptions.model) state.model = launchOptions.model;

        if (launchOptions.isNewSession) {
            state.conversationHistory = [];
        }

        ChidiUI.buildAndShow(state, callbacks);
        ChidiUI.showMessage(launchOptions.isNewSession
            ? "New session started. AI interaction history is cleared."
            : `Chidi.md initialized. ${state.loadedFiles.length} files loaded for analysis.`, true);
    }

    function close() {
        if (!state.isModalOpen) return;
        state = {};
        ChidiUI.hideAndReset();
    }

    async function _submitQuestion(userQuestion) {
        ChidiUI.toggleLoader(true);
        ChidiUI.showMessage(`Analyzing ${state.loadedFiles.length} files for relevance...`);

        state.conversationHistory.push({role: 'user', parts: [{text: userQuestion}]});

        const relevantFiles = _findRelevantFiles(userQuestion);
        let promptContext = "Based on the following documents and our previous conversation, please provide a comprehensive answer.\n\n";

        relevantFiles.forEach(file => {
            const contentForPrompt = file.isCode ? Utils.extractComments(file.content, Utils.getFileExtension(file.name)) : file.content;
            promptContext += `--- START OF DOCUMENT: ${file.name} ---\n\n${contentForPrompt}\n\n--- END OF DOCUMENT ---\n\n`;
        });

        const fullPrompt = `${promptContext}User's Question: "${userQuestion}"`;
        const historyForApi = [...state.conversationHistory.slice(0, -1), {role: 'user', parts: [{text: fullPrompt}]}];

        if (state.isVerbose) {
            ChidiUI.appendAiOutput("Constructed Prompt", `The following block contains the context and question being sent to the AI.\n\n\`\`\`text\n${fullPrompt}\n\`\`\``);
        }

        const finalAnswer = await _callLlmApi(historyForApi);

        if (finalAnswer) {
            state.conversationHistory.push({role: 'model', parts: [{text: finalAnswer}]});
        }

        const fileNames = relevantFiles.map(item => item.name).join(', ');
        ChidiUI.appendAiOutput(`Answer for "${userQuestion}" (based on: ${fileNames})`, finalAnswer || "Could not generate an answer based on the provided context.");
        ChidiUI.toggleLoader(false);
    }

    function _findRelevantFiles(userQuestion) {
        const questionLower = userQuestion.toLowerCase();
        const stopWords = new Set(['a', 'an', 'the', 'is', 'in', 'of', 'for', 'to', 'what', 'who', 'where', 'when', 'why', 'how', 'and', 'or', 'but']);
        const keywords = questionLower.split(/[\s\W]+/).filter(word => word.length > 2 && !stopWords.has(word));

        const scoredFiles = state.loadedFiles.map(file => {
            let score = 0;
            const contentLower = file.content.toLowerCase();
            keywords.forEach(keyword => {
                if (file.name.toLowerCase().includes(keyword)) score += 15;
                score += (contentLower.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
            });
            return {file, score};
        }).sort((a, b) => b.score - a.score);

        const relevantFiles = scoredFiles.slice(0, 5).filter(item => item.score > 0).map(item => item.file);
        const currentFile = state.loadedFiles[state.currentIndex];
        if (currentFile && !relevantFiles.some(f => f.path === currentFile.path)) {
            relevantFiles.pop();
            relevantFiles.unshift(currentFile);
        }
        return relevantFiles.length > 0 ? relevantFiles : [currentFile];
    }

    // Rename this function to be more generic
    async function _callLlmApi(chatHistory) {
        let apiKey = null;
        // Only get the API key if the provider is Gemini
        if (state.provider === 'gemini') {
            apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
            if (!apiKey) {
                ChidiUI.showMessage("Error: Gemini API key not found.", true);
                ChidiUI.appendAiOutput("API Error", "A Gemini API key is required for this operation. Please run the `gemini` command once to set it up.");
                return "";
            }
        }

        const result = await Utils.callLlmApi(state.provider, state.model, chatHistory, apiKey);
        if (!result.success) {
            ChidiUI.showMessage(`Error: ${result.error}`, true);
            ChidiUI.appendAiOutput("API Error", `Failed to get a response. Details: ${result.error}`);
            return "";
        }
        ChidiUI.showMessage("Response received.", true);
        return result.answer;
    }

    return {launch};
})();