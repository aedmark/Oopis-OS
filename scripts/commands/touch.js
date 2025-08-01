// scripts/commands/touch.js

window.TouchCommand = class TouchCommand extends Command {
  constructor() {
    super({
      commandName: "touch",
      description: "Changes file timestamps or creates empty files.",
      helpText: `Usage: touch [OPTION]... FILE...
      Change file timestamps.
      DESCRIPTION
      The touch command updates the modification time of each FILE to
      the current time.
      A FILE argument that does not exist is created empty, unless the
      -c option is supplied.
      OPTIONS
      -c, --no-create
      Do not create any files.
      -d, --date=<string>
      Parse <string> and use it instead of the current time.
      Examples: "1 day ago", "2025-01-01"
      -t <stamp>
      Use [[CC]YY]MMDDhhmm[.ss] instead of the current time.
      EXAMPLES
      touch newfile.txt
      Creates 'newfile.txt' if it does not exist, or updates its
      modification time if it does.
      touch -c existing_file.txt
      Updates the timestamp of 'existing_file.txt' but will not
      create it if it's missing.`,
      completionType: "paths",
      flagDefinitions: [
        { name: "noCreate", short: "-c", long: "--no-create" },
        { name: "dateString", short: "-d", long: "--date", takesValue: true },
        { name: "stamp", short: "-t", takesValue: true },
      ],
      argValidation: { min: 1 },
    });
  }

  async coreLogic(context) {
    const { args, flags, currentUser, dependencies } = context;
    const { ErrorHandler, TimestampParser, UserManager, FileSystemManager, Config } = dependencies;

    const timestampResult =
        TimestampParser.resolveTimestampFromCommandFlags(flags, "touch");
    if (timestampResult.error)
      return ErrorHandler.createError(timestampResult.error);

    const timestampToUse = timestampResult.timestampISO;
    let allSuccess = true;
    const messages = [];
    let changesMade = false;

    const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

    for (const pathArg of args) {
      const pathValidationResult = FileSystemManager.validatePath(pathArg, {
        allowMissing: true,
      });

      if (
          !pathValidationResult.success &&
          pathValidationResult.data?.node !== null
      ) {
        messages.push(`touch: ${pathValidationResult.error}`);
        allSuccess = false;
        continue;
      }

      const { node, resolvedPath } = pathValidationResult.data;

      if (resolvedPath === "/") {
        messages.push(`touch: cannot touch root directory`);
        allSuccess = false;
        continue;
      }

      if (node) {
        if (!FileSystemManager.hasPermission(node, currentUser, "write")) {
          messages.push(
              `touch: cannot update timestamp of '${pathArg}': Permission denied`
          );
          allSuccess = false;
          continue;
        }
        node.mtime = timestampToUse;
        changesMade = true;
      } else {
        if (flags.noCreate) continue;

        if (pathArg.trim().endsWith(Config.FILESYSTEM.PATH_SEPARATOR)) {
          messages.push(
              `touch: cannot touch '${pathArg}': No such file or directory`
          );
          allSuccess = false;
          continue;
        }

        const createResult = await FileSystemManager.createOrUpdateFile(
            resolvedPath,
            "",
            { currentUser, primaryGroup }
        );
        if (!createResult.success) {
          allSuccess = false;
          messages.push(`touch: ${createResult.error}`);
          continue;
        }
        const newNode = FileSystemManager.getNodeByPath(resolvedPath);
        if (newNode) {
          newNode.mtime = timestampToUse;
          changesMade = true;
        }
      }
    }

    if (!allSuccess)
      return ErrorHandler.createError(
          messages.join("\\n") || "touch: Not all operations were successful."
      );

    return ErrorHandler.createSuccess("", { stateModified: changesMade });
  }
}

window.CommandRegistry.register(new TouchCommand());
