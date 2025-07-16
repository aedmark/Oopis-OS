// scripts/commands/ls.js
(() => {
    "use strict";

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
            linkCount: 1, // Hardcoded for this simulation
        };
    }

    // REFACTORED: This function now correctly formats the date according to POSIX standards.
    function formatLongListItem(itemDetails, effectiveFlags) {
        const perms = FileSystemManager.formatModeToString(itemDetails.node);
        const owner = (itemDetails.node.owner || "unknown").padEnd(10);
        const group = (itemDetails.node.group || "unknown").padEnd(10);
        const size = effectiveFlags.humanReadable
            ? Utils.formatBytes(itemDetails.size).padStart(8)
            : String(itemDetails.size).padStart(8);

        let dateStr;
        const fileDate = itemDetails.mtime;
        if (fileDate && fileDate.getTime() !== 0) {
            const now = new Date();
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(now.getMonth() - 6);

            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = months[fileDate.getMonth()];
            const day = fileDate.getDate().toString().padStart(2, ' ');

            if (fileDate > sixMonthsAgo) {
                // Recent file: Show HH:MM
                const hours = fileDate.getHours().toString().padStart(2, '0');
                const minutes = fileDate.getMinutes().toString().padStart(2, '0');
                dateStr = `${month} ${day} ${hours}:${minutes}`;
            } else {
                // Older file: Show YYYY
                const year = fileDate.getFullYear();
                dateStr = `${month} ${day}  ${year}`;
            }
        } else {
            dateStr = "Jan  1  1970"; // Default for invalid dates
        }

        const nameSuffix = itemDetails.type === 'directory' && !effectiveFlags.dirsOnly ? '/' : "";
        return `${perms}  ${String(itemDetails.linkCount).padStart(2)} ${owner}${group}${size} ${dateStr.padEnd(12)} ${itemDetails.name}${nameSuffix}`;
    }

    function sortItems(items, currentFlags) {
        let sortedItems = [...items];
        if (currentFlags.noSort) {
            return sortedItems;
        }

        const sortOrder = currentFlags.reverseSort ? -1 : 1;

        sortedItems.sort((a, b) => {
            if (currentFlags.sortByTime) {
                return (b.mtime - a.mtime || a.name.localeCompare(b.name)) * sortOrder;
            }
            if (currentFlags.sortBySize) {
                return (b.size - a.size || a.name.localeCompare(b.name)) * sortOrder;
            }
            if (currentFlags.sortByExtension) {
                return (a.extension.localeCompare(b.extension) || a.name.localeCompare(b.name)) * sortOrder;
            }
            // Default sort by name
            return a.name.localeCompare(b.name) * sortOrder;
        });

        return sortedItems;
    }

    function formatToColumns(names) {
        if (names.length === 0) return "";

        // Ensure DOM elements and utility functions are available.
        const terminalDiv = document.getElementById("terminal");
        const getCharDimensions = (typeof Utils !== 'undefined' && Utils.getCharacterDimensions)
            ? Utils.getCharacterDimensions
            : () => ({ width: 8, height: 16 }); // Fallback

        const terminalWidth = terminalDiv?.clientWidth || 80 * getCharDimensions().width;
        const charWidth = getCharDimensions().width || 8;
        const displayableCols = Math.floor(terminalWidth / charWidth);

        const longestName = names.reduce((max, name) => Math.max(max, name.length), 0);
        const colWidth = longestName + 2; // Add padding

        // If even the longest name doesn't fit, default to a single column.
        if (colWidth > displayableCols) {
            return names.join('\\n');
        }

        const numColumns = Math.max(1, Math.floor(displayableCols / colWidth));
        const numRows = Math.ceil(names.length / numColumns);

        const output = [];
        for (let i = 0; i < numRows; i++) {
            let row = '';
            for (let j = 0; j < numColumns; j++) {
                const index = j * numRows + i;
                if (index < names.length) {
                    const item = names[index];
                    // Use padEnd to ensure consistent column width.
                    row += item.padEnd(colWidth);
                }
            }
            output.push(row);
        }

        return output.join('\\n');
    }

    async function listSinglePathContents(targetPathArg, effectiveFlags, currentUser) {
        const resolvedPath = FileSystemManager.getAbsolutePath(targetPathArg);
        const targetNode = FileSystemManager.getNodeByPath(resolvedPath);

        if (!targetNode) {
            return { success: false, error: `ls: cannot access '${targetPathArg}': No such file or directory` };
        }

        if (!FileSystemManager.hasPermission(targetNode, currentUser, "read")) {
            return { success: false, error: `ls: cannot open directory '${targetPathArg}': Permission denied` };
        }

        let itemDetailsList = [];
        let singleItemResultOutput = null;

        if (effectiveFlags.dirsOnly) {
            const details = getItemDetails(targetPathArg, targetNode, resolvedPath);
            if (details) singleItemResultOutput = effectiveFlags.long ? formatLongListItem(details, effectiveFlags) : details.name;
        } else if (targetNode.type === 'directory') {
            const childrenNames = Object.keys(targetNode.children);
            for (const name of childrenNames) {
                if (!effectiveFlags.all && name.startsWith(".")) continue;
                const details = getItemDetails(name, targetNode.children[name], FileSystemManager.getAbsolutePath(name, resolvedPath));
                if (details) itemDetailsList.push(details);
            }
            itemDetailsList = sortItems(itemDetailsList, effectiveFlags);
        } else {
            const fileName = resolvedPath.substring(resolvedPath.lastIndexOf('/') + 1);
            const details = getItemDetails(fileName, targetNode, resolvedPath);
            if (details) singleItemResultOutput = effectiveFlags.long ? formatLongListItem(details, effectiveFlags) : details.name;
        }

        let currentPathOutputLines = [];
        if (singleItemResultOutput !== null) {
            currentPathOutputLines.push(singleItemResultOutput);
        } else if (itemDetailsList.length > 0) {
            if (effectiveFlags.long) {
                currentPathOutputLines.push(`total ${itemDetailsList.length}`);
                itemDetailsList.forEach(item => { currentPathOutputLines.push(formatLongListItem(item, effectiveFlags)); });
            } else if (effectiveFlags.oneColumn) {
                itemDetailsList.forEach(item => {
                    const nameSuffix = item.type === 'directory' ? '/' : "";
                    currentPathOutputLines.push(`${item.name}${nameSuffix}`);
                });
            } else {
                const namesToFormat = itemDetailsList.map(item => {
                    const nameSuffix = item.type === 'directory' ? '/' : "";
                    return `${item.name}${nameSuffix}`;
                });
                currentPathOutputLines.push(formatToColumns(namesToFormat));
            }
        }

        // FIXED: Use correct newline character
        return { success: true, output: currentPathOutputLines.join("\n"), items: itemDetailsList, isDir: targetNode.type === 'directory' };
    }

    const lsCommandDefinition = {
        commandName: "ls",
        completionType: "paths",
        flagDefinitions: [
            { name: "long", short: "-l" },
            { name: "all", short: "-a" },
            { name: "recursive", short: "-R" },
            { name: "reverseSort", short: "-r" },
            { name: "sortByTime", short: "-t" },
            { name: "sortBySize", short: "-S" },
            { name: "sortByExtension", short: "-X" },
            { name: "noSort", short: "-U" },
            { name: "dirsOnly", short: "-d" },
            { name: "oneColumn", short: "-1" },
            { name: "humanReadable", short: "-h" }
        ],
        coreLogic: async (context) => {
            const {args, flags, currentUser, options} = context;

            try {
                const effectiveFlags = { ...flags };
                if (options && !options.isInteractive && !effectiveFlags.long && !effectiveFlags.oneColumn) {
                    effectiveFlags.oneColumn = true;
                }

                const pathsToList = args.length > 0 ? args : ["."];
                let outputBlocks = [];
                let overallSuccess = true;

                if (effectiveFlags.recursive) {
                    async function displayRecursive(currentPath, depth = 0) {
                        if (depth > 0 || pathsToList.length > 1) {
                            outputBlocks.push(`\n${currentPath}:`);
                        }
                        const listResult = await listSinglePathContents(currentPath, effectiveFlags, currentUser);
                        if (!listResult.success) {
                            outputBlocks.push(listResult.error);
                            overallSuccess = false;
                        } else if (listResult.output) {
                            outputBlocks.push(listResult.output);
                        }

                        if (listResult.items && listResult.isDir) {
                            const subdirectories = listResult.items.filter(item => item.type === 'directory' && !item.name.startsWith("."));
                            for (const dirItem of subdirectories) {
                                await displayRecursive(dirItem.path, depth + 1);
                            }
                        }
                    }
                    for (const path of pathsToList) {
                        await displayRecursive(path);
                    }

                } else {
                    const fileArgs = [];
                    const dirArgs = [];
                    const errorOutputs = [];

                    for (const path of pathsToList) {
                        const pathValidation = FileSystemManager.validatePath(path);
                        if (pathValidation.error) {
                            errorOutputs.push(`ls: cannot access '${path}': No such file or directory`);
                            overallSuccess = false;
                        } else if (pathValidation.node.type === 'directory' || effectiveFlags.dirsOnly) {
                            dirArgs.push(path);
                        } else {
                            fileArgs.push(path);
                        }
                    }

                    if (fileArgs.length > 0) {
                        const fileListResult = await listSinglePathContents(fileArgs[0], effectiveFlags, currentUser); // temp fix for multiple files
                        if(fileListResult.success) outputBlocks.push(fileListResult.output);
                        else {
                            errorOutputs.push(fileListResult.error);
                            overallSuccess = false;
                        }
                    }

                    for (let i = 0; i < dirArgs.length; i++) {
                        if (fileArgs.length > 0 || i > 0) {
                            outputBlocks.push("");
                        }
                        if (pathsToList.length > 1) {
                            outputBlocks.push(`${dirArgs[i]}:`);
                        }
                        const listResult = await listSinglePathContents(dirArgs[i], effectiveFlags, currentUser);
                        if (listResult.success) {
                            outputBlocks.push(listResult.output);
                        } else {
                            errorOutputs.push(listResult.error);
                            overallSuccess = false;
                        }
                    }
                    outputBlocks = [...errorOutputs, ...outputBlocks];
                }

                // FIXED: Use correct newline character
                return { success: overallSuccess, [overallSuccess ? 'output' : 'error']: outputBlocks.join("\n") };
            } catch (e) {
                return { success: false, error: `ls: An unexpected error occurred: ${e.message}` };
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
       -l              Use a long listing format.
       -a              Do not ignore entries starting with .
       -R              List subdirectories recursively.
       -r              Reverse order while sorting.
       -t              Sort by modification time, newest first.
       -S              Sort by file size, largest first.
       -X              Sort alphabetically by entry extension.
       -U              Do not sort; list entries in directory order.
       -d              List directories themselves, not their contents.
       -1              List one file per line.
       -h              With -l, print sizes in human-readable format.`;

    CommandRegistry.register("ls", lsCommandDefinition, lsDescription, lsHelpText);
})();