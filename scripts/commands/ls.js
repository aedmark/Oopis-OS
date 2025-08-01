// scripts/commands/ls.js

function getItemDetails(itemName, itemNode, itemPath, dependencies) {
  const { FileSystemManager, Utils } = dependencies;
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

function formatLongListItem(itemDetails, effectiveFlags, dependencies) {
  const { FileSystemManager, Utils, Config } = dependencies;
  let perms = FileSystemManager.formatModeToString(itemDetails.node);
  if (itemDetails.type === Config.FILESYSTEM.SYMBOLIC_LINK_TYPE) {
    perms = 'l' + perms.substring(1);
  }
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

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const month = months[fileDate.getMonth()];
    const day = fileDate.getDate().toString().padStart(2, " ");

    if (fileDate > sixMonthsAgo) {
      const hours = fileDate.getHours().toString().padStart(2, "0");
      const minutes = fileDate.getMinutes().toString().padStart(2, "0");
      dateStr = `${month} ${day} ${hours}:${minutes}`;
    } else {
      const year = fileDate.getFullYear();
      dateStr = `${month} ${day}  ${year}`;
    }
  } else {
    dateStr = "Jan  1  1970";
  }

  let nameOutput = itemDetails.name;
  if (itemDetails.type === Config.FILESYSTEM.SYMBOLIC_LINK_TYPE) {
    nameOutput += ` -> ${itemDetails.node.target}`;
  } else if (itemDetails.type === "directory" && !effectiveFlags.dirsOnly) {
    nameOutput += "/";
  }

  return `${perms}  ${String(itemDetails.linkCount).padStart(2)} ${owner} ${group} ${size} ${dateStr.padEnd(12)} ${nameOutput}`;
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
      return (
          (a.extension.localeCompare(b.extension) ||
              a.name.localeCompare(b.name)) * sortOrder
      );
    }
    return a.name.localeCompare(b.name) * sortOrder;
  });

  return sortedItems;
}

function formatToColumns(names, options = {}, dependencies) {
  const { Utils } = dependencies;
  if (names.length === 0) return "";

  const terminalDiv = document.getElementById("terminal");
  const isVisibleAndInteractive = options.isInteractive && terminalDiv?.clientWidth > 0;

  const charDimensions = Utils.getCharacterDimensions();
  const terminalWidth = isVisibleAndInteractive
      ? terminalDiv.clientWidth
      : 80 * (charDimensions.width || 8);
  const charWidth = charDimensions.width || 8;

  const displayableCols = Math.floor(terminalWidth / charWidth);

  const longestName = names.reduce(
      (max, name) => Math.max(max, name.length),
      0
  );
  const colWidth = longestName + 2;

  if (colWidth > displayableCols) {
    return names.join("\n");
  }

  const numColumns = Math.max(1, Math.floor(displayableCols / colWidth));
  const numRows = Math.ceil(names.length / numColumns);

  const output = [];
  for (let i = 0; i < numRows; i++) {
    let row = "";
    for (let j = 0; j < numColumns; j++) {
      const index = j * numRows + i;
      if (index < names.length) {
        const item = names[index];
        row += item.padEnd(colWidth);
      }
    }
    output.push(row);
  }

  return output.join("\n");
}

async function listSinglePathContents(
    targetPathArg,
    effectiveFlags,
    currentUser,
    options,
    dependencies
) {
  const { FileSystemManager, ErrorHandler } = dependencies;
  const pathValidationResult = FileSystemManager.validatePath(targetPathArg, { resolveLastSymlink: false });

  if (!pathValidationResult.success) {
    return ErrorHandler.createError(
        `ls: cannot access '${targetPathArg}': No such file or directory`
    );
  }
  const { node: targetNode, resolvedPath } = pathValidationResult.data;

  if (!FileSystemManager.hasPermission(targetNode, currentUser, "read")) {
    return ErrorHandler.createError(
        `ls: cannot open directory '${targetPathArg}': Permission denied`
    );
  }

  let itemDetailsList = [];
  let singleItemResultOutput = null;

  if (effectiveFlags.dirsOnly) {
    const details = getItemDetails(targetPathArg, targetNode, resolvedPath, dependencies);
    if (details) {
      itemDetailsList.push(details);
      singleItemResultOutput = effectiveFlags.long
          ? formatLongListItem(details, effectiveFlags, dependencies)
          : details.name;
    }
  } else if (targetNode.type === "directory") {
    const childrenNames = Object.keys(targetNode.children);
    for (const name of childrenNames) {
      if (!effectiveFlags.all && name.startsWith(".")) continue;
      const details = getItemDetails(
          name,
          targetNode.children[name],
          FileSystemManager.getAbsolutePath(name, resolvedPath),
          dependencies
      );
      if (details) itemDetailsList.push(details);
    }
    itemDetailsList = sortItems(itemDetailsList, effectiveFlags);
  } else {
    const details = getItemDetails(targetPathArg, targetNode, resolvedPath, dependencies);
    if (details) {
      itemDetailsList.push(details);
      singleItemResultOutput = effectiveFlags.long
          ? formatLongListItem(details, effectiveFlags, dependencies)
          : details.name;
    }
  }

  let currentPathOutputLines = [];
  if (singleItemResultOutput !== null) {
    currentPathOutputLines.push(singleItemResultOutput);
  } else if (itemDetailsList.length > 0) {
    if (effectiveFlags.long) {
      currentPathOutputLines.push(`total ${itemDetailsList.length}`);
      itemDetailsList.forEach((item) => {
        currentPathOutputLines.push(formatLongListItem(item, effectiveFlags, dependencies));
      });
    } else if (effectiveFlags.oneColumn) {
      itemDetailsList.forEach((item) => {
        const nameSuffix = item.type === "directory" ? "/" : "";
        currentPathOutputLines.push(`${item.name}${nameSuffix}`);
      });
    } else {
      const namesToFormat = itemDetailsList.map((item) => {
        const nameSuffix = item.type === "directory" ? "/" : "";
        return `${item.name}${nameSuffix}`;
      });
      currentPathOutputLines.push(formatToColumns(namesToFormat, options, dependencies));
    }
  }

  return ErrorHandler.createSuccess({
    output: currentPathOutputLines.join("\n"),
    items: itemDetailsList,
    isDir: targetNode.type === "directory",
  });
}


