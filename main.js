// scripts/main.js

function initializeTerminalEventListeners(domElements, commandExecutor, dependencies) {
  const { AppLayerManager, ModalManager, TerminalUI, TabCompletionManager, HistoryManager, SoundManager } = dependencies;

  if (!domElements.terminalDiv || !domElements.editableInputDiv) {
    console.error(
        "Terminal event listeners cannot be initialized: Core DOM elements not found."
    );
    return;
  }

  domElements.terminalDiv.addEventListener("click", (e) => {
    if (AppLayerManager.isActive()) return;

    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    if (
        !e.target.closest("button, a") &&
        (!domElements.editableInputDiv ||
            !domElements.editableInputDiv.contains(e.target))
    ) {
      if (domElements.editableInputDiv.contentEditable === "true")
        TerminalUI.focusInput();
    }
  });

  document.addEventListener("keydown", async (e) => {
    if (ModalManager.isAwaiting()) {
      if (e.key === "Enter") {
        e.preventDefault();
        await ModalManager.handleTerminalInput(
            TerminalUI.getCurrentInputValue()
        );
      } else if (TerminalUI.isObscured()) {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          TerminalUI.updateInputForObscure(e.key);
        } else if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          TerminalUI.updateInputForObscure(e.key);
        }
      }
      return;
    }

    if (AppLayerManager.isActive()) {
      return;
    }

    if (e.target !== domElements.editableInputDiv) {
      return;
    }

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (!SoundManager.isInitialized) {
          await SoundManager.initialize();
        }
        TabCompletionManager.resetCycle();
        await commandExecutor.processSingleCommand(
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
              domElements.editableInputDiv &&
              domElements.editableInputDiv.contains(range.commonAncestorContainer)
          ) {
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(domElements.editableInputDiv);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            cursorPos = preCaretRange.toString().length;
          } else {
            cursorPos = currentInput.length;
          }
        } else {
          cursorPos = currentInput.length;
        }
        const result = await TabCompletionManager.handleTab(
            currentInput,
            cursorPos
        );
        if (
            result?.textToInsert !== null &&
            result.textToInsert !== undefined
        ) {
          TerminalUI.setCurrentInputValue(result.textToInsert, false);
          TerminalUI.setCaretPosition(
              domElements.editableInputDiv,
              result.newCursorPos
          );
        }
        break;
    }
  });

  if (domElements.editableInputDiv) {
    domElements.editableInputDiv.addEventListener("paste", (e) => {
      e.preventDefault();
      if (domElements.editableInputDiv.contentEditable !== "true") return;
      const text = (e.clipboardData || window.clipboardData).getData(
          "text/plain"
      );
      const processedText = text.replace(/\r?\n|\r/g, " ");
      TerminalUI.handlePaste(processedText);
    });
  }
}

