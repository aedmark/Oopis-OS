// scripts/commands/mv.js

window.MvCommand = class MvCommand extends Command {
    constructor() {
        super({
            commandName: "mv",
            description: "Move or rename files and directories.",
            helpText: `Usage: mv [OPTION]... <source> <destination>
      mv [OPTION]... <source>... <directory>
      Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.
      DESCRIPTION
      The mv command renames the file or directory at <source> to the
      name given by <destination>, or moves it into an existing
      <directory>.
      If the last argument is an existing directory, all preceding
      source files and directories are moved inside of it.
      OPTIONS
      -f, --force
      Do not prompt before overwriting. This option overrides a
      previous -i option.
      -i, --interactive
      Prompt before overwriting an existing file.
      EXAMPLES
      mv old_name.txt new_name.txt
      Renames 'old_name.txt' to 'new_name.txt'.
      mv report.txt notes.txt /home/Guest/documents/
      Moves both 'report.txt' and 'notes.txt' into the
      'documents' directory.`,
            completionType: "paths",
            flagDefinitions: [
                { name: "force", short: "-f", long: "--force" },
                { name: "interactive", short: "-i", long: "--interactive" },
            ],
            validations: {
                args: {
                    min: 2,
                    error: "Usage: mv [OPTION]... <source> <destination> or mv [OPTION]... <source>... <directory>",
                },
            },
        });
    }

    async coreLogic(context) {
        const { args, options, flags, dependencies } = context;
        const { FileSystemManager, ErrorHandler, ModalManager, Utils } = dependencies;
        const nowISO = new Date().toISOString();
        let changesMade = false;

        const destPathArg = args.pop();
        const sourcePathArgs = args;

        const planResult = await FileSystemManager.prepareFileOperation(
            sourcePathArgs,
            destPathArg,
            { isMove: true }
        );

        if (!planResult.success) {
            return ErrorHandler.createError(`mv: ${planResult.error}`);
        }

        const operationsPlan = planResult.data;

        for (const operation of operationsPlan) {
            if (operation.sourceAbsPath === operation.destinationAbsPath) {
                continue;
            }

            if (
                operation.willOverwrite &&
                (flags.interactive || (options.isInteractive && !flags.force))
            ) {
                const confirmed = await new Promise((resolve) => {
                    ModalManager.request({
                        context: "terminal",
                        type: "confirm",
                        messageLines: [`Overwrite '${operation.destinationAbsPath}'?`],
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false),
                        options,
                    });
                });
                if (!confirmed) {
                    continue;
                }
            }

            const sourceName = operation.sourceAbsPath.substring(
                operation.sourceAbsPath.lastIndexOf("/") + 1
            );
            const sourceParentPath =
                operation.sourceAbsPath.substring(
                    0,
                    operation.sourceAbsPath.lastIndexOf("/")
                ) || "/";
            const sourceParentNode =
                FileSystemManager.getNodeByPath(sourceParentPath);

            const movedNode = Utils.deepCopyNode(operation.sourceNode);
            movedNode.mtime = nowISO;
            operation.destinationParentNode.children[operation.finalName] =
                movedNode;
            operation.destinationParentNode.mtime = nowISO;
            delete sourceParentNode.children[sourceName];
            sourceParentNode.mtime = nowISO;
            changesMade = true;
        }

        return ErrorHandler.createSuccess("", { stateModified: changesMade });
    }
}

window.CommandRegistry.register(new MvCommand());
