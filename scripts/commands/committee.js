// scripts/commands/committee.js

window.CommitteeCommand = class CommitteeCommand extends Command {
    constructor() {
        super({
            commandName: "committee",
            description: "Creates and manages a collaborative project space.",
            helpText: `Usage: committee --create <name> --members <user1>,<user2>...
      Creates a new project committee, streamlining the setup for collaborative work.
      DESCRIPTION
      The committee command automates the creation of a user group, a shared
      project directory, and the assignment of appropriate permissions. It is a
      high-level utility for bootstrapping a new collaborative project. This command
      is equivalent to running groupadd, mkdir, chgrp, chmod, and multiple usermod
      commands.
      OPTIONS
      -c, --create <name>
            The name of the committee to create. This will create a group
            and a directory named '/home/project_<name>'.
      -m, --members <user_list>
            A comma-separated list of existing users to add to the committee.
      PERMISSIONS
      Only the superuser (root) can run this command.`,
            flagDefinitions: [
                { name: "create", short: "-c", long: "--create", takesValue: true },
                { name: "members", short: "-m", long: "--members", takesValue: true },
            ],
        });
    }

    async coreLogic(context) {
        const { flags, currentUser, dependencies } = context;
        const { UserManager, GroupManager, FileSystemManager, ErrorHandler, Config } = dependencies;

        if (currentUser !== "root") {
            return ErrorHandler.createError("committee: only root can create a committee.");
        }

        if (!flags.create || !flags.members) {
            return ErrorHandler.createError("committee: --create and --members flags are required.");
        }

        const committeeName = flags.create;
        const members = flags.members.split(',');
        const projectPath = `/home/project_${committeeName}`;

        for (const member of members) {
            if (!(await UserManager.userExists(member))) {
                return ErrorHandler.createError(`committee: user '${member}' does not exist.`);
            }
        }

        if (GroupManager.groupExists(committeeName)) {
            return ErrorHandler.createError(`committee: group '${committeeName}' already exists.`);
        }
        if (FileSystemManager.getNodeByPath(projectPath)) {
            return ErrorHandler.createError(`committee: directory '${projectPath}' already exists.`);
        }

        GroupManager.createGroup(committeeName);

        const mkdirResult = await FileSystemManager.createOrUpdateFile(
            projectPath,
            null,
            { isDirectory: true, currentUser: 'root', primaryGroup: 'root' }
        );
        if (!mkdirResult.success) {
            GroupManager.deleteGroup(committeeName);
            return ErrorHandler.createError(`committee: failed to create directory: ${mkdirResult.error}`);
        }

        const projectNode = FileSystemManager.getNodeByPath(projectPath);

        projectNode.group = committeeName;
        projectNode.mode = 0o770;

        for (const member of members) {
            GroupManager.addUserToGroup(member, committeeName);
        }

        await FileSystemManager.save();

        return ErrorHandler.createSuccess(
            `Committee '${committeeName}' created successfully.\n` +
            `Group '${committeeName}' created with members: ${members.join(', ')}\n` +
            `Project directory created at '${projectPath}' with group permissions.`
        );
    }
};

window.CommandRegistry.register(new CommitteeCommand());
