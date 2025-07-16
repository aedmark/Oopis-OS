// scripts/commands/find.js
(() => {
    "use strict";

    const findCommandDefinition = {
        commandName: "find",
        completionType: "paths", // Preserved for tab completion
        argValidation: {
            min: 1,
            error: "missing path specification",
        },

        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const startPathArg = args[0];
            const expressionArgs = args.slice(1);
            let outputLines = [];
            let overallSuccess = true;
            let filesProcessedSuccessfully = true;
            let anyChangeMadeDuringFind = false;

            try {
                const predicates = {
                    "-name": (node, path, pattern) => {
                        const regex = Utils.globToRegex(pattern);
                        if (!regex) {
                            outputLines.push(`find: invalid pattern for -name: ${pattern}`);
                            overallSuccess = false;
                            return false;
                        }
                        return regex.test(path.substring(path.lastIndexOf('/') + 1));
                    },
                    "-type": (node, path, typeChar) => {
                        if (typeChar === "f") return node.type === 'file';
                        if (typeChar === "d") return node.type === 'directory';
                        outputLines.push(`find: unknown type '${typeChar}' for -type`);
                        overallSuccess = false;
                        return false;
                    },
                    "-user": (node, path, username) => node.owner === username,
                    "-perm": (node, path, modeStr) => {
                        if (!/^[0-7]{3,4}$/.test(modeStr)) {
                            outputLines.push(`find: invalid mode '${modeStr}' for -perm`);
                            overallSuccess = false;
                            return false;
                        }
                        return node.mode === parseInt(modeStr, 8);
                    },
                    "-mtime": (node, path, mtimeSpec) => {
                        if (!node.mtime) return false;
                        const ageInMs = new Date().getTime() - new Date(node.mtime).getTime();
                        const days = ageInMs / (24 * 60 * 60 * 1000);
                        let n;
                        if (mtimeSpec.startsWith("+")) {
                            n = parseInt(mtimeSpec.substring(1), 10);
                            return !isNaN(n) && days > n;
                        } else if (mtimeSpec.startsWith("-")) {
                            n = parseInt(mtimeSpec.substring(1), 10);
                            return !isNaN(n) && days < n;
                        } else {
                            n = parseInt(mtimeSpec, 10);
                            return !isNaN(n) && Math.floor(days) === n;
                        }
                    },
                };

                const actions = {
                    "-print": async (node, path) => {
                        outputLines.push(path);
                        return true;
                    },
                    "-exec": async (node, path, commandParts) => {
                        const cmdStr = commandParts.map((part) => (part === "{}" ? `"${path}"` : part)).join(" ");
                        const result = await CommandExecutor.processSingleCommand(cmdStr, { isInteractive: false });
                        if (!result.success) {
                            outputLines.push(`find: -exec: command '${cmdStr}' failed: ${result.error}`);
                            filesProcessedSuccessfully = false;
                            return false;
                        }
                        return true;
                    },
                    "-delete": async (node, path) => {
                        const result = await FileSystemManager.deleteNodeRecursive(path, { force: true, currentUser });
                        if (!result.success) {
                            outputLines.push(`find: -delete: ${result.messages.join(";") || `failed to delete '${path}'`}`);
                            filesProcessedSuccessfully = false;
                            return false;
                        }
                        if (result.anyChangeMade) anyChangeMadeDuringFind = true;
                        return true;
                    },
                };

                let parsedExpression = [];
                let currentTermGroup = [];
                let nextTermNegated = false;
                let hasExplicitAction = false;
                let i = 0;
                while (i < expressionArgs.length) {
                    const token = expressionArgs[i];
                    if (token === "-not" || token === "!") {
                        nextTermNegated = true;
                        i++;
                        continue;
                    }
                    if (token === "-or" || token === "-o") {
                        if (currentTermGroup.length > 0)
                            parsedExpression.push({ type: "AND_GROUP", terms: currentTermGroup });
                        currentTermGroup = [];
                        parsedExpression.push({ type: "OR" });
                        i++;
                        continue;
                    }

                    let term = { name: token, negated: nextTermNegated };
                    nextTermNegated = false;

                    if (predicates[token]) {
                        term.type = "TEST";
                        term.eval = predicates[token];
                        if (i + 1 < expressionArgs.length) {
                            term.arg = expressionArgs[++i];
                        } else {
                            return { success: false, error: `find: missing argument to \`${token}\`` };
                        }
                    } else if (actions[token]) {
                        term.type = "ACTION";
                        term.perform = actions[token];
                        hasExplicitAction = true;
                        if (token === "-exec") {
                            term.commandParts = [];
                            i++;
                            while (i < expressionArgs.length && expressionArgs[i] !== ";")
                                term.commandParts.push(expressionArgs[i++]);
                            if (i >= expressionArgs.length || expressionArgs[i] !== ";")
                                return { success: false, error: "find: missing terminating ';' for -exec" };
                        }
                    } else {
                        return { success: false, error: `find: unknown predicate '${token}'` };
                    }
                    currentTermGroup.push(term);
                    i++;
                }
                if (currentTermGroup.length > 0)
                    parsedExpression.push({ type: "AND_GROUP", terms: currentTermGroup });

                if (!hasExplicitAction) {
                    if (parsedExpression.length === 0 || parsedExpression[parsedExpression.length - 1].type === "OR")
                        parsedExpression.push({ type: "AND_GROUP", terms: [] });
                    parsedExpression[parsedExpression.length - 1].terms.push({ type: "ACTION", name: "-print", perform: actions["-print"], negated: false });
                }

                async function evaluateExpressionForNode(node, path) {
                    let overallResult = false;
                    let currentAndGroupResult = true;

                    for (const groupOrOperator of parsedExpression) {
                        if (groupOrOperator.type === "AND_GROUP") {
                            currentAndGroupResult = true;
                            for (const term of groupOrOperator.terms.filter((t) => t.type === "TEST")) {
                                const result = await term.eval(node, path, term.arg);
                                const effectiveResult = term.negated ? !result : result;
                                if (!effectiveResult) {
                                    currentAndGroupResult = false;
                                    break;
                                }
                            }
                        } else if (groupOrOperator.type === "OR") {
                            overallResult = overallResult || currentAndGroupResult;
                            currentAndGroupResult = true;
                        }
                    }
                    overallResult = overallResult || currentAndGroupResult;
                    return overallResult;
                }

                async function recurseFind(currentResolvedPath, isDepthFirst) {
                    const node = FileSystemManager.getNodeByPath(currentResolvedPath);
                    if (!node) {
                        outputLines.push(`find: ‘${currentResolvedPath}’: No such file or directory`);
                        filesProcessedSuccessfully = false;
                        return;
                    }
                    if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
                        outputLines.push(`find: ‘${currentResolvedPath}’: Permission denied`);
                        filesProcessedSuccessfully = false;
                        return;
                    }

                    const processNode = async () => {
                        if (await evaluateExpressionForNode(node, currentResolvedPath)) {
                            for (const groupOrOperator of parsedExpression) {
                                if (groupOrOperator.type === "AND_GROUP") {
                                    for (const term of groupOrOperator.terms.filter((t) => t.type === "ACTION"))
                                        await term.perform(node, currentResolvedPath, term.commandParts);
                                }
                            }
                        }
                    };

                    if (!isDepthFirst) await processNode();

                    if (node.type === 'directory') {
                        for (const childName of Object.keys(node.children || {})) {
                            await recurseFind(FileSystemManager.getAbsolutePath(childName, currentResolvedPath), isDepthFirst);
                        }
                    }

                    if (isDepthFirst) await processNode();
                }

                const startPathResolved = FileSystemManager.getAbsolutePath(startPathArg);
                const startNode = FileSystemManager.getNodeByPath(startPathResolved);

                if (!startNode) {
                    return { success: false, error: `find: '${startPathArg}': No such file or directory` };
                }

                const impliesDepth = parsedExpression.some((g) => g.type === "AND_GROUP" && g.terms.some((t) => t.name === "-delete"));
                await recurseFind(startPathResolved, impliesDepth);

                if (anyChangeMadeDuringFind) await FileSystemManager.save();

                return {
                    success: overallSuccess && filesProcessedSuccessfully,
                    output: outputLines.join("\n"),
                };
            } catch (e) {
                return { success: false, error: `find: An unexpected error occurred: ${e.message}` };
            }
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