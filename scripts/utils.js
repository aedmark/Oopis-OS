/**
 * @file Provides globally accessible utility functions for various tasks such as string manipulation,
 * DOM creation, data validation, and command-line parsing. Also includes specialized parsers for timestamps and diffing.
 * @author Andrew Edmark
 * @author Gemini
 */

/**
 * @module Utils
 * @description A collection of general-purpose utility functions used throughout OopisOS.
 */
const Utils = (() => {
    "use strict";

    /**
     * Measures the precise pixel dimensions of a single character for a given font style.
     * @param {string} [fontStyle='16px "VT323"'] - The CSS font style to apply.
     * @returns {{width: number, height: number}} An object containing the measured width and height.
     */
    function getCharacterDimensions(fontStyle = '16px "VT323"') {
        const tempSpan = document.createElement("span");
        tempSpan.textContent = 'M'; // A common character for measurement
        tempSpan.style.font = fontStyle;
        tempSpan.style.position = 'absolute';
        tempSpan.style.left = '-9999px'; // Position off-screen
        tempSpan.style.top = '-9999px';
        tempSpan.style.visibility = 'hidden';

        document.body.appendChild(tempSpan);
        const rect = tempSpan.getBoundingClientRect();
        document.body.removeChild(tempSpan);

        return { width: rect.width, height: rect.height };
    }


    /**
     * Hashes a string using the Web Crypto API (SHA-256).
     * @param {string} text - The plain-text string to hash.
     * @returns {Promise<string|null>} A promise that resolves to the hex-encoded hash string, or null on failure.
     */
    async function calculateSHA256(text) {
        if (typeof text !== 'string') {
            return null;
        }
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        } catch (error) {
            console.error("SHA-256 hashing failed:", error);
            return null;
        }
    }

    /**
     * Formats a function's arguments object into a single, space-separated string for display.
     * @param {IArguments} args - The arguments object from a function call.
     * @returns {string} A string representation of the arguments.
     */
    function formatConsoleArgs(args) {
        return Array.from(args)
            .map((arg) =>
                typeof arg === "object" && arg !== null
                    ? JSON.stringify(arg)
                    : String(arg)
            )
            .join(" ");
    }

    /**
     * Creates a deep copy of a JSON-serializable object.
     * @param {object} node - The object (e.g., a file system node) to copy.
     * @returns {object|null} A deep copy of the object, or null if the input is null.
     */
    function deepCopyNode(node) {
        return node ? JSON.parse(JSON.stringify(node)) : null;
    }

    /**
     * Formats a number of bytes into a human-readable string (e.g., "1.25 KB").
     * @param {number} bytes - The number of bytes to format.
     * @param {number} [decimals=2] - The number of decimal places to include.
     * @returns {string} The formatted byte string.
     */
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    /**
     * Extracts the file extension from a file path.
     * @param {string} filePath - The path of the file.
     * @returns {string} The file's extension in lowercase, or an empty string if none is found.
     */
    function getFileExtension(filePath) {
        if (!filePath || typeof filePath !== "string") return "";
        const separator = (typeof Config !== 'undefined' && Config.FILESYSTEM) ? Config.FILESYSTEM.PATH_SEPARATOR : '/';
        const name = filePath.substring(
            filePath.lastIndexOf(separator) + 1
        );
        const lastDot = name.lastIndexOf(".");
        if (lastDot === -1 || lastDot === 0 || lastDot === name.length - 1) {
            return "";
        }
        return name.substring(lastDot + 1).toLowerCase();
    }

    /**
     * A powerful and flexible utility to create DOM elements programmatically.
     * @param {string} tag - The HTML tag for the element (e.g., 'div', 'button').
     * @param {object} [attributes={}] - An object of attributes to set on the element.
     * @param {...(Node|string)} childrenArgs - A variable number of child nodes or strings to append to the element.
     * @returns {HTMLElement} The newly created DOM element.
     */
    function createElement(tag, attributes = {}, ...childrenArgs) {
        const element = document.createElement(tag);
        for (const key in attributes) {
            if (Object.prototype.hasOwnProperty.call(attributes, key)) {
                const value = attributes[key];
                if (key === "textContent") {
                    element.textContent = value;
                } else if (key === "innerHTML") {
                    element.innerHTML = value;
                } else if (key === "classList" && Array.isArray(value)) {
                    element.classList.add(...value.filter(c => typeof c === 'string'));
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
            } else if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            }
        });
        return element;
    }

    /**
     * Validates the number of arguments provided against a configuration object.
     * @param {Array<string>} argsArray - The array of arguments to validate.
     * @param {object} [config={}] - Configuration for validation.
     * @returns {{isValid: boolean, errorDetail?: string}} An object indicating if validation passed and an error message if it failed.
     */
    function validateArguments(argsArray, config = {}) {
        const argCount = argsArray.length;
        if (typeof config.exact === "number" && argCount !== config.exact) {
            return { isValid: false, errorDetail: `expected exactly ${config.exact} argument(s) but got ${argCount}` };
        }
        if (typeof config.min === "number" && argCount < config.min) {
            return { isValid: false, errorDetail: `expected at least ${config.min} argument(s), but got ${argCount}` };
        }
        if (typeof config.max === "number" && argCount > config.max) {
            return { isValid: false, errorDetail: `expected at most ${config.max} argument(s), but got ${argCount}` };
        }
        return { isValid: true };
    }

    /**
     * Parses a string argument into a number with validation.
     * @param {string} argString - The string to parse.
     * @param {object} [options={}] - Parsing options.
     * @returns {{value: number|null, error: string|null}} An object containing the parsed value or an error message.
     */
    function parseNumericArg(argString, options = {}) {
        const { allowFloat = false, allowNegative = false, min, max } = options;
        const num = allowFloat ? parseFloat(argString) : parseInt(argString, 10);
        if (isNaN(num)) return { value: null, error: "is not a valid number" };
        if (!allowNegative && num < 0) return { value: null, error: "must be a non-negative number" };
        if (min !== undefined && num < min) return { value: null, error: `must be at least ${min}` };
        if (max !== undefined && num > max) return { value: null, error: `must be at most ${max}` };
        return { value: num, error: null };
    }

    /**
     * Validates a username against system rules (length, characters, reserved names).
     * @param {string} username - The username to validate.
     * @returns {{isValid: boolean, error: string|null}} An object indicating if validation passed and an error message if it failed.
     */
    function validateUsernameFormat(username) {
        if (!username || typeof username !== "string" || username.trim() === "") return { isValid: false, error: "Username cannot be empty." };
        if (username.includes(" ")) return { isValid: false, error: "Username cannot contain spaces." };
        if (typeof Config !== 'undefined' && Config.USER.RESERVED_USERNAMES.includes(username.toLowerCase())) return { isValid: false, error: `Cannot use '${username}'. This username is reserved.` };
        if (typeof Config !== 'undefined' && username.length < Config.USER.MIN_USERNAME_LENGTH) return { isValid: false, error: `Username must be at least ${Config.USER.MIN_USERNAME_LENGTH} characters long.` };
        if (typeof Config !== 'undefined' && username.length > Config.USER.MAX_USERNAME_LENGTH) return { isValid: false, error: `Username cannot exceed ${Config.USER.MAX_USERNAME_LENGTH} characters.` };
        return { isValid: true, error: null };
    }

    /**
     * Parses an array of command-line arguments into flags and remaining non-flag arguments.
     * @param {string[]} argsArray - The array of raw arguments from the command line.
     * @param {Array<object>} flagDefinitions - An array of objects defining the valid flags for a command.
     * @returns {{flags: object, remainingArgs: string[]}} An object containing a `flags` object and an array of `remainingArgs`.
     */
    function parseFlags(argsArray, flagDefinitions) {
        const flags = {};
        const remainingArgs = [];
        flagDefinitions.forEach((def) => {
            flags[def.name] = def.takesValue ? null : false;
        });

        const findDef = (argument) => flagDefinitions.find(d => [d.long, d.short, ...(d.aliases || [])].includes(argument));

        for (let i = 0; i < argsArray.length; i++) {
            const arg = argsArray[i];
            if (!arg.startsWith('-') || arg === '-' || arg === '--') {
                remainingArgs.push(arg);
                continue;
            }

            const exactDef = findDef(arg);
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

            if (!arg.startsWith('--') && arg.length > 2) {
                const shortFlag = arg.substring(0, 2);
                const valueTakingDef = findDef(shortFlag);
                if (valueTakingDef && valueTakingDef.takesValue) {
                    flags[valueTakingDef.name] = arg.substring(2);
                    continue;
                }

                const chars = arg.substring(1);
                let consumed = true;
                for (const char of chars) {
                    const charDef = findDef(`-${char}`);
                    if (charDef && !charDef.takesValue) {
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

    /**
     * A generic function to call an LLM API, adapting to different providers.
     * @param {string} provider - The name of the provider.
     * @param {string} model - The specific model to use.
     * @param {Array<object>} conversation - The chat history/prompt.
     * @param {string} apiKey - The API key for the provider.
     * @returns {Promise<object>} A promise that resolves with the API response.
     */
    async function callLlmApi(provider, model, conversation, apiKey) {
        const providerConfig = (typeof Config !== 'undefined') ? Config.API.LLM_PROVIDERS[provider] : null;
        if (!providerConfig) {
            return { success: false, error: `LLM provider '${provider}' not configured.` };
        }

        const url = providerConfig.url;
        let headers = { 'Content-Type': 'application/json' };
        let body;

        switch (provider) {
            case 'gemini':
                headers['x-goog-api-key'] = apiKey;
                body = JSON.stringify({ contents: conversation });
                break;
            case 'ollama':
                const promptText = conversation.map(part => part.parts.map(p => p.text).join('\n')).join('\n');
                body = JSON.stringify({ model: model || providerConfig.defaultModel, prompt: promptText, stream: false });
                break;
            case 'llm-studio':
                body = JSON.stringify({
                    model: model || providerConfig.defaultModel,
                    messages: conversation.map(turn => ({
                        role: turn.role === 'model' ? 'assistant' : 'user',
                        content: turn.parts.map(p => p.text).join('\n')
                    })),
                    temperature: 0.7,
                    stream: false
                });
                break;
            default:
                return { success: false, error: `Unsupported LLM provider: ${provider}` };
        }

        try {
            const response = await fetch(url, { method: 'POST', headers, body });
            if (!response.ok) {
                const errorText = await response.text();
                return { success: false, error: `API request failed with status ${response.status}: ${errorText}` };
            }

            const responseData = await response.json();
            let finalAnswer;
            switch (provider) {
                case 'gemini': finalAnswer = responseData.candidates?.[0]?.content?.parts?.[0]?.text; break;
                case 'ollama': finalAnswer = responseData.response; break;
                case 'llm-studio': finalAnswer = responseData.choices?.[0]?.message?.content; break;
            }

            return finalAnswer ? { success: true, answer: finalAnswer } : { success: false, error: "AI failed to generate a valid response." };
        } catch (e) {
            if (provider !== 'gemini' && e instanceof TypeError) {
                return { success: false, error: `LOCAL_PROVIDER_UNAVAILABLE` };
            }
            return { success: false, error: `Network or fetch error: ${e.message}` };
        }
    }

    /**
     * Converts a glob pattern (like *.txt) into a regular expression for matching.
     * @param {string} glob - The glob pattern string.
     * @returns {RegExp|null} A RegExp object or null if the glob is invalid.
     */
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
                case "[":
                    let charClass = "[";
                    let k = i + 1;
                    if (k < glob.length && (glob[k] === "!" || glob[k] === "^")) {
                        charClass += "^";
                        k++;
                    }
                    while (k < glob.length && glob[k] !== "]") {
                        charClass += (/[.^${}()|[\]\\]/.test(glob[k])) ? "\\" + glob[k] : glob[k];
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
                default:
                    if (/[.^${}()|[\]\\]/.test(char)) regexStr += "\\";
                    regexStr += char;
            }
        }
        regexStr += "$";
        try {
            return new RegExp(regexStr);
        } catch (e) {
            console.warn(`Utils.globToRegex: Failed to convert glob "${glob}" to regex: ${e.message}`);
            return null;
        }
    }

    return {
        getCharacterDimensions,
        calculateSHA256,
        formatConsoleArgs,
        deepCopyNode,
        formatBytes,
        getFileExtension,
        createElement,
        validateArguments,
        parseNumericArg,
        validateUsernameFormat,
        parseFlags,
        callLlmApi,
        globToRegex,
    };
})();

/**
 * @module TimestampParser
 * @description A specialized parser for handling various date and time string formats.
 */
const TimestampParser = (() => {
    "use strict";

    /**
     * Parses a human-readable relative or absolute date string into a Date object.
     * @param {string} dateStr - The string to parse (e.g., "1 day ago", "2025-01-01", "-1 week").
     * @returns {Date|null} A Date object or null if parsing fails.
     */
    function parseDateString(dateStr) {
        if (typeof dateStr !== "string") return null;

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
            const now = new Date();

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

        const absoluteDate = new Date(dateStr);
        if (!isNaN(absoluteDate.getTime())) {
            return absoluteDate;
        }

        return null;
    }

    /**
     * Parses a `touch`-style timestamp string into an ISO 8601 date string.
     * @param {string} stampStr - The timestamp string in the format [[CC]YY]MMDDhhmm[.ss].
     * @returns {string|null} An ISO 8601 string or null if parsing fails.
     */
    function parseStampToISO(stampStr) {
        let year, monthVal, day, hours, minutes, seconds = 0;
        const currentDate = new Date();
        let s = stampStr;
        if (s.includes(".")) {
            const parts = s.split(".");
            if (parts.length !== 2 || parts[1].length !== 2 || isNaN(parseInt(parts[1], 10))) return null;
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
        if (isNaN(year) || isNaN(monthVal) || isNaN(day) || isNaN(hours) || isNaN(minutes)) return null;
        if (monthVal < 1 || monthVal > 12 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        const dateObj = new Date(Date.UTC(year, monthVal - 1, day, hours, minutes, seconds));
        if (dateObj.getUTCFullYear() !== year || dateObj.getUTCMonth() !== monthVal - 1 || dateObj.getUTCDate() !== day || dateObj.getUTCHours() !== hours || dateObj.getUTCMinutes() !== minutes || dateObj.getUTCSeconds() !== seconds) return null;
        return dateObj.toISOString();
    }

    /**
     * Resolves a final timestamp from command flags, handling `-d` and `-t` options.
     * @param {object} flags - The parsed flags object from a command.
     * @param {string} commandName - The name of the command calling this function, for error messages.
     * @returns {{timestampISO: string|null, error: string|null}} An object with the resulting ISO timestamp or an error.
     */
    function resolveTimestampFromCommandFlags(flags, commandName) {
        if (flags.dateString && flags.stamp) {
            return { timestampISO: null, error: `${commandName}: cannot use both --date and --stamp flags simultaneously.` };
        }
        if (flags.dateString) {
            const parsedDate = parseDateString(flags.dateString);
            if (!parsedDate) {
                return { timestampISO: null, error: `${commandName}: invalid date string format '${flags.dateString}'` };
            }
            return { timestampISO: parsedDate.toISOString(), error: null };
        }
        if (flags.stamp) {
            const parsedISO = parseStampToISO(flags.stamp);
            if (!parsedISO) {
                return { timestampISO: null, error: `${commandName}: invalid stamp format '${flags.stamp}' (expected [[CC]YY]MMDDhhmm[.ss])` };
            }
            return { timestampISO: parsedISO, error: null };
        }
        return { timestampISO: new Date().toISOString(), error: null };
    }
    return {
        parseDateString,
        resolveTimestampFromCommandFlags,
    };
})();

/**
 * @module DiffUtils
 * @description Provides utilities for comparing text content, used by the `diff` command.
 */
const DiffUtils = (() => {
    "use strict";

    /**
     * Compares two strings line by line using a diff algorithm.
     * @param {string} textA - The first string to compare.
     * @param {string} textB - The second string to compare.
     * @returns {string} A formatted diff string.
     */
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
                    x = v[k + 1 + max];
                } else {
                    x = v[k - 1 + max] + 1;
                }
                let y = x - k;
                while (x < N && y < M && a[x] === b[y]) {
                    x++;
                    y++;
                }
                v[k + max] = x;
                if (x >= N && y >= M) {
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
                                diffOutput.unshift(`< ${a[px - 1]}`);
                            } else {
                                diffOutput.unshift(`> ${b[py - 1]}`);
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
        return "";
    }

    return {
        compare
    };
})();

/**
 * @module PatchUtils
 * @description Provides utilities for creating and applying patches for undo/redo functionality.
 */
const PatchUtils = (() => {
    "use strict";

    /**
     * Creates a patch object representing the difference between two strings.
     * @param {string} oldText The original string.
     * @param {string} newText The modified string.
     * @returns {object|null} A patch object or null if no difference.
     */
    function createPatch(oldText, newText) {
        if (oldText === newText) {
            return null;
        }
        let start = 0;
        while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
            start++;
        }
        let oldEnd = oldText.length;
        let newEnd = newText.length;
        while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
            oldEnd--;
            newEnd--;
        }
        const deletedText = oldText.substring(start, oldEnd);
        const insertedText = newText.substring(start, newEnd);
        return {
            index: start,
            delete: deletedText.length,
            insert: insertedText,
            deleted: deletedText
        };
    }

    /**
     * Applies a patch to a string to get the new version.
     * @param {string} text The original string.
     * @param {object} patch The patch object.
     * @returns {string} The text after applying the patch.
     */
    function applyPatch(text, patch) {
        const head = text.substring(0, patch.index);
        const tail = text.substring(patch.index + patch.delete);
        return head + patch.insert + tail;
    }

    /**
     * Applies the inverse of a patch to a string to get the old version.
     * @param {string} text The modified string.
     * @param {object} patch The patch object containing the 'deleted' property.
     * @returns {string} The text after applying the inverse patch.
     */
    function applyInverse(text, patch) {
        const head = text.substring(0, patch.index);
        const tail = text.substring(patch.index + patch.insert.length);
        return head + patch.deleted + tail;
    }

    return {
        createPatch,
        applyPatch,
        applyInverse
    };
})();