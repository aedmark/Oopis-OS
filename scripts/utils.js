// scripts/utils.js

class Utils {
  static extractComments(content, fileExtension) {
    let comments = [];
    let regex;

    switch (fileExtension) {
      case "js":
        regex = /(\/\*[\s\S]*?\*\/|\/\/.+)/g;
        break;
      case "sh":
        regex = /(^|\s)#.*$/gm;
        break;
      default:
        return "";
    }

    const matches = content.match(regex);
    if (matches) {
      comments = matches.map((comment) => {
        if (comment.startsWith("/*")) {
          return comment
              .replace(/^\/\*+/, "")
              .replace(/\*\/$/, "")
              .trim();
        } else {
          return comment.replace(/^\/\//, "").replace(/^#/, "").trim();
        }
      });
    }
    return comments.join("\n");
  }

  static debounce(func, delay) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  }

  static getCharacterDimensions(fontStyle = '16px "VT323"') {
    const tempSpan = document.createElement("span");
    tempSpan.textContent = "M";
    tempSpan.style.font = fontStyle;
    tempSpan.style.position = "absolute";
    tempSpan.style.left = "-9999px";
    tempSpan.style.top = "-9999px";
    tempSpan.style.visibility = "hidden";

    document.body.appendChild(tempSpan);
    const rect = tempSpan.getBoundingClientRect();
    document.body.removeChild(tempSpan);

    return { width: rect.width, height: rect.height };
  }

