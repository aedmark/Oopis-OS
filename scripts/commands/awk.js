// scripts/commands/awk.js
(() => {
    "use strict";
    const awkCommandDefinition = {
        commandName: "awk",
        // isInputStream is removed to allow for correct argument parsing.
        flagDefinitions: [
            { name: "fieldSeparator", short: "-F", takesValue: true }
        ],
        coreLogic: async (context) => {
            const {flags, args, options, currentUser } = context;

            if (args.length === 0) {
                return { success: false, error: "awk: missing program" };
            }

            // The first argument is the program, not a file.
            const programString = args[0];
            const program = _parseProgram(programString);
            if (program.error) {
                return { success: false, error: `awk: program error: ${program.error}` };
            }

            // Determine the input source: either from a file argument or piped stdin.
            let inputText;
            if (args.length > 1) {
                const pathValidation = FileSystemManager.validatePath("awk", args[1], { expectedType: 'file' });
                if (pathValidation.error) {
                    return { success: false, error: pathValidation.error };
                }
                if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                    return { success: false, error: `awk: cannot read file: ${args[1]}` };
                }
                inputText = pathValidation.node.content || "";
            } else if (options.stdinContent !== null && options.stdinContent !== undefined) {
                inputText = options.stdinContent;
            } else {
                return { success: false, error: "awk: No input provided. Please specify a file or pipe data." };
            }

            // The rest of the logic remains largely the same, as it correctly processes the inputText.
            const separator = flags.fieldSeparator ? new RegExp(flags.fieldSeparator) : /\s+/;
            let outputLines = [];
            let nr = 0;

            if (program.begin) {
                const beginResult = _executeAction(program.begin, [], { NR: 0, NF: 0 });
                if (beginResult !== null) {
                    outputLines.push(beginResult);
                }
            }

            const lines = inputText.split('\n');
            for (const line of lines) {
                if (line === '' && lines.at(-1) === '') continue;
                nr++;
                const trimmedLine = line.trim();
                let fields = trimmedLine === '' ? [] : trimmedLine.split(separator);
                if (!Array.isArray(fields)) fields = [];
                const allFields = [line, ...fields];
                const vars = {NR: nr, NF: fields.length};

                for (const rule of program.rules) {
                    if (rule.pattern.test(line)) {
                        const actionResult = _executeAction(rule.action, allFields, vars);
                        if (actionResult !== null) outputLines.push(actionResult);
                    }
                }
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

    // The helper functions _parseProgram and _executeAction remain unchanged.
    function _parseProgram(programString) {
        const program = {begin: null, end: null, rules: [], error: null,};
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
                    program.rules.push({pattern: pattern, action: match[6].trim()});
                } catch (e) {
                    program.error = `Invalid regex pattern: ${match[5]}`;
                    return program;
                }
            }
        }
        if (programString.trim() && !program.begin && !program.end && program.rules.length === 0) {
            const simpleActionMatch = programString.trim().match(/^{([^}]*)}$/);
            if (simpleActionMatch) {
                program.rules.push({pattern: /.*/, action: simpleActionMatch[1].trim()});
            } else {
                program.error = `Unrecognized program format: ${programString}`;
            }
        }
        return program;
    }

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