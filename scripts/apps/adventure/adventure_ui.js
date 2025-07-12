const TextAdventureModal = (() => {
  "use strict";

  let state = {
    isModalOpen: false,
    isActive: false,
    inputCallback: null,
    exitPromiseResolve: null
  };

  let elements = {};

  function _createLayout() {
    const roomNameSpan = Utils.createElement('span', { id: 'adventure-room-name' });
    const scoreSpan = Utils.createElement('span', { id: 'adventure-score' });
    const headerLeft = Utils.createElement('div', {}, roomNameSpan);
    const headerRight = Utils.createElement('div', {}, scoreSpan);
    const header = Utils.createElement('header', { id: 'adventure-header' }, headerLeft, headerRight);
    const output = Utils.createElement('div', { id: 'adventure-output' });
    const inputPrompt = Utils.createElement('span', { id: 'adventure-prompt', textContent: '>' });
    const input = Utils.createElement('input', { id: 'adventure-input', type: 'text', spellcheck: 'false', autocapitalize: 'none' });
    const inputContainer = Utils.createElement('div', { id: 'adventure-input-container' }, inputPrompt, input);
    const container = Utils.createElement('div', { id: 'adventure-container' }, header, output, inputContainer);

    elements = { container, header, output, input, roomNameSpan, scoreSpan };
  }

  function _handleInput(e) {
    if (e.key !== 'Enter' || !state.inputCallback) return;
    e.preventDefault();
    const command = elements.input.value;
    elements.input.value = '';
    appendOutput(`> ${command}`, 'system');
    state.inputCallback(command);
  }

  function _setupEventListeners() {
    elements.input.addEventListener('keydown', _handleInput);
    document.addEventListener('keydown', _handleGlobalKeys);
  }

  function _removeEventListeners() {
    if (elements.input) {
      elements.input.removeEventListener('keydown', _handleInput);
    }
    document.removeEventListener('keydown', _handleGlobalKeys);
  }

  function _handleGlobalKeys(e) {
    if (e.key === 'Escape' && state.isModalOpen) {
      // Defer to the AppLayerManager's control flow for hiding.
      // This ensures a consistent exit path.
      callbacks.onExitRequest();
    }
  }

  function show(adventureData, callbacks, scriptingContext) {
    if (state.isModalOpen) return Promise.resolve();

    // Assign callbacks from the manager
    state.callbacks = callbacks;

    _createLayout(); // Build the layout but don't show it yet

    AppLayerManager.show(elements.container); // Use AppLayerManager to show the UI.

    state.isModalOpen = true;
    state.isActive = true;
    state.inputCallback = callbacks.processCommand;

    _setupEventListeners();
    elements.input.focus();

    if (scriptingContext && scriptingContext.isScripting) {
      elements.input.style.display = 'none';
    }

    return new Promise(resolve => {
      state.exitPromiseResolve = resolve;
    });
  }

  function hide() {
    if (!state.isModalOpen) return;
    _removeEventListeners();
    AppLayerManager.hide(); // Use AppLayerManager to hide the UI.
    const resolver = state.exitPromiseResolve;

    // Reset state completely.
    state = {
      isModalOpen: false,
      isActive: false,
      inputCallback: null,
      exitPromiseResolve: null,
      callbacks: {}
    };
    elements = {};

    if (resolver) {
      resolver();
    }
  }

  function appendOutput(text, styleClass = '') {
    if (!elements.output) return;
    const p = Utils.createElement('p', { textContent: text });
    if (styleClass) {
      p.className = `adv-${styleClass}`;
    }
    elements.output.appendChild(p);
    elements.output.scrollTop = elements.output.scrollHeight;
  }

  function requestInput() {
    return new Promise(resolve => {
      const scriptContext = TextAdventureEngine.getScriptingContext();
      if (scriptContext && scriptContext.isScripting) {
        while (scriptContext.currentLineIndex < scriptContext.lines.length - 1) {
          scriptContext.currentLineIndex++;
          const line = scriptContext.lines[scriptContext.currentLineIndex]?.trim();
          if (line && !line.startsWith('#')) {
            appendOutput(`> ${line}`, 'system');
            resolve(line);
            return;
          }
        }
        resolve(null);
      }
    });
  }

  function updateStatusLine(roomName, score, moves) {
    if (elements.roomNameSpan) {
      elements.roomNameSpan.textContent = roomName;
    }
    if (elements.scoreSpan) {
      elements.scoreSpan.textContent = `Score: ${score}  Moves: ${moves}`;
    }
  }

  return {
    show,
    hide,
    appendOutput,
    requestInput,
    updateStatusLine,
    isActive: () => state.isActive
  };
})();