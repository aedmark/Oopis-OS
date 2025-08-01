// scripts/commands/grep.js

window.GrepCommand = class GrepCommand extends Command {
  constructor() {
    super({
      commandName: "grep",
      description: "Searches for a pattern in files or standard input.",
      helpText: `Usage: grep [OPTION]... PATTERN [FILE]...
      Search for PATTERN in each FILE or standard input.
      DESCRIPTION
      The grep command searches for lines containing a match to the given
      PATTERN. When a line matches, it is printed.
      OPTIONS
      -i, --ignore-case
      Ignore case distinctions in patterns and data.
      -v, --invert-match
      Invert the sense of matching, to select non-matching lines.
      -n, --line-number
      Prefix each line of output with the 1-based line number
      within its input file.
      -c, --count
      Suppress normal output; instead print a count of matching lines
      for each input file.
      -R, -r, --recursive
      Read all files under each directory, recursively.
      -E, --extended-regexp
      Interpret PATTERN as an extended regular expression. (Currently no-op)
      EXAMPLES
      grep "error" /data/logs/system.log
      Finds all lines containing "error" in the system log.
      ls | grep ".txt"
      Lists only the files in the current directory that contain ".txt".
      grep -R "TODO" /home/Guest/src
      Recursively searches for "TODO" in the 'src' directory.`,
      completionType: "paths",
      flagDefinitions: [
        { name: "ignoreCase", short: "-i", long: "--ignore-case" },
        { name: "invertMatch", short: "-v", long: "--invert-match" },
        { name: "lineNumber", short: "-n", long: "--line-number" },
        { name: "count", short: "-c", long: "--count" },
        { name: "recursive", short: "-R", long: "--recursive", aliases: ["-r"] },
        { name: "extendedRegex", short: "-E", long: "--extended-regexp" },
      ],
    });
  }

  async coreLogic(context) {
    const { args, flags, currentUser, options, dependencies } = context;
    const { ErrorHandler, FileSystemManager } = dependencies;

    if (args.length === 0) {
      return ErrorHandler.createError("grep: missing pattern");
    }

    const patternStr = args[0];
    const filePaths = args.slice(1);
    let regex;

    try {
      regex = new RegExp(patternStr, flags.ignoreCase ? "i" : "");
    } catch (e) {
      return ErrorHandler.createError(
          `grep: invalid regular expression '${patternStr}': ${e.message}`
      );
    }

    const outputLines = [];
    let hadError = false;

    const processContent = (content, filePathForDisplay, displayFileName) => {
      const lines = content.split("\n");
      let fileMatchCount = 0;
      let fileOutput = [];

      lines.forEach((line, index) => {
        if (index === lines.length - 1 && line === "") return;

        const isMatch = regex.test(line);
        const effectiveMatch = flags.invertMatch ? !isMatch : isMatch;

        if (effectiveMatch) {
          fileMatchCount++;
          if (!flags.count) {
            let outputLine = "";
            if (displayFileName) {
              outputLine += `${filePathForDisplay}:`;
            }
            if (flags.lineNumber) {
              outputLine += `${index + 1}:`;
            }
            outputLine += line;
            fileOutput.push(outputLine);
          }
        }
      });

      if (flags.count) {
        let countOutput = "";
        if (displayFileName) {
          countOutput += `${filePathForDisplay}:`;
        }
        countOutput += fileMatchCount;
        outputLines.push(countOutput);
      } else {
        outputLines.push(...fileOutput);
      }
    };

    async function searchDirectory(directoryPath) {
      const dirNode = FileSystemManager.getNodeByPath(directoryPath);
      if (!dirNode || dirNode.type !== "directory") return;

      const children = Object.keys(dirNode.children).sort();
      for (const childName of children) {
        const childPath = FileSystemManager.getAbsolutePath(
            childName,
            directoryPath
        );
        const childNode = dirNode.children[childName];
        if (childNode.type === "directory") {
          if (
              FileSystemManager.hasPermission(childNode, currentUser, "read")
          ) {
            await searchDirectory(childPath);
          } else {
            outputLines.push(`grep: ${childPath}: Permission denied`);
            hadError = true;
          }
        } else if (childNode.type === "file") {
          if (
              FileSystemManager.hasPermission(childNode, currentUser, "read")
          ) {
            processContent(childNode.content || "", childPath, true);
          } else {
            outputLines.push(`grep: ${childPath}: Permission denied`);
            hadError = true;
          }
        }
      }
    }

    if (filePaths.length > 0) {
      for (const pathArg of filePaths) {
        const resolvedPath = FileSystemManager.getAbsolutePath(pathArg);
        const node = FileSystemManager.getNodeByPath(resolvedPath);

        if (!node) {
          outputLines.push(`grep: ${pathArg}: No such file or directory`);
          hadError = true;
          continue;
        }

        if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
          outputLines.push(`grep: ${pathArg}: Permission denied`);
          hadError = true;
          continue;
        }

        if (node.type === "directory" && flags.recursive) {
          await searchDirectory(resolvedPath);
        } else if (node.type === "directory" && !flags.recursive) {
          outputLines.push(`grep: ${pathArg}: is a directory`);
          hadError = true;
        } else {
          processContent(node.content || "", pathArg, filePaths.length > 1);
        }
      }
    } else if (options.stdinContent !== null) {
      processContent(options.stdinContent, "(standard input)", false);
    } else {
      return ErrorHandler.createError("grep: missing operand");
    }

    if (hadError) {
      return ErrorHandler.createError(outputLines.join("\n"));
    }
    return ErrorHandler.createSuccess(outputLines.join("\n"));
  }
}

window.CommandRegistry.register(new GrepCommand());
