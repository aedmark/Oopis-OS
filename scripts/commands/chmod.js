// scripts/commands/chmod.js

window.ChmodCommand = class ChmodCommand extends Command {
    constructor() {
        super({
            commandName: "chmod",
            description: "Changes the access permissions of a file or directory.",
            helpText: `Usage: chmod <mode> <path>
      Change the access permissions of a file or directory.
      DESCRIPTION
      The chmod command changes the file mode bits of the file or
      directory specified by <path>. The <mode> is a 3-digit octal
      number that represents the permissions for the owner, the group,
      and all other users.
      Each digit is a sum of the following values:
      4 - read (r)
      2 - write (w)
      1 - execute (x)
      The three digits of the mode correspond to:
      1st digit: Owner's permissions
      2nd digit: Group's permissions
      3rd digit: Others' permissions
      For example, a mode of 755 means:
      - Owner: 7 (4+2+1) -> read, write, and execute
      - Group: 5 (4+0+1) -> read and execute
      - Other: 5 (4+0+1) -> read and execute
      EXAMPLES
      chmod 755 script.sh
      Makes 'script.sh' executable by the owner, and readable
      and executable by the group and others. A common mode for
      executable scripts.
      chmod 640 secret.txt
      Makes 'secret.txt' readable and writable by the owner,
      readable by the group, and completely inaccessible to
      other users.
      PERMISSIONS
      To change the permissions of a file, you must be the owner of
      the file or the superuser (root).`,
            completionType: "paths",
            validations: {
                args: { exact: 2, error: "Usage: chmod <mode> <path>" },
                paths: [
                    {
                        argIndex: 1,
                        options: {
                            ownershipRequired: true
                        }
                    }
                ]
            },
        });
    }

    async coreLogic(context) {
        const { args, validatedPaths, dependencies } = context;
        const { ErrorHandler } = dependencies;
        const modeArg = args[0];
        const { node } = validatedPaths[0];

        if (!/^[0-7]{3,4}$/.test(modeArg)) {
            return ErrorHandler.createError(
                `chmod: invalid mode: ‘${modeArg}’ (must be 3 or 4 octal digits)`
            );
        }

        const newMode = parseInt(modeArg, 8);
        node.mode = newMode;
        node.mtime = new Date().toISOString();

        return ErrorHandler.createSuccess("", { stateModified: true });
    }
}

window.CommandRegistry.register(new ChmodCommand());
