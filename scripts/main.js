/**
 * @file This is the main entry point for OopisOS. It handles the initial boot sequence,
 * caches essential DOM elements, and sets up the primary terminal event listeners.
 * @author Andrew Edmark
 * @author Gemini
 */

/**
 * A global object to cache frequently accessed DOM elements.
 * This improves performance by reducing the number of `getElementById` or `querySelector` calls.
 * @type {Object.<string, HTMLElement|null>}
 */
let DOM = {};

/**
 * Sets up the core event listeners for the terminal, enabling user interaction.
 * This includes handling clicks for focus, key presses for commands, command history,
 * tab completion, and pasting text.
 */
function initializeTerminalEventListeners() {
  if (!DOM.terminalDiv || !DOM.editableInputDiv) {
    console.error(
        "Terminal event listeners cannot be initialized: Core DOM elements not found."
    );
    return;
  }

  // Focus the input area when the terminal is clicked, unless text is being selected.
  DOM.terminalDiv.addEventListener("click", (e) => {
    // REFACTORED: Use the central AppLayerManager to check if any app is active.
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

  // Main keyboard input handler for the entire document.
  document.addEventListener("keydown", async (e) => {
    // HIGHEST PRIORITY: Check if a modal input is actively waiting for an Enter key.
    if (ModalInputManager.isAwaiting()) {
      if (e.key === 'Enter') {
        e.preventDefault();
        await ModalInputManager.handleInput();
      } else if (ModalInputManager.isObscured()) {
        e.preventDefault();
        ModalInputManager.updateInput(
            e.key,
            e.key.length === 1 ? e.key : null
        );
      }
      return;
    }

    // SECOND PRIORITY: If a full-screen app is running, let it handle its own keys.
    if (AppLayerManager.isActive()) {
      return; // Let the active app handle its own keyboard events.
    }
    // Ignore key events not targeting the main input div.
    if (e.target !== DOM.editableInputDiv) {
      return;
    }

    // Prevent user input while a script is running.
    if (CommandExecutor.isScriptRunning()) {
      e.preventDefault();
      return;
    }

    // Handle special key presses for terminal functionality.
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        TabCompletionManager.resetCycle();
        await CommandExecutor.processSingleCommand(
            TerminalUI.getCurrentInputValue(),
            { isInteractive: true }
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

  // Handle pasting text into the input area, sanitizing newlines.
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

    // Reset tab completion cycle on any manual input.
    DOM.editableInputDiv.addEventListener("input", (e) => {
      if (e.isTrusted) {
        TabCompletionManager.resetCycle();
      }
    });
  }
}

/**
 * The main entry point for the OopisOS application. This function serves as the
 * "bootloader" for the OS, initializing all managers in the correct order,
 * loading data from storage, and setting up the UI for interaction.
 * @async
 */
window.onload = async () => {
  // Cache all necessary DOM elements for performance.
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

  // Override console methods to output to the terminal display.
  OutputManager.initializeConsoleOverrides();

  try {
    // Begin the OS boot sequence. Order is important here.
    await IndexedDBManager.init();
    await FileSystemManager.load();
    await UserManager.initializeDefaultUsers();
    await Config.loadFromFile();
    GroupManager.initialize();
    AliasManager.initialize();
    EnvironmentManager.initialize();
    SessionManager.initializeStack();

    // Initialize the command executor, which now only sets up its core functions.
    CommandExecutor.initialize();

    // Load the initial user's session state.
    SessionManager.loadAutomaticState(Config.USER.DEFAULT_NAME);

    // Ensure the current path is valid after loading.
    const guestHome = `/home/${Config.USER.DEFAULT_NAME}`;
    if (!FileSystemManager.getNodeByPath(FileSystemManager.getCurrentPath())) {
      if (FileSystemManager.getNodeByPath(guestHome)) {
        FileSystemManager.setCurrentPath(guestHome);
      } else {
        FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
      }
    }

    // Finalize UI setup and event listeners.
    initializeTerminalEventListeners();
    TerminalUI.updatePrompt();
    TerminalUI.focusInput();
    console.log(
        `${Config.OS.NAME} v.${Config.OS.VERSION} loaded successfully!`
    );

    const resizeObserver = new ResizeObserver(entries => {
      // Re-enabled: The dynamic, aspect-ratio-locked canvas requires this.
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