// oos-dev/scripts/commands/fsck.js

window.FsckCommand = class FsckCommand extends Command {
    constructor() {
        super({
            commandName: "fsck",
            description: "Checks and optionally repairs filesystem integrity.",
            helpText: `Usage: fsck [--repair] [path]
      Checks the integrity of the OopisOS filesystem.

      DESCRIPTION
      The fsck (file system check) utility scans the filesystem starting
      from the given path (or the root if no path is provided) to find
      and report on inconsistencies.

      It verifies:
      - Structural Integrity: Ensures all files/directories are properly formed.
      - Ownership: Checks for valid user and group ownership.
      - User Homes: Confirms every user has a valid home directory.
      - Symbolic Links: Identifies broken or dangling symbolic links.

      OPTIONS
      --repair
            After scanning, prompts the user interactively to fix any
            issues that were found.

      WARNING: Running with --repair can result in data loss if used
      improperly. It is recommended to run without this flag first to
      review the potential changes.`,
            flagDefinitions: [
                { name: "repair", long: "--repair" },
            ],
            argValidation: {
                max: 1,
            },
        });
    }

    async coreLogic(context) {
        const { args, flags, dependencies, options } = context;
        const { FileSystemManager, UserManager, GroupManager, StorageManager, OutputManager, ModalManager, ErrorHandler, Config } = dependencies;

        const startPath = args[0] || '/';
        const repairMode = flags.repair || false;

        const pathValidation = FileSystemManager.validatePath(startPath, { expectedType: 'directory' });
        if (!pathValidation.success) {
            return ErrorHandler.createError(`fsck: Cannot start check at '${startPath}': ${pathValidation.error}`);
        }

        const output = [];
        const issues = [];
        let changesMade = false;

        await OutputManager.appendToOutput(`Starting filesystem check at '${startPath}'...`);

        const structuralAudit = async () => {
            const auditIssues = [];
            const traverse = (path, node) => {
                const requiredProps = ['type', 'owner', 'group', 'mode', 'mtime'];
                for (const prop of requiredProps) {
                    if (node[prop] === undefined) {
                        auditIssues.push({ type: 'MALFORMED_NODE', path, issue: `Malformed node: missing '${prop}' property.`, data: { node } });
                    }
                }
                if (node.type === 'directory' && (typeof node.children !== 'object' || node.children === null)) {
                    auditIssues.push({ type: 'TYPE_INCONSISTENCY', path, issue: "Directory node is missing or has invalid 'children' object.", data: { node } });
                } else if (node.type === 'file' && typeof node.content !== 'string') {
                    auditIssues.push({ type: 'TYPE_INCONSISTENCY', path, issue: "File node is missing 'content' string.", data: { node } });
                }
                if (node.type === Config.FILESYSTEM.SYMBOLIC_LINK_TYPE) {
                    const parentOfLink = path.substring(0, path.lastIndexOf('/')) || '/';
                    const targetPath = FileSystemManager.getAbsolutePath(node.target, parentOfLink);
                    const targetNode = FileSystemManager.getNodeByPath(targetPath);
                    if (!targetNode) {
                        auditIssues.push({ type: 'DANGLING_SYMLINK', path, issue: `Dangling symbolic link pointing to non-existent target '${node.target}'.`, data: { node } });
                    }
                }
                if (node.type === 'directory' && node.children) {
                    for (const childName in node.children) {
                        const childPath = FileSystemManager.getAbsolutePath(childName, path);
                        traverse(childPath, node.children[childName]);
                    }
                }
            };
            output.push("\n--- Phase 1: Structural Integrity Audit ---");
            traverse(pathValidation.data.resolvedPath, pathValidation.data.node);
            if (auditIssues.length > 0) {
                auditIssues.forEach(iss => output.push(`[STRUCTURAL ISSUE] at ${iss.path}: ${iss.issue}`));
                issues.push(...auditIssues);
            } else {
                output.push("  ✅ No structural issues found.");
            }
        };

        const ownershipAudit = async () => {
            const auditIssues = [];
            const allUsers = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
            const userSet = new Set(Object.keys(allUsers));
            userSet.add(Config.USER.DEFAULT_NAME);

            const traverse = async (path, node) => {
                if (!userSet.has(node.owner)) {
                    auditIssues.push({ type: 'ORPHANED_OWNER', path, issue: `Orphaned file: owner '${node.owner}' does not exist.`, data: { node } });
                }
                if (!GroupManager.groupExists(node.group)) {
                    auditIssues.push({ type: 'INVALID_GROUP', path, issue: `Invalid group: group '${node.group}' does not exist.`, data: { node } });
                }
                if (node.type === 'directory' && node.children) {
                    for (const childName in node.children) {
                        const childPath = FileSystemManager.getAbsolutePath(childName, path);
                        await traverse(childPath, node.children[childName]);
                    }
                }
            };
            output.push("\n--- Phase 2: Ownership and Permissions Review ---");
            await traverse(pathValidation.data.resolvedPath, pathValidation.data.node);
            if (auditIssues.length > 0) {
                auditIssues.forEach(iss => output.push(`[OWNERSHIP ISSUE] at ${iss.path}: ${iss.issue}`));
                issues.push(...auditIssues);
            } else {
                output.push("  ✅ All file ownership and groups are valid.");
            }
        };

        const homeDirectoryAudit = async () => {
            const auditIssues = [];
            const allUsers = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
            const userList = Object.keys(allUsers);
            userList.push(Config.USER.DEFAULT_NAME);

            output.push("\n--- Phase 3: User Homestead Inspection ---");
            for (const username of new Set(userList)) {
                const homePath = `/home/${username}`;
                const homeNode = FileSystemManager.getNodeByPath(homePath);
                if (!homeNode) {
                    auditIssues.push({ type: 'MISSING_HOME', path: homePath, issue: `User '${username}' is missing a home directory.`, data: { username } });
                } else if (homeNode.type !== 'directory') {
                    auditIssues.push({ type: 'INCORRECT_HOME_TYPE', path: homePath, issue: `Home path for user '${username}' is not a directory.`, data: { username, node: homeNode } });
                } else if (homeNode.owner !== username) {
                    auditIssues.push({ type: 'INCORRECT_HOME_OWNER', path: homePath, issue: `Home directory for user '${username}' is not owned by that user (owned by '${homeNode.owner}').`, data: { username, node: homeNode } });
                }
            }
            if (auditIssues.length > 0) {
                auditIssues.forEach(iss => output.push(`[HOME DIR ISSUE] at ${iss.path}: ${iss.issue}`));
                issues.push(...auditIssues);
            } else {
                output.push("  ✅ All users have a valid home directory.");
            }
        };

        const performRepairs = async () => {
            output.push("\n--- Phase 4: Interactive Repair ---");
            let quitRepair = false;
            for (const issue of issues) {
                if (quitRepair) break;

                await OutputManager.appendToOutput(`\nIssue found at '${issue.path}': ${issue.issue}`);
                let choice;
                let actionResult = { success: false, message: "No action taken." };

                const getChoice = async (prompt) => {
                    return new Promise(resolve => ModalManager.request({
                        context: 'terminal', type: 'input', messageLines: prompt,
                        onConfirm: val => resolve(val.trim().toLowerCase()),
                        onCancel: () => resolve('q'),
                        options
                    }));
                };

                switch (issue.type) {
                    case 'DANGLING_SYMLINK':
                    case 'MALFORMED_NODE':
                        choice = await getChoice(["[1] Delete node", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            const rmResult = await FileSystemManager.deleteNodeRecursive(issue.path, { force: true, currentUser: 'root' });
                            actionResult = { success: rmResult.success, message: rmResult.success ? `Deleted '${issue.path}'.` : `Failed to delete.` };
                        }
                        break;
                    case 'ORPHANED_OWNER':
                        choice = await getChoice(["[1] Reassign owner to 'root'", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.owner = 'root';
                            actionResult = { success: true, message: "Owner reassigned to 'root'." };
                        }
                        break;
                    case 'INVALID_GROUP':
                        choice = await getChoice(["[1] Reassign group to 'root'", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.group = 'root';
                            actionResult = { success: true, message: "Group reassigned to 'root'." };
                        }
                        break;
                    case 'MISSING_HOME':
                        choice = await getChoice(["[1] Create home directory", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            await FileSystemManager.createUserHomeDirectory(issue.data.username);
                            actionResult = { success: true, message: `Created '${issue.path}'.` };
                        }
                        break;
                    case 'INCORRECT_HOME_OWNER':
                        choice = await getChoice(["[1] Correct ownership", "[2] Ignore", "[q] Quit Repair"]);
                        if (choice === '1') {
                            issue.data.node.owner = issue.data.username;
                            issue.data.node.group = issue.data.username;
                            actionResult = { success: true, message: `Ownership of '${issue.path}' corrected.` };
                        }
                        break;
                    default:
                        actionResult = { success: true, message: `No automatic repair available for this issue type.` };
                        break;
                }

                await OutputManager.appendToOutput(actionResult.message, { typeClass: actionResult.success ? Config.CSS_CLASSES.SUCCESS_MSG : Config.CSS_CLASSES.ERROR_MSG });
                if(actionResult.success) changesMade = true;
                if (choice === 'q') quitRepair = true;
            }
            if (quitRepair) output.push("\nRepair process quit by user.");
        };

        await structuralAudit();
        await ownershipAudit();
        await homeDirectoryAudit();

        if (repairMode && issues.length > 0) {
            await performRepairs();
        }

        output.push("\n--- Filesystem Check Summary ---");
        if (issues.length > 0 && !repairMode) {
            output.push(`Found ${issues.length} potential issue(s).`);
            output.push("Run with the --repair flag to attempt to fix them.");
        } else if (changesMade) {
            output.push("Repairs complete. Filesystem has been modified.");
        }
        else {
            output.push("  ✅ Filesystem appears to be healthy.");
        }

        if(changesMade) {
            await FileSystemManager.save();
        }

        return ErrorHandler.createSuccess(output.join('\n'));
    }
}

window.CommandRegistry.register(new FsckCommand());
