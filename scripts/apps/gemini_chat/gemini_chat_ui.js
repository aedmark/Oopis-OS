const GeminiChatUI = (() => {
    "use strict";

    let elements = {};
    let managerCallbacks = {};

    function buildAndShow(callbacks) {
        managerCallbacks = callbacks;

        // --- Main Container ---
        elements.container = Utils.createElement('div', { id: 'gemini-chat-container' });

        // --- Header ---
        const title = Utils.createElement('h2', { textContent: 'Gemini Chat' });
        const exitBtn = Utils.createElement('button', { className: 'btn btn--cancel', textContent: 'Exit' });
        const header = Utils.createElement('header', { className: 'gemini-chat-header' }, [title, exitBtn]);

        // --- Message Display ---
        elements.messageDisplay = Utils.createElement('div', { className: 'gemini-chat-messages' });

        // --- Loader ---
        elements.loader = Utils.createElement('div', { className: 'gemini-chat-loader hidden' }, [
            Utils.createElement('span'),
            Utils.createElement('span'),
            Utils.createElement('span'),
        ]);

        // --- Input Form ---
        elements.input = Utils.createElement('input', {
            type: 'text',
            placeholder: 'Type your message...',
            className: 'gemini-chat-input'
        });
        const sendBtn = Utils.createElement('button', { className: 'btn btn--confirm', textContent: 'Send' });
        const form = Utils.createElement('form', { className: 'gemini-chat-form' }, [elements.input, sendBtn]);
        
        // --- Assemble ---
        elements.container.append(header, elements.messageDisplay, elements.loader, form);

        // --- Event Listeners ---
        exitBtn.addEventListener('click', () => managerCallbacks.onExit());
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            managerCallbacks.onSendMessage(elements.input.value);
            elements.input.value = '';
        });

        elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form.requestSubmit();
            }
        });

        AppLayerManager.show(elements.container);
        elements.input.focus();
    }
    
    function hideAndReset() {
        AppLayerManager.hide();
        elements = {};
        managerCallbacks = {};
    }

    function appendMessage(message, sender) {
        if (!elements.messageDisplay) return;

        const messageDiv = Utils.createElement('div', {
            className: `gemini-chat-message ${sender}`
        });
        
        // Use marked to render markdown for AI messages
        if (sender === 'ai') {
            messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(message));
        } else {
            messageDiv.textContent = message;
        }

        elements.messageDisplay.appendChild(messageDiv);
        elements.messageDisplay.scrollTop = elements.messageDisplay.scrollHeight;
    }

    function toggleLoader(show) {
        if (elements.loader) {
            elements.loader.classList.toggle('hidden', !show);
        }
    }

    return {
        buildAndShow,
        hideAndReset,
        appendMessage,
        toggleLoader
    };
})();