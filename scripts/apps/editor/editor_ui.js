// scripts/apps/editor/editor_ui.js

window.EditorUI = class EditorUI {
  constructor(initialState, callbacks, deps) {
    this.elements = {};
    this.managerCallbacks = callbacks;
    this.dependencies = deps;
    this.buildAndShow(initialState);
  }

  buildAndShow(initialState) {
    const { Utils, UIComponents } = this.dependencies;

    const appWindow = UIComponents.createAppWindow('Text Editor', () => this.managerCallbacks.onExitRequest());
    this.elements.container = appWindow.container;
    this.elements.main = appWindow.main;
    this.elements.footer = appWindow.footer;

    this.elements.container.id = 'text-editor-app-container';

    this.elements.titleInput = Utils.createElement("input", {
      id: "editor-title",
      className: "editor-title-input",
      type: "text",
      value: initialState.currentFilePath || "Untitled",
    });

    this.elements.saveBtn = UIComponents.createButton({ icon: "💾", text: "Save", onClick: () => this.managerCallbacks.onSaveRequest() });
    this.elements.exitBtn = UIComponents.createButton({ text: "Exit", onClick: () => this.managerCallbacks.onExitRequest() });
    this.elements.previewBtn = UIComponents.createButton({ icon: "👁️", text: "View", onClick: () => this.managerCallbacks.onTogglePreview() });
    this.elements.undoBtn = UIComponents.createButton({ icon: "↩", text: "Undo", onClick: () => this.managerCallbacks.onUndo() });
    this.elements.redoBtn = UIComponents.createButton({ icon: "↪", text: "Redo", onClick: () => this.managerCallbacks.onRedo() });
    this.elements.wordWrapBtn = UIComponents.createButton({ text: "Wrap", onClick: () => this.managerCallbacks.onWordWrapToggle() });

    const toolbarGroup = Utils.createElement(
        "div",
        { className: "editor-toolbar-group" },
        [
          this.elements.previewBtn,
          this.elements.wordWrapBtn,
          this.elements.undoBtn,
          this.elements.redoBtn,
          this.elements.saveBtn,
          this.elements.exitBtn,
        ]
    );
    const toolbar = Utils.createElement(
        "div",
        { className: "editor-toolbar" },
        [toolbarGroup]
    );

    this.elements.textarea = Utils.createElement("pre", {
      id: "editor-textarea",
      className: "editor-textarea",
      contenteditable: "true",
      spellcheck: "false",
      autocapitalize: "none",
      textContent: initialState.currentContent,
    });

    this.elements.preview = Utils.createElement("div", {
      id: "editor-preview",
      className: "editor-preview",
    });

    const editorMainContent = Utils.createElement(
        "div",
        { className: "editor-main-content" },
        [this.elements.textarea, this.elements.preview]
    );

    this.elements.main.append(this.elements.titleInput, toolbar, editorMainContent);

    this.elements.dirtyStatus = Utils.createElement("span", { id: "editor-dirty-status" });
    this.elements.statusMessage = Utils.createElement("span", { id: "editor-status-message" });
    this.elements.footer.append(this.elements.dirtyStatus, this.elements.statusMessage);

    this._addEventListeners();
    this.updateDirtyStatus(initialState.isDirty);
    this.updateWindowTitle(initialState.currentFilePath);
    this.setWordWrap(initialState.wordWrap);
    this.setViewMode(
        initialState.viewMode,
        initialState.fileMode,
        initialState.currentContent
    );

    this.elements.textarea.focus();
  }

  renderPreview(content, mode) {
    if (!this.elements.preview) return;

    if (mode === "markdown") {
      this.elements.preview.innerHTML = DOMPurify.sanitize(marked.parse(content));
    } else if (mode === "html") {
      let iframe = this.elements.preview.querySelector("iframe");
      if (!iframe) {
        iframe = this.dependencies.Utils.createElement("iframe", {
          style: "width: 100%; height: 100%; border: none;",
        });
        this.elements.preview.innerHTML = "";
        this.elements.preview.appendChild(iframe);
      }

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(DOMPurify.sanitize(content));
      iframeDoc.close();
    }
  }

  setViewMode(viewMode, fileMode, content) {
    const editorMainContent = this.elements.main.querySelector('.editor-main-content');
    if (!this.elements.preview || !this.elements.textarea || !editorMainContent) return;

    this.elements.previewBtn.disabled = fileMode === "text" || fileMode === "code";

    if (fileMode === "text" || fileMode === "code") {
      viewMode = "edit";
    }

    editorMainContent.classList.remove("editor-main--split", "editor-main--full");
    this.elements.textarea.classList.remove("hidden");
    this.elements.preview.classList.remove("hidden");

    switch (viewMode) {
      case "edit":
        editorMainContent.classList.add("editor-main--full");
        this.elements.preview.classList.add("hidden");
        break;
      case "preview":
        editorMainContent.classList.add("editor-main--full");
        this.elements.textarea.classList.add("hidden");
        this.renderPreview(content, fileMode);
        break;
      case "split":
      default:
        editorMainContent.classList.add("editor-main--split");
        this.renderPreview(content, fileMode);
        break;
    }
  }

  hideAndReset() {
    this.elements = {};
    this.managerCallbacks = {};
  }

  updateDirtyStatus(isDirty) {
    if (this.elements.dirtyStatus) {
      this.elements.dirtyStatus.textContent = isDirty ? "UNSAVED" : "SAVED";
      this.elements.dirtyStatus.style.color = isDirty
          ? "var(--color-warning)"
          : "var(--color-success)";
    }
  }

  updateWindowTitle(filePath) {
    if (this.elements.titleInput) {
      this.elements.titleInput.value = filePath || "Untitled";
    }
  }

  updateStatusMessage(message) {
    if (this.elements.statusMessage) {
      this.elements.statusMessage.textContent = message;
      setTimeout(() => {
        if (this.elements.statusMessage) this.elements.statusMessage.textContent = "";
      }, 3000);
    }
  }

  setContent(content) {
    if (this.elements.textarea) {
      this.elements.textarea.textContent = content;
    }
  }

  setWordWrap(enabled) {
    if (this.elements.textarea) {
      this.elements.textarea.classList.toggle("word-wrap-enabled", enabled);
      if (this.elements.wordWrapBtn) {
        this.elements.wordWrapBtn.classList.toggle("active", enabled);
      }
    }
  }

  _addEventListeners() {
    this.elements.textarea.addEventListener("input", () => {
      this.managerCallbacks.onContentChange(this.elements.textarea);
    });

    this.elements.textarea.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text);
    });
  }
}
