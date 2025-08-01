// scripts/commands/chgrp.js

window.ChgrpCommand = class ChgrpCommand extends Command {
    constructor() {
        super({
            commandName: "chgrp",
            description: "Changes the group ownership of a file or directory.",
            helpText: `Usage: chgrp [-R] <group> <path>...
      Change the group ownership of files or directories.
      DESCRIPTION
      The chgrp command changes the group of the file or directory
      specified by <path> to <group>.
      Group ownership is a fundamental part of the OopisOS security model.
      File permissions can be set to allow or deny access based on whether
      a user is a member of a file's group. Use the 'ls -l' command to
      view file and directory ownership.
      OPTIONS
      -R, -r, --recursive
            Change the group of directories and their contents recursively.
      EXAMPLES
      chgrp developers /home/Guest/project
      Changes the group of the 'project' directory to 'developers'.
      chgrp -R developers /home/Guest/project_folder
      Recursively changes the group of 'project_folder' and all
      its contents to 'developers'.
      PERMISSIONS
      To change the group of a file, you must be the owner of the file
      or the superuser (root).`,
            completionType: "groups",
            flagDefinitions: [
                { name: "recursive", short: "-R", long: "--recursive", aliases: ["-r"] }
            ],
            validations: {
                args: { min: 2, error: "Usage: chgrp [-R] <groupname> <path>..." },
            },
        });
    }

    async _recursiveChgrp(node, newGroup, dependencies) {
        const nowISO = new Date().toISOString();
        node.group = newGroup;
        node.mtime = nowISO;

        if (node.type === 'directory' && node.children) {
            for (const childName in node.children) {
                const childNode = node.children[childName];
                await this._recursiveChgrp(childNode, newGroup, dependencies);
            }
        }
    }

    async coreLogic(context) {
        const { args, flags, currentUser, dependencies } = context;
        const { GroupManager, FileSystemManager, ErrorHandler } = dependencies;

        const groupName = args.shift();
        const paths = args;
        let changesMade = false;

        if (!GroupManager.groupExists(groupName)) {
            return ErrorHandler.createError(
                `chgrp: invalid group: '${groupName}'`
            );
        }

        for (const pathArg of paths) {
            const pathDataResult = FileSystemManager.validatePath(pathArg, { allowMissing: false, ownershipRequired: true });

            if (!pathDataResult.success) {
                return ErrorHandler.createError(`chgrp: ${pathDataResult.error}`);
            }

            const { node } = pathDataResult.data;

            if (!FileSystemManager.canUserModifyNode(node, currentUser)) {
                return ErrorHandler.createError(`chgrp: changing group of '${pathArg}': Operation not permitted`);
            }

            if (node.type === 'directory' && flags.recursive) {
                await this._recursiveChgrp(node, groupName, dependencies);
            } else {
                node.group = groupName;
                node.mtime = new Date().toISOString();
            }
            changesMade = true;
        }

        return ErrorHandler.createSuccess("", { stateModified: changesMade });
    }
}

window.CommandRegistry.register(new ChgrpCommand());
