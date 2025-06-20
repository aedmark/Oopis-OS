/**
 * @file Defines the 'find' command, a powerful utility for searching files in a directory hierarchy.
 * It supports various criteria (predicates) and allows performing actions on found files.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} findCommandDefinition
     * @description The command definition for the 'find' command.
     * This object specifies the command's name, argument validation, and the complex
     * core logic that parses expressions with predicates, operators, and actions.
     */
    const findCommandDefinition = {
        commandName: "find",
        argValidation: {
            min: 1,
            error: "missing path specification",
        },
        /**
         * The core logic for the 'find' command.
         * It parses the starting path and a sequence of expression arguments (predicates and actions).
         * It then recursively traverses the file system, evaluates the expression for each node,
         * and performs specified actions on matching nodes.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, starting with the path and followed by the expression.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object with the search output.
         */
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const startPathArg = args[0]; // The first argument is the starting path.
            const expressionArgs = args.slice(1); // Remaining arguments form the expression.
            let outputLines = []; // Array to collect lines of output.
            let overallSuccess = true; // Tracks if all parts of find command execution were successful.
            let filesProcessedSuccessfully = true; // Tracks success of actions like -exec, -delete.
            let anyChangeMadeDuringFind = false; // Flag to indicate if FileSystemManager.save() is needed.

            /**
             * @const {object} predicates
             * @description A dictionary of functions, where each key is a predicate name (e.g., '-name')
             * and the value is an asynchronous function that evaluates a node against the predicate's criteria.
             * Each predicate function returns a boolean indicating a match.
             */
            const predicates = {
                "-name": (node, path, pattern) => {
                    const regex = Utils.globToRegex(pattern); // Convert glob pattern to regex.
                    if (!regex) {
                        // Report error if glob conversion fails.
                        OutputManager.appendToOutput(
                            `find: invalid pattern for -name: ${pattern}`,
                            {
                                typeClass: Config.CSS_CLASSES.ERROR_MSG,
                            }
                        );
                        overallSuccess = false;
                        return false;
                    }
                    // Test regex against the item's name (last part of the path).
                    return regex.test(
                        path.substring(
                            path.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
                        )
                    );
                },
                "-type": (node, path, typeChar) => {
                    // 'f' for file, 'd' for directory.
                    if (typeChar === "f")
                        return node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE;
                    if (typeChar === "d")
                        return node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;
                    // Report error for unknown type characters.
                    OutputManager.appendToOutput(
                        `find: unknown type '${typeChar}' for -type`,
                        {
                            typeClass: Config.CSS_CLASSES.ERROR_MSG,
                        }
                    );
                    overallSuccess = false;
                    return false;
                },
                "-user": (node, path, username) => node.owner === username,
                "-perm": (node, path, modeStr) => {
                    // Validate octal mode string.
                    if (!/^[0-7]{3,4}$/.test(modeStr)) {
                        OutputManager.appendToOutput(
                            `find: invalid mode '${modeStr}' for -perm`,
                            {
                                typeClass: Config.CSS_CLASSES.ERROR_MSG,
                            }
                        );
                        overallSuccess = false;
                        return false;
                    }
                    // Compare node's mode with parsed octal mode.
                    return node.mode === parseInt(modeStr, 8);
                },
                "-mtime": (node, path, mtimeSpec) => {
                    if (!node.mtime) return false;
                    const ageInMs = new Date().getTime() - new Date(node.mtime).getTime();
                    const days = ageInMs / (24 * 60 * 60 * 1000); // Convert milliseconds to days.
                    let n;
                    if (mtimeSpec.startsWith("+")) { // More than n days old.
                        n = parseInt(mtimeSpec.substring(1), 10);
                        return !isNaN(n) && days > n;
                    } else if (mtimeSpec.startsWith("-")) { // Less than n days old.
                        n = parseInt(mtimeSpec.substring(1), 10);
                        return !isNaN(n) && days < n;
                    } else { // Exactly n days old (rounded down).
                        n = parseInt(mtimeSpec, 10);
                        return !isNaN(n) && Math.floor(days) === n;
                    }
                },
                "-newermt": (node, path, dateStr) => {
                    if (!node.mtime) return false;
                    const targetDate = TimestampParser.parseDateString(dateStr); // Parse date string into a Date object.
                    if (!targetDate) {
                        OutputManager.appendToOutput(
                            `find: invalid date string for -newermt: ${dateStr}`,
                            { typeClass: Config.CSS_CLASSES.ERROR_MSG }
                        );
                        overallSuccess = false;
                        return false;
                    }
                    return new Date(node.mtime) > targetDate; // Node modified more recently than targetDate.
                },
                "-oldermt": (node, path, dateStr) => {
                    if (!node.mtime) return false;
                    const targetDate = TimestampParser.parseDateString(dateStr);
                    if (!targetDate) {
                        OutputManager.appendToOutput(
                            `find: invalid date string for -oldermt: ${dateStr}`,
                            { typeClass: Config.CSS_CLASSES.ERROR_MSG }
                        );
                        overallSuccess = false;
                        return false;
                    }
                    return new Date(node.mtime) < targetDate; // Node modified older than targetDate.
                },
            };

            /**
             * @const {object} actions
             * @description A dictionary of functions, where each key is an action name (e.g., '-print')
             * and the value is an asynchronous function that performs an operation on a matching node.
             * Each action function returns a boolean indicating its success.
             */
            const actions = {
                "-print": async (node, path) => {
                    outputLines.push(path); // Add path to output.
                    return true;
                },
                "-exec": async (node, path, commandParts) => {
                    // Replace '{}' in command parts with the actual file path.
                    const cmdStr = commandParts
                        .map((part) => (part === "{}" ? path : part))
                        .join(" ");
                    // Process the command.
                    const result = await CommandExecutor.processSingleCommand(
                        cmdStr,
                        false // Non-interactive execution for -exec.
                    );
                    if (!result.success) {
                        // Report failure of the executed command.
                        await OutputManager.appendToOutput(
                            `find: -exec: command '${cmdStr}' failed: ${result.error}`,
                            {
                                typeClass: Config.CSS_CLASSES.WARNING_MSG,
                            }
                        );
                        filesProcessedSuccessfully = false;
                        return false;
                    }
                    return true;
                },
                "-delete": async (node, path) => {
                    // Recursively delete the node. Force is true as confirmed by find logic.
                    const result = await FileSystemManager.deleteNodeRecursive(path, {
                        force: true, // Internal call is always forced after confirmation/decision by find.
                        currentUser,
                    });
                    if (!result.success) {
                        // Report failure of deletion.
                        await OutputManager.appendToOutput(
                            `find: -delete: ${
                                result.messages.join(";") ||
                                `
								failed to delete '${path}'
								`
                            }`,
                            {
                                typeClass: Config.CSS_CLASSES.WARNING_MSG,
                            }
                        );
                        filesProcessedSuccessfully = false;
                        return false;
                    }
                    if (result.anyChangeMade) anyChangeMadeDuringFind = true; // Flag for saving FS changes.
                    return true;
                },
            };

            // Parse the expression arguments into a structured format.
            let parsedExpression = [];
            let currentTermGroup = []; // Terms within an implicit 'AND' group.
            let nextTermNegated = false; // Flag for '!' or '-not'.
            let hasExplicitAction = false; // Flag to determine if default '-print' is needed.
            let i = 0;
            while (i < expressionArgs.length) {
                const token = expressionArgs[i];
                if (token === "-not" || token === "!") {
                    nextTermNegated = true;
                    i++;
                    continue;
                }
                if (token === "-or" || token === "-o") {
                    // If an 'OR' is encountered, push the current 'AND' group and reset.
                    if (currentTermGroup.length > 0)
                        parsedExpression.push({
                            type: "AND_GROUP",
                            terms: currentTermGroup,
                        });
                    currentTermGroup = [];
                    parsedExpression.push({
                        type: "OR",
                    });
                    i++;
                    continue;
                }

                let term = {
                    name: token,
                    negated: nextTermNegated,
                };
                nextTermNegated = false; // Reset negation for the next term.

                if (predicates[token]) {
                    term.type = "TEST";
                    term.eval = predicates[token]; // Assign the predicate evaluation function.
                    if (i + 1 < expressionArgs.length) {
                        term.arg = expressionArgs[++i]; // Consume the predicate's argument.
                    } else {
                        return {
                            success: false,
                            error: `find: missing argument to \`${token}\``,
                        };
                    }
                } else if (actions[token]) {
                    term.type = "ACTION";
                    term.perform = actions[token]; // Assign the action function.
                    hasExplicitAction = true;
                    if (token === "-exec") {
                        term.commandParts = [];
                        i++; // Move past '-exec'.
                        // Collect all parts of the command until a ';' is found.
                        while (i < expressionArgs.length && expressionArgs[i] !== ";")
                            term.commandParts.push(expressionArgs[i++]);
                        if (i >= expressionArgs.length || expressionArgs[i] !== ";")
                            return {
                                success: false,
                                error: "find: missing terminating ';' for -exec",
                            };
                    }
                } else {
                    return {
                        success: false,
                        error: `find: unknown predicate '${token}'`,
                    };
                }
                currentTermGroup.push(term); // Add the parsed term to the current 'AND' group.
                i++;
            }
            // After loop, push any remaining terms.
            if (currentTermGroup.length > 0)
                parsedExpression.push({
                    type: "AND_GROUP",
                    terms: currentTermGroup,
                });

            // If no explicit action was specified, add the default '-print' action.
            if (!hasExplicitAction) {
                // Ensure there's an AND_GROUP to add -print to.
                if (
                    parsedExpression.length === 0 ||
                    parsedExpression[parsedExpression.length - 1].type === "OR"
                )
                    parsedExpression.push({
                        type: "AND_GROUP",
                        terms: [],
                    });
                parsedExpression[parsedExpression.length - 1].terms.push({
                    type: "ACTION",
                    name: "-print",
                    perform: actions["-print"],
                    negated: false,
                });
            }

            /**
             * Evaluates the parsed expression for a given file system node.
             * This function applies the logical 'AND' and 'OR' operators to the predicates.
             * @param {object} node - The file system node to evaluate.
             * @param {string} path - The absolute path of the node.
             * @returns {Promise<boolean>} A promise that resolves to true if the expression matches, false otherwise.
             */
            async function evaluateExpressionForNode(node, path) {
                let overallResult = false;
                let currentAndGroupResult = true;

                // Iterate through the parsed expression (groups and operators).
                for (const groupOrOperator of parsedExpression) {
                    if (groupOrOperator.type === "AND_GROUP") {
                        currentAndGroupResult = true; // Reset result for new AND group.
                        for (const term of groupOrOperator.terms.filter(
                            (t) => t.type === "TEST"
                        )) {
                            // Evaluate each test predicate within the AND group.
                            const result = await term.eval(node, path, term.arg);
                            const effectiveResult = term.negated ? !result : result; // Apply negation.
                            if (!effectiveResult) {
                                currentAndGroupResult = false; // If any test fails, the AND group fails.
                                break;
                            }
                        }
                    } else if (groupOrOperator.type === "OR") {
                        overallResult = overallResult || currentAndGroupResult; // Apply 'OR' logic.
                        currentAndGroupResult = true; // Reset for next AND group.
                    }
                }

                overallResult = overallResult || currentAndGroupResult; // Apply final 'OR' with the last group.
                return overallResult;
            }

            /**
             * Recursively traverses the file system starting from a given path,
             * evaluating expressions and performing actions on matching nodes.
             * It handles permission checks during traversal.
             * @param {string} currentResolvedPath - The absolute path of the current node being processed.
             * @param {boolean} isDepthFirst - True if actions should be performed after visiting children (e.g., for -delete).
             * @returns {Promise<void>}
             */
            async function recurseFind(currentResolvedPath, isDepthFirst) {
                const node = FileSystemManager.getNodeByPath(currentResolvedPath);
                if (!node) {
                    // Report error if node is not found (e.g., removed by another -delete action).
                    await OutputManager.appendToOutput(
                        `find: ‘${currentResolvedPath}’: No such file or directory`,
                        {
                            typeClass: Config.CSS_CLASSES.ERROR_MSG,
                        }
                    );
                    filesProcessedSuccessfully = false;
                    return;
                }
                // Check read permission on the node itself.
                if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
                    await OutputManager.appendToOutput(
                        `find: ‘${currentResolvedPath}’: Permission denied`,
                        {
                            typeClass: Config.CSS_CLASSES.ERROR_MSG,
                        }
                    );
                    filesProcessedSuccessfully = false;
                    return;
                }

                // Helper function to process the current node's actions if it matches.
                const processNode = async () => {
                    if (await evaluateExpressionForNode(node, currentResolvedPath)) {
                        // If the expression evaluates to true, perform associated actions.
                        for (const groupOrOperator of parsedExpression) {
                            if (groupOrOperator.type === "AND_GROUP") {
                                for (const term of groupOrOperator.terms.filter(
                                    (t) => t.type === "ACTION"
                                ))
                                    await term.perform(
                                        node,
                                        currentResolvedPath,
                                        term.commandParts
                                    );
                            }
                        }
                    }
                };

                // Perform action based on traversal order (breadth-first or depth-first).
                if (!isDepthFirst) await processNode(); // Process node before children for breadth-first.

                // Recurse into subdirectories if it's a directory.
                if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    // Iterate over a copy of keys to avoid issues if children are deleted during iteration.
                    for (const childName of Object.keys(node.children || {})) {
                        await recurseFind(
                            FileSystemManager.getAbsolutePath(childName, currentResolvedPath),
                            isDepthFirst
                        );
                    }
                }

                if (isDepthFirst) await processNode(); // Process node after children for depth-first.
            }

            // Validate the starting path.
            const startPathValidation = FileSystemManager.validatePath(
                "find",
                startPathArg
            );
            if (startPathValidation.error)
                return {
                    success: false,
                    error: startPathValidation.error,
                };

            // Determine if a depth-first traversal is implied (e.g., by -delete action).
            const impliesDepth = parsedExpression.some(
                (g) =>
                    g.type === "AND_GROUP" && g.terms.some((t) => t.name === "-delete")
            );

            // Start the recursive search.
            await recurseFind(startPathValidation.resolvedPath, impliesDepth);

            // Save file system changes if any deletion or -exec command modified the FS.
            if (anyChangeMadeDuringFind) await FileSystemManager.save();

            // Return the final result.
            return {
                success: overallSuccess && filesProcessedSuccessfully,
                output: outputLines.join("\n"),
            };
        },
    };
    const findDescription = "Searches for files in a directory hierarchy.";
    const findHelpText = `Usage: find [path...] [expression]

Search for files in a directory hierarchy based on a set of criteria.

Expressions are made up of tests and actions:
  -name <pattern>     File name matches shell pattern (e.g., "*.txt").
  -type <f|d>         File is of type f (file) or d (directory).
  -user <name>        File is owned by user <name>.
  -perm <mode>        File's permission bits are exactly <mode> (octal).
  -mtime <n>          File's data was last modified n*24 hours ago.
  -newermt <date>     File's data was last modified more recently than <date>.
  -delete             Deletes found files. Use with caution.
  -exec <cmd> {} ;    Executes <cmd> on found files. {} is replaced by the file path.
  ! or -not           Inverts the sense of the next test.`;

    CommandRegistry.register("find", findCommandDefinition, findDescription, findHelpText);
})();