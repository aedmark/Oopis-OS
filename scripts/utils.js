//utils.js - OopisOS Utility Functions

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
const TimestampParser = (() => {
    "use strict";

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
        } else if (flags.dateString) {
        } else if (flags.stamp) {
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
        parseDateString,
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