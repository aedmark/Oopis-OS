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
        // NEW: State for conversational context
        sessionContext: "",
        isFirstQuestion: true,
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

            const questions = await _callLlmApi([{role: 'user', parts: [{text: prompt}]}]);

            ChidiUI.toggleLoader(false);
            ChidiUI.appendAiOutput("Suggested Questions", questions);
        },
        // MODIFIED: This is now the entry point for all questions.
        onAsk: async (userQuestion) => {
            if (state.isFirstQuestion) {
                await _submitQuestionWithRelevance(userQuestion);
                state.isFirstQuestion = false;
            } else {
                await _submitQuestionWithHistory(userQuestion);
            }
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

            const conceptsPrompt = `From the following text, extract a list of up to 15 key concepts, names, and technical terms. Return ONLY a comma-separated list.\n\nTEXT:\n${state.sessionContext}`;
            const conceptsResult = await _callLlmApi([{role: 'user', parts: [{text: conceptsPrompt}]}]);
            if (!conceptsResult) {
                ChidiUI.toggleLoader(false);
                ChidiUI.showMessage("Failed to extract key concepts.");
                return;
            }
            const keyConcepts = conceptsResult.split(',').map(c => c.trim());

            ChidiUI.showMessage("Generating cross-referenced summary...");

            const summaryPrompt = `The following key concepts have been identified in a set of documents: ${keyConcepts.join(', ')}.\n\nPlease write a concise, one-paragraph summary of the document set below. Your main goal is to naturally incorporate as many of the key concepts as possible.\n\nDOCUMENT SET:\n${state.sessionContext}`;
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

        state = {...defaultState}; // Reset state completely on launch
        state.isModalOpen = true;
        state.loadedFiles = initialFiles.map(file => ({
            ...file,
            isCode: ['js', 'sh'].includes(Utils.getFileExtension(file.name))
        }));
        state.currentIndex = state.loadedFiles.length > 0 ? 0 : -1;

        // NEW: Establish the persistent session context
        state.sessionContext = state.loadedFiles.map(file => `--- START OF DOCUMENT: ${file.name} ---\n\n${file.content}\n\n--- END OF DOCUMENT ---`).join('\n\n');

        if (launchOptions.provider) state.provider = launchOptions.provider;
        if (launchOptions.model) state.model = launchOptions.model;

        // MODIFIED: -n flag clears history AND resets the conversational state
        if (launchOptions.isNewSession) {
            state.conversationHistory = [];
            state.isFirstQuestion = true;
        }

        ChidiUI.buildAndShow(state, callbacks);
        const initialMessage = launchOptions.isNewSession
            ? `New session started. Analyzing ${state.loadedFiles.length} files. Ask a follow-up question.`
            : `Chidi.md initialized. Analyzing ${state.loadedFiles.length} files. Ask a follow-up question.`;
        ChidiUI.showMessage(initialMessage, true);
    }

    function close() {
        if (!state.isModalOpen) return;
        state = {}; // Reset state on close
        ChidiUI.hideAndReset();
    }

    // RENAMED & MODIFIED: This handles the first question with relevance scoring
    async function _submitQuestionWithRelevance(userQuestion) {
        ChidiUI.toggleLoader(true);
        ChidiUI.showMessage(`Analyzing ${state.loadedFiles.length} files for relevance...`);

        state.conversationHistory.push({role: 'user', parts: [{text: userQuestion}]});

        const relevantFiles = _findRelevantFiles(userQuestion);
        let promptContext = "Based on the following documents, please provide a comprehensive answer.\n\n";

        relevantFiles.forEach(file => {
            const contentForPrompt = file.isCode ? Utils.extractComments(file.content, Utils.getFileExtension(file.name)) : file.content;
            promptContext += `--- START OF DOCUMENT: ${file.name} ---\n\n${contentForPrompt}\n\n--- END OF DOCUMENT ---\n\n`;
        });

        const fullPrompt = `${promptContext}User's Question: "${userQuestion}"`;
        const historyForApi = [{role: 'user', parts: [{text: fullPrompt}]}]; // First question has no history

        if (state.isVerbose) {
            ChidiUI.appendAiOutput("Constructed Prompt (First Question)", `The following block contains the context and question being sent to the AI.\n\n\`\`\`text\n${fullPrompt}\n\`\`\``);
        }

        const finalAnswer = await _callLlmApi(historyForApi);

        if (finalAnswer) {
            state.conversationHistory.push({role: 'model', parts: [{text: finalAnswer}]});
        }

        const fileNames = relevantFiles.map(item => item.name).join(', ');
        ChidiUI.appendAiOutput(`Answer for "${userQuestion}" (based on: ${fileNames})`, finalAnswer || "Could not generate an answer based on the provided context.");
        ChidiUI.toggleLoader(false);
    }

    // NEW: This function handles subsequent questions using the full session context
    async function _submitQuestionWithHistory(userQuestion) {
        ChidiUI.toggleLoader(true);
        ChidiUI.showMessage("Considering full context for follow-up...");

        state.conversationHistory.push({role: 'user', parts: [{text: userQuestion}]});

        // The prompt now includes the persistent session context and the full conversation history
        const fullPrompt = `Continue this conversation, keeping the context of these files in mind.\n\nFULL FILE CONTEXT:\n${state.sessionContext}`;

        // We send the full history, with the new instruction prepended to the latest user message
        const userTurn = state.conversationHistory.at(-1);
        const modifiedUserTurn = { role: 'user', parts: [{ text: `${fullPrompt}\n\nUser's follow-up: "${userTurn.parts[0].text}"` }] };
        const historyForApi = [...state.conversationHistory.slice(0, -1), modifiedUserTurn];

        if (state.isVerbose) {
            ChidiUI.appendAiOutput("Constructed Prompt (Follow-up)", `The following block contains the context and question being sent to the AI.\n\n\`\`\`text\n${modifiedUserTurn.parts[0].text}\n\`\`\``);
        }

        const finalAnswer = await _callLlmApi(historyForApi);

        if (finalAnswer) {
            state.conversationHistory.push({role: 'model', parts: [{text: finalAnswer}]});
        }

        ChidiUI.appendAiOutput(`Answer for "${userQuestion}"`, finalAnswer || "Could not generate an answer based on the provided context.");
        ChidiUI.toggleLoader(false);
    }


    function _findRelevantFiles(userQuestion) {
        // This function remains unchanged for the first question's relevance scoring.
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

    async function _callLlmApi(chatHistory) {
        let apiKey = null;
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