window.LsCommand = class LsCommand extends Command {
  constructor() {
    super({
      commandName: "ls",
      description: "Lists directory contents and file information.",
      helpText: `Usage: ls [OPTION]... [FILE]...
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
      -h              With -l, print sizes in human-readable format.`,
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
        { name: "humanReadable", short: "-h" },
      ],
    });
  }

  async coreLogic(context) {
    const { args, flags, currentUser, options, dependencies } = context;
    const { ErrorHandler } = dependencies;

    const effectiveFlags = { ...flags };
    if (
        options &&
        !options.isInteractive &&
        !effectiveFlags.long &&
        !effectiveFlags.oneColumn
    ) {
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
        const listResult = await listSinglePathContents(
            currentPath,
            effectiveFlags,
            currentUser,
            options,
            dependencies
        );
        if (!listResult.success) {
          outputBlocks.push(listResult.error);
          overallSuccess = false;
        } else {
          const { output, items, isDir } = listResult.data;
          if (output) {
            outputBlocks.push(output);
          }

          if (items && isDir) {
            const subdirectories = items.filter(
                (item) =>
                    item.type === "directory" && !item.name.startsWith(".")
            );
            for (const dirItem of subdirectories) {
              await displayRecursive(dirItem.path, depth + 1);
            }
          }
        }
      }
      for (const path of pathsToList) {
        await displayRecursive(path);
      }
    } else {
      const fileItems = [];
      const dirBlocks = [];
      const errorBlocks = [];

      for (const path of pathsToList) {
        const listResult = await listSinglePathContents(path, effectiveFlags, currentUser, options, dependencies);

        if (!listResult.success) {
          errorBlocks.push(listResult.error);
        } else {
          const { output, items, isDir } = listResult.data;
          if (isDir && !effectiveFlags.dirsOnly) {
            dirBlocks.push({ path, output });
          } else {
            fileItems.push(...items);
          }
        }
      }

      const finalOutputBlocks = [...errorBlocks];
      let fileBlockAdded = false;

      if (fileItems.length > 0) {
        const sortedFileItems = sortItems(fileItems, effectiveFlags);
        const fileOutputLines = [];
        if (effectiveFlags.long) {
          sortedFileItems.forEach(item => fileOutputLines.push(formatLongListItem(item, effectiveFlags, dependencies)));
        } else if (effectiveFlags.oneColumn) {
          sortedFileItems.forEach(item => fileOutputLines.push(item.name));
        } else {
          fileOutputLines.push(formatToColumns(sortedFileItems.map(item => item.name), options, dependencies));
        }
        finalOutputBlocks.push(fileOutputLines.join('\n'));
        fileBlockAdded = true;
      }

      dirBlocks.forEach((block, index) => {
        if (fileBlockAdded || errorBlocks.length > 0 || index > 0) {
          finalOutputBlocks.push('');
        }
        if (pathsToList.length > 1) {
          finalOutputBlocks.push(`${block.path}:`);
        }
        finalOutputBlocks.push(block.output);
      });

      if (errorBlocks.length > 0) {
        return ErrorHandler.createError(finalOutputBlocks.join("\n"));
      }
      return ErrorHandler.createSuccess(finalOutputBlocks.join("\n"));
    }

    if (!overallSuccess) {
      return ErrorHandler.createError(outputBlocks.join("\n"));
    }
    return ErrorHandler.createSuccess(outputBlocks.join("\n"));
  }
}

window.CommandRegistry.register(new LsCommand());
