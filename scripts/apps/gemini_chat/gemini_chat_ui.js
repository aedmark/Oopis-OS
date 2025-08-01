// scripts/apps/gemini_chat/gemini_chat_ui.js

"use strict";

window.GeminiChatUI = class GeminiChatUI {
  constructor(callbacks, dependencies) {
    this.elements = {};
    this.managerCallbacks = callbacks;
    this.dependencies = dependencies;
    this._buildLayout();
  }

  getContainer() {
    return this.elements.container;
  }

  _buildLayout() {
    const { Utils, UIComponents } = this.dependencies;

    const appWindow = UIComponents.createAppWindow('Gemini Chat', this.managerCallbacks.onExit);
    this.elements.container = appWindow.container;
    this.elements.main = appWindow.main;
    this.elements.footer = appWindow.footer;

    this.elements.messageDisplay = Utils.createElement("div", {
      className: "gemini-chat-messages",
    });
    this.elements.loader = Utils.createElement(
        "div",
        { className: "gemini-chat-loader hidden" },
        [
          Utils.createElement("span"),
          Utils.createElement("span"),
          Utils.createElement("span"),
        ]
    );

    this.elements.main.append(this.elements.messageDisplay, this.elements.loader);

    this.elements.input = Utils.createElement("input", {
      type: "text",
      placeholder: "Type your message...",
      className: "gemini-chat-input",
    });
    const sendBtn = Utils.createElement("button", {
      className: "btn btn--confirm",
      textContent: "Send",
    });
    const form = Utils.createElement(
        "form",
        { className: "gemini-chat-form" },
        [this.elements.input, sendBtn]
    );

    this.elements.footer.appendChild(form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.managerCallbacks.onSendMessage(this.elements.input.value);
      this.elements.input.value = "";
    });
    this.elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    this.elements.input.focus();
  }

  hideAndReset() {
    if (this.elements.container) {
      this.elements.container.remove();
    }
    this.elements = {};
    this.managerCallbacks = {};
  }

  appendMessage(message, sender, processMarkdown) {
    if (!this.elements.messageDisplay) return;
    const { Utils } = this.dependencies;

    const messageDiv = Utils.createElement("div", {
      className: `gemini-chat-message ${sender}`,
    });

    if (processMarkdown) {
      const sanitizedHtml = DOMPurify.sanitize(marked.parse(message));
      // Use createTextNode and appendChild instead of innerHTML
      const textNode = document.createTextNode(sanitizedHtml);
      messageDiv.appendChild(textNode);

      const copyBtn = Utils.createElement("button", {
        className: "btn",
        style: "position: absolute; top: 5px; right: 5px; font-size: 0.75rem; padding: 2px 5px;",
        textContent: "Copy",
      });
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(message);
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
        } catch (err) {
          console.error("Failed to copy text:", err);
          copyBtn.textContent = "Error!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
        }
      });
      messageDiv.style.position = "relative";
      messageDiv.appendChild(copyBtn);

      messageDiv.querySelectorAll("pre > code").forEach((codeBlock) => {
        const commandText = codeBlock.textContent.trim();
        if (!commandText.includes("\n")) {
          const runButton = Utils.createElement("button", {
            className: "btn btn--confirm",
            textContent: `Run Command`,
            style: "display: block; margin-top: 10px;",
          });
          runButton.addEventListener("click", () =>
              this.managerCallbacks.onRunCommand(commandText)
          );
          codeBlock.parentElement.insertAdjacentElement("afterend", runButton);
        }
      });
    } else {
      messageDiv.textContent = message;
    }

    this.elements.messageDisplay.appendChild(messageDiv);
    this.elements.messageDisplay.scrollTop = this.elements.messageDisplay.scrollHeight;
  }

  toggleLoader(show) {
    if (this.elements.loader) {
      this.elements.loader.classList.toggle("hidden", !show);
    }
  }
};
