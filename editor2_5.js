// editor.js - OopisOS Live Markdown Text Editor v2.5

const EditorAppConfig = {
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
  STORAGE_KEYS: {
    EDITOR_WORD_WRAP_ENABLED: "oopisOsEditorWordWrapEnabled",
  },
  CSS_CLASSES: {
    EDITOR_MSG: "text-sky-400",
    EDITOR_FORMATTING_TOOLBAR_HIDDEN: "editor-formatting-toolbar-hidden",
    HIDDEN: "hidden",
  }
};
const EditorUtils = (() => {
  "use strict";

  function determineMode(filePath) {
    const extension = Utils.getFileExtension(filePath);
    return(EditorAppConfig.EDITOR.EXTENSIONS_MAP[extension] || EditorAppConfig.EDITOR.DEFAULT_MODE);
  }

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
const EditorUI = (() => {
  "use strict";
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
  let eventCallbacks = {};
  let previewDebounceTimer = null;
  const GUTTER_WRAP_HIDDEN_CLASS = "gutter-hidden-by-wrap";

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
      name: 'boldButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M15.68,11.39C16.78,10.68 17.5,9.53 17.5,8.25C17.5,5.9 15.61,4 13.25,4H6V18H13.75C16.04,18 17.93,16.19 17.93,13.91C17.93,12.59 17.11,11.51 15.68,11.39M9,6.5H13C14.11,6.5 15,7.39 15,8.5C15,9.61 14.11,10.5 13,10.5H9V6.5M13.5,15.5H9V12H13.5C14.61,12 15.5,12.89 15.5,14C15.5,15.11 14.61,15.5 13.5,15.5Z"/></svg>',
      title: 'Bold (Ctrl+B)',
      callbackName: 'onFormatBold'
    }, {
      name: 'italicButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M10,4V7H12.21L8.79,15H6V18H14V15H11.79L15.21,7H18V4H10Z"/></svg>',
      title: 'Italic (Ctrl+I)',
      callbackName: 'onFormatItalic'
    }, {
      name: 'linkButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M3.9,12C3.9,10.29 5.29,8.9 7,8.9H11V7H7C4.24,7 2,9.24 2,12C2,14.76 4.24,17 7,17H11V15.1H7C5.29,15.1 3.9,13.71 3.9,12M8,13H16V11H8V13M17,7H13V8.9H17C18.71,8.9 20.1,10.29 20.1,12C20.1,13.71 18.71,15.1 17,15.1H13V17H17C19.76,17 22,14.76 22,12C22,9.24 19.76,7 17,7Z"/></svg>',
      title: 'Insert Link',
      callbackName: 'onFormatLink'
    }, {
      name: 'quoteButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M14,17H17L19,13V7H13V13H16M6,17H9L11,13V7H5V13H8L6,17Z"/></svg>',
      title: 'Blockquote',
      callbackName: 'onFormatQuote'
    }, {
      name: 'codeButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6Z"/></svg>',
      title: 'Inline Code',
      callbackName: 'onFormatCode'
    }, {
      name: 'codeBlockButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>',
      title: 'Code Block',
      callbackName: 'onFormatCodeBlock'
    }, {
      name: 'ulButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M7,5H21V7H7V5M7,11H21V13H7V11M7,17H21V19H7V17M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z"/></svg>',
      title: 'Unordered List',
      callbackName: 'onFormatUl'
    }, {
      name: 'olButton',
      iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>',
      title: 'Ordered List',
      callbackName: 'onFormatOl'
    }];
    formatButtonDetails.forEach(detail => {
      if(typeof eventCallbacks[detail.callbackName] === 'function') {
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
    }, elements.wordWrapToggleButton, elements.viewToggleButton, elements.exportPreviewButton, elements.exitButton); // <-- Add elements.exitButton here
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
      textContent: `Ctrl+S: Save & Exit | Ctrl+O: Exit (confirm if unsaved) | Ctrl+P: Toggle Preview`,
    });
    elements.editorContainer = Utils.createElement("div", {
      id: "editor-container",
      className: "flex-grow flex flex-col w-full h-full",
    }, elements.controlsDiv, elements.mainArea, elements.statusBar, elements.instructionsFooter);
    if(containerElement && DOM.inputLineContainerDiv) {
      containerElement.insertBefore(elements.editorContainer, DOM.inputLineContainerDiv);
    } else {
      console.error("EditorUI.buildLayout: ContainerElement or DOM.inputLineContainerDiv not found in DOM when trying to insert editor.");
    }
  }

  function setGutterVisibility(visible) {
    if(elements.lineGutter) {
      if(visible) {
        elements.lineGutter.classList.remove(GUTTER_WRAP_HIDDEN_CLASS);
      } else {
        elements.lineGutter.classList.add(GUTTER_WRAP_HIDDEN_CLASS);
      }
    }
  }

  function destroyLayout() {
    if(elements.editorContainer && elements.editorContainer.parentNode) {
      elements.editorContainer.parentNode.removeChild(elements.editorContainer);
    }
    if(previewDebounceTimer) clearTimeout(previewDebounceTimer);
    previewDebounceTimer = null;
    const newElementsToClear = ['formattingToolbar', 'boldButton', 'italicButton', 'linkButton', 'quoteButton', 'codeButton', 'codeBlockButton', 'ulButton', 'olButton', 'exitButton']; // <-- Add 'exitButton' here
    newElementsToClear.forEach(elName => {
      elements[elName] = null;
    });
    eventCallbacks = {};
  }

  function updateFilenameDisplay(filePath, isDirty) {
    if(elements.filenameDisplay) {
      elements.filenameDisplay.textContent = `File: ${filePath || "Untitled"}${isDirty ? "*" : ""}`;
    }
  }

  function updateStatusBar(text, selectionStart) {
    if(!elements.textarea || !elements.statusBar) return;
    const stats = EditorUtils.calculateStatusBarInfo(text, selectionStart);
    if(elements.statusBarLineCount) elements.statusBarLineCount.textContent = `Lines: ${stats.lines}`;
    if(elements.statusBarWordCount) elements.statusBarWordCount.textContent = `Words: ${stats.words}`;
    if(elements.statusBarCharCount) elements.statusBarCharCount.textContent = `Chars: ${stats.chars}`;
    if(elements.statusBarCursorPos) elements.statusBarCursorPos.textContent = `Ln: ${stats.cursor.line}, Col: ${stats.cursor.col}`;
  }

  function updateLineNumbers(text) {
    if(!elements.textarea || !elements.lineGutter) return;
    const numbersArray = EditorUtils.generateLineNumbersArray(text);
    elements.lineGutter.textContent = numbersArray.join("\n");
    elements.lineGutter.scrollTop = elements.textarea.scrollTop;
  }

  function syncLineGutterScroll() {
    if(elements.lineGutter && elements.textarea) {
      elements.lineGutter.scrollTop = elements.textarea.scrollTop;
    }
  }

  function setTextareaContent(text) {
    if(elements.textarea) elements.textarea.value = text;
  }

  function getTextareaContent() {
    return elements.textarea ? elements.textarea.value : "";
  }

  function setEditorFocus() {
    if(elements.textarea && elements.textareaWrapper && !elements.textareaWrapper.classList.contains(EditorAppConfig.CSS_CLASSES.HIDDEN)) {
      elements.textarea.focus();
    }
  }

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

  function setTextareaSelection(start, end) {
    if(elements.textarea) {
      elements.textarea.selectionStart = start;
      elements.textarea.selectionEnd = end;
    }
  }

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

  function applyPreviewWordWrap(isWordWrapActive, currentFileMode) {
    if(!elements.previewPane) return;
    if(currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN) {
      elements.previewPane.classList.toggle("word-wrap-enabled", isWordWrapActive);
    }
  }

  function updateWordWrapButtonText(isWordWrapActive) {
    if(elements.wordWrapToggleButton) {
      elements.wordWrapToggleButton.textContent = isWordWrapActive ? "Wrap: On" : "Wrap: Off";
    }
  }

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

  function setViewMode(viewMode, currentFileMode, isPreviewable, isWordWrapActive) {
    if(!elements.lineGutter || !elements.textareaWrapper || !elements.previewWrapper || !elements.viewToggleButton || !elements.previewPane) return;
    elements.previewPane.classList.toggle("markdown-preview", currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN);
    if(currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN) {
      applyPreviewWordWrap(isWordWrapActive, currentFileMode);
    }
    elements.viewToggleButton.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !isPreviewable);
    elements.exportPreviewButton.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !isPreviewable);
    elements.textareaWrapper.style.borderRight = isPreviewable && viewMode === EditorAppConfig.EDITOR.VIEW_MODES.SPLIT ? "1px solid #404040" : "none";
    if(!isPreviewable) {
      elements.lineGutter.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.textareaWrapper.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.textareaWrapper.style.flex = "1";
      elements.previewWrapper.classList.add(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.previewWrapper.style.flex = "0";
      elements.viewToggleButton.textContent = "Split View";
      return;
    }
    if(viewMode === EditorAppConfig.EDITOR.VIEW_MODES.SPLIT) {
      elements.viewToggleButton.textContent = "Edit Only";
      elements.lineGutter.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.textareaWrapper.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.textareaWrapper.style.flex = "1";
      elements.previewWrapper.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.previewWrapper.style.flex = "1";
    } else if(viewMode === EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY) {
      elements.viewToggleButton.textContent = "Preview Only";
      elements.lineGutter.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.textareaWrapper.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.textareaWrapper.style.flex = "1";
      elements.previewWrapper.classList.add(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.previewWrapper.style.flex = "0";
    } else if(viewMode === EditorAppConfig.EDITOR.VIEW_MODES.PREVIEW_ONLY) {
      elements.viewToggleButton.textContent = "Split View";
      elements.lineGutter.classList.add(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.textareaWrapper.classList.add(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.textareaWrapper.style.flex = "0";
      elements.previewWrapper.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
      elements.previewWrapper.style.flex = "1";
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
    elements: elements
  };
})();
const EditorManager = (() => {
  "use strict";
  let isActiveState = false;
  let currentFilePath = null;
  let currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE;
  let currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT;
  let isWordWrapActive = EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED;
  let originalContent = "";
  let isDirty = false;

  function _loadWordWrapSetting() {
    const savedSetting = StorageManager.loadItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor word wrap setting");
    isWordWrapActive = savedSetting !== null ? savedSetting : EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED;
  }

  function _saveWordWrapSetting() {
    StorageManager.saveItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, isWordWrapActive, "Editor word wrap setting");
  }

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

  function _handleEditorInput() {
    if(!isActiveState) return;
    const currentContent = EditorUI.getTextareaContent();
    isDirty = currentContent !== originalContent;
    _updateFullEditorUI();
  }

  function _handleEditorScroll() {
    if(!isActiveState) return;
    EditorUI.syncLineGutterScroll();
  }

  function _handleEditorSelectionChange() {
    if(!isActiveState) return;
    const textContent = EditorUI.getTextareaContent();
    const selection = EditorUI.getTextareaSelection();
    EditorUI.updateStatusBar(textContent, selection.start);
  }
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
      onFormatOl: () => _applyTextManipulation('ol')
    });
    EditorUI.setGutterVisibility(!isWordWrapActive);
    currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY; // Set it here, once.
    EditorUI.setViewMode(currentViewMode, currentFileMode, isPreviewable, isWordWrapActive);
    EditorUI.applyTextareaWordWrap(isWordWrapActive);
    EditorUI.updateWordWrapButtonText(isWordWrapActive);
    EditorUI.setTextareaContent(content);
    EditorUI.setTextareaSelection(0, 0);
    _updateFormattingToolbarVisibility();
    _updateFullEditorUI();
    EditorUI.setEditorFocus();
  }
  async function _performExitActions() {
    document.removeEventListener('keydown', handleKeyDown);
    EditorUI.destroyLayout();
    isActiveState = false;
    currentFilePath = null;
    currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE;
    isDirty = false;
    originalContent = "";
    if(DOM.outputDiv) DOM.outputDiv.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
    if(DOM.inputLineContainerDiv) DOM.inputLineContainerDiv.classList.remove(EditorAppConfig.CSS_CLASSES.HIDDEN);
    TerminalUI.setInputState(true);
    if(DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
    TerminalUI.focusInput();
    TerminalUI.updatePrompt();
  }
  async function exit(saveChanges = false) {
    let proceedToExit = true;
    let saveSuccess = true;
    const currentUser = UserManager.getCurrentUser().name;
    const nowISO = new Date().toISOString();
    let terminalMessage = null;
    let terminalMessageClass = null;
    if(!saveChanges && isDirty) {
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
      if(userConfirmedDiscard) {
        terminalMessage = `Editor closed for '${currentFilePath || "Untitled"}' without saving. Changes discarded.`;
        terminalMessageClass = Config.CSS_CLASSES.WARNING_MSG;
      } else {
        await OutputManager.appendToOutput("Exit cancelled. Continue editing.", {
          typeClass: EditorAppConfig.CSS_CLASSES.EDITOR_MSG,
        });
        EditorUI.setEditorFocus();
        proceedToExit = false;
      }
    } else if(!saveChanges && !isDirty) {
      terminalMessage = `Editor closed for '${currentFilePath || "Untitled"}'. No changes were made.`;
      terminalMessageClass = Config.CSS_CLASSES.CONSOLE_LOG_MSG;
    }
    if(!proceedToExit) {
      return false;
    }
    if(saveChanges && currentFilePath) {
      const newContent = EditorUI.getTextareaContent();
      const existingNode = FileSystemManager.getNodeByPath(currentFilePath);
      let canWrite = false;

      // Permission checks remain the same
      if(existingNode) {
        if(FileSystemManager.hasPermission(existingNode, currentUser, "write")) canWrite = true;
        else await OutputManager.appendToOutput(`Error saving '${currentFilePath}': Permission denied.`, {
          typeClass: Config.CSS_CLASSES.ERROR_MSG
        });
      } else {
        const parentPath = currentFilePath.substring(0, currentFilePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)) || Config.FILESYSTEM.ROOT_PATH;
        const parentNodeCheck = FileSystemManager.getNodeByPath(parentPath);
        if(parentNodeCheck && FileSystemManager.hasPermission(parentNodeCheck, currentUser, "write")) canWrite = true;
        else await OutputManager.appendToOutput(`Error creating '${currentFilePath}': Permission denied in parent directory.`, {
          typeClass: Config.CSS_CLASSES.ERROR_MSG
        });
      }

      if(!canWrite) saveSuccess = false;

      if(saveSuccess) {
        // ---- REFINEMENT START ----
        // Get the primary group just ONCE here, since we only need it for new file creation.
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        if (!primaryGroup) {
          await OutputManager.appendToOutput(`Critical Error: Could not determine primary group for '${currentUser}'. Cannot save file.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
          saveSuccess = false; // This will prevent the rest of the block from running.
        }
        // ---- REFINEMENT END ----

        // This check ensures we only proceed if we successfully got the primary group.
        if (saveSuccess) {
          const parentDirResult = FileSystemManager.createParentDirectoriesIfNeeded(currentFilePath);
          if(parentDirResult.error) {
            await OutputManager.appendToOutput(`edit: ${parentDirResult.error}`, {
              typeClass: EditorAppConfig.CSS_CLASSES.EDITOR_MSG
            });
            saveSuccess = false;
          } else {
            const parentNode = parentDirResult.parentNode;
            if(parentNode) {
              const fileName = currentFilePath.substring(currentFilePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);

              // This is the node creation logic you wrote, which is perfect.
              // It now uses the 'primaryGroup' variable we defined above.
              const fileNodeData = {
                type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                content: newContent,
                owner: currentUser, // Simplified, as existingNode is null in this branch
                group: primaryGroup,
                mode: Config.FILESYSTEM.DEFAULT_FILE_MODE,
                mtime: nowISO,
              };

              // If we are updating an existing node, preserve its metadata
              if (existingNode) {
                fileNodeData.owner = existingNode.owner;
                fileNodeData.group = existingNode.group || primaryGroup; // Also patch existing nodes if they are missing a group!
                fileNodeData.mode = existingNode.mode;
              }

              parentNode.children[fileName] = fileNodeData;

              FileSystemManager._updateNodeAndParentMtime(currentFilePath, nowISO);
              if(!(await FileSystemManager.save())) { // Removed 'currentUser' from save(), it's not needed
                await OutputManager.appendToOutput(`Error saving file '${currentFilePath}'. Changes might be lost.`, {
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
            } else {
              await OutputManager.appendToOutput(`Failed to save '${currentFilePath}'. Could not obtain parent directory.`, {
                typeClass: Config.CSS_CLASSES.ERROR_MSG
              });
              saveSuccess = false;
            }
          }
        }
      }
    }
    if(proceedToExit && saveSuccess) {
      OutputManager.setEditorActive(false);
      if(terminalMessage) {
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
          // ONLY trigger if Shift is NOT pressed
          if(!event.shiftKey && (currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML)) {
            event.preventDefault();
            _applyTextManipulation('italic');
          }
          // If Shift IS pressed, we do nothing, letting the browser handle it.
          break;
      }
    }
    setTimeout(_handleEditorSelectionChange, 0);
  }

  function _updateFormattingToolbarVisibility() {
    if(!isActiveState || !EditorUI || !EditorUI.elements || !EditorUI.elements.formattingToolbar) {
      console.warn("EditorManager: Formatting toolbar UI not ready.");
      return;
    }
    const isMarkdownOrHTML = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;
    EditorUI.elements.formattingToolbar.classList.toggle(EditorAppConfig.CSS_CLASSES.HIDDEN, !isMarkdownOrHTML);
  }
  return {
    isActive: () => isActiveState,
    enter,
    exit,
  };
})();