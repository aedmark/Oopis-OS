// scripts/commands/rm.js

window.RmCommand = class RmCommand extends Command {
  constructor() {
    super({
      commandName: "rm",
      description: "Removes files or directories.",
      helpText: `Usage: rm [OPTION]... [FILE]...
      Remove files, directories, or symbolic links.
      DESCRIPTION
      The rm command removes each specified file. By default, it does not
      remove directories. It will remove symbolic links without following them.
      In an interactive session, rm will prompt for confirmation before
      removing a file. This behavior can be controlled with the -f and
      -i flags.
      OPTIONS
      -f, --force
      Attempt to remove the files without prompting for
      confirmation, regardless of the file's permissions.
      -i, --interactive
      Prompt for confirmation before every removal.
      -r, -R, --recursive
      Remove directories and their contents recursively.
      WARNING
      Use this command with caution. Deleted files and directories
      cannot be recovered.`,
      completionType: "paths",
      flagDefinitions: [
        { name: "recursive", short: "-r", long: "--recursive", aliases: ["-R"] },
        { name: "force", short: "-f", long: "--force" },
        { name: "interactive", short: "-i", long: "--interactive" },
      ],
      validations: {
        args: { min: 1, error: "missing operand" },
        paths: [
          {
            argIndex: 'all',
            permissionsOnParent: ['write'],
            options: { allowMissing: true, resolveLastSymlink: false }
          }
        ]
      },
    });
  }

  async coreLogic(context) {
    const { flags, currentUser, options, validatedPaths, dependencies } = context;
    const { ErrorHandler, FileSystemManager, ModalManager, Config } = dependencies;
    let allSuccess = true;
    let anyChangeMade = false;
    const messages = [];

    for (const pathData of validatedPaths) {
      const { arg: pathArg, node, resolvedPath } = pathData;

      if (!node) {
        if (!flags.force) {
          messages.push(`rm: cannot remove '${pathArg}': No such file or directory`);
          allSuccess = false;
        }
        continue;
      }

      if (resolvedPath === "/") {
        messages.push(`rm: cannot remove root directory`);
        allSuccess = false;
        continue;
      }

      if (node.type === "directory" && !flags.recursive) {
        messages.push(
            `rm: cannot remove '${pathArg}': Is a directory (use -r or -R)`
        );
        allSuccess = false;
        continue;
      }

      const isPromptRequired =
          flags.interactive || (options.isInteractive && !flags.force);

      if (isPromptRequired) {
        const promptMsg =
            node.type === "directory"
                ? `Recursively remove directory '${pathArg}'?`
                : `Remove file '${pathArg}'?`;
        const confirmed = await new Promise((resolve) => {
          ModalManager.request({
            context: "terminal",
            type: "confirm",
            messageLines: [promptMsg],
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
            options,
          });
        });

        if (!confirmed) {
          messages.push(
              `${Config.MESSAGES.REMOVAL_CANCELLED_PREFIX}'${pathArg}'${Config.MESSAGES.REMOVAL_CANCELLED_SUFFIX}`
          );
          continue;
        }
      }

      const deleteResult = await FileSystemManager.deleteNodeRecursive(
          resolvedPath,
          { force: true, currentUser }
      );
      if (deleteResult.success) {
        if (deleteResult.data.anyChangeMade) anyChangeMade = true;
      } else {
        allSuccess = false;
        messages.push(deleteResult.error || "Unknown error during rm operation.");
      }
    }

    const finalOutput = messages.filter((m) => m).join("\n");
    if (!allSuccess) {
      return ErrorHandler.createError(
          finalOutput || "Unknown error during rm operation."
      );
    }
    return ErrorHandler.createSuccess("", { stateModified: anyChangeMade });
  }
}

window.CommandRegistry.register(new RmCommand());
