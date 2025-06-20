// scripts/commands/ls.js

(() => {
    "use strict";

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
        ],
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;

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
                    linkCount: 1,
                };
            }

            function formatLongListItem(itemDetails) {
                const perms = FileSystemManager.formatModeToString(itemDetails.node);
                const owner = (itemDetails.node.owner || "unknown").padEnd(10);
                const group = (itemDetails.node.group || "unknown").padEnd(10);
                const size = Utils.formatBytes(itemDetails.size).padStart(8);
                let dateStr = "            ";
                if (itemDetails.mtime && itemDetails.mtime.getTime() !== 0) {
                    const d = itemDetails.mtime;
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    dateStr = `${months[d.getMonth()].padEnd(3)} ${d.getDate().toString().padStart(2, " ")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                }
                const nameSuffix = itemDetails.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && !flags.dirsOnly ? Config.FILESYSTEM.PATH_SEPARATOR : "";
                return `${perms}  ${String(itemDetails.linkCount).padStart(2)} ${owner}${group}${size} ${dateStr} ${itemDetails.name}${nameSuffix}`;
            }

            function sortItems(items, currentFlags) {
                let sortedItems = [...items];
                if (currentFlags.noSort) {
                    // Do nothing
                } else if (currentFlags.sortByTime) {
                    sortedItems.sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));
                } else if (currentFlags.sortBySize) {
                    sortedItems.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
                } else if (currentFlags.sortByExtension) {
                    sortedItems.sort((a, b) => {
                        const extComp = a.extension.localeCompare(b.extension);
                        if (extComp !== 0) return extComp;
                        return a.name.localeCompare(b.name);
                    });
                } else {
                    sortedItems.sort((a, b) => a.name.localeCompare(b.name));
                }

                if (currentFlags.reverseSort) {
                    sortedItems.reverse();
                }
                return sortedItems;
            }

            const pathsToList = args.length > 0 ? args : [FileSystemManager.getCurrentPath()];
            let outputBlocks = [];
            let overallSuccess = true;

            async function listSinglePathContents(targetPathArg, effectiveFlags) {
                const pathValidation = FileSystemManager.validatePath("ls", targetPathArg);
                if (pathValidation.error) return { success: false, output: pathValidation.error };
                const targetNode = pathValidation.node;
                if (!FileSystemManager.hasPermission(targetNode, currentUser, "read")) {
                    return { success: false, output: `ls: cannot access '${targetPathArg}': Permission denied` };
                }

                let itemDetailsList = [];
                let singleItemResultOutput = null;

                if (effectiveFlags.dirsOnly && targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    const details = getItemDetails(targetPathArg, targetNode, pathValidation.resolvedPath);
                    if (details) singleItemResultOutput = effectiveFlags.long ? formatLongListItem(details) : details.name;
                    else return { success: false, output: `ls: cannot stat '${targetPathArg}': Error retrieving details` };
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
                    if (details) singleItemResultOutput = effectiveFlags.long ? formatLongListItem(details) : details.name;
                    else return { success: false, output: `ls: cannot stat '${targetPathArg}': Error retrieving details` };
                }

                let currentPathOutputLines = [];
                if (singleItemResultOutput !== null) {
                    currentPathOutputLines.push(singleItemResultOutput);
                } else if (targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && !effectiveFlags.dirsOnly) {
                    if (effectiveFlags.long && itemDetailsList.length > 0) currentPathOutputLines.push(`total ${itemDetailsList.length}`);
                    itemDetailsList.forEach(item => {
                        const nameSuffix = item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? Config.FILESYSTEM.PATH_SEPARATOR : "";
                        currentPathOutputLines.push(effectiveFlags.long ? formatLongListItem(item) : `${item.name}${nameSuffix}`);
                    });
                }
                return { success: true, output: currentPathOutputLines.join("\n"), items: itemDetailsList };
            }

            async function displayRecursive(currentPath, displayFlags, depth = 0) {
                let blockOutputs = [];
                let encounteredErrorInThisBranch = false;
                if (depth > 0 || pathsToList.length > 1) blockOutputs.push(`${currentPath}:`);
                const listResult = await listSinglePathContents(currentPath, displayFlags);
                if (!listResult.success) {
                    blockOutputs.push(listResult.output);
                    encounteredErrorInThisBranch = true;
                    return { outputs: blockOutputs, encounteredError: encounteredErrorInThisBranch };
                }
                if (listResult.output) blockOutputs.push(listResult.output);
                if (listResult.items && FileSystemManager.getNodeByPath(currentPath)?.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                    const subdirectories = listResult.items.filter(item => item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && item.name !== "." && item.name !== "..");
                    for (const dirItem of subdirectories) {
                        if (blockOutputs.length > 0) blockOutputs.push("");
                        const subDirResult = await displayRecursive(dirItem.path, displayFlags, depth + 1);
                        blockOutputs = blockOutputs.concat(subDirResult.outputs);
                        if (subDirResult.encounteredError) encounteredErrorInThisBranch = true;
                    }
                }
                return { outputs: blockOutputs, encounteredError: encounteredErrorInThisBranch };
            }

            if (flags.recursive) {
                for (let i = 0; i < pathsToList.length; i++) {
                    const path = pathsToList[i];
                    const recursiveResult = await displayRecursive(path, flags);
                    outputBlocks = outputBlocks.concat(recursiveResult.outputs);
                    if (recursiveResult.encounteredError) overallSuccess = false;
                    if (i < pathsToList.length - 1) outputBlocks.push("");
                }
            } else {
                for (let i = 0; i < pathsToList.length; i++) {
                    const path = pathsToList[i];
                    if (pathsToList.length > 1) {
                        if (i > 0) outputBlocks.push("");
                        outputBlocks.push(`${path}:`);
                    }
                    const listResult = await listSinglePathContents(path, flags);
                    if (!listResult.success) overallSuccess = false;
                    if (listResult.output) outputBlocks.push(listResult.output);
                }
            }
            return { success: overallSuccess, output: outputBlocks.join("\n") };
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
              Do not sort; list entries in directory order.`;

    CommandRegistry.register("ls", lsCommandDefinition, lsDescription, lsHelpText);
})();