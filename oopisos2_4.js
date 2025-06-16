// oopisos.js - OopisOS Core Logic v2.4
// noinspection JSBitwiseOperatorUsage

const Utils = (() => {
  "use strict";

  function formatConsoleArgs(args) {
    return Array.from(args)
      .map((arg) =>
        typeof arg === "object" && arg !== null
          ? JSON.stringify(arg)
          : String(arg)
      )
      .join(" ");
  }

  function deepCopyNode(node) {
    return node ? JSON.parse(JSON.stringify(node)) : null;
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  function getFileExtension(filePath) {
    if (!filePath || typeof filePath !== "string") return "";
    const name = filePath.substring(
      filePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
    );
    const lastDot = name.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0 || lastDot === name.length - 1) {
      return "";
    }
    return name.substring(lastDot + 1).toLowerCase();
  }

  function createElement(tag, attributes = {}, ...childrenArgs) {
    const element = document.createElement(tag);
    for (const key in attributes) {
      if (attributes.hasOwnProperty(key)) {
        const value = attributes[key];
        if (key === "textContent") {
          element.textContent = value;
        } else if (key === "innerHTML") {
          element.innerHTML = value;
        } else if (key === "classList" && Array.isArray(value)) {
          value.forEach((cls) => {
            if (typeof cls === "string") {
              cls.split(" ").forEach((c) => {
                if (c) element.classList.add(c);
              });
            }
          });
        } else if (key === "className" && typeof value === "string") {
          value.split(" ").forEach((c) => {
            if (c) element.classList.add(c);
          });
        } else if (key === "style" && typeof value === "object") {
          for (const styleProp in value) {
            if (value.hasOwnProperty(styleProp)) {
              element.style[styleProp] = value[styleProp];
            }
          }
        } else if (key === "eventListeners" && typeof value === "object") {
          for (const eventType in value) {
            if (
              value.hasOwnProperty(eventType) &&
              typeof value[eventType] === "function"
            ) {
              element.addEventListener(eventType, value[eventType]); //False Positive
            }
          }
        } else if (value !== null && value !== undefined) {
          if (typeof value === "boolean") {
            if (value) element.setAttribute(key, "");
            else element.removeAttribute(key);
          } else {
            element.setAttribute(key, String(value));
          }
        }
      }
    }
    const childrenToProcess =
      childrenArgs.length === 1 && Array.isArray(childrenArgs[0])
        ? childrenArgs[0]
        : childrenArgs;
    childrenToProcess.forEach((child) => {
      if (child instanceof Node) element.appendChild(child);
      else if (typeof child === "string")
        element.appendChild(document.createTextNode(child));
      else if (child !== null && child !== undefined)
        console.warn(
          "Utils.createElement: Skipping unexpected child type:",
          child
        );
    });
    return element;
  }

  function validateArguments(argsArray, config = {}) {
    const argCount = argsArray.length;
    if (typeof config.exact === "number") {
      if (argCount !== config.exact)
        return {
          isValid: false,
          errorDetail: `expected exactly ${config.exact} argument(s) but got ${argCount}`,
        };
    } else {
      if (typeof config.min === "number" && argCount < config.min)
        return {
          isValid: false,
          errorDetail: `expected at least ${config.min} argument(s), but got ${argCount}`,
        };
      if (typeof config.max === "number" && argCount > config.max)
        return {
          isValid: false,
          errorDetail: `expected at most ${config.max} argument(s), but got ${argCount}`,
        };
    }
    return {
      isValid: true,
    };
  }

  function parseNumericArg(argString, options = {}) {
    const { allowFloat = false, allowNegative = false, min, max } = options;
    const num = allowFloat ? parseFloat(argString) : parseInt(argString, 10);
    if (isNaN(num))
      return {
        value: null,
        error: "is not a valid number",
      };
    if (!allowNegative && num < 0)
      return {
        value: null,
        error: "must be a non-negative number",
      };
    if (min !== undefined && num < min)
      return {
        value: null,
        error: `must be at least ${min}`,
      };
    if (max !== undefined && num > max)
      return {
        value: null,
        error: `must be at most ${max}`,
      };
    return {
      value: num,
      error: null,
    };
  }

  function validateUsernameFormat(username) {
    if (!username || typeof username !== "string" || username.trim() === "")
      return {
        isValid: false,
        error: "Username cannot be empty.",
      };
    if (username.includes(" "))
      return {
        isValid: false,
        error: "Username cannot contain spaces.",
      };
    if (Config.USER.RESERVED_USERNAMES.includes(username.toLowerCase()))
      return {
        isValid: false,
        error: `Cannot use '${username}'. This username is reserved.`,
      };
    if (username.length < Config.USER.MIN_USERNAME_LENGTH)
      return {
        isValid: false,
        error: `Username must be at least ${Config.USER.MIN_USERNAME_LENGTH} characters long.`,
      };
    if (username.length > Config.USER.MAX_USERNAME_LENGTH)
      return {
        isValid: false,
        error: `Username cannot exceed ${Config.USER.MAX_USERNAME_LENGTH} characters.`,
      };
    return {
      isValid: true,
      error: null,
    };
  }

  function parseFlags(argsArray, flagDefinitions) {
    const flags = {};
    const remainingArgs = [];
    // Initialize all defined flag names to their default state
    flagDefinitions.forEach((def) => {
      flags[def.name] = def.takesValue ? null : false;
    });
    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      let consumedAsFlag = false;
      // Function to check if an argument matches a flag definition (including aliases)
      const isFlagMatch = (definition, argument) => {
        const allIdentifiers = [
          definition.long,
          definition.short,
          ...(definition.aliases || []),
        ];
        return allIdentifiers.includes(argument);
      };
      // Function to find the definition that matches the argument
      const findDef = (argument) => {
        for (const def of flagDefinitions) {
          if (isFlagMatch(def, argument)) {
            return def;
          }
        }
        return null;
      };
      if (arg.startsWith("-") && arg.length > 1) {
        // Handle long flags (--flag) and exact short flags (-f)
        const def = findDef(arg);
        if (def) {
          if (def.takesValue) {
            if (i + 1 < argsArray.length) {
              flags[def.name] = argsArray[i + 1];
              i++; // Consume the value
            } else {
              console.warn(
                `Flag ${arg} expects a value, but none was provided.`
              );
              flags[def.name] = null; // Or handle as an error
            }
          } else {
            flags[def.name] = true;
          }
          consumedAsFlag = true;
        }
        // Handle combined short flags like -la (but not if it was an exact match above)
        else if (
          arg.startsWith("-") &&
          !arg.startsWith("--") &&
          arg.length > 2
        ) {
          const chars = arg.substring(1);
          let allCharsAreFlags = true;
          let tempCombinedFlags = {};
          let valueTaken = false;
          for (let j = 0; j < chars.length; j++) {
            const charAsFlag = "-" + chars[j];
            const charDef = findDef(charAsFlag);
            if (charDef) {
              if (charDef.takesValue) {
                // A value-taking flag must be the last in a combined group
                if (j === chars.length - 1) {
                  if (i + 1 < argsArray.length) {
                    tempCombinedFlags[charDef.name] = argsArray[i + 1];
                    valueTaken = true; // Mark that the next arg is consumed
                  } else {
                    console.warn(
                      `Flag ${charAsFlag} in group ${arg} expects a value, but none was provided.`
                    );
                    tempCombinedFlags[charDef.name] = null;
                  }
                } else {
                  console.warn(
                    `Value-taking flag ${charAsFlag} in combined group ${arg} must be at the end.`
                  );
                  allCharsAreFlags = false;
                  break;
                }
              } else {
                tempCombinedFlags[charDef.name] = true;
              }
            } else {
              allCharsAreFlags = false;
              break;
            }
          }
          if (allCharsAreFlags) {
            Object.assign(flags, tempCombinedFlags);
            consumedAsFlag = true;
            if (valueTaken) {
              i++; // Consume the value for the last flag in the group
            }
          }
        }
      }
      if (!consumedAsFlag) {
        remainingArgs.push(arg);
      }
    }
    return {
      flags,
      remainingArgs,
    };
  }

  function globToRegex(glob) {
    let regexStr = "^";
    for (let i = 0; i < glob.length; i++) {
      const char = glob[i];
      switch (char) {
        case "*":
          regexStr += ".*";
          break;
        case "?":
          regexStr += ".";
          break;
        case "[": {
          let charClass = "[";
          let k = i + 1;
          if (k < glob.length && (glob[k] === "!" || glob[k] === "^")) {
            charClass += "^";
            k++;
          }
          if (k < glob.length && glob[k] === "]") {
            charClass += "\\]";
            k++;
          }
          while (k < glob.length && glob[k] !== "]") {
            if (
              glob[k] === "-" &&
              charClass.length > 1 &&
              charClass[charClass.length - 1] !== "[" &&
              charClass[charClass.length - 1] !== "^" &&
              k + 1 < glob.length &&
              glob[k + 1] !== "]"
            ) {
              charClass += "-";
            } else if (/[.^${}()|[\]\\]/.test(glob[k])) {
              charClass += "\\" + glob[k];
            } else {
              charClass += glob[k];
            }
            k++;
          }
          if (k < glob.length && glob[k] === "]") {
            charClass += "]";
            i = k;
          } else {
            regexStr += "\\[";
            continue;
          }
          regexStr += charClass;
          break;
        }
        default:
          if (/[.^${}()|[\]\\]/.test(char)) {
            regexStr += "\\";
          }
          regexStr += char;
      }
    }
    regexStr += "$";
    try {
      return new RegExp(regexStr);
    } catch (e) {
      console.warn(
        `Utils.globToRegex: Failed to convert glob "${glob}" to regex: ${e.message}`
      );
      return null;
    }
  }
  return {
    formatConsoleArgs,
    deepCopyNode,
    formatBytes,
    getFileExtension,
    createElement,
    validateArguments,
    parseNumericArg,
    validateUsernameFormat,
    parseFlags,
    globToRegex,};
})();
const Config = (() => {
  "use strict";
  const defaultConfig = {
    DATABASE: {
      NAME: "OopisOsDB",
      VERSION: 2,
      FS_STORE_NAME: "FileSystemsStore",
      UNIFIED_FS_KEY: "OopisOS_SharedFS",
    },
    OS: {
      NAME: "OopisOs",
      VERSION: "2.4",
      DEFAULT_HOST_NAME: "OopisOs",
    },
    USER: {
      DEFAULT_NAME: "Guest",
      RESERVED_USERNAMES: ["guest", "root", "admin", "system"],
      MIN_USERNAME_LENGTH: 3,
      MAX_USERNAME_LENGTH: 20,
    },
    TERMINAL: {
      MAX_HISTORY_SIZE: 50,
      PROMPT_CHAR: ">", // Default prompt char - will be overridden by file
      PROMPT_SEPARATOR: ":",
      PROMPT_AT: "@",
    },
    STORAGE_KEYS: {
      USER_CREDENTIALS: "oopisOsUserCredentials",
      USER_TERMINAL_STATE_PREFIX: "oopisOsUserTerminalState_",
      MANUAL_TERMINAL_STATE_PREFIX: "oopisOsManualUserTerminalState_",
      EDITOR_WORD_WRAP_ENABLED: "oopisOsEditorWordWrapEnabled",
      ALIAS_DEFINITIONS: "oopisOsAliasDefinitions",
      GEMINI_API_KEY: "oopisGeminiApiKey",
      USER_GROUPS: "oopisOsUserGroups",
    },
    CSS_CLASSES: {
      ERROR_MSG: "text-red-500",
      SUCCESS_MSG: "text-lime-400",
      CONSOLE_LOG_MSG: "text-neutral-400",
      WARNING_MSG: "text-amber-400",
      EDITOR_MSG: "text-sky-400",
      DIR_ITEM: "text-sky-400 font-semibold",
      FILE_ITEM: "text-green-500",
      OUTPUT_LINE:
        "whitespace-pre-wrap break-words overflow-x-hidden min-h-[1.2em] leading-[1.2em]",
      HIDDEN: "hidden",
    },
    FILESYSTEM: {
      ROOT_PATH: "/",
      CURRENT_DIR_SYMBOL: ".",
      PARENT_DIR_SYMBOL: "..",
      DEFAULT_DIRECTORY_TYPE: "directory",
      DEFAULT_FILE_TYPE: "file",
      PATH_SEPARATOR: "/",
      DEFAULT_FILE_MODE: 0o644,
      DEFAULT_DIR_MODE: 0o755,
      DEFAULT_SCRIPT_MODE: 0o755,
      DEFAULT_SH_MODE: 0o755,
      PERMISSION_BIT_READ: 0b100,
      PERMISSION_BIT_WRITE: 0b010,
      PERMISSION_BIT_EXECUTE: 0b001,
      MAX_VFS_SIZE: 640 * 1024 * 1024,
    },
    MESSAGES: {
      PERMISSION_DENIED_SUFFIX: ": Permission denied",
      CONFIRMATION_PROMPT:
        "Type 'YES' (all caps) to confirm, or any other input to cancel.",
      OPERATION_CANCELLED: "Operation cancelled.",
      ALREADY_LOGGED_IN_AS_PREFIX: "Already logged in as '",
      ALREADY_LOGGED_IN_AS_SUFFIX: "'.",
      NO_ACTION_TAKEN: "No action taken.",
      ALREADY_IN_DIRECTORY_PREFIX: "Already in '",
      ALREADY_IN_DIRECTORY_SUFFIX: "'.",
      DIRECTORY_EMPTY: "Directory is empty.",
      TIMESTAMP_UPDATED_PREFIX: "Timestamp of '",
      TIMESTAMP_UPDATED_SUFFIX: "' updated.",
      FILE_CREATED_SUFFIX: "' created.",
      ITEM_REMOVED_SUFFIX: "' removed.",
      FORCIBLY_REMOVED_PREFIX: "Forcibly removed '",
      FORCIBLY_REMOVED_SUFFIX: "'.",
      REMOVAL_CANCELLED_PREFIX: "Removal of '",
      REMOVAL_CANCELLED_SUFFIX: "' cancelled.",
      MOVED_PREFIX: "Moved '",
      MOVED_TO: "' to '",
      MOVED_SUFFIX: "'.",
      COPIED_PREFIX: "Copied '",
      COPIED_TO: "' to '",
      COPIED_SUFFIX: "'.",
      SESSION_SAVED_FOR_PREFIX: "Session manually saved for ",
      SESSION_LOADED_MSG: "Session loaded from manual save.",
      LOAD_STATE_CANCELLED: "Load state cancelled.",
      NO_MANUAL_SAVE_FOUND_PREFIX: "No manually saved state found for ",
      WELCOME_PREFIX: "Aloha,", // Original hardcoded default (NO trailing space here!)
      WELCOME_SUFFIX: "! Type 'help' for commands.",
      EXPORTING_PREFIX: "Exporting '",
      EXPORTING_SUFFIX: "'... Check your browser downloads.",
      BACKUP_CREATING_PREFIX: "Creating backup '",
      BACKUP_CREATING_SUFFIX: "'... Check your browser downloads.",
      RESTORE_CANCELLED_NO_FILE: "Restore cancelled: No file selected.",
      RESTORE_SUCCESS_PREFIX: "Session for user '",
      RESTORE_SUCCESS_MIDDLE: "' successfully restored from '",
      RESTORE_SUCCESS_SUFFIX: "'.",
      UPLOAD_NO_FILE: "Upload cancelled: No file selected.",
      UPLOAD_INVALID_TYPE_PREFIX: "Error: Invalid file type '",
      UPLOAD_INVALID_TYPE_SUFFIX:
        "'. Only .txt, .md, .html, .sh, .js, .css, .json files are allowed.",
      UPLOAD_SUCCESS_PREFIX: "File '",
      UPLOAD_SUCCESS_MIDDLE: "' uploaded successfully to '",
      UPLOAD_SUCCESS_SUFFIX: "'.",
      UPLOAD_READ_ERROR_PREFIX: "Error reading file '",
      UPLOAD_READ_ERROR_SUFFIX: "'.",
      NO_COMMANDS_IN_HISTORY: "No commands in history.",
      EDITOR_DISCARD_CONFIRM: "Care to save your work?",
      BACKGROUND_PROCESS_STARTED_PREFIX: "[",
      BACKGROUND_PROCESS_STARTED_SUFFIX: "] Backgrounded.",
      BACKGROUND_PROCESS_OUTPUT_SUPPRESSED:
        "[Output suppressed for background process]",
      PIPELINE_ERROR_PREFIX: "Pipeline error in command: ",
      PASSWORD_PROMPT: "Enter password:",
      PASSWORD_CONFIRM_PROMPT: "Confirm password:",
      PASSWORD_MISMATCH: "Passwords do not match. User registration cancelled.",
      INVALID_PASSWORD: "Incorrect password. Please try again.",
      EMPTY_PASSWORD_NOT_ALLOWED: "Password cannot be empty.",
    },
    INTERNAL_ERRORS: {
      DB_NOT_INITIALIZED_FS_SAVE: "DB not initialized for FS save",
      DB_NOT_INITIALIZED_FS_LOAD: "DB not initialized for FS load",
      DB_NOT_INITIALIZED_FS_DELETE: "DB not initialized for FS delete",
      DB_NOT_INITIALIZED_FS_CLEAR: "DB not initialized for clearing all FS",
      CORRUPTED_FS_DATA_PRE_SAVE: "Corrupted FS data before saving.",
      SOURCE_NOT_FOUND_IN_PARENT_PREFIX: "internal error: source '",
      SOURCE_NOT_FOUND_IN_PARENT_MIDDLE: "' not found in parent '",
      SOURCE_NOT_FOUND_IN_PARENT_SUFFIX: "'",
    },
    API: {
      GEMINI_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent"
    },
  };
  // The active configuration object, initialized with defaults
  let currentConfig = Utils.deepCopyNode(defaultConfig);
  /**
   * Helper to parse string values from config file into appropriate types.
   * @param {string} valueStr - The string value from the config file.
   * @returns {*} The parsed value (number, boolean, or string).
   */
  function parseConfigValue(valueStr) {
    if (typeof valueStr !== "string") return valueStr; // Return non-strings as-is

    const lowercasedVal = valueStr.toLowerCase();
    if (lowercasedVal === "true") return true;
    if (lowercasedVal === "false") return false;

    // Check if it's a number (integer or float)
    const num = Number(valueStr);
    if (!isNaN(num) && valueStr.trim() !== "") {
      return num;
    }

    // Default to returning the string as-is
    return valueStr;
  }
  /**
   * Helper to set a nested property on an object using a dot-notation path.
   * @param {object} obj - The object to modify.
   * @param {string} path - The dot-notation path (e.g., "TERMINAL.PROMPT_CHAR").
   * @param {*} value - The value to set.
   */
  function setNestedProperty(obj, path, value) {
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {}; // Create nested object if it doesn't exist
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = parseConfigValue(value);
  }
  /**
   * Attempts to load configuration overrides from /etc/oopis.conf.
   * This function should be called after FileSystemManager is loaded.
   */
  async function loadFromFile() {
    const configFilePath = "/etc/oopis.conf";
    // Using try-catch to handle potential errors during FS access or parsing.
    try {
      const configNode = FileSystemManager.getNodeByPath(configFilePath);
      // If the file doesn't exist, we just use the defaults and log a warning.
      // This should ideally not happen if initialize() creates it reliably.
      if (!configNode) {
        console.warn(
          `Config: '${configFilePath}' not found. Using default configuration.`
        );
        return;
      }
      // Basic validation for the config file node.
      if (configNode.type !== defaultConfig.FILESYSTEM.DEFAULT_FILE_TYPE) {
        console.warn(
          `Config: '${configFilePath}' is not a file. Using default configuration.`
        );
        return;
      }
      // Check read permission on the config file. Root user or owner needs read access.
      // We explicitly allow root to read anything.
      const currentUser = UserManager.getCurrentUser().name;
      if (!FileSystemManager.hasPermission(configNode, currentUser, "read")) {
        console.warn(
          `Config: Permission denied to read '${configFilePath}'. Using default configuration.`
        );
        return;
      }
      const content = configNode.content || "";
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmedLine = line.trim();
        // Skip comments and empty lines.
        if (trimmedLine.startsWith("#") || trimmedLine === "") {
          continue;
        }
        const parts = trimmedLine.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          // Join the rest of the parts in case the value itself contains an '='
          const value = parts.slice(1).join("=").trim();
          // Only apply overrides for keys that exist in our defaultConfig structure.
          // This prevents accidental creation of new config properties.
          let tempCheck = defaultConfig;
          let keyExistsInDefaults = true;
          const keyParts = key.split(".");
          for (const part of keyParts) {
            if (
              tempCheck &&
              typeof tempCheck === "object" &&
              tempCheck.hasOwnProperty(part)
            ) {
              tempCheck = tempCheck[part];
            } else {
              keyExistsInDefaults = false;
              break;
            }
          }
          if (keyExistsInDefaults) {
            setNestedProperty(currentConfig, key, value);
          } else {
            console.warn(
              `Config: Unknown or invalid key path '${key}' in '${configFilePath}'. Ignoring.`
            );
          }
        } else {
          console.warn(
            `Config: Malformed line in '${configFilePath}': '${trimmedLine}'. Ignoring.`
          );
        }
      }
      console.log(`Config: Configuration loaded from '${configFilePath}'.`);
    } catch (error) {
      console.error(
        `Config: Error loading or parsing '${configFilePath}':`,
        error
      );
      // Fallback to default configuration in case of any runtime error during loading.
    }
  }
  return {
    ...currentConfig, // Spreads all properties of currentConfig
    loadFromFile, // Exposes the function to load config from file
  };
})();
let DOM = {};
const ModalManager = (() => {
  "use strict";
  let isAwaitingTerminalInput = false;
  let activeModalContext = null;
  // Private function to render the graphical modal (logic from EditorModal)
  function _renderGraphicalModal(options) {
    const {
      messageLines,
      onConfirm,
      onCancel,
      confirmText = "OK",
      cancelText = "Cancel",
    } = options;
    const parentContainer = DOM.terminalBezel;
    if (!parentContainer) {
      console.error(
        "ModalManager: Cannot find terminal-bezel to attach modal."
      );
      if (options.onCancel) options.onCancel();
      return;
    }
    // The CSS for #editor-modal-dialog uses `position: absolute`, so its parent
    // needs a non-static position. We'll ensure it's relative.
    const originalParentPosition = parentContainer.style.position;
    if (window.getComputedStyle(parentContainer).position === "static") {
      parentContainer.style.position = "relative";
    }
    const removeModal = () => {
      const modal = document.getElementById("editor-modal-dialog");
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      // Restore original position style to avoid side effects
      parentContainer.style.position = originalParentPosition;
    };
    // Use the specific CSS classes and IDs from terminal.css
    const confirmButton = Utils.createElement("button", {
      className: "btn-editor-modal btn-confirm",
      textContent: confirmText,
      eventListeners: {
        click: () => {
          removeModal();
          if (onConfirm) onConfirm();
        },
      },
    });
    const cancelButton = Utils.createElement("button", {
      className: "btn-editor-modal btn-cancel",
      textContent: cancelText,
      eventListeners: {
        click: () => {
          removeModal();
          if (onCancel) onCancel();
        },
      },
    });
    const buttonContainer = Utils.createElement(
      "div",
      {
        className: "editor-modal-buttons",
      },
      [confirmButton, cancelButton]
    );
    const messageContainer = Utils.createElement("div");
    messageLines.forEach((line) => {
      messageContainer.appendChild(
        Utils.createElement("p", {
          textContent: line,
        })
      );
    });
    const modalDialog = Utils.createElement(
      "div",
      {
        id: "editor-modal-dialog",
      },
      [messageContainer, buttonContainer]
    );
    parentContainer.appendChild(modalDialog);
  }
  // --- FIX STARTS HERE ---
  // The missing function is defined and now includes logic to restore the input line.
  function _renderTerminalPrompt(options) {
    if (isAwaitingTerminalInput) {
      void OutputManager.appendToOutput(
        "ModalManager: Another terminal prompt is already active.",
        {
          typeClass: Config.CSS_CLASSES.WARNING_MSG,
        }
      );
      if (options.onCancel) options.onCancel();
      return;
    }
    isAwaitingTerminalInput = true;
    activeModalContext = {
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      data: options.data || {},
    };
    options.messageLines.forEach((line) => {
      void OutputManager.appendToOutput(line, {
        typeClass: Config.CSS_CLASSES.WARNING_MSG,
      });
    });
    void OutputManager.appendToOutput(Config.MESSAGES.CONFIRMATION_PROMPT, {
      typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
    });
    // This is the crucial part: The command executor hides the input line
    // before running the command. A modal that requires terminal input
    // must explicitly un-hide it to break the deadlock.
    if (DOM.inputLineContainerDiv) {
      DOM.inputLineContainerDiv.classList.remove(Config.CSS_CLASSES.HIDDEN);
    }
    TerminalUI.setInputState(true); // Also ensure it's editable.
    TerminalUI.focusInput();
    TerminalUI.clearInput();
    if (DOM.outputDiv) {
      DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
    }
  }
  function request(options) {
    if (options.context === "graphical") {
      _renderGraphicalModal(options);
    } else {
      // Default to terminal
      _renderTerminalPrompt(options);
    }
  }
  // New function to handle input when a terminal prompt is active
  async function handleTerminalInput(input) {
    if (!isAwaitingTerminalInput) return false;
    const promptString = `${DOM.promptUserSpan.textContent}${Config.TERMINAL.PROMPT_AT}${DOM.promptHostSpan.textContent}${Config.TERMINAL.PROMPT_SEPARATOR}${DOM.promptPathSpan.textContent}${Config.TERMINAL.PROMPT_CHAR} `;
    await OutputManager.appendToOutput(`${promptString}${input.trim()}`);
    if (input.trim() === "YES") {
      await activeModalContext.onConfirm(activeModalContext.data);
    } else {
      if (typeof activeModalContext.onCancel === "function") {
        await activeModalContext.onCancel(activeModalContext.data);
      } else {
        await OutputManager.appendToOutput(
          Config.MESSAGES.OPERATION_CANCELLED,
          {
            typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
          }
        );
      }
    }
    isAwaitingTerminalInput = false;
    activeModalContext = null;
    return true; // Indicates the input was consumed by the modal manager
  }

  function isAwaiting() {
    return isAwaitingTerminalInput;
  }
  return {
    request,
    handleTerminalInput,
    isAwaiting,
  };
})();
const TimestampParser = (() => {
  "use strict";

  // --- NEW: General purpose date string parser ---
  function parseDateString(dateStr) {
    if (typeof dateStr !== "string") return null;

    // Case 1: Relative time like "-5 hours", "1 day ago"
    const relativeMatch = dateStr.match(
      /([-+]|ago$)?\s*(\d+)\s*(minute|hour|day|week|month|year)s?/i
    );
    if (relativeMatch) {
      let sign = relativeMatch[1] === "-" ? -1 : 1;
      if (dateStr.toLowerCase().endsWith("ago")) {
        sign = -1;
      }
      const amount = parseInt(relativeMatch[2], 10);
      const unit = relativeMatch[3].toLowerCase();
      const now = new Date(); // Using current time: 2025-06-14T22:55:57.000Z

      switch (unit) {
        case "minute":
          now.setMinutes(now.getMinutes() + sign * amount);
          break;
        case "hour":
          now.setHours(now.getHours() + sign * amount);
          break;
        case "day":
          now.setDate(now.getDate() + sign * amount);
          break;
        case "week":
          now.setDate(now.getDate() + sign * amount * 7);
          break;
        case "month":
          now.setMonth(now.getMonth() + sign * amount);
          break;
        case "year":
          now.setFullYear(now.getFullYear() + sign * amount);
          break;
        default:
          return null;
      }
      return now;
    }

    // Case 2: Absolute date string like "2025-06-15" or "2025-06-15T10:00:00"
    const absoluteDate = new Date(dateStr);
    if (!isNaN(absoluteDate.getTime())) {
      return absoluteDate;
    }

    return null; // Return null if format is not recognized
  }

  // --- EXISTING: Logic for the `touch` command's -t flag ---
  function parseStampToISO(stampStr) {
    let year,
      monthVal,
      day,
      hours,
      minutes,
      seconds = 0;
    const currentDate = new Date();
    let s = stampStr;
    if (s.includes(".")) {
      const parts = s.split(".");
      if (
        parts.length !== 2 ||
        parts[1].length !== 2 ||
        isNaN(parseInt(parts[1], 10))
      )
        return null;
      seconds = parseInt(parts[1], 10);
      if (seconds < 0 || seconds > 59) return null;
      s = parts[0];
    }
    if (s.length === 12) {
      year = parseInt(s.substring(0, 4), 10);
      monthVal = parseInt(s.substring(4, 6), 10);
      day = parseInt(s.substring(6, 8), 10);
      hours = parseInt(s.substring(8, 10), 10);
      minutes = parseInt(s.substring(10, 12), 10);
    } else if (s.length === 10) {
      const YY = parseInt(s.substring(0, 2), 10);
      if (isNaN(YY)) return null;
      year = YY < 69 ? 2000 + YY : 1900 + YY;
      monthVal = parseInt(s.substring(2, 4), 10);
      day = parseInt(s.substring(4, 6), 10);
      hours = parseInt(s.substring(6, 8), 10);
      minutes = parseInt(s.substring(8, 10), 10);
    } else if (s.length === 8) {
      year = currentDate.getFullYear();
      monthVal = parseInt(s.substring(0, 2), 10);
      day = parseInt(s.substring(2, 4), 10);
      hours = parseInt(s.substring(4, 6), 10);
      minutes = parseInt(s.substring(6, 8), 10);
    } else return null;
    if (
      isNaN(year) ||
      isNaN(monthVal) ||
      isNaN(day) ||
      isNaN(hours) ||
      isNaN(minutes)
    )
      return null;
    if (
      monthVal < 1 ||
      monthVal > 12 ||
      day < 1 ||
      day > 31 ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    )
      return null;
    const dateObj = new Date(
      Date.UTC(year, monthVal - 1, day, hours, minutes, seconds)
    );
    if (
      dateObj.getUTCFullYear() !== year ||
      dateObj.getUTCMonth() !== monthVal - 1 ||
      dateObj.getUTCDate() !== day ||
      dateObj.getUTCHours() !== hours ||
      dateObj.getUTCMinutes() !== minutes ||
      dateObj.getUTCSeconds() !== seconds
    )
      return null;
    return dateObj.toISOString();
  }

  function resolveTimestampFromCommandFlags(flags, commandName) {
    const nowActualISO = new Date().toISOString();

    if (flags.dateString && flags.stamp) {
      // Both flags are present, which is ambiguous.
      // Output an error message to the user.
    } else if (flags.dateString) {
      // --- UPGRADE THIS PART ---
      // Handle the dateString flag.
    } else if (flags.stamp) {
      // Handle the stamp flag.
    }

    if (!flags.stamp) {
      return { timestampISO: nowActualISO, error: null };
    } else {
      const parsedISO = parseStampToISO(flags.stamp);
      if (!parsedISO) {
        return {
          timestampISO: null,
          error: `${commandName}: invalid stamp format '${flags.stamp}' (expected [[CC]YY]MMDDhhmm[.ss])`,
        };
      }
      return { timestampISO: parsedISO, error: null };
    }
  }
  return {
    parseDateString, // <-- Exposing the new function
    resolveTimestampFromCommandFlags,
  };
})();
const DiffUtils = (() => {
  "use strict";

  function compare(textA, textB) {
    const a = textA.split('\n');
    const b = textB.split('\n');
    const N = a.length;
    const M = b.length;
    const max = N + M;
    const v = new Array(2 * max + 1).fill(0);
    const trace = [];

    for (let d = 0; d <= max; d++) {
      trace.push([...v]);
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
          x = v[k + 1 + max]; // Insertion
        } else {
          x = v[k - 1 + max] + 1; // Deletion
        }

        let y = x - k;

        while (x < N && y < M && a[x] === b[y]) {
          x++;
          y++;
        }

        v[k + max] = x;

        if (x >= N && y >= M) {
          // --- Backtrack to find the path ---
          let diffOutput = [];
          let px = N;
          let py = M;

          for (let td = d; td > 0; td--) {
            const prev_v = trace[td - 1];
            const p_k = px - py;

            let prev_k;
            if (p_k === -td || (p_k !== td && prev_v[p_k - 1 + max] < prev_v[p_k + 1 + max])) {
              prev_k = p_k + 1;
            } else {
              prev_k = p_k - 1;
            }

            let prev_x = prev_v[prev_k + max];
            let prev_y = prev_x - prev_k;

            while (px > prev_x && py > prev_y) {
              diffOutput.unshift(`  ${a[px - 1]}`);
              px--;
              py--;
            }

            if (td > 0) {
              if (prev_x < px) {
                diffOutput.unshift(`< ${a[px - 1]}`); // Deletion
              } else {
                diffOutput.unshift(`> ${b[py - 1]}`); // Insertion
              }
            }
            px = prev_x;
            py = prev_y;
          }

          while (px > 0 && py > 0) {
            diffOutput.unshift(`  ${a[px - 1]}`);
            px--;
            py--;
          }

          return diffOutput.join('\n');
        }
      }
    }
    // This part is reached only if files are identical or on error.
    return "";
  }

  return {
    compare
  };
})();
const OutputManager = (() => {
  "use strict";
  let isEditorActive = false;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  function setEditorActive(status) {
    isEditorActive = status;
  }
  async function appendToOutput(text, options = {}) {
    if (
      isEditorActive &&
      options.typeClass !== Config.CSS_CLASSES.EDITOR_MSG &&
      !options.isCompletionSuggestion
    )
      return;
    if (!DOM.outputDiv) {
      originalConsoleError(
        "OutputManager.appendToOutput: DOM.outputDiv is not defined. Message:",
        text
      );
      return;
    }
    const { typeClass = null, isBackground = false } = options;

    // This logic needs to be slightly different for textContent vs innerHTML
    if (
      isBackground &&
      DOM.inputLineContainerDiv &&
      !DOM.inputLineContainerDiv.classList.contains(Config.CSS_CLASSES.HIDDEN)
    ) {
      const promptText = `${DOM.promptUserSpan.textContent}${Config.TERMINAL.PROMPT_AT}${DOM.promptHostSpan.textContent}${Config.TERMINAL.PROMPT_SEPARATOR}${DOM.promptPathSpan.textContent}${Config.TERMINAL.PROMPT_CHAR} `;
      const currentInputVal = TerminalUI.getCurrentInputValue();
      const echoLine = Utils.createElement("div", {
        className: Config.CSS_CLASSES.OUTPUT_LINE,
        // Use textContent here as well for consistency and safety.
        textContent: `${promptText}${currentInputVal}`,
      });
      DOM.outputDiv.appendChild(echoLine);
    }

    const lines = String(text).split("\n");
    const fragment = document.createDocumentFragment();

    for (const line of lines) {
      const lineClasses = Config.CSS_CLASSES.OUTPUT_LINE.split(" ");
      const lineAttributes = {
        classList: [...lineClasses],
        // The main event: switch from innerHTML to textContent
        textContent: line,
      };

      if (typeClass) {
        typeClass.split(" ").forEach((cls) => {
          if (cls) lineAttributes.classList.push(cls);
        });
      }

      fragment.appendChild(Utils.createElement("div", lineAttributes));
    }

    DOM.outputDiv.appendChild(fragment);
    DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
  }

  function clearOutput() {
    if (!isEditorActive && DOM.outputDiv) DOM.outputDiv.innerHTML = "";
  }

  function _consoleLogOverride(...args) {
    if (
      DOM.outputDiv &&
      typeof Utils !== "undefined" &&
      typeof Utils.formatConsoleArgs === "function"
    )
      void appendToOutput(`LOG: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
      });
    originalConsoleLog.apply(console, args);
  }

  function _consoleWarnOverride(...args) {
    if (
      DOM.outputDiv &&
      typeof Utils !== "undefined" &&
      typeof Utils.formatConsoleArgs === "function"
    )
      void appendToOutput(`WARN: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.WARNING_MSG,
      });
    originalConsoleWarn.apply(console, args);
  }

  function _consoleErrorOverride(...args) {
    if (
      DOM.outputDiv &&
      typeof Utils !== "undefined" &&
      typeof Utils.formatConsoleArgs === "function"
    )
      void appendToOutput(`ERROR: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.ERROR_MSG,
      });
    originalConsoleError.apply(console, args);
  }

  function initializeConsoleOverrides() {
    if (
      typeof Utils === "undefined" ||
      typeof Utils.formatConsoleArgs !== "function"
    ) {
      originalConsoleError(
        "OutputManager: Cannot initialize console overrides, Utils or Utils.formatConsoleArgs is not defined."
      );
      return;
    }
    console.log = _consoleLogOverride;
    console.warn = _consoleWarnOverride;
    console.error = _consoleErrorOverride;
  }
  return {
    setEditorActive,
    appendToOutput,
    clearOutput,
    initializeConsoleOverrides,
  };
})();
const StorageManager = (() => {
  "use strict";

  function loadItem(key, itemName, defaultValue = null) {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) {
        if (key === Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED)
          return storedValue === "true";
        try {
          return JSON.parse(storedValue);
        } catch (e) {
          return storedValue;
        }
      }
    } catch (e) {
      const errorMsg = `Warning: Could not load ${itemName} for key '${key}' from localStorage. Error: ${e.message}. Using default value.`;
      if (
        typeof OutputManager !== "undefined" &&
        typeof void OutputManager.appendToOutput === "function"
      )
        void OutputManager.appendToOutput(errorMsg, {
          typeClass: Config.CSS_CLASSES.WARNING_MSG,
        });
      else console.warn(errorMsg);
    }
    return defaultValue;
  }

  function saveItem(key, data, itemName) {
    try {
      const valueToStore =
        typeof data === "object" && data !== null
          ? JSON.stringify(data)
          : String(data);
      localStorage.setItem(key, valueToStore);
      return true;
    } catch (e) {
      const errorMsg = `Error saving ${itemName} for key '${key}' to localStorage. Data may be lost. Error: ${e.message}`;
      if (
        typeof OutputManager !== "undefined" &&
        typeof OutputManager.appendToOutput === "function"
      )
        void OutputManager.appendToOutput(errorMsg, {
          typeClass: Config.CSS_CLASSES.ERROR_MSG,
        });
      else console.error(errorMsg);
    }
    return false;
  }

  function removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(
        `StorageManager: Could not remove item for key '${key}'. Error: ${e.message}`
      );
    }
  }

  function getAllLocalStorageKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) keys.push(key);
      }
    } catch (e) {
      console.error(
        `StorageManager: Could not retrieve all localStorage keys. Error: ${e.message}`
      );
    }
    return keys;
  }
  return {
    loadItem,
    saveItem,
    removeItem,
    getAllLocalStorageKeys,
  };
})();
const IndexedDBManager = (() => {
  "use strict";
  let dbInstance = null;
  let hasLoggedNormalInitialization = false;

  function init() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }
      if (!window.indexedDB) {
        const errorMsg =
          "Error: IndexedDB is not supported by your browser. File system features will be unavailable.";
        if (
          typeof OutputManager !== "undefined" &&
          typeof OutputManager.appendToOutput === "function"
        )
          void OutputManager.appendToOutput(errorMsg, {
            typeClass: Config.CSS_CLASSES.ERROR_MSG,
          });
        else console.error(errorMsg);
        reject(new Error("IndexedDB not supported."));
        return;
      }
      const request = indexedDB.open(
        Config.DATABASE.NAME,
        Config.DATABASE.VERSION
      );
      request.onupgradeneeded = (event) => {
        const tempDb = event.target.result;
        if (!tempDb.objectStoreNames.contains(Config.DATABASE.FS_STORE_NAME))
          tempDb.createObjectStore(Config.DATABASE.FS_STORE_NAME, {
            keyPath: "id",
          });
      };
      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        if (!hasLoggedNormalInitialization) {
          if (
            typeof OutputManager !== "undefined" &&
            typeof OutputManager.appendToOutput === "function"
          )
            setTimeout(
              () =>
                OutputManager.appendToOutput("FileSystem DB initialized.", {
                  typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                }),
              100
            );
          else
            console.log(
              "FileSystem DB initialized (OutputManager not ready for terminal log)."
            );
          hasLoggedNormalInitialization = true;
        }
        resolve(dbInstance);
      };
      request.onerror = (event) => {
        const errorMsg =
          "Error: OopisOs could not access its file system storage. This might be due to browser settings (e.g., private Browse mode, disabled storage, or full storage). Please check your browser settings and try again. Some features may be unavailable.";
        if (
          typeof OutputManager !== "undefined" &&
          typeof OutputManager.appendToOutput === "function"
        )
          void OutputManager.appendToOutput(errorMsg, {
            typeClass: Config.CSS_CLASSES.ERROR_MSG,
          });
        else console.error(errorMsg);
        console.error("IndexedDB Database error details: ", event.target.error);
        reject(event.target.error);
      };
    });
  }

  function getDbInstance() {
    if (!dbInstance) {
      const errorMsg =
        "Error: OopisOs file system storage (IndexedDB) is not available. Please ensure browser storage is enabled and the page is reloaded.";
      if (
        typeof OutputManager !== "undefined" &&
        typeof OutputManager.appendToOutput === "function"
      )
        void OutputManager.appendToOutput(errorMsg, {
          typeClass: Config.CSS_CLASSES.ERROR_MSG,
        });
      else console.error(errorMsg);
      throw new Error(Config.INTERNAL_ERRORS.DB_NOT_INITIALIZED_FS_LOAD);
    }
    return dbInstance;
  }
  return {
    init,
    getDbInstance,
  };
})();
const FileSystemManager = (() => {
  "use strict";
  let fsData = {};
  let currentPath = Config.FILESYSTEM.ROOT_PATH;
  const OOPIS_CONF_CONTENT = `TERMINAL.PROMPT_CHAR=>
OS.DEFAULT_HOST_NAME=OopisOS
MESSAGES.WELCOME_PREFIX=Greetings and Salutations,
MESSAGES.WELCOME_SUFFIX=! Welcome to OopisOS!`;
  async function initialize(guestUsername) {
    const nowISO = new Date().toISOString();
    fsData = {
      [Config.FILESYSTEM.ROOT_PATH]: {
        type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
        children: {
          home: {
            type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
            children: {},
            owner: "root",
            group: "root",
            mode: 0o755,
            mtime: nowISO,
          },
          etc: {
            type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
            children: {},
            owner: "root",
            group: "root",
            mode: 0o755,
            mtime: nowISO,
          },
        },
        owner: "root",
        group: "root",
        mode: 0o755,
        mtime: nowISO,
      },
    };
    await createUserHomeDirectory("root");
    await createUserHomeDirectory(guestUsername); // which is 'Guest'
    await createUserHomeDirectory("userDiag");
    const rootNode = fsData[Config.FILESYSTEM.ROOT_PATH];
    if (rootNode) {
      // Create /etc directory
      if (rootNode) {
        // Overwrite the placeholder 'etc' to ensure it's correct
        rootNode.children["etc"] = {
          type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
          children: {},
          owner: "root",
          group: "root", // Correctly added
          mode: 0o755,
          mtime: nowISO,
        };
        rootNode.mtime = nowISO;

        const etcNode = rootNode.children["etc"];
        if (etcNode) {
          // Create oopis.conf inside /etc
          etcNode.children["oopis.conf"] = {
            type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
            content: OOPIS_CONF_CONTENT,
            owner: "root",
            group: "root", // Correctly added
            mode: 0o644,
            mtime: nowISO,
          };
          etcNode.mtime = nowISO;
        } else {
          console.error("FileSystemManager: Failed to create /etc directory.");
        }
      } else {
        console.error(
          "FileSystemManager: Root node not found during initialization. Critical error."
        );
      }
    } else {
      console.error(
        "FileSystemManager: Root node not found during initialization. Critical error."
      );
    }
  }
  async function createUserHomeDirectory(username) {
    if (!fsData["/"]?.children?.home) {
      console.error(
        "FileSystemManager: Cannot create user home directory, /home does not exist."
      );
      return;
    }
    const homeDirNode = fsData["/"].children.home;
    if (!homeDirNode.children[username]) {
      homeDirNode.children[username] = {
        type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
        children: {},
        owner: username,
        group: username, // <<< ADD THIS
        mode: 0o700, // Use 3 digits
        mtime: new Date().toISOString(),
      };
      homeDirNode.mtime = new Date().toISOString();
    }
  }
  async function save() {
    const totalSize = _calculateTotalSize();
    if (totalSize > Config.FILESYSTEM.MAX_VFS_SIZE) {
      const errorMsg = `Disk quota exceeded. (Usage: ${Utils.formatBytes(
        totalSize
      )} / ${Utils.formatBytes(
        Config.FILESYSTEM.MAX_VFS_SIZE
      )}). Reverting last operation.`;
      await OutputManager.appendToOutput(errorMsg, {
        typeClass: Config.CSS_CLASSES.ERROR_MSG,
      });
      // Critical: Roll back the in-memory FS to the last saved state to prevent corruption.
      await load();
      return false; // Indicate save failure
    }
    // --- Original Save Logic (if quota check passes) ---
    let db;
    try {
      db = IndexedDBManager.getDbInstance();
    } catch (e) {
      await OutputManager.appendToOutput(
        "Error: File system storage not available for saving.",
        {
          typeClass: Config.CSS_CLASSES.ERROR_MSG,
        }
      );
      return Promise.reject(Config.INTERNAL_ERRORS.DB_NOT_INITIALIZED_FS_SAVE);
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [Config.DATABASE.FS_STORE_NAME],
        "readwrite"
      );
      const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
      const request = store.put({
        id: Config.DATABASE.UNIFIED_FS_KEY,
        data: Utils.deepCopyNode(fsData),
      });
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => {
        OutputManager.appendToOutput(
          "Error: OopisOs failed to save the file system.",
          {
            typeClass: Config.CSS_CLASSES.ERROR_MSG,
          }
        );
        reject(event.target.error);
      };
    });
  }
  async function load() {
    let db;
    try {
      db = IndexedDBManager.getDbInstance();
    } catch (e) {
      await initialize(Config.USER.DEFAULT_NAME);
      return Promise.reject(Config.INTERNAL_ERRORS.DB_NOT_INITIALIZED_FS_LOAD);
    }
    return new Promise(async (resolve, reject) => {
      const transaction = db.transaction(
        [Config.DATABASE.FS_STORE_NAME],
        "readonly"
      );
      const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
      const request = store.get(Config.DATABASE.UNIFIED_FS_KEY);
      request.onsuccess = async (event) => {
        const result = event.target.result;
        if (result && result.data) {
          fsData = result.data;
        } else {
          await OutputManager.appendToOutput(
            "No file system found. Initializing new one.",
            {
              typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            }
          );
          await initialize(Config.USER.DEFAULT_NAME);
          await save();
        }
        resolve();
      };
      request.onerror = async (event) => {
        await initialize(Config.USER.DEFAULT_NAME);
        reject(event.target.error);
      };
    });
  }

  async function clearAllFS() {
    let db;
    try {
      db = IndexedDBManager.getDbInstance();
    } catch (e) {
      await OutputManager.appendToOutput(
        "Error: File system storage not available for clearing all data.",
        {
          typeClass: Config.CSS_CLASSES.ERROR_MSG,
        }
      );
      return Promise.reject(Config.INTERNAL_ERRORS.DB_NOT_INITIALIZED_FS_CLEAR);
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [Config.DATABASE.FS_STORE_NAME],
        "readwrite"
      );
      const store = transaction.objectStore(Config.DATABASE.FS_STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => {
        console.error("Error clearing FileSystemsStore:", event.target.error);
        OutputManager.appendToOutput(
          "Error: OopisOs could not clear all user file systems. Your data might still be present. Please try the operation again.",
          {
            typeClass: Config.CSS_CLASSES.ERROR_MSG,
          }
        );
        reject(event.target.error);
      };
    });
  }

  function getCurrentPath() {
    return currentPath;
  }

  function setCurrentPath(path) {
    currentPath = path;
  }

  function getFsData() {
    return fsData;
  }

  function setFsData(newData) {
    fsData = newData;
  }

  function getAbsolutePath(targetPath, basePath) {
    if (!targetPath) targetPath = Config.FILESYSTEM.CURRENT_DIR_SYMBOL;
    let effectiveBasePath = basePath;
    if (targetPath.startsWith(Config.FILESYSTEM.PATH_SEPARATOR))
      effectiveBasePath = Config.FILESYSTEM.ROOT_PATH;
    const baseSegments =
      effectiveBasePath === Config.FILESYSTEM.ROOT_PATH
        ? []
        : effectiveBasePath
          .substring(1)
          .split(Config.FILESYSTEM.PATH_SEPARATOR)
          .filter((s) => s && s !== Config.FILESYSTEM.CURRENT_DIR_SYMBOL);
    let resolvedSegments = [...baseSegments];
    const targetSegments = targetPath.split(Config.FILESYSTEM.PATH_SEPARATOR);
    for (const segment of targetSegments) {
      if (segment === "" || segment === Config.FILESYSTEM.CURRENT_DIR_SYMBOL) {
        if (
          targetPath.startsWith(Config.FILESYSTEM.PATH_SEPARATOR) &&
          resolvedSegments.length === 0 &&
          segment === ""
        ) {
        }
        continue;
      }
      if (segment === Config.FILESYSTEM.PARENT_DIR_SYMBOL) {
        if (resolvedSegments.length > 0) resolvedSegments.pop();
      } else resolvedSegments.push(segment);
    }
    if (resolvedSegments.length === 0) return Config.FILESYSTEM.ROOT_PATH;
    return (
      Config.FILESYSTEM.PATH_SEPARATOR +
      resolvedSegments.join(Config.FILESYSTEM.PATH_SEPARATOR)
    );
  }

  function getNodeByPath(absolutePath) {
    const currentUser = UserManager.getCurrentUser().name;
    if (absolutePath === Config.FILESYSTEM.ROOT_PATH) {
      return fsData[Config.FILESYSTEM.ROOT_PATH];
    }
    const segments = absolutePath
      .substring(1)
      .split(Config.FILESYSTEM.PATH_SEPARATOR)
      .filter((s) => s);
    let currentNode = fsData[Config.FILESYSTEM.ROOT_PATH];
    for (const segment of segments) {
      if (!hasPermission(currentNode, currentUser, "execute")) {
        return null;
      }
      if (!currentNode.children || !currentNode.children[segment]) {
        return null;
      }
      currentNode = currentNode.children[segment];
    }
    return currentNode;
  }

  function calculateNodeSize(node) {
    if (!node) return 0;
    if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE)
      return (node.content || "").length;
    if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
      let totalSize = 0;
      for (const childName in node.children)
        totalSize += calculateNodeSize(node.children[childName]);
      return totalSize;
    }
    return 0;
  }

  function _updateNodeAndParentMtime(nodePath, nowISO) {
    // This function already deals with absolute paths, so it can use the new internal function.
    if (!nodePath || !nowISO) return;
    const node = getNodeByPath(nodePath);
    if (node) node.mtime = nowISO;
    if (nodePath !== Config.FILESYSTEM.ROOT_PATH) {
      const parentPath =
        nodePath.substring(
          0,
          nodePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
        ) || Config.FILESYSTEM.ROOT_PATH;
      // Changed from the non-existent _getNodeByAbsolutePath to the correct getNodeByPath
      const parentNode = getNodeByPath(parentPath);
      if (
        parentNode &&
        parentNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
      )
        parentNode.mtime = nowISO;
    }
  }

  function createParentDirectoriesIfNeeded(fullPath) {
    const currentUserForCPDIF = UserManager.getCurrentUser().name;
    const nowISO = new Date().toISOString();
    if (fullPath === Config.FILESYSTEM.ROOT_PATH)
      return {
        parentNode: null,
        error: "Cannot create directory structure for root.",
      };
    const lastSlashIndex = fullPath.lastIndexOf(
      Config.FILESYSTEM.PATH_SEPARATOR
    );
    const parentPathForSegments =
      lastSlashIndex === 0
        ? Config.FILESYSTEM.ROOT_PATH
        : fullPath.substring(0, lastSlashIndex);
    const finalDirNameInPath = fullPath.substring(lastSlashIndex + 1);
    if (
      !finalDirNameInPath ||
      finalDirNameInPath === Config.FILESYSTEM.CURRENT_DIR_SYMBOL ||
      finalDirNameInPath === Config.FILESYSTEM.PARENT_DIR_SYMBOL
    ) {
    }
    if (parentPathForSegments === Config.FILESYSTEM.ROOT_PATH)
      return {
        parentNode: fsData[Config.FILESYSTEM.ROOT_PATH],
        error: null,
      };
    const segmentsToCreate = parentPathForSegments
      .substring(1)
      .split(Config.FILESYSTEM.PATH_SEPARATOR)
      .filter((s) => s);
    let currentParentNode = fsData[Config.FILESYSTEM.ROOT_PATH];
    let currentProcessedPath = Config.FILESYSTEM.ROOT_PATH;
    if (
      !currentParentNode ||
      typeof currentParentNode.owner === "undefined" ||
      typeof currentParentNode.mode === "undefined"
    )
      return {
        parentNode: null,
        error: "Internal error: Root FS node is malformed.",
      };
    for (const segment of segmentsToCreate) {
      if (
        !currentParentNode.children ||
        typeof currentParentNode.children !== "object"
      ) {
        const errorMsg = `Internal error: currentParentNode.children is not an object at path "${currentProcessedPath}" for segment "${segment}". FS may be corrupted.`;
        console.error(errorMsg, currentParentNode);
        return {
          parentNode: null,
          error: errorMsg,
        };
      }
      if (!currentParentNode.children[segment]) {
        if (!hasPermission(currentParentNode, currentUserForCPDIF, "write")) {
          const errorMsg = `Cannot create directory '${segment}' in '${currentProcessedPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`;
          return {
            parentNode: null,
            error: errorMsg,
          };
        }
        currentParentNode.children[segment] = {
          type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
          children: {},
          owner: currentUserForCPDIF,
          group: currentUserForCPDIF,
          mode: Config.FILESYSTEM.DEFAULT_DIR_MODE,
          mtime: nowISO,
        };
        currentParentNode.mtime = nowISO;
      } else if (
        currentParentNode.children[segment].type !==
        Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
      ) {
        const errorMsg = `Path component '${getAbsolutePath(
          segment,
          currentProcessedPath
        )}' is not a directory.`;
        return {
          parentNode: null,
          error: errorMsg,
        };
      }
      currentParentNode = currentParentNode.children[segment];
      currentProcessedPath = getAbsolutePath(segment, currentProcessedPath);
      if (
        !currentParentNode ||
        typeof currentParentNode.owner === "undefined" ||
        typeof currentParentNode.mode === "undefined"
      )
        return {
          parentNode: null,
          error: `Internal error: Node for "${currentProcessedPath}" became malformed during parent creation.`,
        };
    }
    return {
      parentNode: currentParentNode,
      error: null,
    };
  }

  function validatePath(commandName, pathArg, options = {}) {
    const {
      allowMissing = false,
      expectedType = null,
      disallowRoot = false,
      defaultToCurrentIfEmpty = true,
    } = options;
    const currentUser = UserManager.getCurrentUser().name;
    const effectivePathArg =
      pathArg === "" && defaultToCurrentIfEmpty
        ? Config.FILESYSTEM.CURRENT_DIR_SYMBOL
        : pathArg;
    const resolvedPath = getAbsolutePath(effectivePathArg, currentPath);

    if (disallowRoot && resolvedPath === Config.FILESYSTEM.ROOT_PATH) {
      return {
        error: `${commandName}: '${pathArg}' (resolved to root) is not a valid target for this operation.`,
        node: null,
        resolvedPath,
        optionsUsed: options,
      };
    }

    // --- NEW, Inlined Traversal Logic ---
    let node;
    if (resolvedPath === Config.FILESYSTEM.ROOT_PATH) {
      node = fsData[Config.FILESYSTEM.ROOT_PATH];
    } else {
      const segments = resolvedPath
        .substring(1)
        .split(Config.FILESYSTEM.PATH_SEPARATOR)
        .filter((s) => s);
      let currentNode = fsData[Config.FILESYSTEM.ROOT_PATH];
      let currentPathForError = Config.FILESYSTEM.ROOT_PATH;

      for (const segment of segments) {
        // This is the new, more specific check.
        if (!hasPermission(currentNode, currentUser, "execute")) {
          return {
            error: `${commandName}: cannot access '${resolvedPath}': Permission denied while traversing '${currentPathForError}'`,
            node: null,
            resolvedPath,
            optionsUsed: options,
          };
        }
        if (!currentNode.children || !currentNode.children[segment]) {
          currentNode = null; // Path does not exist
          break;
        }
        currentNode = currentNode.children[segment];
        currentPathForError = getAbsolutePath(segment, currentPathForError);
      }
      node = currentNode;
    }
    // --- End Inlined Traversal Logic ---

    if (!node) {
      if (allowMissing) {
        return {
          error: null,
          node: null,
          resolvedPath,
          optionsUsed: options,
        };
      }
      return {
        error: `${commandName}: '${pathArg}' (resolved to '${resolvedPath}'): No such file or directory`,
        node: null,
        resolvedPath,
        optionsUsed: options,
      };
    }

    if (expectedType && node.type !== expectedType) {
      const typeName =
        expectedType === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
          ? "directory"
          : "file";
      const actualTypeName =
        node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
          ? "directory"
          : node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE
            ? "file"
            : "unknown type";
      return {
        error: `${commandName}: '${pathArg}' (resolved to '${resolvedPath}') is not a ${typeName} (it's a ${actualTypeName})`,
        node,
        resolvedPath,
        optionsUsed: options,
      };
    }

    // Specific check for 'cd' on the final directory remains important.
    if (commandName.startsWith("cd") && node) {
      if (!hasPermission(node, currentUser, "execute")) {
        return {
          error: `cd: '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
          node,
          resolvedPath,
          optionsUsed: options,
        };
      }
    }

    return {
      error: null,
      node,
      resolvedPath,
      optionsUsed: options,
    };
  }

  function hasPermission(node, username, permissionType) {
    if (username === "root") {
      return true;
    }
    if (
      !node ||
      typeof node.mode !== "number" ||
      typeof node.owner !== "string" ||
      typeof node.group !== "string"
    ) {
      console.warn("hasPermission: Invalid node or missing permissions info.", {
        node,
        username,
        permissionType,
      });
      return false;
    }

    // --- REFACTORED PART ---
    const ownerPerms = (node.mode >> 6) & 7;
    const groupPerms = (node.mode >> 3) & 7;
    const otherPerms = (node.mode >> 0) & 7;
    // --- END REFACTOR ---

    let permissionMask;
    switch (permissionType) {
      case "read":
        permissionMask = Config.FILESYSTEM.PERMISSION_BIT_READ;
        break;
      case "write":
        permissionMask = Config.FILESYSTEM.PERMISSION_BIT_WRITE;
        break;
      case "execute":
        permissionMask = Config.FILESYSTEM.PERMISSION_BIT_EXECUTE;
        break;
      default:
        console.warn(
          "hasPermission: Unknown permission type requested:",
          permissionType
        );
        return false;
    }

    if (node.owner === username) {
      return (ownerPerms & permissionMask) === permissionMask;
    }

    const userGroups = GroupManager.getGroupsForUser(username);
    if (userGroups.includes(node.group)) {
      return (groupPerms & permissionMask) === permissionMask;
    }

    return (otherPerms & permissionMask) === permissionMask;
  }

  function formatModeToString(node) {
    if (!node || typeof node.mode !== "number") return "----------";
    const typeChar =
      node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? "d" : "-";

    // --- REFACTORED PART ---
    const ownerPerms = (node.mode >> 6) & 7;
    const groupPerms = (node.mode >> 3) & 7;
    const otherPerms = (node.mode >> 0) & 7;
    // --- END REFACTOR ---

    const r = Config.FILESYSTEM.PERMISSION_BIT_READ;
    const w = Config.FILESYSTEM.PERMISSION_BIT_WRITE;
    const x = Config.FILESYSTEM.PERMISSION_BIT_EXECUTE;

    const perm_str = (p) =>
      (p & r ? "r" : "-") + (p & w ? "w" : "-") + (p & x ? "x" : "-");

    return (
      typeChar +
      perm_str(ownerPerms) +
      perm_str(groupPerms) +
      perm_str(otherPerms)
    );
  }

  async function deleteNodeRecursive(path, options = {}) {
    const { force = false, currentUser } = options;
    const pathValidation = validatePath("delete", path, {
      disallowRoot: true,
    });
    if (pathValidation.error) {
      // With 'force', we ignore "not found" errors, just like `rm -f`.
      if (force && !pathValidation.node) {
        return {
          success: true,
          messages: [],
        };
      }
      return {
        success: false,
        messages: [pathValidation.error],
      };
    }
    const node = pathValidation.node;
    const resolvedPath = pathValidation.resolvedPath;
    const parentPath =
      resolvedPath.substring(
        0,
        resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
      ) || Config.FILESYSTEM.ROOT_PATH;
    const parentNode = getNodeByPath(parentPath);
    const itemName = resolvedPath.substring(
      resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
    );
    const nowISO = new Date().toISOString();
    let messages = [];
    let anyChangeMade = false;
    // Check for write permission in the parent directory, which is required to delete an item.
    if (!parentNode || !hasPermission(parentNode, currentUser, "write")) {
      const permError = `cannot remove '${path}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`;
      // In force mode, permission errors are suppressed.
      return {
        success: force,
        messages: force ? [] : [permError],
      };
    }
    if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
      // Recursively delete children first (post-order traversal)
      const childrenNames = Object.keys(node.children || {});
      for (const childName of childrenNames) {
        const childPath = getAbsolutePath(childName, resolvedPath);
        const result = await deleteNodeRecursive(childPath, options);
        messages.push(...result.messages);
        if (!result.success) {
          // If any child deletion fails, the entire operation fails.
          return {
            success: false,
            messages,
          };
        }
      }
    }
    // After handling children (if any), delete the node itself.
    delete parentNode.children[itemName];
    parentNode.mtime = nowISO;
    anyChangeMade = true;
    return {
      success: true,
      messages,
      anyChangeMade,
    };
  }

  function _createNewFileNode(name, content, owner, group, mode = null) {
    const nowISO = new Date().toISOString();
    return {
      type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
      content: content || "",
      owner: owner,
      group: group, // <<< ADDED group parameter
      mode: mode !== null ? mode : Config.FILESYSTEM.DEFAULT_FILE_MODE,
      mtime: nowISO,
    };
  }

  function _calculateTotalSize() {
    if (!fsData || !fsData[Config.FILESYSTEM.ROOT_PATH]) return 0;
    return calculateNodeSize(fsData[Config.FILESYSTEM.ROOT_PATH]);
  }
  function _createNewDirectoryNode(owner, group, mode = null) {
    const nowISO = new Date().toISOString();
    return {
      type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
      children: {},
      owner: owner,
      group: group,
      mode: mode !== null ? mode : Config.FILESYSTEM.DEFAULT_DIR_MODE,
      mtime: nowISO
    };
  }
  return {
    createUserHomeDirectory,
    save,
    load,
    clearAllFS,
    getCurrentPath,
    setCurrentPath,
    getFsData,
    setFsData,
    getAbsolutePath,
    getNodeByPath,
    createParentDirectoriesIfNeeded,
    calculateNodeSize,
    validatePath,
    hasPermission,
    formatModeToString,
    _updateNodeAndParentMtime,
    _createNewFileNode,
    _createNewDirectoryNode,
    deleteNodeRecursive,
  };
})();
const HistoryManager = (() => {
  "use strict";
  let commandHistory = [];
  let historyIndex = 0;

  function add(command) {
    const trimmedCommand = command.trim();
    if (
      trimmedCommand &&
      (commandHistory.length === 0 ||
        commandHistory[commandHistory.length - 1] !== trimmedCommand)
    ) {
      commandHistory.push(trimmedCommand);
      if (commandHistory.length > Config.TERMINAL.MAX_HISTORY_SIZE)
        commandHistory.shift();
    }
    historyIndex = commandHistory.length;
  }

  function getPrevious() {
    if (commandHistory.length > 0 && historyIndex > 0) {
      historyIndex--;
      return commandHistory[historyIndex];
    }
    return null;
  }

  function getNext() {
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      return commandHistory[historyIndex];
    } else if (historyIndex >= commandHistory.length - 1) {
      historyIndex = commandHistory.length;
      return "";
    }
    return null;
  }

  function resetIndex() {
    historyIndex = commandHistory.length;
  }

  function getFullHistory() {
    return [...commandHistory];
  }

  function clearHistory() {
    commandHistory = [];
    historyIndex = 0;
  }

  function setHistory(newHistory) {
    commandHistory = Array.isArray(newHistory) ? [...newHistory] : [];
    if (commandHistory.length > Config.TERMINAL.MAX_HISTORY_SIZE)
      commandHistory = commandHistory.slice(
        commandHistory.length - Config.TERMINAL.MAX_HISTORY_SIZE
      );
    historyIndex = commandHistory.length;
  }
  return {
    add,
    getPrevious,
    getNext,
    resetIndex,
    getFullHistory,
    clearHistory,
    setHistory,
  };
})();
const AliasManager = (() => {
  "use strict";
  let aliases = {}; // In-memory cache of aliases
  // Load aliases from localStorage on startup
  function initialize() {
    aliases = StorageManager.loadItem(
      Config.STORAGE_KEYS.ALIAS_DEFINITIONS,
      "Aliases",
      {}
    );
  }
  // Save aliases to localStorage
  function _save() {
    StorageManager.saveItem(
      Config.STORAGE_KEYS.ALIAS_DEFINITIONS,
      aliases,
      "Aliases"
    );
  }
  // Set or update an alias
  function setAlias(name, value) {
    if (!name || typeof value !== "string") return false;
    aliases[name] = value;
    _save();
    return true;
  }
  // Remove an alias
  function removeAlias(name) {
    if (!aliases[name]) return false;
    delete aliases[name];
    _save();
    return true;
  }
  // Get a specific alias's value
  function getAlias(name) {
    return aliases[name] || null;
  }
  // Get all aliases
  function getAllAliases() {
    return { ...aliases };
  }
  // Recursively expand an alias to its final command
  function resolveAlias(commandString) {
    const parts = commandString.split(/\s+/);
    let commandName = parts[0];
    const remainingArgs = parts.slice(1).join(" ");
    const MAX_RECURSION = 10;
    let count = 0;
    while (aliases[commandName] && count < MAX_RECURSION) {
      const aliasValue = aliases[commandName];
      const aliasParts = aliasValue.split(/\s+/);
      commandName = aliasParts[0];
      const aliasArgs = aliasParts.slice(1).join(" ");
      commandString = `${commandName} ${aliasArgs} ${remainingArgs}`.trim();
      count++;
    }
    if (count === MAX_RECURSION) {
      return {
        error: `Alias loop detected for '${parts[0]}'`,
      };
    }
    return {
      newCommand: commandString,
    };
  }
  return {
    initialize,
    setAlias,
    removeAlias,
    getAlias,
    getAllAliases,
    resolveAlias,
  };
})();
const TerminalUI = (() => {
  "use strict";
  let isNavigatingHistory = false;
  let _isObscuredInputMode = false;
  function updatePrompt() {
    const user =
      typeof UserManager !== "undefined"
        ? UserManager.getCurrentUser()
        : {
          name: Config.USER.DEFAULT_NAME,
        };
    if (DOM.promptUserSpan) {
      DOM.promptUserSpan.textContent = user
        ? user.name
        : Config.USER.DEFAULT_NAME;
      DOM.promptUserSpan.className = "prompt-user mr-0.5 text-sky-400";
    }
    if (DOM.promptHostSpan)
      DOM.promptHostSpan.textContent = Config.OS.DEFAULT_HOST_NAME;
    const currentPathDisplay =
      typeof FileSystemManager !== "undefined"
        ? FileSystemManager.getCurrentPath()
        : Config.FILESYSTEM.ROOT_PATH;
    if (DOM.promptPathSpan)
      DOM.promptPathSpan.textContent =
        currentPathDisplay === Config.FILESYSTEM.ROOT_PATH &&
          currentPathDisplay.length > 1
          ? Config.FILESYSTEM.ROOT_PATH
          : currentPathDisplay;
    if (DOM.promptCharSpan)
      DOM.promptCharSpan.textContent = Config.TERMINAL.PROMPT_CHAR;
  }

  function focusInput() {
    if (
      DOM.editableInputDiv &&
      DOM.editableInputDiv.contentEditable === "true"
    ) {
      DOM.editableInputDiv.focus();
      if (DOM.editableInputDiv.textContent.length === 0)
        setCaretToEnd(DOM.editableInputDiv);
    }
  }

  function clearInput() {
    if (DOM.editableInputDiv) DOM.editableInputDiv.textContent = "";
  }

  function getCurrentInputValue() {
    return DOM.editableInputDiv ? DOM.editableInputDiv.textContent : "";
  }

  function setCurrentInputValue(value, setAtEnd = true) {
    if (DOM.editableInputDiv) {
      DOM.editableInputDiv.textContent = value;
      if (setAtEnd) setCaretToEnd(DOM.editableInputDiv);
    }
  }

  function setCaretToEnd(element) {
    if (
      !element ||
      typeof window.getSelection === "undefined" ||
      typeof document.createRange === "undefined"
    )
      return;
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    element.focus();
  }

  function setCaretPosition(element, position) {
    if (
      !element ||
      typeof position !== "number" ||
      typeof window.getSelection === "undefined" ||
      typeof document.createRange === "undefined"
    )
      return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let charCount = 0;
    let foundNode = false;

    function findTextNodeAndSet(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharCount = charCount + node.length;
        if (!foundNode && position >= charCount && position <= nextCharCount) {
          range.setStart(node, position - charCount);
          range.collapse(true);
          foundNode = true;
        }
        charCount = nextCharCount;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (findTextNodeAndSet(node.childNodes[i])) return true;
          if (foundNode) break;
        }
      }
      return foundNode;
    }
    if (element.childNodes.length === 0 && position === 0) {
      range.setStart(element, 0);
      range.collapse(true);
      foundNode = true;
    } else findTextNodeAndSet(element);
    if (foundNode) {
      sel.removeAllRanges();
      sel.addRange(range);
    } else setCaretToEnd(element);
    element.focus();
  }

  function setInputState(isEditable, obscured = false) {
    if (DOM.editableInputDiv) {
      DOM.editableInputDiv.contentEditable = isEditable ? "true" : "false";
      DOM.editableInputDiv.style.opacity = isEditable ? "1" : "0.5";
      _isObscuredInputMode = obscured; // Set the obscured mode flag
      if (!isEditable) DOM.editableInputDiv.blur();
    }
  }
  function setIsNavigatingHistory(status) {
    isNavigatingHistory = status;
  }

  function getIsNavigatingHistory() {
    return isNavigatingHistory;
  }

  function getSelection() {
    const sel = window.getSelection();
    // noinspection JSUnusedAssignment
    let start = 0, //safety net
      end = 0;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (
        DOM.editableInputDiv &&
        DOM.editableInputDiv.contains(range.commonAncestorContainer)
      ) {
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(DOM.editableInputDiv);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        start = preSelectionRange.toString().length;
        end = start + range.toString().length;
      } else {
        start = end = getCurrentInputValue().length;
      }
    } else {
      start = end = getCurrentInputValue().length;
    }
    return {
      start,
      end,
    };
  }

  return {
    updatePrompt,
    focusInput,
    clearInput,
    setCurrentInputValue,
    getCurrentInputValue,
    setIsNavigatingHistory,
    getIsNavigatingHistory,
    setCaretPosition,
    setInputState,
    getSelection,
  };
})();
const ModalInputManager = (() => {
  "use strict";
  let _isAwaitingInput = false;
  let _inputContext = null; // { onInputReceived, onCancelled, isObscured, currentInput }
  function isObscured() {
    return _isAwaitingInput && _inputContext && _inputContext.isObscured;
  }

  function requestInput(
    promptMessage,
    onInputReceivedCallback,
    onCancelledCallback,
    isObscured = false
  ) {
    if (_isAwaitingInput) {
      void OutputManager.appendToOutput(
        "Another modal input prompt is already pending.",
        {
          typeClass: Config.CSS_CLASSES.WARNING_MSG,
        }
      );
      if (onCancelledCallback) onCancelledCallback();
      return;
    }
    _isAwaitingInput = true;
    _inputContext = {
      onInputReceived: onInputReceivedCallback,
      onCancelled: onCancelledCallback,
      isObscured: isObscured,
      currentInput: "", // Start with empty input
    };
    if (DOM.inputLineContainerDiv) {
      DOM.inputLineContainerDiv.classList.remove(Config.CSS_CLASSES.HIDDEN);
    }
    void OutputManager.appendToOutput(promptMessage, {
      typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
    });
    TerminalUI.clearInput();
    TerminalUI.setInputState(true, false);
    TerminalUI.focusInput();
    if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
  }
  async function handleInput() {
    if (!_isAwaitingInput || !_inputContext) return false;
    const finalInput = _inputContext.isObscured
      ? _inputContext.currentInput
      : TerminalUI.getCurrentInputValue();
    const callback = _inputContext.onInputReceived;
    _isAwaitingInput = false;
    _inputContext = null;
    TerminalUI.clearInput();
    if (typeof callback === "function") {
      await callback(finalInput.trim());
    }
    return true;
  }

  function updateInput(key, rawChar) {
    if (!_isAwaitingInput) return;
    let inputArray = Array.from(_inputContext.currentInput);
    const selection = TerminalUI.getSelection();
    let { start, end } = selection;
    if (key === "Backspace") {
      if (start === end && start > 0) {
        inputArray.splice(start - 1, 1);
        start--;
      } else if (start !== end) {
        inputArray.splice(start, end - start);
      }
    } else if (key === "Delete") {
      if (start === end && start < inputArray.length) {
        inputArray.splice(start, 1);
      } else if (start !== end) {
        inputArray.splice(start, end - start);
      }
    } else if (rawChar) {
      inputArray.splice(start, end - start, rawChar);
      start += rawChar.length;
    }
    _inputContext.currentInput = inputArray.join("");
    const displayText = _inputContext.isObscured
      ? "*".repeat(_inputContext.currentInput.length)
      : _inputContext.currentInput;
    TerminalUI.setCurrentInputValue(displayText, false);
    TerminalUI.setCaretPosition(DOM.editableInputDiv, start);
  }
  return {
    requestInput,
    handleInput,
    updateInput,
    isAwaiting: () => _isAwaitingInput,
    isObscured,
  };
})();
const UserManager = (() => {
  "use strict";
  let currentUser = {
    name: Config.USER.DEFAULT_NAME,
  };
  async function _secureHashPassword(password) {
    if (!password || typeof password !== "string" || password.trim() === "") {
      return null;
    }
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      console.error("Password hashing failed:", error);
      return null;
    }
  }

  function getCurrentUser() {
    return currentUser;
  }
  function getPrimaryGroupForUser(username) {
    const users = StorageManager.loadItem(
      Config.STORAGE_KEYS.USER_CREDENTIALS,
      "User list",
      {}
    );
    return users[username]?.primaryGroup || null;
  }
  async function register(username, password) {
    const formatValidation = Utils.validateUsernameFormat(username);
    if (!formatValidation.isValid)
      return {
        success: false,
        error: formatValidation.error,
      };

    const users = StorageManager.loadItem(
      Config.STORAGE_KEYS.USER_CREDENTIALS,
      "User list",
      {}
    );

    if (users[username])
      return {
        success: false,
        error: `User '${username}' already exists.`,
      };

    const passwordHash = password ? await _secureHashPassword(password) : null;
    if (password && !passwordHash) {
      return {
        success: false,
        error: "Failed to securely process password.",
      };
    }

    GroupManager.createGroup(username);
    GroupManager.addUserToGroup(username, username);

    users[username] = {
      passwordHash: passwordHash,
      primaryGroup: username,
    };

    await FileSystemManager.createUserHomeDirectory(username);

    if (
      StorageManager.saveItem(
        Config.STORAGE_KEYS.USER_CREDENTIALS,
        users,
        "User list"
      ) &&
      (await FileSystemManager.save())
    ) {
      return {
        success: true,
        message: `User '${username}' registered. Home directory created at /home/${username}.`,
      };
    } else {
      return {
        success: false,
        error: "Failed to save new user and filesystem.",
      };
    }
  }
  async function login(username, providedPassword = null) {
    if (currentUser.name === username)
      return {
        success: true,
        message: `...`,
        noAction: true,
      };
    const users = StorageManager.loadItem(
      Config.STORAGE_KEYS.USER_CREDENTIALS,
      "User list",
      {}
    );
    const userEntry = users[username];
    if (
      !userEntry &&
      username !== Config.USER.DEFAULT_NAME &&
      username !== "root"
    ) {
      return {
        success: false,
        error: "Invalid username.",
      };
    }
    const storedPasswordHash = userEntry ? userEntry.passwordHash : null;
    if (storedPasswordHash !== null) {
      if (providedPassword === null) {
        return {
          success: false,
          error: "Password required.",
          requiresPasswordPrompt: true,
        };
      }
      const providedPasswordHash = await _secureHashPassword(providedPassword);
      if (providedPasswordHash !== storedPasswordHash) {
        return {
          success: false,
          error: Config.MESSAGES.INVALID_PASSWORD,
        };
      }
    } else {
      if (providedPassword !== null) {
        return {
          success: false,
          error: "This account does not require a password.",
        };
      }
    }
    if (currentUser.name !== Config.USER.DEFAULT_NAME) {
      SessionManager.saveAutomaticState(currentUser.name);
    }
    currentUser = {
      name: username,
    };
    SessionManager.loadAutomaticState(username);
    const homePath = `/home/${username}`;
    if (FileSystemManager.getNodeByPath(homePath)) {
      FileSystemManager.setCurrentPath(homePath);
    } else {
      FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
    }
    TerminalUI.updatePrompt();
    return {
      success: true,
      message: `Logged in as ${username}.`,
    };
  }
  async function logout() {
    if (currentUser.name === Config.USER.DEFAULT_NAME)
      return {
        success: true,
        message: `...`,
        noAction: true,
      };
    SessionManager.saveAutomaticState(currentUser.name);
    const prevUserName = currentUser.name;
    currentUser = {
      name: Config.USER.DEFAULT_NAME,
    };
    SessionManager.loadAutomaticState(Config.USER.DEFAULT_NAME);
    const guestHome = `/home/${Config.USER.DEFAULT_NAME}`;
    if (FileSystemManager.getNodeByPath(guestHome)) {
      FileSystemManager.setCurrentPath(guestHome);
    } else {
      FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
    }
    TerminalUI.updatePrompt();
    return {
      success: true,
      message: `User ${prevUserName} logged out. Now logged in as ${Config.USER.DEFAULT_NAME}.`,
    };
  }
  async function initializeDefaultUsers() {
    const users = StorageManager.loadItem(
      Config.STORAGE_KEYS.USER_CREDENTIALS,
      "User list",
      {}
    );
    let changesMade = false;

    // <<< FIX: Add primaryGroup for root >>>
    if (!users["root"]) {
      users["root"] = {
        passwordHash: await _secureHashPassword("mcgoopis"),
        primaryGroup: "root",
      };
      changesMade = true;
    }

    // <<< FIX: Add primaryGroup for Guest >>>
    if (!users[Config.USER.DEFAULT_NAME]) {
      users[Config.USER.DEFAULT_NAME] = {
        passwordHash: null,
        primaryGroup: Config.USER.DEFAULT_NAME,
      };
      changesMade = true;
    }

    if (!users["userDiag"]) {
      users["userDiag"] = {
        passwordHash: await _secureHashPassword("pantload"),
        primaryGroup: "userDiag",
      };
      changesMade = true;
    }

    if (changesMade) {
      StorageManager.saveItem(
        Config.STORAGE_KEYS.USER_CREDENTIALS,
        users,
        "User list"
      );
    }
  }
  return {
    getCurrentUser,
    register,
    login,
    logout,
    initializeDefaultUsers,
    getPrimaryGroupForUser,
  };
})();
const GroupManager = (() => {
  "use strict";
  let groups = {}; // In-memory cache

  function initialize() {
    groups = StorageManager.loadItem(
      Config.STORAGE_KEYS.USER_GROUPS,
      "User Groups",
      {}
    );
    // Ensure default groups exist
    if (!groups["root"]) {
      createGroup("root");
      addUserToGroup("root", "root");
    }
    if (!groups["Guest"]) {
      createGroup("Guest");
      addUserToGroup("Guest", "Guest");
    }
    if (!groups["userDiag"]) {
      createGroup("userDiag");
      addUserToGroup("userDiag", "userDiag");
    }
    console.log("GroupManager initialized.");
  }

  function _save() {
    StorageManager.saveItem(
      Config.STORAGE_KEYS.USER_GROUPS,
      groups,
      "User Groups"
    );
  }

  function groupExists(groupName) {
    return !!groups[groupName];
  }

  function createGroup(groupName) {
    if (groupExists(groupName)) {
      return false;
    }
    groups[groupName] = { members: [] };
    _save();
    return true;
  }

  function addUserToGroup(username, groupName) {
    if (
      groupExists(groupName) &&
      !groups[groupName].members.includes(username)
    ) {
      groups[groupName].members.push(username);
      _save();
      return true;
    }
    return false;
  }

  function getGroupsForUser(username) {
    const userGroups = [];
    const users = StorageManager.loadItem(
      Config.STORAGE_KEYS.USER_CREDENTIALS,
      "User list",
      {}
    );
    const primaryGroup = users[username]?.primaryGroup;

    if (primaryGroup) {
      userGroups.push(primaryGroup);
    }

    for (const groupName in groups) {
      if (
        groups[groupName].members &&
        groups[groupName].members.includes(username)
      ) {
        if (!userGroups.includes(groupName)) {
          userGroups.push(groupName);
        }
      }
    }
    return userGroups;
  }

  function deleteGroup(groupName) {
    if (!groupExists(groupName)) {
      return { success: false, error: `group '${groupName}' does not exist.` };
    }

    // Critical safety check: prevent deleting a primary group of an existing user
    const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
    for (const username in users) {
      if (users[username].primaryGroup === groupName) {
        return { success: false, error: `cannot remove group '${groupName}': it is the primary group of user '${username}'.` };
      }
    }

    delete groups[groupName];
    _save();
    return { success: true };
  }

  function removeUserFromAllGroups(username) {
    let changed = false;
    for (const groupName in groups) {
      const index = groups[groupName].members.indexOf(username);
      if (index > -1) {
        groups[groupName].members.splice(index, 1);
        changed = true;
      }
    }
    if (changed) {
      _save();
    }
  }

  return {
    initialize,
    createGroup,
    deleteGroup,
    addUserToGroup,
    removeUserFromAllGroups,
    getGroupsForUser,
    groupExists,
  };
})();
const SessionManager = (() => {
  "use strict";

  function _getAutomaticSessionStateKey(user) {
    return `${Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX}${user}`;
  }

  function _getManualUserTerminalStateKey(user) {
    const userName =
      typeof user === "object" && user !== null && user.name
        ? user.name
        : String(user);
    return `${Config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX}${userName}`;
  }

  function saveAutomaticState(username) {
    if (!username) {
      console.warn(
        "saveAutomaticState: No username provided. State not saved."
      );
      return;
    }
    const currentInput = TerminalUI.getCurrentInputValue();
    const autoState = {
      currentPath: FileSystemManager.getCurrentPath(),
      outputHTML: DOM.outputDiv ? DOM.outputDiv.innerHTML : "",
      currentInput: currentInput,
      commandHistory: HistoryManager.getFullHistory(),
    };
    StorageManager.saveItem(
      _getAutomaticSessionStateKey(username),
      autoState,
      `Auto session for ${username}`
    );
  }

  function loadAutomaticState(username) {
    if (!username) {
      console.warn(
        "loadAutomaticState: No username provided. Cannot load state."
      );
      if (DOM.outputDiv) DOM.outputDiv.innerHTML = "";
      TerminalUI.setCurrentInputValue("");
      FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
      HistoryManager.clearHistory();
      void OutputManager.appendToOutput(
        `${Config.MESSAGES.WELCOME_PREFIX} ${Config.USER.DEFAULT_NAME}${Config.MESSAGES.WELCOME_SUFFIX}`
      );
      TerminalUI.updatePrompt();
      if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
      return false;
    }
    const autoState = StorageManager.loadItem(
      _getAutomaticSessionStateKey(username),
      `Auto session for ${username}`
    );
    if (autoState) {
      FileSystemManager.setCurrentPath(
        autoState.currentPath || Config.FILESYSTEM.ROOT_PATH
      );
      if (DOM.outputDiv) {
        if (autoState.hasOwnProperty("outputHTML")) {
          DOM.outputDiv.innerHTML = autoState.outputHTML || "";
        } else {
          DOM.outputDiv.innerHTML = "";
          void OutputManager.appendToOutput(
            `${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`
          );
        }
      }
      TerminalUI.setCurrentInputValue(autoState.currentInput || "");
      HistoryManager.setHistory(autoState.commandHistory || []);
    } else {
      if (DOM.outputDiv) DOM.outputDiv.innerHTML = "";
      TerminalUI.setCurrentInputValue("");
      const homePath = `/home/${username}`;
      if (FileSystemManager.getNodeByPath(homePath)) {
        FileSystemManager.setCurrentPath(homePath);
      } else {
        FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
      }
      HistoryManager.clearHistory();
      void OutputManager.appendToOutput(
        `${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`
      );
    }
    TerminalUI.updatePrompt();
    if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
    return !!autoState;
  }
  async function saveManualState() {
    const currentUser = UserManager.getCurrentUser();
    const currentInput = TerminalUI.getCurrentInputValue();
    const manualStateData = {
      user: currentUser.name,
      osVersion: Config.OS.VERSION,
      timestamp: new Date().toISOString(),
      currentPath: FileSystemManager.getCurrentPath(),
      outputHTML: DOM.outputDiv ? DOM.outputDiv.innerHTML : "",
      currentInput: currentInput,
      fsDataSnapshot: Utils.deepCopyNode(FileSystemManager.getFsData()),
      commandHistory: HistoryManager.getFullHistory(),
    };
    if (
      StorageManager.saveItem(
        _getManualUserTerminalStateKey(currentUser),
        manualStateData,
        `Manual save for ${currentUser.name}`
      )
    )
      return {
        success: true,
        message: `${Config.MESSAGES.SESSION_SAVED_FOR_PREFIX}${currentUser.name}.`,
      };
    else
      return {
        success: false,
        error: "Failed to save session manually.",
      };
  }
  async function loadManualState() {
    const currentUser = UserManager.getCurrentUser();
    const manualStateData = StorageManager.loadItem(
      _getManualUserTerminalStateKey(currentUser),
      `Manual save for ${currentUser.name}`
    );
    if (manualStateData) {
      if (manualStateData.user && manualStateData.user !== currentUser.name) {
        await OutputManager.appendToOutput(
          `Warning: Saved state is for user '${manualStateData.user}'. Current user is '${currentUser.name}'. Load aborted. Use 'login ${manualStateData.user}' then 'loadstate'.`,
          {
            typeClass: Config.CSS_CLASSES.WARNING_MSG,
          }
        );
        return {
          success: false,
          message: `Saved state user mismatch. Current: ${currentUser.name}, Saved: ${manualStateData.user}.`,
        };
      }
      ModalManager.request({
        context: "terminal",
        messageLines: [
          `Load manually saved state for '${currentUser.name}'? This overwrites current session & filesystem.`,
        ],
        data: {
          pendingData: manualStateData,
          userNameToRestoreTo: currentUser.name,
        },
        onConfirm: async (data) => {
          FileSystemManager.setFsData(
            Utils.deepCopyNode(data.pendingData.fsDataSnapshot) || {
              [Config.FILESYSTEM.ROOT_PATH]: {
                type: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
                children: {},
                owner: data.userNameToRestoreTo,
                mode: Config.FILESYSTEM.DEFAULT_DIR_MODE,
                mtime: new Date().toISOString(),
              },
            }
          );
          FileSystemManager.setCurrentPath(
            data.pendingData.currentPath || Config.FILESYSTEM.ROOT_PATH
          );
          if (DOM.outputDiv)
            DOM.outputDiv.innerHTML = data.pendingData.outputHTML || "";
          TerminalUI.setCurrentInputValue(data.pendingData.currentInput || "");
          HistoryManager.setHistory(data.pendingData.commandHistory || []);
          await FileSystemManager.save(data.userNameToRestoreTo);
          await OutputManager.appendToOutput(
            Config.MESSAGES.SESSION_LOADED_MSG,
            {
              typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
            }
          );
          TerminalUI.updatePrompt();
          if (DOM.outputDiv)
            DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
        },
        onCancel: () => {
          OutputManager.appendToOutput(Config.MESSAGES.LOAD_STATE_CANCELLED, {
            typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
          });
        },
      });
      return {
        success: true,
        message: "Confirmation requested for loading state.",
      };
    } else
      return {
        success: false,
        message: `${Config.MESSAGES.NO_MANUAL_SAVE_FOUND_PREFIX}${currentUser.name}.`,
      };
  }

  function clearUserSessionStates(username) {
    if (!username || typeof username !== "string") {
      console.warn(
        "SessionManager.clearUserSessionStates: Invalid username provided.",
        username
      );
      return false;
    }
    try {
      StorageManager.removeItem(_getAutomaticSessionStateKey(username));
      StorageManager.removeItem(_getManualUserTerminalStateKey(username));
      const users = StorageManager.loadItem(
        Config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
      );
      if (users.hasOwnProperty(username)) {
        delete users[username];
        StorageManager.saveItem(
          Config.STORAGE_KEYS.USER_CREDENTIALS,
          users,
          "User list"
        );
      }
      return true;
    } catch (e) {
      console.error(`Error clearing session states for user '${username}':`, e);
      return false;
    }
  }
  async function performFullReset() {
    OutputManager.clearOutput();
    TerminalUI.clearInput();
    const allKeys = StorageManager.getAllLocalStorageKeys();
    allKeys.forEach((key) => {
      const shouldRemove =
        key.startsWith(Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX) ||
        key.startsWith(Config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX) ||
        key === Config.STORAGE_KEYS.USER_CREDENTIALS ||
        key === Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED ||
        key === Config.STORAGE_KEYS.ALIAS_DEFINITIONS || // <-- ADD THIS LINE
        key === Config.STORAGE_KEYS.USER_GROUPS; // <-- AND THIS LINE
      if (shouldRemove && key !== Config.STORAGE_KEYS.GEMINI_API_KEY) {
        StorageManager.removeItem(key);
      }
    });
    await OutputManager.appendToOutput(
      "All session states, credentials, aliases, groups, and editor settings cleared from local storage."
    );
    try {
      await FileSystemManager.clearAllFS();
      await OutputManager.appendToOutput(
        "All user filesystems cleared from DB."
      );
    } catch (error) {
      await OutputManager.appendToOutput(
        `Warning: Could not fully clear all user filesystems from DB. Error: ${error.message}`,
        {
          typeClass: Config.CSS_CLASSES.WARNING_MSG,
        }
      );
    }
    await OutputManager.appendToOutput("Reset complete. Rebooting OopisOS...", {
      typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
    });
    TerminalUI.setInputState(false);
    if (DOM.inputLineContainerDiv) {
      DOM.inputLineContainerDiv.classList.add(Config.CSS_CLASSES.HIDDEN);
    }
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }
  return {
    saveAutomaticState,
    loadAutomaticState,
    saveManualState,
    loadManualState,
    clearUserSessionStates,
    performFullReset,
  };
})();
const TabCompletionManager = (() => {
  "use strict";
  let suggestionsCache = [];
  let cycleIndex = -1;
  let lastCompletionInput = null; // The full input string at the time of the last multi-suggestion tab
  function resetCycle() {
    suggestionsCache = [];
    cycleIndex = -1;
    lastCompletionInput = null;
  }

  function findLongestCommonPrefix(strs) {
    if (!strs || strs.length === 0) return "";
    if (strs.length === 1) return strs[0];
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
      while (strs[i].indexOf(prefix) !== 0) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (prefix === "") return "";
      }
    }
    return prefix;
  }

  function _applyCompletion(
    fullInput,
    startOfWordIndex,
    currentWordPrefixLength,
    completion
  ) {
    const textBeforeWord = fullInput.substring(0, startOfWordIndex);
    const textAfterWord = fullInput.substring(
      startOfWordIndex + currentWordPrefixLength
    );
    const newText = textBeforeWord + completion + textAfterWord;
    const newCursorPos = textBeforeWord.length + completion.length;
    return {
      textToInsert: newText,
      newCursorPos,
    };
  }

  function _getCompletionContext(fullInput, cursorPos) {
    const textBeforeCursor = fullInput.substring(0, cursorPos);
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(" ");
    // Find the start of the word being completed
    let startOfWordIndex = lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1;
    // If there are multiple spaces, we might be at the start of a new word.
    if (/\s$/.test(textBeforeCursor)) {
      startOfWordIndex = cursorPos;
    }
    const currentWordPrefix = textBeforeCursor.substring(startOfWordIndex);
    const tokens = fullInput.trimStart().split(/\s+/).filter(Boolean);
    const isCompletingCommand =
      tokens.length === 0 || (tokens.length === 1 && !/\s$/.test(fullInput));
    const commandName = isCompletingCommand ? "" : tokens[0].toLowerCase();
    return {
      currentWordPrefix,
      startOfWordIndex,
      isCompletingCommand,
      commandName,
    };
  }

  function _getSuggestionsFromProvider(context) {
    const { currentWordPrefix, isCompletingCommand, commandName } = context;
    const allCommands = CommandExecutor.getCommands();
    let suggestions = [];

    if (isCompletingCommand) {
      suggestions = Object.keys(allCommands)
        .filter((cmd) =>
          cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
        )
        .sort();
    } else {
      const commandDefinition = allCommands[commandName]?.handler.definition; // Assumes handler holds definition

      if (!commandDefinition) return [];

      if (commandName === "help") {
        suggestions = Object.keys(allCommands)
          .filter((cmd) =>
            cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
          )
          .sort();
      } else if (commandDefinition.completionType === "users") {
        const users = StorageManager.loadItem(
          Config.STORAGE_KEYS.USER_CREDENTIALS,
          "User list",
          {}
        );
        const userNames = Object.keys(users);
        if (!userNames.includes(Config.USER.DEFAULT_NAME))
          userNames.push(Config.USER.DEFAULT_NAME);
        suggestions = userNames
          .filter((name) =>
            name.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
          )
          .sort();
      } else if (commandDefinition.pathValidation) {
        // Check for pathValidation property
        let pathPrefixForFS = "";
        let segmentToMatchForFS = "";
        const lastSlashIndex = currentWordPrefix.lastIndexOf(
          Config.FILESYSTEM.PATH_SEPARATOR
        );

        if (lastSlashIndex !== -1) {
          pathPrefixForFS = currentWordPrefix.substring(0, lastSlashIndex + 1);
          segmentToMatchForFS = currentWordPrefix.substring(lastSlashIndex + 1);
        } else {
          segmentToMatchForFS = currentWordPrefix;
        }

        const effectiveBasePathForFS = FileSystemManager.getAbsolutePath(
          pathPrefixForFS,
          FileSystemManager.getCurrentPath()
        );
        const baseNode = FileSystemManager.getNodeByPath(
          effectiveBasePathForFS
        );
        const currentUser = UserManager.getCurrentUser().name;

        if (
          baseNode &&
          baseNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
          FileSystemManager.hasPermission(baseNode, currentUser, "read")
        ) {
          suggestions = Object.keys(baseNode.children)
            .filter((name) =>
              name.toLowerCase().startsWith(segmentToMatchForFS.toLowerCase())
            )
            .map((name) => {
              const childNode = baseNode.children[name];
              const completion = pathPrefixForFS + name;
              return childNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                ? completion + Config.FILESYSTEM.PATH_SEPARATOR
                : completion;
            })
            .sort();
        }
      }
    }
    return suggestions;
  }

  function handleTab(fullInput, cursorPos) {
    if (fullInput !== lastCompletionInput) {
      resetCycle();
    }
    const context = _getCompletionContext(fullInput, cursorPos);
    if (suggestionsCache.length === 0) {
      // New completion
      const suggestions = _getSuggestionsFromProvider(context);
      if (suggestions.length === 0) {
        resetCycle();
        return {
          textToInsert: null,
        };
      }
      if (suggestions.length === 1) {
        const isDir = suggestions[0].endsWith(Config.FILESYSTEM.PATH_SEPARATOR);
        const completion = suggestions[0] + (isDir ? "" : " ");
        const result = _applyCompletion(
          fullInput,
          context.startOfWordIndex,
          context.currentWordPrefix.length,
          completion
        );
        resetCycle();
        return result;
      }
      // Multiple suggestions
      const lcp = findLongestCommonPrefix(suggestions);
      if (lcp && lcp.length > context.currentWordPrefix.length) {
        const result = _applyCompletion(
          fullInput,
          context.startOfWordIndex,
          context.currentWordPrefix.length,
          lcp
        );
        lastCompletionInput = result.textToInsert;
        return result;
      } else {
        suggestionsCache = suggestions;
        cycleIndex = -1;
        lastCompletionInput = fullInput;
        // Print the prompt and current input before showing suggestions
        const promptText = `${DOM.promptUserSpan.textContent}${Config.TERMINAL.PROMPT_AT}${DOM.promptHostSpan.textContent}${Config.TERMINAL.PROMPT_SEPARATOR}${DOM.promptPathSpan.textContent}${Config.TERMINAL.PROMPT_CHAR} `;
        void OutputManager.appendToOutput(`${promptText}${fullInput}`, {
          isCompletionSuggestion: true,
        });
        // Now show the suggestions on the next line
        void OutputManager.appendToOutput(suggestionsCache.join("    "), {
          typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
          isCompletionSuggestion: true,
        });
        if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
        return {
          textToInsert: null,
        };
      }
    } else {
      // We are cycling
      cycleIndex = (cycleIndex + 1) % suggestionsCache.length;
      const nextSuggestion = suggestionsCache[cycleIndex];
      const result = _applyCompletion(
        fullInput,
        context.startOfWordIndex,
        context.currentWordPrefix.length,
        nextSuggestion
      );
      lastCompletionInput = result.textToInsert;
      return result;
    }
  }
  return {
    handleTab,
    resetCycle,
  };
})();
function initializeTerminalEventListeners() {
  if (!DOM.terminalDiv || !DOM.editableInputDiv) {
    console.error(
      "Terminal event listeners cannot be initialized: Core DOM elements not found."
    );
    return;
  }
  // This listener helps focus the input when the user clicks on the terminal area.
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
  // This is the main keyboard event handler for the entire application.
  document.addEventListener("keydown", async (e) => {
    // If the editor is active, it has its own key handler, so we do nothing here.
    if (EditorManager.isActive()) {
      return;
    }
    // If a modal prompt (like a password input) is active, let the modal manager handle the key.
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
    // Process the key press for the terminal
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        TabCompletionManager.resetCycle(); // Reset on command execution
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
  // This listener handles pasting text into the terminal.
  if (DOM.editableInputDiv) {
    DOM.editableInputDiv.addEventListener("paste", (e) => {
      e.preventDefault();
      if (DOM.editableInputDiv.contentEditable !== "true") return;

      // Get pasted text and replace newlines with spaces.
      const text = (e.clipboardData || window.clipboardData).getData(
        "text/plain"
      );
      const processedText = text.replace(/\r?\n|\r/g, " ");

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);

      // Ensure the paste action is happening inside our editable input.
      if (!DOM.editableInputDiv.contains(range.commonAncestorContainer)) return;

      // Delete any currently selected text.
      range.deleteContents();

      // Create a new text node with our processed, single-line text.
      const textNode = document.createTextNode(processedText);
      range.insertNode(textNode);

      // Move the cursor to the end of the newly inserted text.
      range.setStartAfter(textNode);
      range.collapse(true); // Collapse the range to a single point (the cursor).
      selection.removeAllRanges(); // Clear any old selection.
      selection.addRange(range); // Set the new cursor position.
    });
    DOM.editableInputDiv.addEventListener("input", (e) => {
      // Any direct user input should reset the tab-completion cycle.
      if (e.isTrusted) {
        TabCompletionManager.resetCycle();
      }
    });
  } // <- This closes the `if(DOM.editableInputDiv)` block
}
window.onload = async () => {
  // Cache all the necessary DOM elements for performance
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

  // Start up the core systems
  OutputManager.initializeConsoleOverrides();
  try {
    await IndexedDBManager.init();
    await FileSystemManager.load();
    await UserManager.initializeDefaultUsers();
    await Config.loadFromFile();
    GroupManager.initialize();
    AliasManager.initialize();

    // Set the initial session state for the Guest user
    SessionManager.loadAutomaticState(Config.USER.DEFAULT_NAME);

    // Ensure the current path is valid after loading
    const guestHome = `/home/${Config.USER.DEFAULT_NAME}`;
    if (!FileSystemManager.getNodeByPath(FileSystemManager.getCurrentPath())) {
      if (FileSystemManager.getNodeByPath(guestHome)) {
        FileSystemManager.setCurrentPath(guestHome);
      } else {
        FileSystemManager.setCurrentPath(Config.FILESYSTEM.ROOT_PATH);
      }
    }

    // Light up the terminal
    initializeTerminalEventListeners();
    TerminalUI.updatePrompt();
    TerminalUI.focusInput();
    console.log(
      `${Config.OS.NAME} v.${Config.OS.VERSION} loaded successfully!`
    );
  } catch (error) {
    // Catch any fatal errors during initialization
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
