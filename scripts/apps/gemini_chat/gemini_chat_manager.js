// scripts/apps/gemini_chat/gemini_chat_manager.js

const GeminiChatManager = (() => {
    "use strict";

    let state = {};

    const defaultState = {
        isActive: false,
        conversationHistory: [],
        provider: 'gemini', // Default provider
        model: null, // Default model
    };

    async function enter(provider, model) {
        if (state.isActive) return;

        state = { ...defaultState };
        state.isActive = true;
        state.provider = provider || 'gemini';
        state.model = model || null;

        // NEW: Gather and prepend context at the start of the session
        const pwdResult = await CommandExecutor.processSingleCommand("pwd", { suppressOutput: true });
        const lsResult = await CommandExecutor.processSingleCommand("ls -la", { suppressOutput: true });
        const historyResult = await CommandExecutor.processSingleCommand("history", { suppressOutput: true });

        const systemContext = `You are a helpful assistant operating inside a browser-based simulated OS called OopisOS. The user has opened this chat interface. Below is the context of their current terminal session. Use it to inform your answers.

## OopisOS Session Context ##
Current Directory:
${pwdResult.output || '(unknown)'}

Directory Listing (ls -la):
${lsResult.output || '(empty)'}

Recent Command History:
${historyResult.output || '(none)'}
`;
        // Prepend the context to the conversation history as a system message.
        // This is sent only once at the beginning of the conversation.
        state.conversationHistory.push({ role: 'system', parts: [{ text: systemContext }] });

        GeminiChatUI.buildAndShow({
            onSendMessage: _sendMessage,
            onExit: exit
        });
    }

    async function exit() {
        if (!state.isActive) return;

        GeminiChatUI.hideAndReset();
        state = {};
    }

    async function _sendMessage(userInput) {
        if (!userInput || userInput.trim() === '') return;

        const userMessage = { role: 'user', parts: [{ text: userInput }] };
        state.conversationHistory.push(userMessage);

        GeminiChatUI.appendMessage(userInput, 'user');
        GeminiChatUI.toggleLoader(true);

        let apiKey = null;

        if (state.provider === 'gemini') {
            apiKey = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
            if (!apiKey) {
                GeminiChatUI.toggleLoader(false);
                GeminiChatUI.appendMessage("Error: Gemini API key not set. Please run the `gemini` command in the terminal once to set it.", 'ai');
                state.conversationHistory.pop();
                return;
            }
        }

        // The conversation history now naturally includes the system context at the beginning
        const result = await Utils.callLlmApi(state.provider, state.model, state.conversationHistory, apiKey, null);

        GeminiChatUI.toggleLoader(false);

        if (result.success) {
            const aiResponse = result.answer;
            state.conversationHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
            GeminiChatUI.appendMessage(aiResponse, 'ai');
        } else {
            const errorMessage = `AI Error: ${result.error}`;
            GeminiChatUI.appendMessage(errorMessage, 'ai');
            state.conversationHistory.pop();
        }
    }

    return {
        enter,
        exit,
        isActive: () => state.isActive
    };
})();