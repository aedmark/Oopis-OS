// scripts/apps/chidi/chidi_manager.js

/**
 * Chidi Document Analyst Manager - AI-powered document analysis and Q&A system
 * @class ChidiManager
 * @extends App
 */
window.ChidiManager = class ChidiManager extends App {
  /**
   * Create a Chidi manager instance
   */
  constructor() {
    super();
    /** @type {Object} Application state including files, conversation history, and settings */
    this.state = {};
    /** @type {Object} Injected dependencies */
    this.dependencies = {};
    /** @type {Object} Callback functions for UI interaction */
    this.callbacks = {};
    /** @type {Object|null} UI instance */
    this.ui = null;
  }

  /**
   * Enter the Chidi document analyst
   * @param {HTMLElement} appLayer - DOM element to attach the UI
   * @param {Object} options - Configuration options
   * @param {Object} options.dependencies - Required dependencies
   * @param {Array} options.initialFiles - Files to analyze
   * @param {Object} options.launchOptions - Launch configuration
   */
  enter(appLayer, options = {}) {
    if (this.isActive) return;

    this.dependencies = options.dependencies;
    this.callbacks = this._createCallbacks();

    this._initializeState(options.initialFiles, options.launchOptions);
    this.isActive = true;

    this.ui = new this.dependencies.ChidiUI(this.state, this.callbacks, this.dependencies);
    this.container = this.ui.getContainer();
    appLayer.appendChild(this.container);

    const initialMessage = this.state.isNewSession
        ? `New session started. Analyzing ${this.state.loadedFiles.length} files.`
        : `Chidi.md initialized. Analyzing ${this.state.loadedFiles.length} files.`;
    this.ui.showMessage(initialMessage, true);
  }

  /**
   * Exit the Chidi application
   */
  exit() {
    if (!this.isActive) return;
    if (this.ui) {
      this.ui.hideAndReset();
    }
    this.dependencies.AppLayerManager.hide(this);
    this.isActive = false;
    this.state = {};
    this.ui = null;
  }

  /**
   * Initialize application state
   * @private
   * @param {Array} initialFiles - Files to load for analysis
   * @param {Object} launchOptions - Launch configuration options
   */
  _initializeState(initialFiles, launchOptions) {
    const { Utils } = this.dependencies;
    this.state = {
      isActive: true,
      loadedFiles: initialFiles.map((file) => ({
        ...file,
        isCode: ["js", "sh"].includes(Utils.getFileExtension(file.name)),
      })),
      currentIndex: initialFiles.length > 0 ? 0 : -1,
      isNewSession: launchOptions.isNewSession,
      provider: launchOptions.provider || "gemini",
      model: launchOptions.model || null,
      conversationHistory: [],
      sessionContext: initialFiles
          .map(
              (file) =>
                  `--- START OF DOCUMENT: ${file.name} ---\n\n${file.content}\n\n--- END OF DOCUMENT ---`
          )
          .join("\n\n"),
      CHIDI_SYSTEM_PROMPT: `You are Chidi, an AI-powered document analyst.

**Rules:**
- Your answers MUST be based *only* on the provided document context and the ongoing conversation history.
- If the answer is not in the documents, state that clearly. Do not use outside knowledge.
- Be concise, helpful, and directly answer the user's question.

--- PROVIDED DOCUMENT CONTEXT ---
{{documentContext}}
--- END DOCUMENT CONTEXT ---`,
    };

    if (launchOptions.isNewSession) {
      this.state.conversationHistory = [];
    }
  }

  /**
   * Call the LLM API for document analysis
   * @private
   * @param {Array} chatHistory - Conversation history
   * @param {string} [systemPrompt] - System prompt for the AI
   * @returns {Promise<Object>} API response result
   */
  async _callLlmApi(chatHistory, systemPrompt) {
    const { AIManager } = this.dependencies;
    const apiKeyResult = await AIManager.getApiKey(this.state.provider, {
      isInteractive: true,
      dependencies: this.dependencies,
    });
    if (!apiKeyResult.success) {
      return apiKeyResult;
    }
    const apiKey = apiKeyResult.data.key;

    const result = await AIManager.callLlmApi(
        this.state.provider,
        this.state.model,
        chatHistory,
        apiKey,
        this.dependencies,
        systemPrompt
    );
    return result;
  }

  /**
   * Create callback functions for UI interaction
   * @private
   * @returns {Object} Callback object with all UI handlers
   */
  _createCallbacks() {
    return {
      onPrevFile: () => {
        if (this.state.currentIndex > 0) {
          this.state.currentIndex--;
          this.ui.update(this.state);
        }
      },
      onNextFile: () => {
        if (this.state.currentIndex < this.state.loadedFiles.length - 1) {
          this.state.currentIndex++;
          this.ui.update(this.state);
        }
      },
      onAsk: async () => {
        const { ModalManager } = this.dependencies;
        const userQuestion = await new Promise((resolve) => {
          ModalManager.request({
            context: "graphical",
            type: "input",
            messageLines: ["Ask a question about all loaded documents:"],
            onConfirm: (value) => resolve(value),
            onCancel: () => resolve(null),
          });
        });

        if (!userQuestion || !userQuestion.trim()) return;

        this.ui.toggleLoader(true);
        this.ui.showMessage("Analyzing...");

        this.state.conversationHistory.push({
          role: "user",
          parts: [{ text: userQuestion }],
        });

        const systemPromptWithContext = this.state.CHIDI_SYSTEM_PROMPT.replace(
            "{{documentContext}}",
            this.state.sessionContext
        );
        const result = await this._callLlmApi(
            this.state.conversationHistory,
            systemPromptWithContext
        );

        this.ui.toggleLoader(false);
        if (result.success) {
          this.state.conversationHistory.push({
            role: "model",
            parts: [{ text: result.answer }],
          });
          this.ui.appendAiOutput(`Answer for "${userQuestion}"`, result.answer);
          this.ui.showMessage("Response received.", true);
        } else {
          this.state.conversationHistory.pop();
          this.ui.appendAiOutput(
              "API Error",
              `Failed to get a response. Details: ${result.error}`
          );
          this.ui.showMessage(`Error: ${result.error}`, true);
        }
      },
      onSummarize: async () => {
        const { Utils } = this.dependencies;
        const currentFile = this.state.loadedFiles[this.state.currentIndex];
        if (!currentFile) return;
        this.ui.toggleLoader(true);
        this.ui.showMessage(`Contacting ${this.state.provider} API...`);
        let contentToSummarize = currentFile.content;
        if (currentFile.isCode) {
          const comments = Utils.extractComments(
              currentFile.content,
              Utils.getFileExtension(currentFile.name)
          );
          if (comments && comments.trim() !== "") {
            contentToSummarize = comments;
          }
        }
        const prompt = `Please provide a concise summary of the following document:\n\n---\n\n${contentToSummarize}`;

        const result = await this._callLlmApi([
          { role: "user", parts: [{ text: prompt }] },
        ]);

        this.ui.toggleLoader(false);
        if (result.success) {
          this.ui.appendAiOutput("Summary", result.answer);
          this.ui.showMessage("Summary received.", true);
        } else {
          this.ui.appendAiOutput(
              "API Error",
              `Failed to get a summary. Details: ${result.error}`
          );
          this.ui.showMessage(`Error: ${result.error}`, true);
        }
      },
      onStudy: async () => {
        const { Utils } = this.dependencies;
        const currentFile = this.state.loadedFiles[this.state.currentIndex];
        if (!currentFile) return;
        this.ui.toggleLoader(true);
        this.ui.showMessage(`Contacting ${this.state.provider} API...`);
        let contentForQuestions = currentFile.content;
        if (currentFile.isCode) {
          const comments = Utils.extractComments(
              currentFile.content,
              Utils.getFileExtension(currentFile.name)
          );
          if (comments && comments.trim() !== "") {
            contentForQuestions = comments;
          }
        }
        const prompt = `Based on the following document, what are some insightful questions a user might ask?\n\n---\n\n${contentForQuestions}`;

        const result = await this._callLlmApi([
          { role: "user", parts: [{ text: prompt }] },
        ]);

        this.ui.toggleLoader(false);
        if (result.success) {
          this.ui.appendAiOutput("Suggested Questions", result.answer);
          this.ui.showMessage("Suggestions received.", true);
        } else {
          this.ui.appendAiOutput(
              "API Error",
              `Failed to get suggestions. Details: ${result.error}`
          );
          this.ui.showMessage(`Error: ${result.error}`, true);
        }
      },
      onSaveSession: async () => {
        const { ModalManager, FileSystemManager, UserManager } = this.dependencies;
        const filename = await new Promise((resolve) => {
          ModalManager.request({
            context: "graphical",
            type: "input",
            messageLines: ["Save Chidi Session As:"],
            placeholder: `chidi_session_${new Date().toISOString().split("T")[0]}.html`,
            onConfirm: (value) => resolve(value.trim()),
            onCancel: () => resolve(null),
          });
        });
        if (!filename) return;

        const htmlContent = this.ui.packageSessionAsHTML(this.state);
        const absPath = FileSystemManager.getAbsolutePath(filename);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            absPath,
            htmlContent,
            {
              currentUser: UserManager.getCurrentUser().name,
              primaryGroup: UserManager.getPrimaryGroupForUser(
                  UserManager.getCurrentUser().name
              ),
            }
        );
        if (saveResult.success && (await FileSystemManager.save())) {
          this.ui.showMessage(`Session saved to '${filename}'.`, true);
        } else {
          this.ui.showMessage(
              `Error: ${saveResult.error || "Failed to save file system."}`,
              true
          );
        }
      },
      onExport: () => {
        const { Utils } = this.dependencies;
        const htmlContent = this.ui.packageSessionAsHTML(this.state);
        const currentFile = this.state.loadedFiles[this.state.currentIndex];
        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = Utils.createElement("a", {
          href: url,
          download: `${currentFile.name.replace(/\.(md|txt|js|sh)$/, "")}_session.html`,
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.ui.showMessage(`Exported session for ${currentFile.name}.`, true);
      },
      onClose: this.exit.bind(this),
    };
  }
}
