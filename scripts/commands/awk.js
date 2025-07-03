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

        // Simplified parser for 'pattern { action }' structures.
        // This regex is complex but safer than eval. It captures different parts of an awk script.
        const ruleRegex = /(BEGIN)\s*{([^}]*)}|(END)\s*{([^}]*)}|(\/[^/]*\/)\s*{([^}]*)}/g;
        let match;
        let lastIndex = 0;

        while ((match = ruleRegex.exec(programString)) !== null) {
            if (match[1]) { // BEGIN block
                program.begin = match[2].trim();
            } else if (match[3]) { // END block
                program.end = match[4].trim();
            } else if (match[5]) { // /pattern/ { action } block
                try {
                    const pattern = new RegExp(match[5].slice(1, -1)); // Create RegExp from pattern
                    program.rules.push({
                        pattern: pattern,
                        action: match[6].trim()
                    });
                } catch (e) {
                    program.error = `Invalid regex pattern: ${match[5]}`;
                    return program;
                }
            }
            lastIndex = ruleRegex.lastIndex;
        }

        // Handle default action (print all lines) if no rules are found
        if (programString.trim() && !program.begin && !program.end && program.rules.length === 0) {
            // Check if it's a simple action block without a pattern
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
                return fields[0]; // print equivalent to print $0
            }

            // Replace variables like $1, $0, NR, NF with their values
            argsStr = argsStr.replace(/\$([0-9]+)/g, (match, n) => {
                const index = parseInt(n, 10);
                return fields[index] || "";
            });
            argsStr = argsStr.replace(/\$0/g, fields[0]);
            argsStr = argsStr.replace(/NR/g, vars.NR);
            argsStr = argsStr.replace(/NF/g, vars.NF);

            // Handle comma-separated arguments by replacing commas with spaces
            return argsStr.replace(/,/g, ' ');
        }
        return null;
    }


    const awkCommandDefinition = {
        commandName: "awk",
        argValidation: {
            min: 1,
            error: "Usage: awk 'program' [file...]"
        },
        coreLogic: async (context) => {
            const { args, options, currentUser } = context;
            const programString = args[0];
            const filePaths = args.slice(1);

            const program = _parseProgram(programString);
            if (program.error) {
                return { success: false, error: `awk: program error: ${program.error}` };
            }

            let outputLines = [];
            let nr = 0; // Total record number

            // --- BEGIN Block ---
            if (program.begin) {
                const beginResult = _executeAction(program.begin, [], { NR: 0, NF: 0 });
                if (beginResult !== null) {
                    outputLines.push(beginResult);
                }
            }

            // --- Main Processing ---
            const processContent = (content) => {
                const lines = content.split('\n');
                for (const line of lines) {
                    // Don't process the empty string that results from a trailing newline
                    if (line === '' && lines[lines.length -1] === '') continue;

                    nr++;
                    const fields = line.split(/\s+/);
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

            // --- END Block ---
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

EXAMPLES
       ls -l | awk '{print $9}'
              Prints only the 9th column (the filename) from the output of ls -l.

       awk '/success/ {print "Found:", $0}' app.log
              Prints "Found:" followed by the full line for every line containing
              "success" in the file app.log.

       awk 'BEGIN { print "--- Report Start ---" } { print NR, $0 } END { print "--- Report End ---" }' data.txt
              Prints a header, then each line of data.txt prefixed with its line
              number, and finally a footer.`;

    CommandRegistry.register("awk", awkCommandDefinition, awkDescription, awkHelpText);
})();