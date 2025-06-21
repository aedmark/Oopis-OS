/**
 * @file Manages the entire lifecycle and functionality of the OopisOS full-screen text editor.
 * @author Andrew Edmark
 * @author Gemini
 * @see EditorManager
 */

/* global marked, Utils, DOM, Config, FileSystemManager, OutputManager, TerminalUI, UserManager, ModalManager, StorageManager */

/**
 * @module EditorAppConfig
 * @description Provides a centralized configuration object for the editor application.
 * This includes constants for editor behavior, storage keys, and CSS class names.
 */
const EditorAppConfig = {
  /**
   * @property {object} EDITOR - Configuration settings specific to the editor's behavior.
   * @property {number} EDITOR.DEBOUNCE_DELAY_MS - Delay in milliseconds for debouncing preview rendering.
   * @property {string} EDITOR.TAB_REPLACEMENT - The string to insert when the Tab key is pressed.
   * @property {string} EDITOR.CTRL_S_ACTION - Action identifier for the Ctrl+S key combination.
   * @property {string} EDITOR.CTRL_O_ACTION - Action identifier for the Ctrl+O key combination.
   * @property {string} EDITOR.CTRL_P_ACTION - Action identifier for the Ctrl+P key combination.
   * @property {string} EDITOR.DEFAULT_MODE - The default editor mode if none can be determined from the file extension.
   * @property {object} EDITOR.MODES - Enumeration of available editor modes.
   * @property {object} EDITOR.EXTENSIONS_MAP - A map of file extensions to their corresponding editor modes.
   * @property {object} EDITOR.VIEW_MODES - Enumeration of available view modes (split, edit-only, preview-only).
   * @property {boolean} EDITOR.WORD_WRAP_DEFAULT_ENABLED - The default state for word wrap.
   * @property {string} EDITOR.FORMATTING_TOOLBAR_ID - The DOM ID for the formatting toolbar.
   */
  EDITOR: {
    DEBOUNCE_DELAY_MS: 250,
    TAB_REPLACEMENT: "    ",
    CTRL_S_ACTION: "save_exit",
    CTRL_O_ACTION: "exit_no_save",
    CTRL_P_ACTION: "toggle_preview",
    DEFAULT_MODE: "text",
    MODES: {
      TEXT: "text",
      MARKDOWN: "markdown",
      HTML: "html",
    },
    EXTENSIONS_MAP: {
      md: "markdown",
      html: "html",
      htm: "html",
      sh: "text",
      js: "text",
      css: "text",
    },
    VIEW_MODES: {
      SPLIT: "split",
      EDIT_ONLY: "edit",
      PREVIEW_ONLY: "preview",
    },
    WORD_WRAP_DEFAULT_ENABLED: false,
    FORMATTING_TOOLBAR_ID: "editor-formatting-toolbar",
  },
  /**
   * @property {object} STORAGE_KEYS - Keys used for storing editor settings in localStorage.
   * @property {string} STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED - Key for the word wrap setting.
   */
  STORAGE_KEYS: {
    EDITOR_WORD_WRAP_ENABLED: "oopisOsEditorWordWrapEnabled",
  },
  /**
   * @property {object} CSS_CLASSES - CSS class names used for styling the editor UI.
   * @property {string} CSS_CLASSES.EDITOR_MSG - Class for editor-related messages in the terminal.
   * @property {string} CSS_CLASSES.EDITOR_FORMATTING_TOOLBAR_HIDDEN - Class to hide the formatting toolbar.
   * @property {string} CSS_CLASSES.HIDDEN - General-purpose class to hide elements.
   */
  CSS_CLASSES: {
    EDITOR_MSG: "text-sky-400",
    EDITOR_FORMATTING_TOOLBAR_HIDDEN: "editor-formatting-toolbar-hidden",
    HIDDEN: "hidden",
  }
};

/**
 * @module EditorUtils
 * @description Provides helper and utility functions specifically for the editor.
 */
const EditorUtils = (() => {
  "use strict";

  /**
   * Determines the editor mode based on a file's extension.
   * @param {string} filePath - The full path of the file.
   * @returns {string} The determined editor mode (e.g., 'markdown', 'html', 'text').
   */
  function determineMode(filePath) {
    const extension = Utils.getFileExtension(filePath);
    return(EditorAppConfig.EDITOR.EXTENSIONS_MAP[extension] || EditorAppConfig.EDITOR.DEFAULT_MODE);
  }

  /**
   * Generates the CSS required for styling the preview pane.
   * Provides different styles for HTML and Markdown previews.
   * @param {boolean} [isHtmlMode=false] - Flag to indicate if HTML-specific styles are needed.
   * @returns {string} The CSS style block as a string.
   */
  function getPreviewStylingCSS(isHtmlMode = false) {
    let baseStyles = `
                    body { font-family: sans-serif; margin: 20px; line-height: 1.6; background-color: #fff; color: #333; }
                    pre { white-space: pre-wrap; word-break: break-word; }
                `;
    if(isHtmlMode) {
      return(`html { height: 100%; width: 100%; margin: 0; padding: 0; box-sizing: border-box; background-color: #fff; } ` + `body { height: 100%; width: 100%; margin: 0; padding: 15px;  box-sizing: border-box; overflow: auto; ` + `font-family: sans-serif; color: #333; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; } ` + `pre { white-space: pre-wrap !important; word-break: break-all !important; overflow-wrap: break-word !important; }`);
    }
    return(baseStyles + `
                    .markdown-preview h1, .markdown-preview h2, .markdown-preview h3 { color: #0284c7; border-bottom: 1px solid #e5e7eb; margin-top: 1em; margin-bottom: 0.5em; }
                    .markdown-preview p { margin-bottom: 0.5em; line-height: 1.5; }
                    .markdown-preview code { background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: monospace; color: #1f2937; }
                    .markdown-preview pre { background-color: #f3f4f6; padding: 10px; overflow-x: auto; border-radius: 3px;}
                    .markdown-preview pre > code { display: block; padding: 0; }
                    .markdown-preview ul, .markdown-preview ol { margin-left: 20px; margin-bottom: 0.5em;}
                    .markdown-preview blockquote { border-left: 3px solid #d1d5db; padding-left: 10px; margin-left: 0; color: #6b7280; }
                    .markdown-preview a { color: #0ea5e9; text-decoration: underline; }
                `);
  }

  /**
   * Calculates various statistics for the status bar (lines, words, chars, cursor position).
   * @param {string} text - The full text content of the editor.
   * @param {number} selectionStart - The starting position of the cursor/selection.
   * @returns {{lines: number, words: number, chars: number, cursor: {line: number, col: number}}} An object containing the calculated stats.
   */
  function calculateStatusBarInfo(text, selectionStart) {
    const lines = text.split("\n");
    const lineCount = lines.length;
    const charCount = text.length;
    const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
    let currentLineNum = 0;
    let currentColNum = 0;
    let charCounter = 0;
    for(let i = 0; i < lines.length; i++) {
      const lineLengthWithNewline = lines[i].length + 1;
      if(selectionStart >= charCounter && selectionStart < charCounter + lineLengthWithNewline) {
        currentLineNum = i;
        currentColNum = selectionStart - charCounter;
        break;
      }
      charCounter += lineLengthWithNewline;
    }
    if(selectionStart === text.length && !text.endsWith("\n")) {
      currentLineNum = lines.length - 1;
      currentColNum = lines[lines.length - 1].length;
    } else if(selectionStart === text.length && text.endsWith("\n")) {
      currentLineNum = lines.length - 1;
      currentColNum = 0;
    }
    return {
      lines: lineCount,
      words: wordCount,
      chars: charCount,
      cursor: {
        line: currentLineNum + 1,
        col: currentColNum + 1
      },
    };
  }

  /**
   * Generates an array of line numbers based on the text content.
   * @param {string} text - The text content to analyze.
   * @returns {number[]} An array of numbers, e.g., [1, 2, 3, ...].
   */
  function generateLineNumbersArray(text) {
    const lines = text.split("\n").length;
    return Array.from({
      length: lines
    }, (_, i) => i + 1);
  }
  return {
    determineMode,
    getPreviewStylingCSS,
    calculateStatusBarInfo,
    generateLineNumbersArray,
  };
})();

