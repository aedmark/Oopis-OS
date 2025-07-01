/**
 * @file Defines the 'ls' command, a core utility for listing directory contents and file information.
 * It supports various flags for detailed output, sorting, and recursive listing.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} lsCommandDefinition
     * @description The command definition for the 'ls' command.
     * This object specifies the command's name, supported flags for formatting and sorting,
     * and the core logic for listing file system entries.
     */
    const lsCommandDefinition = {
        commandName: "ls",
        flagDefinitions: [
            { name: "long", short: "-l", long: "--long" }, // Long listing format.
            { name: "all", short: "-a", long: "--all" }, // Do not ignore entries starting with '.'.
            { name: "recursive", short: "-R", long: "--recursive" }, // List subdirectories recursively.
            { name: "reverseSort", short: "-r", long: "--reverse" }, // Reverse order of sorting.
            { name: "sortByTime", short: "-t" }, // Sort by modification time.
            { name: "sortBySize", short: "-S" }, // Sort by file size.
            { name: "sortByExtension", short: "-X" }, // Sort by file extension.
            { name: "noSort", short: "-U" }, // Do not sort.
            { name: "dirsOnly", short: "-d" }, // List directories themselves, not their contents.
            { name: "oneColumn", short: "-1" }, // The flag that started it all!
            { name: "humanReadable", short: "-h", long: "--human-readable" } // A very useful addition for -l
        ],
        /**
         * The core logic for the 'ls' command.
         * It determines the paths to list (current directory by default or specified arguments).
         * It then retrieves and processes the details of each item, applies sorting based on flags,
         * and formats the output. It supports recursive listing and various display modes.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command (optional paths to list).
         * @param {object} context.flags - An object containing the parsed flags.
         * @param {string} context.currentUser - The name of the current user.
         * @returns {Promise<object>} A promise that resolves to a command result object
         * with the formatted directory/file listing.
         */
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;

            /**
             * Retrieves detailed information for a file system item.
             * @param {string} itemName - The name of the item.
             * @param {object} itemNode - The file system node object.
             * @param {string} itemPath - The full absolute path of the item.
             * @returns {object|null} An object containing item details, or null if node is invalid.
             */
            function getItemDetails(itemName, itemNode, itemPath) {
                if (!itemNode) return null;
                return {
                    name: itemName,
                    path: itemPath,
                    node: itemNode,
                    type: itemNode.type,
                    owner: itemNode.owner || "unknown",
                    group: itemNode.group || "unknown",
                    mode: itemNode.mode,
                    mtime: itemNode.mtime ? new Date(itemNode.mtime) : new Date(0), // Convert ISO string to Date object.
                    size: FileSystemManager.calculateNodeSize(itemNode),
                    extension: Utils.getFileExtension(itemName),
                    linkCount: 1, // Currently fixed at 1 for simplicity.
                };
            }

            /**
             * Formats item details into a long listing string (similar to `ls -l`).
             * @param {object} itemDetails - The detailed item object.
             * @returns {string} The formatted long listing string.
             */
            function formatLongListItem(itemDetails) {
                const perms = FileSystemManager.formatModeToString(itemDetails.node); // Get permission string (e.g., 'drwxr-xr-x').
                const owner = (itemDetails.node.owner || "unknown").padEnd(10);
                const group = (itemDetails.node.group || "unknown").padEnd(10);
                const size = flags.humanReadable
                    ? Utils.formatBytes(itemDetails.size).padStart(8)
                    : String(itemDetails.size).padStart(8);                let dateStr = "            "; // Default empty date string.
                if (itemDetails.mtime && itemDetails.mtime.getTime() !== 0) {
                    const d = itemDetails.mtime;
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    dateStr = `${months[d.getMonth()].padEnd(3)} ${d.getDate().toString().padStart(2, " ")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                }
                // Add a slash suffix for directories unless -d flag is active.
                const nameSuffix = itemDetails.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && !flags.dirsOnly ? Config.FILESYSTEM.PATH_SEPARATOR : "";
                return `${perms}  ${String(itemDetails.linkCount).padStart(2)} ${owner}${group}${size} ${dateStr} ${itemDetails.name}${nameSuffix}`;
            }

            /**
             * Sorts an array of item details based on the provided flags.
             * @param {object[]} items - The array of item details to sort.
             * @param {object} currentFlags - The current flags object to determine sorting criteria.
             * @returns {object[]} The sorted array of items.
             */
            function sortItems(items, currentFlags) {
                let sortedItems = [...items]; // Create a shallow copy to avoid modifying original array.

                if (currentFlags.noSort) {
                    // Do nothing if -U flag (no sort) is present.
                } else if (currentFlags.sortByTime) {
                    // Sort by modification time (newest first), then by name.
                    sortedItems.sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));
                } else if (currentFlags.sortBySize) {
                    // Sort by size (largest first), then by name.
                    sortedItems.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
                } else if (currentFlags.sortByExtension) {
                    // Sort by extension, then by name.
                    sortedItems.sort((a, b) => {
                        const extComp = a.extension.localeCompare(b.extension);
                        if (extComp !== 0) return extComp; // If extensions differ, sort by extension.
                        return a.name.localeCompare(b.name); // Otherwise, sort by name.
                    });
                } else {
                    // Default sort is alphabetical by name.
                    sortedItems.sort((a, b) => a.name.localeCompare(b.name));
                }

                // Apply reverse sort if -r flag is present.
                if (currentFlags.reverseSort) {
                    sortedItems.reverse();
                }
                return sortedItems;
            }

            // Determine paths to list: default to current path if no arguments provided.
            const pathsToList = args.length > 0 ? args : [FileSystemManager.getCurrentPath()];
            let outputBlocks = []; // Accumulates output for all paths/recursive calls.
            let overallSuccess = true; // Tracks overall success of the command.

            /**
             * Lists the contents of a single path, handling files and directories.
             * @async
             * @param {string} targetPathArg - The path argument provided to ls (can be relative).
             * @param {object} effectiveFlags - The flags object relevant to this listing.
             * @returns {Promise<{success: boolean, output?: string, error?: string, items?: object[]}>} The result of the listing.
             */
            async function listSinglePathContents(targetPathArg, effectiveFlags) {
                // Validate the target path.
                const pathValidation = FileSystemManager.validatePath("ls", targetPathArg);
                if (pathValidation.error) return { success: false, error: pathValidation.error };

                const targetNode = pathValidation.node;

                // Check read permission on the target node.
                if (!FileSystemManager.hasPermission(targetNode, currentUser, "read")) {
                    return { success: false, error: `ls: cannot access '${targetPathArg}': Permission denied` };
                }

                let itemDetailsList = [];
                let singleItemResultOutput = null; // Used if listing a single file or directory with -d.

                if (effectiveFlags.dirsOnly && targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    // If -d is used and target is a directory, list the directory itself.
                    const details = getItemDetails(targetPathArg, targetNode, pathValidation.resolvedPath);
                    if (details) singleItemResultOutput = effectiveFlags.long ? formatLongListItem(details) : details.name;
                    else return { success: false, error: `ls: cannot stat '${targetPathArg}': Error retrieving details` };
                } else if (targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    // If target is a directory (and -d is not used), list its children.
                    const childrenNames = Object.keys(targetNode.children);
                    for (const name of childrenNames) {
                        // Skip hidden files/dirs unless -a flag is present.
                        if (!effectiveFlags.all && name.startsWith(".")) continue;
                        const details = getItemDetails(name, targetNode.children[name], FileSystemManager.getAbsolutePath(name, pathValidation.resolvedPath));
                        if (details) itemDetailsList.push(details);
                    }
                    itemDetailsList = sortItems(itemDetailsList, effectiveFlags); // Sort the children.
                } else {
                    // If target is a file, list the file itself.
                    const fileName = pathValidation.resolvedPath.substring(pathValidation.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);
                    const details = getItemDetails(fileName, targetNode, pathValidation.resolvedPath);
                    if (details) singleItemResultOutput = effectiveFlags.long ? formatLongListItem(details) : details.name;
                    else return { success: false, error: `ls: cannot stat '${targetPathArg}': Error retrieving details` };
                }

                let currentPathOutputLines = [];
                if (singleItemResultOutput !== null) {
                    currentPathOutputLines.push(singleItemResultOutput);
                } else if (targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && !effectiveFlags.dirsOnly) {
                    if (effectiveFlags.long) {
                        if (itemDetailsList.length > 0) currentPathOutputLines.push(`total ${itemDetailsList.length}`);
                        itemDetailsList.forEach(item => {
                            currentPathOutputLines.push(formatLongListItem(item));
                        });
                        // --- MODIFICATION FOR -1 ---
                    } else if (effectiveFlags.oneColumn) {
                        itemDetailsList.forEach(item => {
                            const nameSuffix = item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? Config.FILESYSTEM.PATH_SEPARATOR : "";
                            currentPathOutputLines.push(`${item.name}${nameSuffix}`);
                        });
                        // --- END MODIFICATION ---
                    } else {
                        // This part needs adjustment to format into columns, for now, we'll do a simple space-separated list.
                        // A true multi-column format is a significant UI challenge.
                        const simpleList = itemDetailsList.map(item => {
                            const nameSuffix = item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? Config.FILESYSTEM.PATH_SEPARATOR : "";
                            return `${item.name}${nameSuffix}`;
                        }).join("  ");
                        currentPathOutputLines.push(simpleList);
                    }
                }
                return { success: true, output: currentPathOutputLines.join("\n"), items: itemDetailsList };
            }

            /**
             * Recursively displays directory contents for the -R flag.
             * @async
             * @param {string} currentPath - The current absolute path being processed recursively.
             * @param {object} displayFlags - The flags object for this recursive call.
             * @param {number} depth - The current recursion depth.
             * @returns {Promise<{outputs: string[], encounteredError: boolean}>} Object with collected output lines and error status.
             */
            async function displayRecursive(currentPath, displayFlags, depth = 0) {
                let blockOutputs = [];
                let encounteredErrorInThisBranch = false;

                // Add path header for recursive listing or multiple paths.
                if (depth > 0 || pathsToList.length > 1) blockOutputs.push(`${currentPath}:`);

                const listResult = await listSinglePathContents(currentPath, displayFlags);
                if (!listResult.success) {
                    blockOutputs.push(listResult.error); // Use .error property
                    encounteredErrorInThisBranch = true;
                    return { outputs: blockOutputs, encounteredError: encounteredErrorInThisBranch };
                }
                if (listResult.output) blockOutputs.push(listResult.output);

                // If it's a directory and not in -d mode, recurse into subdirectories.
                if (listResult.items && FileSystemManager.getNodeByPath(currentPath)?.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    const subdirectories = listResult.items.filter(item => item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && item.name !== "." && item.name !== "..");
                    for (const dirItem of subdirectories) {
                        if (blockOutputs.length > 0) blockOutputs.push(""); // Add a blank line between blocks.
                        const subDirResult = await displayRecursive(dirItem.path, displayFlags, depth + 1);
                        blockOutputs = blockOutputs.concat(subDirResult.outputs);
                        if (subDirResult.encounteredError) encounteredErrorInThisBranch = true;
                    }
                }
                return { outputs: blockOutputs, encounteredError: encounteredErrorInThisBranch };
            }

            // Main logic branch: Handle recursive or non-recursive listing.
            if (flags.recursive) {
                for (let i = 0; i < pathsToList.length; i++) {
                    const path = pathsToList[i];
                    const recursiveResult = await displayRecursive(path, flags);
                    outputBlocks = outputBlocks.concat(recursiveResult.outputs);
                    if (recursiveResult.encounteredError) overallSuccess = false;
                    if (i < pathsToList.length - 1) outputBlocks.push(""); // Blank line between top-level recursive outputs.
                }
            } else {
                for (let i = 0; i < pathsToList.length; i++) {
                    const path = pathsToList[i];
                    if (pathsToList.length > 1) {
                        if (i > 0) outputBlocks.push("");
                        outputBlocks.push(`${path}:`); // Add header for multiple non-recursive paths.
                    }
                    const listResult = await listSinglePathContents(path, flags);
                    if (!listResult.success) {
                        overallSuccess = false;
                        if (listResult.error) outputBlocks.push(listResult.error); // Use .error property
                    } else {
                        if (listResult.output) outputBlocks.push(listResult.output);
                    }
                }
            }

            // Return success or failure with the appropriate message property.
            if (overallSuccess) {
                return { success: true, output: outputBlocks.join("\n") };
            } else {
                return { success: false, error: outputBlocks.join("\n") };
            }
        },
    };

    const lsDescription = "Lists directory contents and file information.";

    const lsHelpText = `Usage: ls [OPTION]... [FILE]...

List information about the FILEs (the current directory by default).
Sort entries alphabetically if none of -tSUXU is specified.

DESCRIPTION
       The ls command lists files and directories. By default, it lists
       the contents of the current directory. If one or more files or
       directories are given, it lists information about them.

OPTIONS
       -a, --all
              Do not ignore entries starting with .
       -d, --dirs-only
              List directories themselves, not their contents.
       -l, --long
              Use a long listing format, showing permissions, owner,
              size, and modification time.
       -R, --recursive
              List subdirectories recursively.
       -r, --reverse
              Reverse order while sorting.
       -S
              Sort by file size, largest first.
       -t
              Sort by modification time, newest first.
       -X
              Sort alphabetically by entry extension.
       -U
              Do not sort; list entries in directory order.
       -1
              List one file per line.
       -h, --human-readable
              With -l, print sizes in human-readable format (e.g., 1K 234M 2G).`;


    CommandRegistry.register("ls", lsCommandDefinition, lsDescription, lsHelpText);
})();