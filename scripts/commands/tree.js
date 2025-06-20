/**
 * @file Defines the 'tree' command, which lists directory contents in a tree-like format.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} treeCommandDefinition
     * @description The command definition for the 'tree' command.
     * This object specifies the command's name, supported flags,
     * argument validation, and the core logic for generating a tree view of the file system.
     */
    const treeCommandDefinition = {
        commandName: "tree",
        flagDefinitions: [
            {
                name: "level",
                short: "-L",
                long: "--level",
                takesValue: true,
            },
            {
                name: "dirsOnly",
                short: "-d",
                long: "--dirs-only",
            },
        ],
        argValidation: {
            max: 1, // Accepts at most one argument (the starting path).
        },
        /**
         * The core logic for the 'tree' command.
         * It takes an optional path argument (defaulting to current directory) and flags
         * for controlling depth (-L) and showing only directories (-d).
         * It recursively traverses the file system, building a formatted string
         * that visually represents the directory hierarchy, including file and directory counts.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (optional starting path).
         * @param {object} context.flags - An object containing the parsed flags.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the formatted tree output or an error if the path is invalid or permissions are denied.
         */
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;
            const pathArg = args.length > 0 ? args[0] : "."; // Default to current directory if no path is given.

            // Parse and validate the 'level' flag.
            const maxDepth = flags.level
                ? Utils.parseNumericArg(flags.level, {
                    min: 0, // Minimum level is 0.
                })
                : {
                    value: Infinity, // Default to infinite depth if no level specified.
                };
            if (flags.level && (maxDepth.error || maxDepth.value === null))
                return {
                    success: false,
                    error: `tree: invalid level value for -L: '${flags.level}' ${
                        maxDepth.error || ""
                    }`,
                };

            // Validate the starting path, ensuring it's a directory.
            const pathValidation = FileSystemManager.validatePath("tree", pathArg, {
                expectedType: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
            });
            if (pathValidation.error)
                return {
                    success: false,
                    error: pathValidation.error,
                };

            // Check read permission on the starting directory.
            if (
                !FileSystemManager.hasPermission(
                    pathValidation.node,
                    currentUser,
                    "read"
                )
            )
                return {
                    success: false,
                    error: `tree: '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                };

            const outputLines = [pathValidation.resolvedPath]; // Start output with the resolved base path.
            let dirCount = 0;
            let fileCount = 0;

            /**
             * Recursively builds the tree structure for display.
             * @param {string} currentDirPath - The absolute path of the directory currently being processed.
             * @param {number} currentDepth - The current recursion depth (starts at 1 for the initial path).
             * @param {string} indentPrefix - The prefix string for indentation (e.g., "│   ").
             */
            function buildTreeRecursive(currentDirPath, currentDepth, indentPrefix) {
                if (currentDepth > maxDepth.value) return; // Stop if max depth is exceeded.

                const node = FileSystemManager.getNodeByPath(currentDirPath);
                if (!node || node.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE)
                    return; // Skip if node is not found or not a directory.

                // For subdirectories (depth > 1), check read permission again.
                if (
                    currentDepth > 1 &&
                    !FileSystemManager.hasPermission(node, currentUser, "read")
                ) {
                    outputLines.push(indentPrefix + "└── [Permission Denied]");
                    return;
                }

                // Get and sort children names alphabetically.
                const childrenNames = Object.keys(node.children).sort();

                childrenNames.forEach((childName, index) => {
                    const childNode = node.children[childName];
                    // Construct the appropriate branch prefix (├── or └──).
                    const branchPrefix = index === childrenNames.length - 1 ? "└── " : "├── ";

                    if (childNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                        dirCount++; // Increment directory count.
                        outputLines.push(
                            indentPrefix +
                            branchPrefix +
                            childName +
                            Config.FILESYSTEM.PATH_SEPARATOR // Add trailing slash for directories.
                        );
                        // Recursively call for subdirectories if within max depth.
                        if (currentDepth < maxDepth.value)
                            buildTreeRecursive(
                                FileSystemManager.getAbsolutePath(childName, currentDirPath),
                                currentDepth + 1,
                                indentPrefix +
                                (index === childrenNames.length - 1 ? "    " : "│   ") // Extend indent.
                            );
                    } else if (!flags.dirsOnly) {
                        // If not in 'dirsOnly' mode, display files.
                        fileCount++; // Increment file count.
                        outputLines.push(
                            indentPrefix +
                            branchPrefix +
                            childName
                        );
                    }
                });
            }
            // Start the recursive tree building from the resolved path at depth 1.
            buildTreeRecursive(pathValidation.resolvedPath, 1, "");

            outputLines.push(""); // Add an empty line before the summary report.
            let report = `${dirCount} director${dirCount === 1 ? "y" : "ies"}`;
            if (!flags.dirsOnly)
                report += `, ${fileCount} file${fileCount === 1 ? "" : "s"}`;
            outputLines.push(report); // Add the final count report.

            return {
                success: true,
                output: outputLines.join("\n"), // Join all collected lines with newlines.
            };
        },
    };

    /**
     * @const {string} treeDescription
     * @description A brief, one-line description of the 'tree' command for the 'help' command.
     */
    const treeDescription = "Lists directory contents in a tree-like format.";

    /**
     * @const {string} treeHelpText
     * @description The detailed help text for the 'tree' command, used by 'man'.
     */
    const treeHelpText = `Usage: tree [OPTION]... [PATH]

List the contents of directories in a tree-like format.

DESCRIPTION
       The tree command recursively lists the contents of the given
       directory PATH, or the current directory if none is specified,
       in a visually structured tree.

OPTIONS
       -L <level>
              Descend only <level> directories deep.
       -d
              List directories only.

EXAMPLES
       tree
              Displays the entire directory tree starting from the
              current location.

       tree -L 2 /home
              Displays the first two levels of the /home directory.
              
       tree -d
              Displays only the subdirectories, not the files.`;

    // Register the command with the system
    CommandRegistry.register("tree", treeCommandDefinition, treeDescription, treeHelpText);
})();