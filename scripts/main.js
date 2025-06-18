// oopisos.js - OopisOS Core

let DOM = {};
function initializeTerminalEventListeners() {
  if (!DOM.terminalDiv || !DOM.editableInputDiv) {
    console.error(
        "Terminal event listeners cannot be initialized: Core DOM elements not found."
    );
    return;
  }
  DOM.terminalDiv.addEventListener("click", (e) => {
    if (EditorManager.isActive()) return;
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    if (
        !e.target.closest("button, a") &&
        (!DOM.editableInputDiv || !DOM.editableInputDiv.contains(e.target))
    ) {
      if (DOM.editableInputDiv.contentEditable === "true")
        TerminalUI.focusInput();
    }
  });
  document.addEventListener("keydown", async (e) => {
    if (EditorManager.isActive() || TextAdventureModal.isActive() || PaintManager.isActive()) {
      return;
    }
    if (ModalInputManager.isAwaiting()) {
      if (ModalInputManager.isObscured()) {
        e.preventDefault();
        if (e.key === "Enter") {
          await ModalInputManager.handleInput();
        } else {
          ModalInputManager.updateInput(
              e.key,
              e.key.length === 1 ? e.key : null
          );
        }
      } else {
        if (e.key === "Enter") {
          e.preventDefault();
          await ModalInputManager.handleInput();
        }
      }
      return;
    }
    if (e.target !== DOM.editableInputDiv) {
      return;
    }
    if (CommandExecutor.isScriptRunning()) {
      e.preventDefault();
      return;
    }
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        TabCompletionManager.resetCycle();
        await CommandExecutor.processSingleCommand(
            TerminalUI.getCurrentInputValue(),
            true
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        const prevCmd = HistoryManager.getPrevious();
        if (prevCmd !== null) {
          TerminalUI.setIsNavigatingHistory(true);
          TerminalUI.setCurrentInputValue(prevCmd, true);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        const nextCmd = HistoryManager.getNext();
        if (nextCmd !== null) {
          TerminalUI.setIsNavigatingHistory(true);
          TerminalUI.setCurrentInputValue(nextCmd, true);
        }
        break;
      case "Tab":
        e.preventDefault();
        const currentInput = TerminalUI.getCurrentInputValue();
        const sel = window.getSelection();
        let cursorPos = 0;
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (
              DOM.editableInputDiv &&
              DOM.editableInputDiv.contains(range.commonAncestorContainer)
          ) {
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(DOM.editableInputDiv);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            cursorPos = preCaretRange.toString().length;
          } else {
            cursorPos = currentInput.length;
          }
        } else {
          cursorPos = currentInput.length;
        }
        const result = TabCompletionManager.handleTab(currentInput, cursorPos);
        if (
            result?.textToInsert !== null &&
            result.textToInsert !== undefined
        ) {
          TerminalUI.setCurrentInputValue(result.textToInsert, false);
          TerminalUI.setCaretPosition(
              DOM.editableInputDiv,
              result.newCursorPos
          );
        }
        break;
    }
  });
  if (DOM.editableInputDiv) {
    DOM.editableInputDiv.addEventListener("paste", (e) => {
      e.preventDefault();
      if (DOM.editableInputDiv.contentEditable !== "true") return;

      const text = (e.clipboardData || window.clipboardData).getData(
          "text/plain"
      );
      const processedText = text.replace(/\r?\n|\r/g, " ");

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);

      if (!DOM.editableInputDiv.contains(range.commonAncestorContainer)) return;

      range.deleteContents();

      const textNode = document.createTextNode(processedText);
      range.insertNode(textNode);

      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    });
    DOM.editableInputDiv.addEventListener("input", (e) => {
      if (e.isTrusted) {
        TabCompletionManager.resetCycle();
      }
    });
  }
}
window.onload = async () => {
  DOM = {
    terminalBezel: document.getElementById("terminal-bezel"),
    terminalDiv: document.getElementById("terminal"),
    outputDiv: document.getElementById("output"),
    inputLineContainerDiv: document.querySelector(".input-line-container"),
    promptUserSpan: document.getElementById("prompt-user"),
    promptHostSpan: document.getElementById("prompt-host"),
    promptPathSpan: document.getElementById("prompt-path"),
    promptCharSpan: document.getElementById("prompt-char"),
    editableInputContainer: document.getElementById("editable-input-container"),
    editableInputDiv: document.getElementById("editable-input"),
    adventureModal: document.getElementById("adventure-modal"),
    adventureInput: document.getElementById("adventure-input"),
  };

  OutputManager.initializeConsoleOverrides();
  try {
    await IndexedDBManager.init();
    await FileSystemManager.load();
    await UserManager.initializeDefaultUsers();
    await Config.loadFromFile();
    GroupManager.initialize();
    AliasManager.initialize();
    EnvironmentManager.initialize();

    SessionManager.loadAutomaticState(Config.USER.DEFAULT_NAME);

    const guestHome = `/home/${Config.USER.DEFAULT_NAME}`;
    if (!FileSystemManager.getNodeByPath(FileSystemManager.getCurrentPath())) {
      if (FileSystemManager.getNodeByPath(guestHome)) {
        FileSystemManager.setCurrentPath(guestHome);
      } else {
        FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
      }
    }

    initializeTerminalEventListeners();
    TerminalUI.updatePrompt();
    TerminalUI.focusInput();
    console.log(
        `${Config.OS.NAME} v.${Config.OS.VERSION} loaded successfully!`
    );
  } catch (error) {
    console.error(
        "Failed to initialize OopisOs on window.onload:",
        error,
        error.stack
    );
    if (DOM.outputDiv) {
      DOM.outputDiv.innerHTML += `<div class="text-red-500">FATAL ERROR: ${error.message}. Check console for details.</div>`;
    }
  }
};