window.onload = async () => {
  const domElements = {
    terminalBezel: document.getElementById("terminal-bezel"),
    terminalDiv: document.getElementById("terminal"),
    outputDiv: document.getElementById("output"),
    inputLineContainerDiv: document.querySelector(".terminal__input-line"),
    promptContainer: document.getElementById("prompt-container"),
    editableInputContainer: document.getElementById("editable-input-container"),
    editableInputDiv: document.getElementById("editable-input"),
    appLayer: document.getElementById("app-layer"),
  };

  // Instantiate all manager classes
  const configManager = new ConfigManager();
  const storageManager = new StorageManager();
  const indexedDBManager = new IndexedDBManager();
  const groupManager = new GroupManager();
  const fsManager = new FileSystemManager(configManager);
  const sessionManager = new SessionManager();
  const sudoManager = new SudoManager();
  const environmentManager = new EnvironmentManager();
  const commandExecutor = new CommandExecutor();
  const messageBusManager = new MessageBusManager();
  const outputManager = new OutputManager();
  const terminalUI = new TerminalUI();
  const modalManager = new ModalManager();
  const appLayerManager = new AppLayerManager();
  const aliasManager = new AliasManager();
  const historyManager = new HistoryManager();
  const tabCompletionManager = new TabCompletionManager();
  const uiComponents = new UIComponents();
  const aiManager = new AIManager();
  const commandRegistry = new CommandRegistry();
  window.CommandRegistry = commandRegistry;
  const networkManager = new NetworkManager();
  const soundManager = new SoundManager();
  const storageHAL = new IndexedDBStorageHAL();

  const dependencies = {
    Config: configManager,
    StorageManager: storageManager,
    IndexedDBManager: indexedDBManager,
    FileSystemManager: fsManager,
    UserManager: null,
    SessionManager: sessionManager,
    CommandExecutor: commandExecutor,
    SudoManager: sudoManager,
    GroupManager: groupManager,
    EnvironmentManager: environmentManager,
    OutputManager: outputManager,
    TerminalUI: terminalUI,
    ModalManager: modalManager,
    AppLayerManager: appLayerManager,
    AliasManager: aliasManager,
    HistoryManager: historyManager,
    TabCompletionManager: tabCompletionManager,
    Utils: Utils,
    ErrorHandler: ErrorHandler,
    Lexer: Lexer,
    Parser: Parser,
    CommandRegistry: commandRegistry,
    TimestampParser: TimestampParser,
    DiffUtils: DiffUtils,
    PatchUtils: PatchUtils,
    AIManager: aiManager,
    MessageBusManager: messageBusManager,
    NetworkManager: networkManager,
    UIComponents: uiComponents,
    domElements: domElements,
    SoundManager: soundManager,
    StorageHAL: storageHAL,
  };

  const userManager = new UserManager(dependencies);
  dependencies.UserManager = userManager;

  const pagerManager = new PagerManager(dependencies);
  dependencies.PagerManager = pagerManager;

  configManager.setDependencies(dependencies);
  storageManager.setDependencies(dependencies);
  indexedDBManager.setDependencies(dependencies);
  fsManager.setDependencies(dependencies);
  userManager.setDependencies(sessionManager, sudoManager, commandExecutor, modalManager);
  sessionManager.setDependencies(dependencies);
  sudoManager.setDependencies(fsManager, groupManager, configManager);
  environmentManager.setDependencies(userManager, fsManager, configManager);
  commandExecutor.setDependencies(dependencies);
  groupManager.setDependencies(dependencies);
  outputManager.setDependencies(dependencies);
  terminalUI.setDependencies(dependencies);
  modalManager.setDependencies(dependencies);
  appLayerManager.setDependencies(dependencies);
  aliasManager.setDependencies(dependencies);
  historyManager.setDependencies(dependencies);
  tabCompletionManager.setDependencies(dependencies);
  uiComponents.setDependencies(dependencies);
  aiManager.setDependencies(dependencies);
  networkManager.setDependencies(dependencies);
  storageHAL.setDependencies(dependencies);

  try {
    outputManager.initialize(domElements);
    terminalUI.initialize(domElements);
    modalManager.initialize(domElements);
    appLayerManager.initialize(domElements);
    await storageHAL.init();
    aliasManager.initialize();
    outputManager.initializeConsoleOverrides();
    await fsManager.load();
    await userManager.initializeDefaultUsers();
    await configManager.loadFromFile();
    await configManager.loadPackageManifest();
    groupManager.initialize();
    environmentManager.initialize();
    sessionManager.initializeStack();
    sessionManager.loadAutomaticState(configManager.USER.DEFAULT_NAME);

    // After loading state, clear the screen and show a fresh welcome message for a clean boot experience.
    outputManager.clearOutput();
    await outputManager.appendToOutput(
        `${configManager.MESSAGES.WELCOME_PREFIX} ${userManager.getCurrentUser().name}${configManager.MESSAGES.WELCOME_SUFFIX}`
    );


    const guestHome = `/home/${configManager.USER.DEFAULT_NAME}`;
    if (!fsManager.getNodeByPath(fsManager.getCurrentPath())) {
      fsManager.setCurrentPath(
          fsManager.getNodeByPath(guestHome)
              ? guestHome
              : configManager.FILESYSTEM.ROOT_PATH
      );
    }

    initializeTerminalEventListeners(domElements, commandExecutor, dependencies);

    terminalUI.updatePrompt();
    terminalUI.focusInput();
    console.log(
        `${configManager.OS.NAME} v.${configManager.OS.VERSION} loaded successfully!`
    );

  } catch (error) {
    console.error(
        "Failed to initialize OopisOs on window.onload:",
        error,
        error.stack
    );
    if (domElements.outputDiv) {
      domElements.outputDiv.innerHTML += `<div class="text-error">FATAL ERROR: ${error.message}. Check console for details.</div>`;
    }
  }
};