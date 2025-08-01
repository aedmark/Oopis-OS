// scripts/commands/chown.js

window.ChownCommand = class ChownCommand extends Command {
    constructor() {
        super({
            commandName: "chown",
            description: "Changes the user ownership of a file or directory.",
            helpText: `Usage: chown [-R] <owner> <path>...
      Change the user ownership of files or directories.
      DESCRIPTION
      The chown command changes the user ownership of the file or
      directory specified by <path> to <owner>. The <owner> must be a
      valid, existing user on the system.
      Use the 'ls -l' command to view the current owner of a file.
      OPTIONS
      -R, -r, --recursive
            Change the owner of directories and their contents recursively.
      EXAMPLES
      chown Guest /home/root/somefile
      Changes the owner of 'somefile' from 'root' to 'Guest'.
      chown -R Guest /home/root/project_folder
      Recursively changes the owner of 'project_folder' and all
      its contents to 'Guest'.
      PERMISSIONS
      Only the superuser (root) can change the ownership of a file.`,
            completionType: "users",
            flagDefinitions: [
                { name: "recursive", short: "-R", long: "--recursive", aliases: ["-r"] }
            ],
            validations: {
                args: { min: 2, error: "Usage: chown [-R] <new_owner> <path>..." },
            },
        });
    }

    async _recursiveChown(node, newOwner) {
        const nowISO = new Date().toISOString();
        node.owner = newOwner;
        node.mtime = nowISO;

        if (node.type === 'directory' && node.children) {
            for (const childName in node.children) {
                await this._recursiveChown(node.children[childName], newOwner);
            }
        }
    }

    async coreLogic(context) {
        const { args, flags, currentUser, dependencies } = context;
        const { UserManager, FileSystemManager, Config, ErrorHandler } = dependencies;

        const newOwnerArg = args[0];
        const paths = args.slice(1);
        let changesMade = false;

        if (currentUser !== "root") {
            return ErrorHandler.createError("chown: you must be root to change ownership.");
        }

        if (!(await UserManager.userExists(newOwnerArg)) && newOwnerArg !== Config.USER.DEFAULT_NAME) {
            return ErrorHandler.createError(`chown: user '${newOwnerArg}' does not exist.`);
        }

        for (const pathArg of paths) {
            const pathDataResult = FileSystemManager.validatePath(pathArg, { allowMissing: false });
            if (!pathDataResult.success) {
                return ErrorHandler.createError(`chown: cannot access '${pathArg}': ${pathDataResult.error}`);
            }
            const { node } = pathDataResult.data;
            if (node.type === 'directory' && flags.recursive) {
                await this._recursiveChown(node, newOwnerArg);
            } else {
                node.owner = newOwnerArg;
                node.mtime = new Date().toISOString();
            }
            changesMade = true;
        }

        return ErrorHandler.createSuccess("", { stateModified: changesMade });
    }
}

window.CommandRegistry.register(new ChownCommand());
