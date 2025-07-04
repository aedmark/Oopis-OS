/**
 * @file Defines the 'awk' command, a powerful pattern-scanning and text-processing language.
 * This implementation provides a safe subset of awk's functionality.
 * @author Andrew Edmark
 * @author Gemini
 */
(() => {
    "use strict";

    /**
     * Parses the awk program string into a structured object.
     * @param {string} programString - The awk program, e.g., '/pattern/ { action }'.
     * @returns {{begin: string|null, end: string|null, rules: Array<object>, error: string|null}}
     */
    function _parseProgram(programString) {
        const program = {
            begin: null,
            end: null,
            rules: [],
            error: null,
        };

        const ruleRegex = /(BEGIN)\s*{([^}]*)}|(END)\s*{([^}]*)}|(\/[^/]*\/)\s*{([^}]*)}/g;
        let match;
        while ((match = ruleRegex.exec(programString)) !== null) {
            if (match[1]) {
                program.begin = match[2].trim();
            } else if (match[3]) {
                program.end = match[4].trim();
            } else if (match[5]) {
                try {
                    const pattern = new RegExp(match[5].slice(1, -1));
                    program.rules.push({
                        pattern: pattern,
                        action: match[6].trim()
                    });
                } catch (e) {
                    program.error = `Invalid regex pattern: ${match[5]}`;
                    return program;
                }
            }
        }

        if (programString.trim() && !program.begin && !program.end && program.rules.length === 0) {
            const simpleActionMatch = programString.trim().match(/^{([^}]*)}$/);
            if (simpleActionMatch) {
                program.rules.push({ pattern: /.*/, action: simpleActionMatch[1].trim() });
            } else {
                program.error = `Unrecognized program format: ${programString}`;
            }
        }
        return program;
    }


    /**
     * Safely executes a parsed awk action string.
     * @param {string} action - The action string, e.g., 'print $1, $3'.
     * @param {string[]} fields - The fields of the current line, where fields[0] is $0.
     * @param {object} vars - Built-in variables like NR and NF.
     * @returns {string|null} The output string or null if no output.
     */
    function _executeAction(action, fields, vars) {
        if (action.startsWith("print")) {
            let argsStr = action.substring(5).trim();
            if (argsStr === "") {
                return fields[0];
            }

            argsStr = argsStr.replace(/\$([0-9]+)/g, (match, n) => {
                const index = parseInt(n, 10);
                return fields[index] || "";
            });
            argsStr = argsStr.replace(/\$0/g, fields[0]);
            argsStr = argsStr.replace(/NR/g, vars.NR);
            argsStr = argsStr.replace(/NF/g, vars.NF);

            return argsStr.replace(/,/g, ' ');
        }
        return null;
    }


    const awkCommandDefinition = {
        commandName: "awk",
        flagDefinitions: [
            { name: "fieldSeparator", short: "-F", takesValue: true }
        ],
        coreLogic: async (context) => {
            const { flags, args: remainingArgs, options, currentUser } = context;

            if (remainingArgs.length === 0) {
                return { success: false, error: "awk: missing program" };
            }

            const programString = remainingArgs[0];
            const filePaths = remainingArgs.slice(1);

            const program = _parseProgram(programString);
            if (program.error) {
                return { success: false, error: `awk: program error: ${program.error}` };
            }

            const separator = flags.fieldSeparator ? new RegExp(flags.fieldSeparator) : /\s+/;
            let outputLines = [];
            let nr = 0;

            if (program.begin) {
                const beginResult = _executeAction(program.begin, [], { NR: 0, NF: 0 });
                if (beginResult !== null) {
                    outputLines.push(beginResult);
                }
            }

            const processContent = (content) => {
                if (typeof content !== 'string') {
                    console.error("AWK internal error: processContent received non-string input:", content);
                    return;
                }

                const lines = content.split('\n');
                for (const line of lines) {
                    if (line === '' && lines.at(-1) === '') continue;

                    nr++;

                    const trimmedLine = line.trim();
                    let fields = trimmedLine === '' ? [] : trimmedLine.split(separator);

                    // (Your previous fix can remain here as an extra layer of safety)
                    if (!Array.isArray(fields)) {
                        console.error("AWK internal error: 'fields' was not an array for line:", line);
                        fields = [];
                    }

                    const allFields = [line, ...fields];
                    const vars = { NR: nr, NF: fields.length };

                    for (const rule of program.rules) {
                        if (rule.pattern.test(line)) {
                            const actionResult = _executeAction(rule.action, allFields, vars);
                            if (actionResult !== null) {
                                outputLines.push(actionResult);
                            }
                        }
                    }
                }
            };

            if (filePaths.length > 0) {
                for (const path of filePaths) {
                    const pathValidation = FileSystemManager.validatePath("awk", path, { expectedType: 'file' });
                    if (pathValidation.error) {
                        return { success: false, error: pathValidation.error };
                    }
                    if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                        return { success: false, error: `awk: cannot open file '${path}' for reading: Permission denied` };
                    }
                    processContent(pathValidation.node.content || "");
                }
            } else if (options.stdinContent !== null) {
                processContent(options.stdinContent);
            }

            if (program.end) {
                const endResult = _executeAction(program.end, [], { NR: nr, NF: 0 });
                if (endResult !== null) {
                    outputLines.push(endResult);
                }
            }

            return { success: true, output: outputLines.join('\n') };
        }
    };

    const awkDescription = "Pattern scanning and text processing language.";
    const awkHelpText = `Usage: awk 'program' [file...]
       awk -F<separator> 'program' [file...]

A tool for pattern scanning and processing.

DESCRIPTION
       awk scans each input file for lines that match any of a set of
       patterns specified in the 'program'. The program consists of
       a series of rules, each with a pattern and an action.

       This version of awk supports a subset of features:
       - Patterns must be regular expressions enclosed in slashes (e.g., /error/).
       - The only supported action is 'print'.
       - Special patterns BEGIN and END are supported.
       - Built-in variables NR (line number) and NF (number of fields) are available.
       - Field variables like $0 (the whole line), $1, $2, etc., are available.

OPTIONS
       -F<separator>
              Use the specified separator to split fields. Can be a single
              character or a regular expression.

EXAMPLES
       ls -l | awk '{print $9}'
              Prints only the 9th column (the filename) from the output of ls -l.

       awk -F, '{print $1}' data.csv
              Prints the first column of a comma-separated file.

       awk '/success/ {print "Found:", $0}' app.log
              Prints "Found:" followed by the full line for every line containing
              "success" in the file app.log.`;

    CommandRegistry.register("awk", awkCommandDefinition, awkDescription, awkHelpText);
})();