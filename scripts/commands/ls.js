/**
 * @file Defines the 'ls' command, a core utility for listing directory contents and file information.
 * It supports various flags for detailed output, sorting, and recursive listing.
 * @author Andrew Edmark
 * @author Gemini
 * @author Engineer (Refactored for v3.4)
 */
(() => {
    "use strict";

    // --- Helper Functions (Moved to IIFE Scope) ---

    /**
     * Gathers details for a single file system item.
     * @param {string} itemName - The name of the item.
     * @param {object} itemNode - The file system node for the item.
     * @param {string} itemPath - The full path to the item.
     * @returns {object|null} A detailed object for the item or null.
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
            mtime: itemNode.mtime ? new Date(itemNode.mtime) : new Date(0),
            size: FileSystemManager.calculateNodeSize(itemNode),
            extension: Utils.getFileExtension(itemName),
            linkCount: 1, // Hard link simulation is basic for now.
        };
    }

    /**
     * Formats the details of a single item for the long listing format (-l).
     * @param {object} itemDetails - The detailed object from getItemDetails.
     * @param {object} effectiveFlags - The flags being used for the command.
     * @returns {string} The formatted string for the list item.
     */
    function formatLongListItem(itemDetails, effectiveFlags) {
        const perms = FileSystemManager.formatModeToString(itemDetails.node);
        const owner = (itemDetails.node.owner || "unknown").padEnd(10);
        const group = (itemDetails.node.group || "unknown").padEnd(10);
        const size = effectiveFlags.humanReadable ? Utils.formatBytes(itemDetails.size).padStart(8) : String(itemDetails.size).padStart(8);
        let dateStr = "            ";
        if (itemDetails.mtime && itemDetails.mtime.getTime() !== 0) {
            const d = itemDetails.mtime;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            dateStr = `${months[d.getMonth()].padEnd(3)} ${d.getDate().toString().padStart(2, " ")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        }
        const nameSuffix = itemDetails.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && !effectiveFlags.dirsOnly ? Config.FILESYSTEM.PATH_SEPARATOR : "";
        return `${perms}  ${String(itemDetails.linkCount).padStart(2)} ${owner}${group}${size} ${dateStr} ${itemDetails.name}${nameSuffix}`;
    }

    /**
     * Sorts an array of item details based on the provided flags.
     * @param {Array<object>} items - Array of item detail objects.
     * @param {object} currentFlags - The flags to sort by.
     * @returns {Array<object>} The sorted array of items.
     */
    function sortItems(items, currentFlags) {
        let sortedItems = [...items];
        if (currentFlags.noSort) {
            // Do nothing
        } else if (currentFlags.sortByTime) {
            sortedItems.sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));
        } else if (currentFlags.sortBySize) {
            sortedItems.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
        } else if (currentFlags.sortByExtension) {
            sortedItems.sort((a, b) => a.extension.localeCompare(b.extension) || a.name.localeCompare(b.name));
        } else {
            sortedItems.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (currentFlags.reverseSort) {
            sortedItems.reverse();
        }
        return sortedItems;
    }

    /**
     * Formats an array of names into a multi-column string based on terminal width.
     * @param {Array<string>} names - The names to format.
     * @returns {string} The multi-column formatted string.
     */
    function formatToColumns(names) {
        if (names.length === 0) return "";
        const terminalWidth = DOM.terminalDiv?.clientWidth || 80 * 8;
        const charWidth = Utils.getCharacterDimensions().width || 8;
        const displayableCols = Math.floor(terminalWidth / charWidth);
        const longestName = names.reduce((max, name) => Math.max(max, name.length), 0);
        const colWidth = longestName + 2; // Add padding
        const numColumns = Math.max(1, Math.floor(displayableCols / colWidth));
        const numRows = Math.ceil(names.length / numColumns);
        const grid = Array(numRows).fill(null).map(() => Array(numColumns).fill(""));

        for (let i = 0; i < names.length; i++) {
            const row = i % numRows;
            const col = Math.floor(i / numRows);
            grid[row][col] = names[i];
        }

        return grid.map(row => row.map((item, colIndex) => (colIndex === row.length - 1) ? item : item.padEnd(colWidth)).join("")).join("\n");
    }

    /**
     * The primary workhorse function. Lists the contents of a single path.
     * @param {string} targetPathArg - The path argument to list.
     * @param {object} effectiveFlags - The calculated flags for the operation.
     * @param {string} currentUser - The current user.
     * @returns {Promise<object>} A result object with output, success status, and item details.
     */
    async function listSinglePathContents(targetPathArg, effectiveFlags, currentUser) {
        const pathValidation = FileSystemManager.validatePath("ls", targetPathArg);
        if (pathValidation.error) return { success: false, error: pathValidation.error };

        const targetNode = pathValidation.node;
        if (!FileSystemManager.hasPermission(targetNode, currentUser, "read")) {
            return { success: false, error: `ls: cannot access '${targetPathArg}': Permission denied` };
        }

        let itemDetailsList = [];
        let singleItemResultOutput = null;

        if (effectiveFlags.dirsOnly) {
            const details = getItemDetails(targetPathArg, targetNode, pathValidation.resolvedPath);
            if (details) singleItemResultOutput = effectiveFlags.long ? formatLongListItem(details, effectiveFlags) : details.name;
        } else if (targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
            const childrenNames = Object.keys(targetNode.children);
            for (const name of childrenNames) {
                if (!effectiveFlags.all && name.startsWith(".")) continue;
                const details = getItemDetails(name, targetNode.children[name], FileSystemManager.getAbsolutePath(name, pathValidation.resolvedPath));
                if (details) itemDetailsList.push(details);
            }
            itemDetailsList = sortItems(itemDetailsList, effectiveFlags);
        } else {
            const fileName = pathValidation.resolvedPath.substring(pathValidation.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1);
            const details = getItemDetails(fileName, targetNode, pathValidation.resolvedPath);
            if (details) singleItemResultOutput = effectiveFlags.long ? formatLongListItem(details, effectiveFlags) : details.name;
        }

        let currentPathOutputLines = [];
        if (singleItemResultOutput !== null) {
            currentPathOutputLines.push(singleItemResultOutput);
        } else {
            if (effectiveFlags.long) {
                if (itemDetailsList.length > 0) currentPathOutputLines.push(`total ${itemDetailsList.length}`);
                itemDetailsList.forEach(item => { currentPathOutputLines.push(formatLongListItem(item, effectiveFlags)); });
            } else if (effectiveFlags.oneColumn) {
                itemDetailsList.forEach(item => {
                    const nameSuffix = item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? Config.FILESYSTEM.PATH_SEPARATOR : "";
                    currentPathOutputLines.push(`${item.name}${nameSuffix}`);
                });
            } else {
                const namesToFormat = itemDetailsList.map(item => {
                    const nameSuffix = item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? Config.FILESYSTEM.PATH_SEPARATOR : "";
                    return `${item.name}${nameSuffix}`;
                });
                currentPathOutputLines.push(formatToColumns(namesToFormat));
            }
        }
        return { success: true, output: currentPathOutputLines.join("\n"), items: itemDetailsList, isDir: targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE };
    }

    /**
     * Handles the logic for a standard (non-recursive) listing.
     * @param {Array<string>} pathsToList - The paths provided by the user.
     * @param {object} effectiveFlags - The calculated flags for the operation.
     * @param {string} currentUser - The current user.
     * @returns {Promise<object>} The final command result object.
     */
    async function _handleStandardListing(pathsToList, effectiveFlags, currentUser) {
        let outputBlocks = [];
        let overallSuccess = true;
        const fileArgs = [];
        const dirArgs = [];
        const errorOutputs = [];

        for (const path of pathsToList) {
            const validation = FileSystemManager.validatePath("ls", path);
            if (validation.error) {
                errorOutputs.push(validation.error);
                overallSuccess = false;
            } else if (validation.node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE || effectiveFlags.dirsOnly) {
                dirArgs.push(path);
            } else {
                fileArgs.push(path);
            }
        }

        const fileResults = [];
        for (const path of fileArgs) {
            const listResult = await listSinglePathContents(path, effectiveFlags, currentUser);
            if (listResult.success && listResult.output) {
                fileResults.push(listResult.output);
            } else if (!listResult.success) {
                errorOutputs.push(listResult.error);
                overallSuccess = false;
            }
        }
        if (fileResults.length > 0) {
            outputBlocks.push(fileResults.join(effectiveFlags.long || effectiveFlags.oneColumn ? '\n' : '  '));
        }

        for (let i = 0; i < dirArgs.length; i++) {
            const path = dirArgs[i];
            if (outputBlocks.length > 0 || errorOutputs.length > 0) {
                outputBlocks.push("");
            }
            if (pathsToList.length > 1) {
                outputBlocks.push(`${path}:`);
            }
            const listResult = await listSinglePathContents(path, effectiveFlags, currentUser);
            if (listResult.success && listResult.output) {
                outputBlocks.push(listResult.output);
            } else if (!listResult.success) {
                errorOutputs.push(listResult.error);
                overallSuccess = false;
            }
        }

        const finalOutput = [...errorOutputs, ...outputBlocks].join('\n');
        return { success: overallSuccess, [overallSuccess ? 'output' : 'error']: finalOutput };
    }

    /**
     * Handles the logic for a recursive (-R) listing.
     * @param {Array<string>} pathsToList - The initial paths provided by the user.
     * @param {object} effectiveFlags - The calculated flags for the operation.
     * @param {string} currentUser - The current user.
     * @returns {Promise<object>} The final command result object.
     */
    async function _handleRecursiveListing(pathsToList, effectiveFlags, currentUser) {
        let outputBlocks = [];
        let overallSuccess = true;

        async function displayRecursive(currentPath, displayFlags, depth = 0) {
            let blockOutputs = [];
            let encounteredErrorInThisBranch = false;
            if (depth > 0 || pathsToList.length > 1) {
                blockOutputs.push(""); // Add spacing between directory listings
                blockOutputs.push(`${currentPath}:`);
            }
            const listResult = await listSinglePathContents(currentPath, displayFlags, currentUser);
            if (!listResult.success) {
                blockOutputs.push(listResult.error);
                encounteredErrorInThisBranch = true;
                return { outputs: blockOutputs, encounteredError: encounteredErrorInThisBranch };
            }
            if (listResult.output) {
                blockOutputs.push(listResult.output);
            }
            if (listResult.items && listResult.isDir) {
                const subdirectories = listResult.items.filter(item => item.type === 'directory' && item.name !== "." && item.name !== "..");
                for (const dirItem of subdirectories) {
                    const subDirResult = await displayRecursive(dirItem.path, displayFlags, depth + 1);
                    blockOutputs.push(...subDirResult.outputs);
                    if (subDirResult.encounteredError) encounteredErrorInThisBranch = true;
                }
            }
            return { outputs: blockOutputs, encounteredError: encounteredErrorInThisBranch };
        }

        for (const path of pathsToList) {
            const recursiveResult = await displayRecursive(path, effectiveFlags);
            outputBlocks.push(...recursiveResult.outputs);
            if (recursiveResult.encounteredError) {
                overallSuccess = false;
            }
        }

        // Clean up initial empty lines if any
        if (outputBlocks.length > 0 && outputBlocks[0] === "") {
            outputBlocks.shift();
        }

        return { success: overallSuccess, [overallSuccess ? 'output' : 'error']: outputBlocks.join("\n") };
    }


    // --- Command Definition ---

    const lsCommandDefinition = {
        commandName: "ls",
        flagDefinitions: [
            { name: "long", short: "-l", long: "--long" },
            { name: "all", short: "-a", long: "--all" },
            { name: "recursive", short: "-R", long: "--recursive" },
            { name: "reverseSort", short: "-r", long: "--reverse" },
            { name: "sortByTime", short: "-t" },
            { name: "sortBySize", short: "-S" },
            { name: "sortByExtension", short: "-X" },
            { name: "noSort", short: "-U" },
            { name: "dirsOnly", short: "-d" },
            { name: "oneColumn", short: "-1" },
            { name: "humanReadable", short: "-h", long: "--human-readable" }
        ],
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;

            const effectiveFlags = { ...flags };
            if (options && !options.isInteractive && !effectiveFlags.long && !effectiveFlags.oneColumn) {
                effectiveFlags.oneColumn = true;
            }

            const pathsToList = args.length > 0 ? args : ["."];

            if (effectiveFlags.recursive) {
                return await _handleRecursiveListing(pathsToList, effectiveFlags, currentUser);
            } else {
                return await _handleStandardListing(pathsToList, effectiveFlags, currentUser);
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
       directories are given, it lists information about them. When the
       output is not a terminal (e.g., a pipe), it defaults to a single
       column format.

OPTIONS
       -a, --all
              Do not ignore entries starting with .
       -d
              List directories themselves, not their contents.
       -l
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
              List one file per line. (This is the default for non-interactive output).
       -h, --human-readable
              With -l, print sizes in human-readable format (e.g., 1K 234M 2G).`;


    CommandRegistry.register("ls", lsCommandDefinition, lsDescription, lsHelpText);
})();