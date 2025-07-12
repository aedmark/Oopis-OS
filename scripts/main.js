// aedmark/oopis-os-dev/Oopis-OS-DEV-e5518cea540819416617bfa81def39b31b5d26d1/scripts/main.js
let DOM = {};

function initializeTerminalEventListeners() {
  if (!DOM.terminalDiv || !DOM.editableInputDiv) {
    console.error(
        "Terminal event listeners cannot be initialized: Core DOM elements not found."
    );
    return;
  }

  DOM.terminalDiv.addEventListener("click", (e) => {
    if (AppLayerManager.isActive()) return;

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
    if (ModalInputManager.isAwaiting()) {
      if (e.key === 'Enter') {
        e.preventDefault();
        await ModalInputManager.handleInput();
      } else if (ModalInputManager.isObscured()) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        } else {
          e.preventDefault();
          ModalInputManager.updateInput(
              e.key,
              e.key.length === 1 ? e.key : null
          );
        }
      }
      return;
    }

    if (AppLayerManager.isActive()) {
      return;
    }

    if (e.target !== DOM.editableInputDiv) {
      return;
    }

    // This block was removed as it is now handled by the CommandExecutor and run command logic.
    // if (CommandExecutor.isScriptRunning()) {
    //   e.preventDefault();
    //   return;
    // }

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        TabCompletionManager.resetCycle();
        await CommandExecutor.processSingleCommand(
            TerminalUI.getCurrentInputValue(),
            {isInteractive: true}
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
        const result = await TabCompletionManager.handleTab(currentInput, cursorPos);
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
      e.preventDefault(); // Always prevent default native paste to control it.
      if (DOM.editableInputDiv.contentEditable !== "true") return;

      const text = (e.clipboardData || window.clipboardData).getData("text/plain");
      const processedText = text.replace(/\r?\n|\r/g, " ");

      if (ModalInputManager.isAwaiting() && ModalInputManager.isObscured()) {
        ModalInputManager.handlePaste(processedText);
      } else {
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
      }
    });
  }
}

window.onload = async () => {
  DOM = {
    terminalBezel: document.getElementById("terminal-bezel"),
    terminalDiv: document.getElementById("terminal"),
    outputDiv: document.getElementById("output"),
    inputLineContainerDiv: document.querySelector(".terminal__input-line"),
    promptContainer: document.getElementById("prompt-container"),
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
    SessionManager.initializeStack();

    CommandExecutor.initialize();

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

    const resizeObserver = new ResizeObserver(_entries => {
      if (typeof PaintManager !== 'undefined' && PaintManager.isActive()) {
        if (typeof PaintUI !== 'undefined' && typeof PaintUI.handleResize === 'function') {
          PaintUI.handleResize();
        }
      }
    });

    if (DOM.terminalDiv) {
      resizeObserver.observe(DOM.terminalDiv);
    }

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