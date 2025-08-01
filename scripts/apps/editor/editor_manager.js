/**
 * Text editor application manager with syntax highlighting and preview support
 * @extends App
 */
window.EditorManager = class EditorManager extends App {
  /**
   * Initialize editor manager with default state
   */
  constructor() {
    super();
    this.state = {};
    this.dependencies = {};
    this._debouncedHighlight = null;
    this.callbacks = {};
    this.ui = null;
  }

  /**
   * Get current text selection in element
   * @param {HTMLElement} element - Text element
   * @returns {Object} Selection with start and end positions
   * @private
   */
  _getSelection(element) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return { start: 0, end: 0 };
    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(element);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    return {
      start: start,
      end: start + range.toString().length,
    };
  }

  /**
   * Set text selection in element
   * @param {HTMLElement} element - Text element
   * @param {Object} offset - Selection offset with start and end
   * @private
   */
  _setSelection(element, offset) {
    const range = document.createRange();
    const sel = window.getSelection();
    let charCount = 0;
    let foundNode = false;

    function findTextNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharCount = charCount + node.length;
        if (!foundNode && offset.start >= charCount && offset.start <= nextCharCount) {
          range.setStart(node, offset.start - charCount);
          foundNode = true;
        }
        if (foundNode && offset.end >= charCount && offset.end <= nextCharCount) {
          range.setEnd(node, offset.end - charCount);
          return true;
        }
        charCount = nextCharCount;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (findTextNode(node.childNodes[i])) {
            return true;
          }
        }
      }
      return false;
    }

    findTextNode(element);
    if (sel && foundNode) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  /**
   * Apply JavaScript syntax highlighting to text
   * @param {string} text - Text to highlight
   * @returns {string} HTML with syntax highlighting
   * @private
   */
  _jsHighlighter(text) {
    const escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return escapedText
        .replace(/(\/\*[\s\S]*?\*\/|\/\/.+)/g, "<em>$1</em>")
        .replace(/\b(new|if|else|do|while|switch|for|in|of|continue|break|return|typeof|function|var|const|let|async|await|class|extends|true|false|null)(?=[^\w])/g, "<strong>$1</strong>")
        .replace(/(".*?"|'.*?'|`.*?`)/g, "<strong><em>$1</em></strong>")
        .replace(/\b(\d+)/g, "<em><strong>$1</strong></em>");
  }

  /**
   * Update content with syntax highlighting and preview
   * @param {HTMLElement} element - Text element to update
   * @private
   */
  // Import DOMPurify for sanitizing HTML
  // DOMPurify is a library that sanitizes HTML and prevents XSS attacks

  _updateContent(element) {
    if (this.state.fileMode === 'code') {
      const selection = this._getSelection(element);
      const text = element.textContent || "";
      element.innerHTML = DOMPurify.sanitize(this._jsHighlighter(text));
      this._setSelection(element, selection);
    }
    if (this.state.viewMode !== "edit") {
      this.ui.renderPreview(element.textContent || "", this.state.fileMode);
    }
  }


  /**
   * Initialize and display the editor
   * @param {HTMLElement} appLayer - Container element
   * @param {Object} options - Configuration options
   */
  enter(appLayer, options = {}) {
    const { filePath, fileContent, onSaveCallback, dependencies } = options;
    this.dependencies = dependencies;
    this.callbacks = this._createCallbacks();

    this._debouncedPushUndo = this.dependencies.Utils.debounce((content) => {
      if (!this.isActive) return;
      this.state.undoStack.push(content);
      if (this.state.undoStack.length > 50) {
        this.state.undoStack.shift();
      }
      this.state.redoStack = [];
    }, 500);

    const normalizedContent = (fileContent || "").replace(/\r\n|\r/g, "\n");

    this.state = {
      currentFilePath: filePath,
      originalContent: normalizedContent,
      isDirty: false,
      fileMode: this._getFileMode(filePath),
      viewMode: "split",
      undoStack: [normalizedContent],
      redoStack: [],
      wordWrap: this.dependencies.StorageManager.loadItem(
          this.dependencies.Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED,
          "Editor Word Wrap",
          false
      ),
      onSaveCallback: onSaveCallback || null,
    };

    this.isActive = true;

    this.ui = new this.dependencies.EditorUI({ ...this.state, currentContent: normalizedContent }, this.callbacks, this.dependencies);
    this.container = this.ui.elements.container;

    appLayer.appendChild(this.container);
    this.container.focus();

    this._updateContent(this.ui.elements.textarea);
  }

  /**
   * Exit editor with unsaved changes confirmation
   * @returns {Promise<void>}
   */
  async exit() {
    if (!this.isActive) return;

    if (this.state.isDirty) {
      await new Promise((resolve) => {
        this.dependencies.ModalManager.request({
          context: "graphical",
          type: "confirm",
          messageLines: [
            "You have unsaved changes that will be lost.",
            "Are you sure you want to exit?",
          ],
          confirmText: "Discard Changes",
          cancelText: "Cancel",
          onConfirm: () => {
            this._performExit();
            resolve();
          },
          onCancel: () => resolve(),
        });
      });
    } else {
      this._performExit();
    }
  }

  /**
   * Perform actual exit cleanup
   * @private
   */
  _performExit() {
    this.ui.hideAndReset();
    this.dependencies.AppLayerManager.hide(this);
    this.isActive = false;
    this.state = {};
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {Promise<void>}
   */
  async handleKeyDown(event) {
    if (!this.isActive) return;

    if (event.ctrlKey || event.metaKey) {
      let handled = true;
      switch (event.key.toLowerCase()) {
        case "s":
          await this.callbacks.onSaveRequest();
          break;
        case "o":
          await this.exit();
          break;
        case "p":
          this.callbacks.onTogglePreview();
          break;
        case "z":
          event.shiftKey ? this.callbacks.onRedo() : this.callbacks.onUndo();
          break;
        case "y":
          this.callbacks.onRedo();
          break;
        default:
          handled = false;
          break;
      }
      if (handled) event.preventDefault();
    } else if (event.key === "Escape") {
      event.preventDefault();
      await this.exit();
    }
  }

  /**
   * Determine file mode based on extension
   * @param {string} filePath - File path
   * @returns {string} File mode (text, markdown, html, code)
   * @private
   */
  _getFileMode(filePath) {
    const { Utils } = this.dependencies;
    if (!filePath) return "text";
    const extension = Utils.getFileExtension(filePath);
    const codeExtensions = ["js", "sh", "css", "json"];
    if (extension === "md") return "markdown";
    if (extension === "html") return "html";
    if (codeExtensions.includes(extension)) return "code";
    return "text";
  }

  /**
   * Create callback functions for UI interactions
   * @returns {Object} Callback functions
   * @private
   */
  _createCallbacks() {
    return {
      onContentChange: (element) => {
        const newContent = element.textContent || "";
        this.state.isDirty = newContent !== this.state.originalContent;
        this.ui.updateDirtyStatus(this.state.isDirty);
        this._debouncedPushUndo(newContent);
        this._updateContent(element);
      },
      onSaveRequest: async () => {
        const { ModalManager, FileSystemManager, UserManager } = this.dependencies;
        let savePath = this.state.currentFilePath;
        if (!savePath) {
          savePath = await new Promise((resolve) => {
            ModalManager.request({
              context: "graphical",
              type: "input",
              messageLines: ["Save New File"],
              placeholder: "/home/Guest/untitled.txt",
              onConfirm: (value) => resolve(value),
              onCancel: () => resolve(null),
            });
          });
          if (!savePath) {
            this.ui.updateStatusMessage("Save cancelled.");
            return;
          }
          this.state.currentFilePath = savePath;
          this.state.fileMode = this._getFileMode(savePath);
          this.ui.updateWindowTitle(savePath);
        }

        const currentContent = this.ui.elements.textarea.textContent || "";
        const saveResult = await FileSystemManager.createOrUpdateFile(
            savePath,
            currentContent,
            {
              currentUser: UserManager.getCurrentUser().name,
              primaryGroup: UserManager.getPrimaryGroupForUser(
                  UserManager.getCurrentUser().name
              ),
            }
        );
        if (saveResult.success && (await FileSystemManager.save())) {
          this.state.originalContent = currentContent;
          this.state.isDirty = false;
          this.ui.updateDirtyStatus(false);
          this.ui.updateStatusMessage(`File saved to ${savePath}`);
          if (typeof this.state.onSaveCallback === "function") {
            await this.state.onSaveCallback(savePath);
          }
        } else {
          this.ui.updateStatusMessage(
              `Error: ${saveResult.error || "Failed to save file system."}`
          );
        }
      },
      onExitRequest: this.exit.bind(this),
      onTogglePreview: () => {
        const modes = ["split", "edit", "preview"];
        this.state.viewMode =
            this.state.fileMode === "text"
                ? "edit"
                : modes[(modes.indexOf(this.state.viewMode) + 1) % modes.length];
        this.ui.setViewMode(
            this.state.viewMode,
            this.state.fileMode,
            this.ui.elements.textarea.textContent || ""
        );
      },
      onUndo: () => {
        if (this.state.undoStack.length > 1) {
          this.state.redoStack.push(this.state.undoStack.pop());
          const content = this.state.undoStack[this.state.undoStack.length - 1];
          this.ui.setContent(content);
          this._updateContent(this.ui.elements.textarea);
        }
      },
      onRedo: () => {
        if (this.state.redoStack.length > 0) {
          const nextState = this.state.redoStack.pop();
          this.state.undoStack.push(nextState);
          this.ui.setContent(nextState);
          this._updateContent(this.ui.elements.textarea);
        }
      },
      onWordWrapToggle: () => {
        const { StorageManager, Config } = this.dependencies;
        this.state.wordWrap = !this.state.wordWrap;
        StorageManager.saveItem(
            Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED,
            this.state.wordWrap
        );
        this.ui.setWordWrap(this.state.wordWrap);
      },
    };
  }
}
