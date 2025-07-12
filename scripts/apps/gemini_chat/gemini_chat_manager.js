const GeminiChatManager = (() => {
    "use strict";

    let state = {};

    const defaultState = {
        isActive: false,
        conversationHistory: [],
        provider: 'gemini', // Default provider
        model: null, // Default model
    };

    function enter(provider, model) {
        if (state.isActive) return;

        state = { ...defaultState };
        state.isActive = true;
        state.provider = provider || 'gemini';
        state.model = model || null;
        
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
                // Remove the user message from history so they can try again after setting the key
                state.conversationHistory.pop(); 
                return;
            }
        }
        
        const result = await Utils.callLlmApi(state.provider, state.model, state.conversationHistory, apiKey, null);

        GeminiChatUI.toggleLoader(false);

        if (result.success) {
            const aiResponse = result.answer;
            state.conversationHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
            GeminiChatUI.appendMessage(aiResponse, 'ai');
        } else {
            const errorMessage = `AI Error: ${result.error}`;
            GeminiChatUI.appendMessage(errorMessage, 'ai');
            // Remove the user's message from history on failure
            state.conversationHistory.pop(); 
        }
    }

    return {
        enter,
        exit,
        isActive: () => state.isActive
    };
})();