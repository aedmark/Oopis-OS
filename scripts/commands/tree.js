// scripts/commands/tree.js
(() => {
    "use strict";

    const treeCommandDefinition = {
        commandName: "tree",
        completionType: "paths", // Preserved for tab completion
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
            max: 1,
        },
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;

            try {
                const pathArg = args.length > 0 ? args[0] : ".";

                const maxDepth = flags.level
                    ? Utils.parseNumericArg(flags.level, { min: 0 })
                    : { value: Infinity };

                if (flags.level && (maxDepth.error || maxDepth.value === null))
                    return {
                        success: false,
                        error: `tree: invalid level value for -L: '${flags.level}' ${maxDepth.error || ""}`,
                    };

                const pathValidation = FileSystemManager.validatePath(pathArg, { permissions: ['read'] });

                if(pathValidation.error) {
                    return { success: false, error: `tree: ${pathValidation.error}` };
                }

                if (pathValidation.node.type !== 'directory') {
                    return { success: false, error: `tree: '${pathArg}' is not a directory` };
                }

                const outputLines = [pathValidation.resolvedPath];
                let dirCount = 0;
                let fileCount = 0;

                function buildTreeRecursive(currentDirPath, currentDepth, indentPrefix) {
                    if (currentDepth > maxDepth.value) return;

                    const node = FileSystemManager.getNodeByPath(currentDirPath);
                    if (!node || node.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) return;

                    if (currentDepth > 1 && !FileSystemManager.hasPermission(node, currentUser, "read")) {
                        outputLines.push(indentPrefix + "└── [Permission Denied]");
                        return;
                    }

                    const childrenNames = Object.keys(node.children).sort();

                    childrenNames.forEach((childName, index) => {
                        const childNode = node.children[childName];
                        const branchPrefix = index === childrenNames.length - 1 ? "└── " : "├── ";

                        if (childNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                            dirCount++;
                            outputLines.push(indentPrefix + branchPrefix + childName + Config.FILESYSTEM.PATH_SEPARATOR);
                            if (currentDepth < maxDepth.value)
                                buildTreeRecursive(
                                    FileSystemManager.getAbsolutePath(childName, currentDirPath),
                                    currentDepth + 1,
                                    indentPrefix + (index === childrenNames.length - 1 ? "    " : "│   ")
                                );
                        } else if (!flags.dirsOnly) {
                            fileCount++;
                            outputLines.push(indentPrefix + branchPrefix + childName);
                        }
                    });
                }
                buildTreeRecursive(pathValidation.resolvedPath, 1, "");

                outputLines.push("");
                let report = `${dirCount} director${dirCount === 1 ? "y" : "ies"}`;
                if (!flags.dirsOnly)
                    report += `, ${fileCount} file${fileCount === 1 ? "" : "s"}`;
                outputLines.push(report);

                return {
                    success: true,
                    output: outputLines.join("\\n"),
                };
            } catch (e) {
                return { success: false, error: `tree: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const treeDescription = "Lists directory contents in a tree-like format.";
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

    CommandRegistry.register("tree", treeCommandDefinition, treeDescription, treeHelpText);
})();