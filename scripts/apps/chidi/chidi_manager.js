const ChidiManager = (() => {
    "use strict";

    let state = {};

    const defaultState = {
        loadedFiles: [],
        currentIndex: -1,
        isModalOpen: false,
        isVerbose: false,
        conversationHistory: [],
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
            ChidiUI.showMessage("Contacting Gemini API...");

            const contentToSummarize = currentFile.isCode
                ? Utils.extractComments(currentFile.content, Utils.getFileExtension(currentFile.name))
                : currentFile.content;
            const prompt = `Please provide a concise summary of the following document:\n\n---\n\n${contentToSummarize}`;
            const summary = await _callGeminiApi([{role: 'user', parts: [{text: prompt}]}]);

            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Summary", summary);
        },
        onStudy: async () => {
            const currentFile = state.loadedFiles[state.currentIndex];
            if (!currentFile) return;

            ChidiUI.toggleLoader(true);
            ChidiUI.showMessage("Contacting Gemini API...");

            const contentForQuestions = currentFile.isCode
                ? Utils.extractComments(currentFile.content, Utils.getFileExtension(currentFile.name))
                : currentFile.content;
            const prompt = `Based on the following document, what are some insightful questions a user might ask?\n\n---\n\n${contentForQuestions}`;
            const questions = await _callGeminiApi([{role: 'user', parts: [{text: prompt}]}]);

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

        const finalAnswer = await _callGeminiApi(historyForApi);

        if (finalAnswer) {
            state.conversationHistory.push({role: 'model', parts: [{text: finalAnswer}]});
        }

        const fileNames = relevantFiles.map(item => item.name).join(', ');
        ChidiUI.appendAiOutput(`Answer for "${userQuestion}" (based on: ${fileNames})`, finalAnswer || "Could not generate an answer based on the provided context.");
        ChidiUI.toggleLoader(false);
    }

    function _findRelevantFiles(userQuestion) {
        // This is a simplified keyword search; a real implementation would use embeddings.
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

    async function _callGeminiApi(chatHistory) {
        const apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
        const result = await Utils.callLlmApi('gemini', null, chatHistory, apiKey);
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