  static async calculateSHA256(text) {
    if (typeof text !== "string") {
      return null;
    }
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      console.error("Password hashing failed:", error);
      return null;
    }
  }

  static formatConsoleArgs(args) {
    return Array.from(args)
        .map((arg) =>
            typeof arg === "object" && arg !== null
                ? JSON.stringify(arg)
                : String(arg)
        )
        .join(" ");
  }

  static parseKeyValue(args) {
    const combined = args.join(" ");
    const eqIndex = combined.indexOf("=");

    if (eqIndex === -1) {
      return { name: combined.trim(), value: null };
    }

    const name = combined.substring(0, eqIndex).trim();
    let value = combined.substring(eqIndex + 1).trim();

    if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.substring(1, value.length - 1);
    }

    return { name, value };
  }

  static deepCopyNode(node) {
    return node ? JSON.parse(JSON.stringify(node)) : null;
  }

  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  static getFileExtension(filePath) {
    if (!filePath || typeof filePath !== "string") return "";
    const separator =
        typeof Config !== "undefined" && Config.FILESYSTEM
            ? Config.FILESYSTEM.PATH_SEPARATOR
            : "/";
    const name = filePath.substring(filePath.lastIndexOf(separator) + 1);
    const lastDot = name.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0 || lastDot === name.length - 1) {
      return "";
    }
    return name.substring(lastDot + 1).toLowerCase();
  }

  static createElement(tag, attributes = {}, ...childrenArgs) {
    const element = document.createElement(tag);
    for (const key in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, key)) {
        const value = attributes[key];
        if (key === "textContent") {
          element.textContent = value;
        } else if (key === "innerHTML") {
          element.innerHTML = value;
        } else if (key === "classList" && Array.isArray(value)) {
          element.classList.add(...value.filter((c) => typeof c === "string"));
        } else if (key === "className" && typeof value === "string") {
          element.className = value;
        } else if (key === "style" && typeof value === "object") {
          Object.assign(element.style, value);
        } else if (key === "eventListeners" && typeof value === "object") {
          for (const eventType in value) {
            if (Object.prototype.hasOwnProperty.call(value, eventType)) {
              element.addEventListener(eventType, value[eventType]);
            }
          }
        } else if (value !== null && value !== undefined) {
          element.setAttribute(key, String(value));
        }
      }
    }
    childrenArgs.flat().forEach((child) => {
      if (child instanceof Node) {
        element.appendChild(child);
      } else if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
      }
    });
    return element;
  }

  static validateArguments(argsArray, config = {}) {
    const argCount = argsArray.length;
    if (typeof config.exact === "number" && argCount !== config.exact) {
      return {
        isValid: false,
        errorDetail: `expected exactly ${config.exact} argument(s) but got ${argCount}`,
      };
    }
    if (typeof config.min === "number" && argCount < config.min) {
      return {
        isValid: false,
        errorDetail: `expected at least ${config.min} argument(s), but got ${argCount}`,
      };
    }
    if (typeof config.max === "number" && argCount > config.max) {
      return {
        isValid: false,
        errorDetail: `expected at most ${config.max} argument(s), but got ${argCount}`,
      };
    }
    return { isValid: true };
  }

  static parseNumericArg(argString, options = {}) {
    const { allowFloat = false, allowNegative = false, min, max } = options;
    const num = allowFloat ? parseFloat(argString) : parseInt(argString, 10);
    if (isNaN(num)) return { value: null, error: "is not a valid number" };
    if (!allowNegative && num < 0)
      return { value: null, error: "must be a non-negative number" };
    if (min !== undefined && num < min)
      return { value: null, error: `must be at least ${min}` };
    if (max !== undefined && num > max)
      return { value: null, error: `must be at most ${max}` };
    return { value: num, error: null };
  }

  static validateUsernameFormat(username) {
    if (!username || typeof username !== "string" || username.trim() === "")
      return { isValid: false, error: "Username cannot be empty." };
    if (username.includes(" "))
      return { isValid: false, error: "Username cannot contain spaces." };
    if (
        typeof Config !== "undefined" &&
        Config.USER.RESERVED_USERNAMES.includes(username.toLowerCase())
    )
      return {
        isValid: false,
        error: `Cannot use '${username}'. This username is reserved.`,
      };
    if (
        typeof Config !== "undefined" &&
        username.length < Config.USER.MIN_USERNAME_LENGTH
    )
      return {
        isValid: false,
        error: `Username must be at least ${Config.USER.MIN_USERNAME_LENGTH} characters long.`,
      };
    if (
        typeof Config !== "undefined" &&
        username.length > Config.USER.MAX_USERNAME_LENGTH
    )
      return {
        isValid: false,
        error: `Username cannot exceed ${Config.USER.MAX_USERNAME_LENGTH} characters.`,
      };
    return { isValid: true, error: null };
  }

  static parseFlags(argsArray, flagDefinitions) {
    const flags = {};
    const remainingArgs = [];
    flagDefinitions.forEach((def) => {
      flags[def.name] = def.takesValue ? null : false;
    });

    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      if (!arg.startsWith("-") || arg === "-" || arg === "--") {
        remainingArgs.push(arg);
        continue;
      }

      const exactDef = flagDefinitions.find((d) =>
          [d.long, d.short, ...(d.aliases || [])].includes(arg)
      );
      if (exactDef) {
        if (exactDef.takesValue) {
          if (i + 1 < argsArray.length) {
            flags[exactDef.name] = argsArray[++i];
          }
        } else {
          flags[exactDef.name] = true;
        }
        continue;
      }

      if (!arg.startsWith("--") && arg.length > 2) {
        const shortFlag = arg.substring(0, 2);
        const valueTakingDef = flagDefinitions.find(
            (d) => [d.short].includes(shortFlag) && d.takesValue
        );
        if (valueTakingDef) {
          flags[valueTakingDef.name] = arg.substring(2);
          continue;
        }

        const chars = arg.substring(1);
        let consumed = true;
        for (const char of chars) {
          const charDef = flagDefinitions.find(
              (d) => [d.short].includes(`-${char}`) && !d.takesValue
          );
          if (charDef) {
            flags[charDef.name] = true;
          } else {
            consumed = false;
            break;
          }
        }
        if (consumed) continue;
      }

      remainingArgs.push(arg);
    }

    return { flags, remainingArgs };
  }

  static safeDelay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  static globToRegex(glob) {
    if (glob === "*") return /.*/;

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
        case "[":
          let charClass = "[";
          let k = i + 1;
          if (k < glob.length && (glob[k] === "!" || glob[k] === "^")) {
            charClass += "^";
            k++;
          }
          while (k < glob.length && glob[k] !== "]") {
            if (["\\", "-", "]"].includes(glob[k])) {
              charClass += "\\";
            }
            charClass += glob[k];
            k++;
          }
          if (k < glob.length && glob[k] === "]") {
            charClass += "]";
            i = k;
          } else {
            regexStr += "\\[";
          }
          break;
        default:
          if (/[.\\+?()|[\]{}^$]/.test(char)) {
            regexStr += "\\" + char;
          } else {
            regexStr += char;
          }
          break;
      }
    }
    regexStr += "$";
    try {
      return new RegExp(regexStr, "u");
    } catch (e) {
      console.warn(
          `Utils.globToRegex: Failed to convert glob "${glob}" to regex: ${e.message}`
      );
      return null;
    }
  }
}