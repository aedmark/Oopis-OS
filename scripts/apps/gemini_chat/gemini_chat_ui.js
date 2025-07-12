// scripts/apps/gemini_chat/gemini_chat_ui.js

const GeminiChatUI = (() => {
    "use strict";

    let elements = {};
    let managerCallbacks = {};

    function buildAndShow(callbacks) {
        managerCallbacks = callbacks;

        elements.container = Utils.createElement('div', { id: 'gemini-chat-container' });
        const title = Utils.createElement('h2', { textContent: 'Gemini Chat' });
        const exitBtn = Utils.createElement('button', { className: 'btn btn--cancel', textContent: 'Exit' });
        const header = Utils.createElement('header', { className: 'gemini-chat-header' }, [title, exitBtn]);
        elements.messageDisplay = Utils.createElement('div', { className: 'gemini-chat-messages' });
        elements.loader = Utils.createElement('div', { className: 'gemini-chat-loader hidden' }, [
            Utils.createElement('span'), Utils.createElement('span'), Utils.createElement('span'),
        ]);
        elements.input = Utils.createElement('input', {
            type: 'text',
            placeholder: 'Type your message...',
            className: 'gemini-chat-input'
        });
        const sendBtn = Utils.createElement('button', { className: 'btn btn--confirm', textContent: 'Send' });
        const form = Utils.createElement('form', { className: 'gemini-chat-form' }, [elements.input, sendBtn]);

        elements.container.append(header, elements.messageDisplay, elements.loader, form);

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

        if (sender === 'ai') {
            const sanitizedHtml = DOMPurify.sanitize(marked.parse(message));
            messageDiv.innerHTML = sanitizedHtml;

            // NEW: Add a "Copy" button to each AI message for usability
            const copyBtn = Utils.createElement('button', { class: 'btn', style: 'position: absolute; top: 5px; right: 5px; font-size: 0.75rem; padding: 2px 5px;', textContent: 'Copy' });
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(message); // Copy the raw markdown
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            });
            messageDiv.style.position = 'relative';
            messageDiv.appendChild(copyBtn);

            // NEW: Add "Run Command" buttons for code blocks
            messageDiv.querySelectorAll('pre > code').forEach(codeBlock => {
                const commandText = codeBlock.textContent.trim();
                // Check if it's a single-line command
                if (!commandText.includes('\n')) {
                    const runButton = Utils.createElement('button', {
                        class: 'btn btn--confirm',
                        textContent: `Run Command`,
                        style: 'display: block; margin-top: 10px;'
                    });
                    runButton.addEventListener('click', async () => {
                        managerCallbacks.onExit(); // Close chat
                        await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI to hide
                        await CommandExecutor.processSingleCommand(commandText, { isInteractive: true });
                    });
                    codeBlock.parentElement.insertAdjacentElement('afterend', runButton);
                }
            });

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