/**
 * @module EditorUI
 * @description Manages all DOM manipulations for the editor, including building, updating, and destroying the UI.
 */
const EditorUI = (() => {
  "use strict";
  /** @private @type {Object.<string, HTMLElement>} */
  let elements = {};
  elements.formattingToolbar = null;
  elements.boldButton = null;
  elements.italicButton = null;
  elements.linkButton = null;
  elements.quoteButton = null;
  elements.codeButton = null;
  elements.codeBlockButton = null;
  elements.ulButton = null;
  elements.olButton = null;
  elements.undoButton = null;
  elements.redoButton = null;
  /** @private @type {Object.<string, Function>} */
  let eventCallbacks = {};
  /** @private @type {?number} */
  let previewDebounceTimer = null;
  /** @private @const {string} */
  const GUTTER_WRAP_HIDDEN_CLASS = "gutter-hidden-by-wrap";

  /**
   * Builds the entire editor layout and injects it into the DOM.
   * @param {HTMLElement} containerElement - The parent element to build the editor within.
   * @param {Object.<string, Function>} callbacks - An object containing callback functions for UI events.
   */
  function buildLayout(containerElement, callbacks) {
    eventCallbacks = callbacks;
    elements.filenameDisplay = Utils.createElement("span", {
      id: "editor-filename-display",
      className: "text-neutral-400 text-sm",
    });
    elements.viewToggleButton = Utils.createElement("button", {
      id: "editor-view-toggle",
      className: "btn-editor",
      eventListeners: {
        click: eventCallbacks.onViewToggle
      },
    });
    elements.exportPreviewButton = Utils.createElement("button", {
      id: "editor-export-preview",
      className: "btn-editor",
      textContent: "Export",
      eventListeners: {
        click: eventCallbacks.onExportPreview
      },
    });
    elements.exitButton = Utils.createElement("button", {
      id: "editor-exit-btn",
      className: "btn-editor",
      textContent: "Exit",
      title: "Exit (prompts to save if unsaved)",
      eventListeners: {
        click: eventCallbacks.onExitButtonClick
      }
    });
    elements.wordWrapToggleButton = Utils.createElement("button", {
      id: "editor-word-wrap-toggle",
      className: "btn-editor",
      eventListeners: {
        click: eventCallbacks.onWordWrapToggle
      },
    });
    elements.formattingToolbar = Utils.createElement("div", {
      id: EditorAppConfig.EDITOR.FORMATTING_TOOLBAR_ID || "editor-formatting-toolbar",
      className: "py-1 px-2 flex items-center space-x-1",
      classList: [EditorAppConfig.CSS_CLASSES.HIDDEN]
    });

    const formatButtonDetails = [{
      name: 'undoButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="1em" height="1em"><path id="Vector" d="M10 8H5V3M5.29102 16.3569C6.22284 17.7918 7.59014 18.8902 9.19218 19.4907C10.7942 20.0913 12.547 20.1624 14.1925 19.6937C15.8379 19.225 17.2893 18.2413 18.3344 16.8867C19.3795 15.5321 19.963 13.878 19.9989 12.1675C20.0347 10.4569 19.5211 8.78001 18.5337 7.38281C17.5462 5.98561 16.1366 4.942 14.5122 4.40479C12.8878 3.86757 11.1341 3.86499 9.5083 4.39795C7.88252 4.93091 6.47059 5.97095 5.47949 7.36556" stroke="#3eca02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
      title: 'Undo (Ctrl+Z)',
      callbackName: 'onUndo'
    }, {
      name: 'redoButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="1em" height="1em"><path id="Vector" d="M13.9998 8H18.9998V3M18.7091 16.3569C17.7772 17.7918 16.4099 18.8902 14.8079 19.4907C13.2059 20.0913 11.4534 20.1624 9.80791 19.6937C8.16246 19.225 6.71091 18.2413 5.66582 16.8867C4.62073 15.5321 4.03759 13.878 4.00176 12.1675C3.96593 10.4569 4.47903 8.78001 5.46648 7.38281C6.45392 5.98561 7.86334 4.942 9.48772 4.40479C11.1121 3.86757 12.8661 3.86499 14.4919 4.39795C16.1177 4.93091 17.5298 5.97095 18.5209 7.36556" stroke="#3eca02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
      title: 'Redo (Ctrl+Y / Ctrl+Shift+Z)',
      callbackName: 'onRedo'
    }, {
      name: 'boldButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3eca02" width="1em" height="1em"><path d="M18,11v-1h-2V4h-1V3H5v18h13v-1h1v-9H18z M17,18h-1v1H7v-7h9v1h1V18z M7,5h6v1h1v3h-1v1H7V5z"></path></svg>',
      title: 'Bold (Ctrl+B)',
      callbackName: 'onFormatBold'
    }, {
      name: 'italicButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3eca02" width="1em" height="1em"><polygon points="8,3 8,5 12,5 12,8 11,8 11,11 10,11 10,14 9,14 9,17 8,17 8,19 4,19 4,21 15,21 15,20 15,19 11,19 11,16 12,16 12,13 13,13 13,10 14,10 14,7 15,7 15,5 19,5 19,3 "></polygon></svg>',
      title: 'Italic (Ctrl+I)',
      callbackName: 'onFormatItalic'
    }, {
      name: 'linkButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#3eca02" width="1em" height="1em"><path d="M7.05025 1.53553C8.03344 0.552348 9.36692 0 10.7574 0C13.6528 0 16 2.34721 16 5.24264C16 6.63308 15.4477 7.96656 14.4645 8.94975L12.4142 11L11 9.58579L13.0503 7.53553C13.6584 6.92742 14 6.10264 14 5.24264C14 3.45178 12.5482 2 10.7574 2C9.89736 2 9.07258 2.34163 8.46447 2.94975L6.41421 5L5 3.58579L7.05025 1.53553Z" fill="#3eca02"></path> <path d="M7.53553 13.0503L9.58579 11L11 12.4142L8.94975 14.4645C7.96656 15.4477 6.63308 16 5.24264 16C2.34721 16 0 13.6528 0 10.7574C0 9.36693 0.552347 8.03344 1.53553 7.05025L3.58579 5L5 6.41421L2.94975 8.46447C2.34163 9.07258 2 9.89736 2 10.7574C2 12.5482 3.45178 14 5.24264 14C6.10264 14 6.92742 13.6584 7.53553 13.0503Z" fill="#3eca02"></path> <path d="M5.70711 11.7071L11.7071 5.70711L10.2929 4.29289L4.29289 10.2929L5.70711 11.7071Z" fill="#3eca02"></path></svg>',
      title: 'Insert Link',
      callbackName: 'onFormatLink'
    }, {
      name: 'quoteButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3eca02" width="1em" height="1em"><path d="M14,17H17L19,13V7H13V13H16M6,17H9L11,13V7H5V13H8L6,17Z"/></svg>',
      title: 'Blockquote',
      callbackName: 'onFormatQuote'
    }, {
      name: 'codeButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3eca02" width="1em" height="1em"><path d="M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6Z"/></svg>',
      title: 'Inline Code',
      callbackName: 'onFormatCode'
    }, {
      name: 'codeBlockButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="1em" height="1em"><path id="Vector" d="M3 6H3.01919M3.01919 6H20.9809M3.01919 6C3 6.31438 3 6.70191 3 7.2002V16.8002C3 17.9203 3 18.4796 3.21799 18.9074C3.40973 19.2837 3.71547 19.5905 4.0918 19.7822C4.51921 20 5.079 20 6.19694 20L17.8031 20C18.921 20 19.48 20 19.9074 19.7822C20.2837 19.5905 20.5905 19.2837 20.7822 18.9074C21 18.48 21 17.921 21 16.8031L21 7.19691C21 6.70021 21 6.31368 20.9809 6M3.01919 6C3.04314 5.60768 3.09697 5.3293 3.21799 5.0918C3.40973 4.71547 3.71547 4.40973 4.0918 4.21799C4.51962 4 5.08009 4 6.2002 4H17.8002C18.9203 4 19.4796 4 19.9074 4.21799C20.2837 4.40973 20.5905 4.71547 20.7822 5.0918C20.9032 5.3293 20.957 5.60768 20.9809 6M20.9809 6H21M14 11L16 13L14 15M10 15L8 13L10 11" stroke="#3eca02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      title: 'Code Block',
      callbackName: 'onFormatCodeBlock'
    }, {
      name: 'ulButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3eca02" width="1em" height="1em"><path d="M7,5H21V7H7V5M7,11H21V13H7V11M7,17H21V19H7V17M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z"/></svg>',
      title: 'Unordered List',
      callbackName: 'onFormatUl'
    }, {
      name: 'olButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3eca02" width="1em" height="1em"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>',
      title: 'Ordered List',
      callbackName: 'onFormatOl'
    }];

    formatButtonDetails.forEach(detail => {
      if (typeof eventCallbacks[detail.callbackName] === 'function') {
        elements[detail.name] = Utils.createElement("button", {
          className: "btn-editor btn-editor-format",
          innerHTML: detail.iconHTML,
          title: detail.title,
          eventListeners: {
            click: eventCallbacks[detail.callbackName]
          }
        });
        elements.formattingToolbar.appendChild(elements[detail.name]);
      } else {
        console.warn(`EditorUI: Callback ${detail.callbackName} not provided for button ${detail.name}`);
      }
    });

    const controlsRightGroup = Utils.createElement("div", {
      className: "flex"
    }, elements.wordWrapToggleButton, elements.viewToggleButton, elements.exportPreviewButton, elements.exitButton);
    elements.controlsDiv = Utils.createElement("div", {
      id: "editor-controls",
      className: "py-1 flex justify-between items-center border-b border-neutral-700 mb-1",
    }, elements.formattingToolbar, controlsRightGroup);
    elements.lineGutter = Utils.createElement("div", {
      id: "editor-line-gutter",
      style: {
        fontFamily: '"VT323", monospace',
        fontSize: "0.875rem",
        lineHeight: "1.35",
        paddingTop: "4px",
        paddingBottom: "4px",
        boxSizing: "border-box"
      },
    });
    elements.textarea = Utils.createElement("textarea", {
      id: "editor-textarea",
      className: "w-full h-full bg-neutral-950 text-green-400 border-none resize-none outline-none box-border pr-2.5",
      spellcheck: "false",
      style: {
        fontFamily: '"VT323", monospace',
        fontSize: "0.875rem",
        lineHeight: "1.35",
        paddingTop: "4px",
        paddingBottom: "4px",
        boxSizing: "border-box"
      },
      eventListeners: {
        input: eventCallbacks.onInput,
        scroll: eventCallbacks.onScroll,
        click: eventCallbacks.onSelectionChange,
        keyup: eventCallbacks.onSelectionChange,
      },
    });
    elements.textareaWrapper = Utils.createElement("div", {
      id: "editor-textarea-wrapper",
      className: "editor-pane flex-1 relative overflow-hidden border-r border-neutral-700 pl-0",
    }, elements.textarea);
    elements.previewPane = Utils.createElement("div", {
      id: "editor-preview-content",
      className: "p-2.5 flex-1 min-h-0",
    });
    elements.previewWrapper = Utils.createElement("div", {
      id: "editor-preview-wrapper",
      className: "editor-pane flex flex-col min-h-0 flex-1 relative overflow-y-auto bg-neutral-900 text-neutral-300",
    }, elements.previewPane);
    elements.mainArea = Utils.createElement("div", {
      id: "editor-main-area",
      className: "flex-grow flex w-full overflow-hidden relative",
    }, elements.lineGutter, elements.textareaWrapper, elements.previewWrapper);
    elements.statusBarLineCount = Utils.createElement("span", {
      id: "status-lines",
    });
    elements.statusBarWordCount = Utils.createElement("span", {
      id: "status-words",
    });
    elements.statusBarCharCount = Utils.createElement("span", {
      id: "status-chars",
    });
    elements.statusBarCursorPos = Utils.createElement("span", {
      id: "status-cursor",
    });
    const statusBarLeft = Utils.createElement("div", {
      className: "flex space-x-4"
    }, elements.statusBarCursorPos, elements.statusBarLineCount);
    const statusBarRight = Utils.createElement("div", {
      className: "flex space-x-4"
    }, elements.statusBarWordCount, elements.statusBarCharCount);
    elements.statusBar = Utils.createElement("div", {
      id: "editor-status-bar",
      className: "px-2.5 py-1 text-xs text-neutral-500 border-t border-neutral-700 bg-neutral-900 flex-shrink-0 flex justify-between",
    }, statusBarLeft, elements.filenameDisplay, statusBarRight);
    elements.instructionsFooter = Utils.createElement("div", {
      id: "editor-instructions-footer",
      className: "pt-2 pb-0.5 text-sm text-center text-neutral-400 flex-shrink-0 border-t border-neutral-700 mt-1",
      textContent: `Ctrl+S: Save & Exit | Ctrl+O: Exit (confirm if unsaved) | Ctrl+P: Toggle Preview | Ctrl+Z: Undo | Ctrl+Y/Ctrl+Shift+Z: Redo`,
    });
    elements.editorContainer = Utils.createElement("div", {
      id: "editor-container",
      className: "flex-grow flex flex-col w-full h-full",
    }, elements.controlsDiv, elements.mainArea, elements.statusBar, elements.instructionsFooter);
    if (containerElement && DOM.inputLineContainerDiv) {
      containerElement.insertBefore(elements.editorContainer, DOM.inputLineContainerDiv);
    } else {
      console.error("EditorUI.buildLayout: ContainerElement or DOM.inputLineContainerDiv not found in DOM when trying to insert editor.");
    }
  }

  /**
   * Toggles the visibility of the line number gutter.
   * @param {boolean} visible - If true, the gutter is shown; otherwise, it's hidden.
   */
  function setGutterVisibility(visible) {
    if(elements.lineGutter) {
      if(visible) {
        elements.lineGutter.classList.remove(GUTTER_WRAP_HIDDEN_CLASS);
      } else {
        elements.lineGutter.classList.add(GUTTER_WRAP_HIDDEN_CLASS);
      }
    }
  }

  /**
   * Removes the editor layout from the DOM and resets its state.
   */
  function destroyLayout() {
    if(elements.editorContainer && elements.editorContainer.parentNode) {
      elements.editorContainer.parentNode.removeChild(elements.editorContainer);
    }
    if(previewDebounceTimer) clearTimeout(previewDebounceTimer);
    previewDebounceTimer = null;
    const newElementsToClear = ['formattingToolbar', 'boldButton', 'italicButton', 'linkButton', 'quoteButton', 'codeButton', 'codeBlockButton', 'ulButton', 'olButton', 'exitButton', 'undoButton', 'redoButton']; // ADDED undo/redo to clear list
    newElementsToClear.forEach(elName => {
      elements[elName] = null;
    });
    eventCallbacks = {};
  }

  /**
   * Updates the filename display in the status bar.
   * @param {string} filePath - The path of the current file.
   * @param {boolean} isDirty - Whether the file has unsaved changes.
   */
  function updateFilenameDisplay(filePath, isDirty) {
    if(elements.filenameDisplay) {
      elements.filenameDisplay.textContent = `File: ${filePath || "Untitled"}${isDirty ? "*" : ""}`;
    }
  }

  /**
   * Updates all information in the status bar.
   * @param {string} text - The full text content of the editor.
   * @param {number} selectionStart - The starting position of the cursor/selection.
   */
  function updateStatusBar(text, selectionStart) {
    if(!elements.textarea || !elements.statusBar) return;
    const stats = EditorUtils.calculateStatusBarInfo(text, selectionStart);
    if(elements.statusBarLineCount) elements.statusBarLineCount.textContent = ` Lines: ${stats.lines}`;
    if(elements.statusBarWordCount) elements.statusBarWordCount.textContent = `Words: ${stats.words}_`;
    if(elements.statusBarCharCount) elements.statusBarCharCount.textContent = ` Chars: ${stats.chars}`;
    if(elements.statusBarCursorPos) elements.statusBarCursorPos.textContent = `Ln: ${stats.cursor.line}, Col: ${stats.cursor.col}_`;
  }

  /**
   * Renders the line numbers in the gutter.
   * @param {string} text - The full text content of the editor.
   */
  function updateLineNumbers(text) {
    if(!elements.textarea || !elements.lineGutter) return;
    const numbersArray = EditorUtils.generateLineNumbersArray(text);
    elements.lineGutter.textContent = numbersArray.join("\n");
    elements.lineGutter.scrollTop = elements.textarea.scrollTop;
  }

  /**
   * Synchronizes the scroll position of the line gutter with the textarea.
   */
  function syncLineGutterScroll() {
    if(elements.lineGutter && elements.textarea) {
      elements.lineGutter.scrollTop = elements.textarea.scrollTop;
    }
  }

  /**
   * Sets the content of the main textarea.
   * @param {string} text - The content to set.
   */
  function setTextareaContent(text) {
    if(elements.textarea) elements.textarea.value = text;
  }

  /**
   * Gets the current content of the main textarea.
   * @returns {string} The textarea's content.
   */
  function getTextareaContent() {
    return elements.textarea ? elements.textarea.value : "";
  }

  /**
   * Sets focus to the main textarea.
   */
  function setEditorFocus() {
    if(elements.textarea && elements.textareaWrapper && !elements.textareaWrapper.classList.contains(EditorAppConfig.CSS_CLASSES.HIDDEN)) {
      elements.textarea.focus();
    }
  }

  /**
   * Gets the current selection start and end positions in the textarea.
   * @returns {{start: number, end: number}} The selection object.
   */
  function getTextareaSelection() {
    if(elements.textarea) {
      return {
        start: elements.textarea.selectionStart,
        end: elements.textarea.selectionEnd
      };
    }
    return {
      start: 0,
      end: 0
    };
  }

  /**
   * Sets the selection range in the textarea.
   * @param {number} start - The starting position of the selection.
   * @param {number} end - The ending position of the selection.
   */
  function setTextareaSelection(start, end) {
    if(elements.textarea) {
      elements.textarea.selectionStart = start;
      elements.textarea.selectionEnd = end;
    }
  }

  /**
   * Applies the word wrap setting to the textarea element.
   * @param {boolean} isWordWrapActive - The desired word wrap state.
   */
  function applyTextareaWordWrap(isWordWrapActive) {
    if(!elements.textarea) return;
    if(isWordWrapActive) {
      elements.textarea.setAttribute("wrap", "soft");
      elements.textarea.classList.remove("no-wrap");
    } else {
      elements.textarea.setAttribute("wrap", "off");
      elements.textarea.classList.add("no-wrap");
    }
  }

  /**
   * Applies the word wrap setting to the preview pane.
   * @param {boolean} isWordWrapActive - The desired word wrap state.
   * @param {string} currentFileMode - The current mode of the editor.
   */
  function applyPreviewWordWrap(isWordWrapActive, currentFileMode) {
    if(!elements.previewPane) return;
    if(currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN) {
      elements.previewPane.classList.toggle("word-wrap-enabled", isWordWrapActive);
    }
  }

  /**
   * Updates the text of the word wrap toggle button.
   * @param {boolean} isWordWrapActive - The current word wrap state.
   */
  function updateWordWrapButtonText(isWordWrapActive) {
    if(elements.wordWrapToggleButton) {
      elements.wordWrapToggleButton.textContent = isWordWrapActive ? "Wrap: On" : "Wrap: Off";
    }
  }

  /**
   * Gets the inner HTML of the preview pane.
   * @returns {string} The HTML content of the preview pane.
   */
  function getPreviewPaneHTML() {
    if(elements.previewPane) {
      const iframe = elements.previewPane.querySelector("iframe");
      if(iframe && iframe.srcdoc) {
        const match = iframe.srcdoc.match(/<body>([\s\S]*)<\/body>/i);
        if(match && match[1]) return match[1];
        return iframe.srcdoc;
      }
      return elements.previewPane.innerHTML;
    }
    return "";
  }

  /**
   * Renders the preview pane based on the current content and mode.
   * @param {string} content - The text content to render.
   * @param {string} currentFileMode - The current editor mode.
   * @param {boolean} isWordWrapActive - The current word wrap state.
   */
  function renderPreview(content, currentFileMode, isWordWrapActive) {
    if(!elements.previewPane) return;
    if(currentFileMode !== EditorAppConfig.EDITOR.MODES.MARKDOWN && currentFileMode !== EditorAppConfig.EDITOR.MODES.HTML) {
      elements.previewPane.innerHTML = "";
      return;
    }
    if(previewDebounceTimer) clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
      if(currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN) {
        if(typeof marked !== "undefined") {
          elements.previewPane.innerHTML = marked.parse(content);
        } else {
          elements.previewPane.textContent = "Markdown preview library (marked.js) not loaded.";
        }
        applyPreviewWordWrap(isWordWrapActive, currentFileMode);
      } else if(currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
        let iframe = elements.previewPane.querySelector("iframe");
        if(!iframe) {
          iframe = Utils.createElement("iframe", {
            className: "w-full h-full border-none bg-white",
          });
          elements.previewPane.innerHTML = "";
          elements.previewPane.appendChild(iframe);
        }
        let injectedStyles = "";
        if(isWordWrapActive) {
          injectedStyles = `<style> pre { white-space: pre-wrap !important; word-break: break-all !important; overflow-wrap: break-word !important; } body { word-wrap: break-word; overflow-wrap: break-word; } </style>`;
        }
        iframe.srcdoc = `${injectedStyles}<style>${EditorUtils.getPreviewStylingCSS(true)}</style>${content}`;
      }
    }, EditorAppConfig.EDITOR.DEBOUNCE_DELAY_MS);
  }

  /**
   * Sets the view mode of the editor (split, edit-only, preview-only).
   * @param {string} viewMode - The desired view mode.
   * @param {string} currentFileMode - The current editor mode.
   * @param {boolean} isPreviewable - Whether the current file type can be previewed.
   * @param {boolean} isWordWrapActive - The current word wrap state.
   */
  function setViewMode(viewMode, currentFileMode, isPreviewable, isWordWrapActive) {
    // Guard clause: ensure all required elements exist.
    if (!elements.lineGutter || !elements.textareaWrapper || !elements.previewWrapper || !elements.viewToggleButton || !elements.previewPane) {
      return;
    }

    // Perform initial UI setup that's common to all modes.
    elements.previewPane.classList.toggle("markdown-preview", currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN);
    if (currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN) {
      applyPreviewWordWrap(isWordWrapActive, currentFileMode);
    }
    elements.viewToggleButton.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !isPreviewable);
    elements.exportPreviewButton.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !isPreviewable);
    elements.textareaWrapper.style.borderRight = isPreviewable && viewMode === EditorAppConfig.EDITOR.VIEW_MODES.SPLIT ? "1px solid #404040" : "none";

    // Configuration map for different view modes.
    const viewConfigs = {
      [EditorAppConfig.EDITOR.VIEW_MODES.SPLIT]:       { text: "Edit Only",    gutter: true,  editor: true,  editorFlex: "1", preview: true,  previewFlex: "1" },
      [EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY]:   { text: "Preview Only", gutter: true,  editor: true,  editorFlex: "1", preview: false, previewFlex: "0" },
      [EditorAppConfig.EDITOR.VIEW_MODES.PREVIEW_ONLY]:{ text: "Split View",   gutter: false, editor: false, editorFlex: "0", preview: true,  previewFlex: "1" },
      // Define a configuration for the non-previewable state.
      noPreview:                                     { text: "Split View",   gutter: true,  editor: true,  editorFlex: "1", preview: false, previewFlex: "0" }
    };

    // Select the appropriate configuration based on whether the file is previewable.
    const config = isPreviewable ? viewConfigs[viewMode] : viewConfigs.noPreview;

    // Apply the selected configuration to the UI elements.
    if (config) {
      elements.viewToggleButton.textContent = config.text;
      elements.lineGutter.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !config.gutter);
      elements.textareaWrapper.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !config.editor);
      elements.textareaWrapper.style.flex = config.editorFlex;
      elements.previewWrapper.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !config.preview);
      elements.previewWrapper.style.flex = config.previewFlex;
    }
  }

  return {
    buildLayout,
    destroyLayout,
    updateFilenameDisplay,
    updateStatusBar,
    updateLineNumbers,
    syncLineGutterScroll,
    setTextareaContent,
    getTextareaContent,
    setEditorFocus,
    getTextareaSelection,
    setTextareaSelection,
    applyTextareaWordWrap,
    applyPreviewWordWrap,
    updateWordWrapButtonText,
    renderPreview,
    setViewMode,
    getPreviewPaneHTML,
    setGutterVisibility,
    elements: elements,
  };
})();

/**
 * @module EditorManager
 * @description The main controller for the editor. Manages state, user interactions, and coordinates between the UI and file system.
 */
const EditorManager = (() => {
  "use strict";
  /** @private @type {boolean} */
  let isActiveState = false;
  /** @private @type {?string} */
  let currentFilePath = null;
  /** @private @type {string} */
  let currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE;
  /** @private @type {string} */
  let currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT;
  /** @private @type {boolean} */
  let isWordWrapActive = EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED;
  /** @private @type {string} */
  let originalContent = "";
  /** @private @type {boolean} */
  let isDirty = false;
  /** @private @type {string[]} */
  let undoStack = [];
  /** @private @type {string[]} */
  let redoStack = [];
  /** @private @const {number} */
  const MAX_UNDO_STATES = 100;
  /** @private @type {?number} */
  let saveUndoStateTimeout = null;

  /**
   * Loads the word wrap setting from local storage.
   * @private
   */
  function _loadWordWrapSetting() {
    const savedSetting = StorageManager.loadItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor word wrap setting");
    isWordWrapActive = savedSetting !== null ? savedSetting : EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED;
  }

  /**
   * Saves the current word wrap setting to local storage.
   * @private
   */
  function _saveWordWrapSetting() {
    StorageManager.saveItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, isWordWrapActive, "Editor word wrap setting");
  }

  /**
   * Toggles the word wrap state and updates the UI accordingly.
   * @private
   */
  function _toggleWordWrap() {
    if(!isActiveState) return;
    isWordWrapActive = !isWordWrapActive;
    _saveWordWrapSetting();
    EditorUI.applyTextareaWordWrap(isWordWrapActive);
    EditorUI.applyPreviewWordWrap(isWordWrapActive, currentFileMode);
    if(currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
      EditorUI.renderPreview(EditorUI.getTextareaContent(), currentFileMode, isWordWrapActive);
    }
    EditorUI.updateWordWrapButtonText(isWordWrapActive);
    EditorUI.setEditorFocus();
    EditorUI.setGutterVisibility(!isWordWrapActive);
  }

  /**
   * Updates all components of the editor UI (status bar, line numbers, preview).
   * @private
   */
  function _updateFullEditorUI() {
    if(!isActiveState) return;
    EditorUI.updateFilenameDisplay(currentFilePath, isDirty);
    const textContent = EditorUI.getTextareaContent();
    EditorUI.updateLineNumbers(textContent);
    const selection = EditorUI.getTextareaSelection();
    EditorUI.updateStatusBar(textContent, selection.start);
    if(currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
      EditorUI.renderPreview(textContent, currentFileMode, isWordWrapActive);
    }
  }

  /**
   * Handles the 'input' event from the textarea, updating the dirty state and UI.
   * @private
   */
  function _handleEditorInput() {
    if(!isActiveState) return;
    const currentContent = EditorUI.getTextareaContent();

    if (saveUndoStateTimeout) {
      clearTimeout(saveUndoStateTimeout);
    }
    saveUndoStateTimeout = setTimeout(() => {
      _saveUndoState(currentContent);
      saveUndoStateTimeout = null;
    }, EditorAppConfig.EDITOR.DEBOUNCE_DELAY_MS + 50);

    isDirty = currentContent !== originalContent;
    _updateFullEditorUI();
  }

  /**
   * Handles the 'scroll' event from the textarea to sync the line gutter.
   * @private
   */
  function _handleEditorScroll() {
    if(!isActiveState) return;
    EditorUI.syncLineGutterScroll();
  }

  /**
   * Handles cursor movement or selection changes to update the status bar.
   * @private
   */
  function _handleEditorSelectionChange() {
    if(!isActiveState) return;
    const textContent = EditorUI.getTextareaContent();
    const selection = EditorUI.getTextareaSelection();
    EditorUI.updateStatusBar(textContent, selection.start);
  }

  /**
   * Exports the current preview pane content as a downloadable HTML file.
   * @private
   * @async
   */
  async function exportPreviewAsHtml() {
    if(!isActiveState) return;
    let contentToExport
    let baseFilename = "preview";
    if(currentFilePath) {
      baseFilename = currentFilePath.substring(currentFilePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);
      const dotIndex = baseFilename.lastIndexOf(".");
      if(dotIndex > 0) baseFilename = baseFilename.substring(0, dotIndex);
    }
    const downloadFilename = `${baseFilename}_preview.html`;
    if(currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN) {
      contentToExport = EditorUI.getPreviewPaneHTML();
    } else if(currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
      contentToExport = EditorUI.getTextareaContent();
    } else {
      const textContent = EditorUI.getTextareaContent();
      contentToExport = `<pre>${textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    }
    const styles = EditorUtils.getPreviewStylingCSS(currentFileMode === EditorAppConfig.EDITOR.MODES.HTML);
    let injectedWordWrapStyles = "";
    if(isWordWrapActive && currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
      injectedWordWrapStyles = `pre { white-space: pre-wrap !important; word-break: break-all !important; overflow-wrap: break-word !important; } body { word-wrap: break-word; overflow-wrap: break-word; }`;
    }
    const htmlDoc = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>OopisOS Editor Preview - ${currentFilePath || "Untitled"}</title><style>${styles}${injectedWordWrapStyles}</style></head><body><div class="${currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN ? "markdown-preview" : ""}">${contentToExport}</div></body></html>`;
    try {
      const blob = new Blob([htmlDoc], {
        type: "text/html"
      });
      const url = URL.createObjectURL(blob);
      const a = Utils.createElement("a", {
        href: url,
        download: downloadFilename
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await OutputManager.appendToOutput(`Preview exported as '${downloadFilename}'`, {
        typeClass: EditorAppConfig.CSS_CLASSES.EDITOR_MSG
      });
    } catch(error) {
      console.error("Error exporting preview:", error);
      await OutputManager.appendToOutput(`Error exporting preview: ${error.message}`, {
        typeClass: Config.CSS_CLASSES.ERROR_MSG
      });
    }
  }

  /**
   * Saves the current editor content to the undo stack.
   * @param {string} content - The current text content.
   * @private
   */
  function _saveUndoState(content) {
    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== content) {
      undoStack.push(content);
      if (undoStack.length > MAX_UNDO_STATES) {
        undoStack.shift();
      }
      redoStack = [];
      _updateUndoRedoButtonStates();
    }
  }

  /**
   * Reverts the editor content to the previous state in the undo stack.
   * @private
   */
  function _performUndo() {
    if (undoStack.length > 1) {
      const currentState = undoStack.pop();
      redoStack.push(currentState);
      const prevState = undoStack[undoStack.length - 1];

      EditorUI.setTextareaContent(prevState);
      isDirty = (prevState !== originalContent);
      _updateFullEditorUI();
      _updateUndoRedoButtonStates();
      EditorUI.setTextareaSelection(prevState.length, prevState.length);
      EditorUI.setEditorFocus();
    }
  }

  /**
   * Re-applies a state from the redo stack.
   * @private
   */
  function _performRedo() {
    if (redoStack.length > 0) {
      const nextState = redoStack.pop();
      undoStack.push(nextState);

      EditorUI.setTextareaContent(nextState);
      isDirty = (nextState !== originalContent);
      _updateFullEditorUI();
      _updateUndoRedoButtonStates();
      EditorUI.setTextareaSelection(nextState.length, nextState.length);
      EditorUI.setEditorFocus();
    }
  }

  /**
   * Updates the enabled/disabled state of the undo and redo buttons.
   * @private
   */
  function _updateUndoRedoButtonStates() {
    if (EditorUI.elements.undoButton) {
      EditorUI.elements.undoButton.disabled = undoStack.length <= 1;
    }
    if (EditorUI.elements.redoButton) {
      EditorUI.elements.redoButton.disabled = redoStack.length === 0;
    }
  }

  /**
   * Applies a formatting manipulation (e.g., bold, italic) to the selected text.
   * @param {string} type - The type of formatting to apply (e.g., 'bold', 'link').
   * @private
   */
  function _applyTextManipulation(type) {
    if(!isActiveState) return;
    const selection = EditorUI.getTextareaSelection();
    const currentFullText = EditorUI.getTextareaContent();
    const textBeforeSelection = currentFullText.substring(0, selection.start);
    let selectedTextVal = currentFullText.substring(selection.start, selection.end);
    const textAfterSelection = currentFullText.substring(selection.end);
    let newText = currentFullText;
    let finalSelectionStart = selection.start;
    let finalSelectionEnd = selection.end;
    const isMarkdown = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN;
    const isHTML = currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;
    let prefix = "",
        suffix = "",
        placeholder = "";
    let modifiedSegment = "";
    const applyToLines = (text, linePrefixTransform) => text.split('\n').map((line, index) => (typeof linePrefixTransform === 'function' ? linePrefixTransform(index) : linePrefixTransform) + line).join('\n');
    switch(type) {
      case 'bold':
        prefix = isMarkdown ? "**" : "<strong>";
        suffix = isMarkdown ? "**" : "</strong>";
        placeholder = "bold text";
        break;
      case 'italic':
        prefix = isMarkdown ? "*" : "<em>";
        suffix = isMarkdown ? "*" : "</em>";
        placeholder = "italic text";
        break;
      case 'link':
        const url = prompt("Enter URL:", "https://");
        if(url === null) return;
        let linkDisplayText = selectedTextVal || prompt("Enter link text (optional):", "link text");
        if(linkDisplayText === null) return;
        modifiedSegment = isMarkdown ? `[${linkDisplayText}](${url})` : (isHTML ? `<a href="${url}">${linkDisplayText}</a>` : null);
        if(modifiedSegment === null) return;
        finalSelectionStart = textBeforeSelection.length + (isMarkdown ? 1 : `<a href="${url}">`.length);
        finalSelectionEnd = finalSelectionStart + linkDisplayText.length;
        break;
      case 'quote':
        placeholder = "Quoted text";
        modifiedSegment = isMarkdown ? applyToLines(selectedTextVal || placeholder, "> ") : (isHTML ? `<blockquote>\n  ${selectedTextVal || placeholder}\n</blockquote>` : null);
        if(modifiedSegment === null) return;
        finalSelectionStart = selection.start;
        finalSelectionEnd = selection.start + modifiedSegment.length;
        break;
      case 'code':
        prefix = isMarkdown ? "`" : "<code>";
        suffix = isMarkdown ? "`" : "</code>";
        placeholder = "code";
        break;
      case 'codeblock':
        placeholder = "source code";
        let lang = "";
        if(isMarkdown) {
          lang = prompt("Enter language for code block (optional):", "");
          modifiedSegment = "```" + lang + "\n" + (selectedTextVal || placeholder) + "\n```";
          finalSelectionStart = textBeforeSelection.length + ("```" + lang + "\n").length;
        } else if(isHTML) {
          modifiedSegment = "<pre><code>\n" + (selectedTextVal || placeholder) + "\n</code></pre>";
          finalSelectionStart = textBeforeSelection.length + "<pre><code>\n".length;
        } else return;
        finalSelectionEnd = finalSelectionStart + (selectedTextVal || placeholder).length;
        break;
      case 'ul':
      case 'ol':
        placeholder = "List item";
        const items = (selectedTextVal || placeholder).split('\n');
        if(isMarkdown) {
          modifiedSegment = items.map((line, index) => (type === 'ol' ? `${index + 1}. ` : "- ") + line).join('\n');
        } else if(isHTML) {
          const listTag = type === 'ol' ? "ol" : "ul";
          modifiedSegment = `<${listTag}>\n` + items.map(line => `  <li>${line}</li>`).join('\n') + `\n</${listTag}>`;
        } else return;
        finalSelectionStart = selection.start;
        finalSelectionEnd = selection.start + modifiedSegment.length;
        break;
      default:
        return;
    }
    if(type !== 'link' && type !== 'quote' && type !== 'codeblock' && type !== 'ul' && type !== 'ol') {
      if(!selectedTextVal) selectedTextVal = placeholder;
      modifiedSegment = prefix + selectedTextVal + suffix;
      finalSelectionStart = selection.start + prefix.length;
      finalSelectionEnd = finalSelectionStart + selectedTextVal.length;
    }
    newText = textBeforeSelection + modifiedSegment + textAfterSelection;
    EditorUI.setTextareaContent(newText);
    EditorUI.setTextareaSelection(finalSelectionStart, finalSelectionEnd);
    _handleEditorInput();
    EditorUI.setEditorFocus();
  }

  /**
   * Handles the logic for toggling between editor view modes.
   * @private
   */
  function _toggleViewModeHandler() {
    if(!isActiveState) return;
    const isPreviewable = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;
    if(!isPreviewable) return;
    if(currentViewMode === EditorAppConfig.EDITOR.VIEW_MODES.SPLIT) currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY;
    else if(currentViewMode === EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY) currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.PREVIEW_ONLY;
    else currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT;
    EditorUI.setViewMode(currentViewMode, currentFileMode, isPreviewable, isWordWrapActive);
    EditorUI.setEditorFocus();
  }

  /**
   * Enters the editor mode, initializing the UI and state.
   * @param {string} filePath - The path of the file to edit.
   * @param {string} content - The initial content of the file.
   */
  function enter(filePath, content) {
    if(isActiveState) {
      void OutputManager.appendToOutput("Editor already active.", {
        typeClass: EditorAppConfig.CSS_CLASSES.EDITOR_MSG
      });
      return;
    }
    _loadWordWrapSetting();
    isActiveState = true;
    OutputManager.setEditorActive(true);
    if(DOM.outputDiv) DOM.outputDiv.classList.add(EditorAppConfig.CSS_CLASSES.HIDDEN);
    else console.error("[EditorManager.enter] DOM.outputDiv is null!");
    if(DOM.inputLineContainerDiv) DOM.inputLineContainerDiv.classList.add(EditorAppConfig.CSS_CLASSES.HIDDEN);
    else console.error("[EditorManager.enter] DOM.inputLineContainerDiv is null!");
    TerminalUI.setInputState(false);
    currentFilePath = filePath;
    currentFileMode = EditorUtils.determineMode(filePath);
    originalContent = content;
    isDirty = false;

    undoStack = [];
    redoStack = [];
    _saveUndoState(content);

    const isPreviewable = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;
    document.addEventListener('keydown', handleKeyDown);
    EditorUI.buildLayout(DOM.terminalDiv, {
      onInput: _handleEditorInput.bind(this),
      onScroll: _handleEditorScroll.bind(this),
      onSelectionChange: _handleEditorSelectionChange.bind(this),
      onViewToggle: _toggleViewModeHandler.bind(this),
      onExportPreview: exportPreviewAsHtml.bind(this),
      onWordWrapToggle: _toggleWordWrap.bind(this),
      onExitButtonClick: () => this.exit(false),
      onFormatBold: () => _applyTextManipulation('bold'),
      onFormatItalic: () => _applyTextManipulation('italic'),
      onFormatLink: () => _applyTextManipulation('link'),
      onFormatQuote: () => _applyTextManipulation('quote'),
      onFormatCode: () => _applyTextManipulation('code'),
      onFormatCodeBlock: () => _applyTextManipulation('codeblock'),
      onFormatUl: () => _applyTextManipulation('ul'),
      onFormatOl: () => _applyTextManipulation('ol'),
      onUndo: _performUndo.bind(this),
      onRedo: _performRedo.bind(this)
    });
    EditorUI.setGutterVisibility(!isWordWrapActive);
    currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY;
    EditorUI.setViewMode(currentViewMode, currentFileMode, isPreviewable, isWordWrapActive);
    EditorUI.applyTextareaWordWrap(isWordWrapActive);
    EditorUI.updateWordWrapButtonText(isWordWrapActive);
    EditorUI.setTextareaContent(content);
    EditorUI.setTextareaSelection(0, 0);
    _updateFormattingToolbarVisibility();
    _updateFullEditorUI();
    EditorUI.setEditorFocus();
    _updateUndoRedoButtonStates();
  }

  /**
   * Performs all necessary cleanup and state reset when exiting the editor.
   * @private
   * @async
   */
  async function _performExitActions() {
    document.removeEventListener('keydown', handleKeyDown);
    EditorUI.destroyLayout();
    isActiveState = false;
    currentFilePath = null;
    currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE;
    isDirty = false;
    originalContent = "";

    undoStack = [];
    redoStack = [];
    saveUndoStateTimeout = null;

    if(DOM.outputDiv) DOM.outputDiv.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
    if(DOM.inputLineContainerDiv) DOM.inputLineContainerDiv.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
    TerminalUI.setInputState(true);
    if(DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
    TerminalUI.focusInput();
    TerminalUI.updatePrompt();
  }

  /**
   * Exits the editor, handling save logic and confirmation prompts.
   * @param {boolean} [saveChanges=false] - If true, attempts to save the file before exiting.
   * @returns {Promise<boolean>} A promise that resolves to true if the editor was successfully exited, false otherwise.
   * @async
   */
  async function exit(saveChanges = false) {
    let proceedToExit = true;
    let saveSuccess = true;
    const currentUser = UserManager.getCurrentUser().name;
    let terminalMessage = null;
    let terminalMessageClass = null;
    if (!saveChanges && isDirty) {
      const userConfirmedDiscard = await new Promise(resolve => {
        ModalManager.request({
          context: 'graphical',
          messageLines: [Config.MESSAGES.EDITOR_DISCARD_CONFIRM],
          confirmText: "Discard Changes",
          cancelText: "Keep Editing",
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });
      if (userConfirmedDiscard) {
        terminalMessage = `Editor closed for '${currentFilePath || "Untitled"}' without saving. Changes discarded.`;
        terminalMessageClass = Config.CSS_CLASSES.WARNING_MSG;
      } else {
        await OutputManager.appendToOutput("Exit cancelled. Continue editing.", {
          typeClass: EditorAppConfig.CSS_CLASSES.EDITOR_MSG,
        });
        EditorUI.setEditorFocus();
        proceedToExit = false;
      }
    } else if (!saveChanges && !isDirty) {
      terminalMessage = `Editor closed for '${currentFilePath || "Untitled"}'. No changes were made.`;
      terminalMessageClass = Config.CSS_CLASSES.CONSOLE_LOG_MSG;
    }
    if (!proceedToExit) {
      return false;
    }
    if (saveChanges && currentFilePath) {
      const newContent = EditorUI.getTextareaContent();
      const existingNode = FileSystemManager.getNodeByPath(currentFilePath);
      const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

      if (!primaryGroup) {
        await OutputManager.appendToOutput(`Critical Error: Could not determine primary group for '${currentUser}'. Cannot save file.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
        saveSuccess = false;
      } else {
        const saveResult = await FileSystemManager.createOrUpdateFile(
            currentFilePath,
            newContent,
            { currentUser, primaryGroup, existingNode }
        );

        if (!saveResult.success) {
          await OutputManager.appendToOutput(`Error saving '${currentFilePath}': ${saveResult.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
          saveSuccess = false;
        }
      }

      if (saveSuccess) {
        if (!(await FileSystemManager.save())) {
          await OutputManager.appendToOutput(`Error saving file system changes for '${currentFilePath}'. Changes might be lost.`, {
            typeClass: Config.CSS_CLASSES.ERROR_MSG
          });
          saveSuccess = false;
        } else {
          terminalMessage = `File '${currentFilePath}' saved. Editor closed.`;
          terminalMessageClass = Config.CSS_CLASSES.SUCCESS_MSG;
          originalContent = newContent;
          isDirty = false;
          EditorUI.updateFilenameDisplay(currentFilePath, isDirty);
        }
      }
    }
    if (proceedToExit && saveSuccess) {
      OutputManager.setEditorActive(false);
      if (terminalMessage) {
        await OutputManager.appendToOutput(terminalMessage, {
          typeClass: terminalMessageClass
        });
      }
      await _performExitActions();
      return true;
    } else {
      EditorUI.setEditorFocus();
      return false;
    }
  }

  /**
   * Global keydown handler for the editor, processing shortcuts and special keys.
   * @param {KeyboardEvent} event - The keydown event object.
   * @private
   * @async
   */
  async function handleKeyDown(event) {
    if(!isActiveState) return;
    if(event.key === "Tab" && document.activeElement === EditorUI.elements.textarea) {
      event.preventDefault();
      const selection = EditorUI.getTextareaSelection();
      const content = EditorUI.getTextareaContent();
      EditorUI.setTextareaContent(content.substring(0, selection.start) + EditorAppConfig.EDITOR.TAB_REPLACEMENT + content.substring(selection.end));
      EditorUI.setTextareaSelection(selection.start + EditorAppConfig.EDITOR.TAB_REPLACEMENT.length, selection.start + EditorAppConfig.EDITOR.TAB_REPLACEMENT.length);
      _handleEditorInput();
      return;
    }
    if(event.ctrlKey) {
      switch(event.key.toLowerCase()) {
        case "s":
          event.preventDefault();
          await exit(true);
          break;
        case "o":
          event.preventDefault();
          await exit(false);
          break;
        case "p":
          event.preventDefault();
          _toggleViewModeHandler();
          break;
        case "b":
          if(currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
            event.preventDefault();
            _applyTextManipulation('bold');
          }
          break;
        case "i":
          if(!event.shiftKey && (currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML)) {
            event.preventDefault();
            _applyTextManipulation('italic');
          }
          break;
        case "z":
          event.preventDefault();
          if (event.shiftKey) {
            _performRedo();
          } else {
            _performUndo();
          }
          break;
        case "y":
          event.preventDefault();
          _performRedo();
          break;
      }
    }
    setTimeout(_handleEditorSelectionChange, 0);
  }

  /**
   * Shows or hides the formatting toolbar based on the current file mode.
   * @private
   */
  function _updateFormattingToolbarVisibility() {
    if(!isActiveState || !EditorUI || !EditorUI.elements || !EditorUI.elements.formattingToolbar) {
      console.warn("EditorManager: Formatting toolbar UI not ready.");
      return;
    }
    const isMarkdownOrHTML = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;
    EditorUI.elements.formattingToolbar.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !isMarkdownOrHTML);
  }

  return {
    /**
     * Checks if the editor is currently active.
     * @returns {boolean} True if the editor is active, false otherwise.
     */
    isActive: () => isActiveState,
    enter,
    exit,
  };
})();