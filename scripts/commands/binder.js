// gem/scripts/commands/binder.js

window.BinderCommand = class BinderCommand extends Command {
    constructor() {
        super({
            commandName: "binder",
            description: "Creates and manages file collections for projects.",
            helpText: `Usage: binder <sub-command> [options]
      Manages project binders, which are manifest files (.binder) that group related files and directories together regardless of their location in the filesystem.

      SUB-COMMANDS:
        create <name>              Creates a new, empty binder file named '<name>.binder'.
        add <binder> <path>        Adds a file or directory path to a binder.
        list <binder>              Lists the contents of a binder, organized by section.
        remove <binder> <path>     Removes a file path from a binder's manifest.
        exec <binder> -- <cmd>     Executes a command for each file in the binder. Use {} as a placeholder for the file path.

      'add' OPTIONS:
        -s, --section <name>       Specifies the section to add the path to. Defaults to 'general'.

      EXAMPLES:
        binder create my_project
        binder add my_project.binder /home/Guest/docs/README.md -s documentation
        binder list my_project.binder
        binder exec my_project.binder -- cksum {}`,
            flagDefinitions: [
                { name: "section", short: "-s", long: "--section", takesValue: true }
            ]
        });
    }

    async coreLogic(context) {
        const { args, dependencies } = context;
        const { ErrorHandler } = dependencies;
        const subCommand = args[0];

        if (!subCommand) {
            return ErrorHandler.createError("binder: missing sub-command. See 'help binder'.");
        }

        switch (subCommand.toLowerCase()) {
            case "create":
                return this._handleCreate(context);
            case "add":
                return this._handleAdd(context);
            case "list":
                return this._handleList(context);
            case "remove":
                return this._handleRemove(context);
            case "exec":
                return this._handleExec(context);
            default:
                return ErrorHandler.createError(`binder: unknown sub-command '${subCommand}'.`);
        }
    }

    async _handleCreate(context) {
        const { args, currentUser, dependencies } = context;
        const { FileSystemManager, UserManager, ErrorHandler } = dependencies;

        if (args.length !== 2) {
            return ErrorHandler.createError("Usage: binder create <binder_name>");
        }

        let binderName = args[1];
        if (!binderName.endsWith('.binder')) {
            binderName += '.binder';
        }

        const absPath = FileSystemManager.getAbsolutePath(binderName);
        const existingNode = FileSystemManager.getNodeByPath(absPath);

        if (existingNode) {
            return ErrorHandler.createError(`binder: file '${binderName}' already exists.`);
        }

        const initialContent = {
            name: args[1].replace('.binder', ''),
            description: "A collection of related files for this project.",
            sections: {
                general: []
            }
        };

        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            absPath,
            JSON.stringify(initialContent, null, 2),
            { currentUser, primaryGroup }
        );

        if (saveResult.success) {
            await FileSystemManager.save();
            return ErrorHandler.createSuccess(`Binder '${binderName}' created successfully.`, { stateModified: true });
        } else {
            return ErrorHandler.createError(`binder: ${saveResult.error}`);
        }
    }

    async _handleAdd(context) {
        const { args, flags, currentUser, dependencies } = context;
        const { FileSystemManager, UserManager, ErrorHandler } = dependencies;

        if (args.length !== 3) {
            return ErrorHandler.createError("Usage: binder add <binder_file> <path_to_add>");
        }

        const binderPath = args[1];
        const pathToAdd = args[2];
        const section = flags.section || 'general';

        const binderValidation = FileSystemManager.validatePath(binderPath, { expectedType: 'file', permissions: ['read', 'write'] });
        if (!binderValidation.success) {
            return ErrorHandler.createError(`binder: ${binderValidation.error}`);
        }

        const pathToAddValidation = FileSystemManager.validatePath(pathToAdd, { allowMissing: false });
        if (!pathToAddValidation.success) {
            return ErrorHandler.createError(`binder: cannot add path '${pathToAdd}': ${pathToAddValidation.error}`);
        }

        const absPathToAdd = pathToAddValidation.data.resolvedPath;
        const binderNode = binderValidation.data.node;
        let binderData;

        try {
            binderData = JSON.parse(binderNode.content || '{}');
        } catch (e) {
            return ErrorHandler.createError(`binder: could not parse '${binderPath}'. Is it a valid binder file?`);
        }

        binderData.sections = binderData.sections || {};
        binderData.sections[section] = binderData.sections[section] || [];

        if (binderData.sections[section].includes(absPathToAdd)) {
            return ErrorHandler.createSuccess(`Path '${pathToAdd}' is already in the '${section}' section.`);
        }

        binderData.sections[section].push(absPathToAdd);
        binderData.sections[section].sort();

        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            binderValidation.data.resolvedPath,
            JSON.stringify(binderData, null, 2),
            { currentUser, primaryGroup }
        );

        if (saveResult.success) {
            await FileSystemManager.save();
            return ErrorHandler.createSuccess(`Added '${pathToAdd}' to the '${section}' section of '${binderPath}'.`, { stateModified: true });
        } else {
            return ErrorHandler.createError(`binder: ${saveResult.error}`);
        }
    }

    async _handleList(context) {
        const { args, dependencies } = context;
        const { FileSystemManager, ErrorHandler } = dependencies;

        if (args.length !== 2) {
            return ErrorHandler.createError("Usage: binder list <binder_file>");
        }

        const binderPath = args[1];
        const binderValidation = FileSystemManager.validatePath(binderPath, { expectedType: 'file', permissions: ['read'] });
        if (!binderValidation.success) {
            return ErrorHandler.createError(`binder: ${binderValidation.error}`);
        }

        let binderData;
        try {
            binderData = JSON.parse(binderValidation.data.node.content || '{}');
        } catch (e) {
            return ErrorHandler.createError(`binder: could not parse '${binderPath}'. Invalid format.`);
        }

        const output = [];
        output.push(`Binder: ${binderData.name || 'Untitled'}`);
        if (binderData.description) {
            output.push(`Description: ${binderData.description}`);
        }
        output.push('---');

        if (!binderData.sections || Object.keys(binderData.sections).length === 0) {
            output.push("(This binder is empty)");
        } else {
            for (const section in binderData.sections) {
                output.push(`[${section}]`);
                const paths = binderData.sections[section];
                if (paths.length === 0) {
                    output.push("  (empty section)");
                } else {
                    paths.forEach(path => {
                        const node = FileSystemManager.getNodeByPath(path);
                        const status = node ? '' : ' [MISSING]';
                        output.push(`  - ${path}${status}`);
                    });
                }
            }
        }

        return ErrorHandler.createSuccess(output.join('\n'));
    }

    async _handleRemove(context) {
        const { args, currentUser, dependencies } = context;
        const { FileSystemManager, UserManager, ErrorHandler } = dependencies;

        if (args.length !== 3) {
            return ErrorHandler.createError("Usage: binder remove <binder_file> <path_to_remove>");
        }

        const binderPath = args[1];
        const pathToRemove = args[2];

        const binderValidation = FileSystemManager.validatePath(binderPath, { expectedType: 'file', permissions: ['read', 'write'] });
        if (!binderValidation.success) {
            return ErrorHandler.createError(`binder: ${binderValidation.error}`);
        }

        const absPathToRemove = FileSystemManager.getAbsolutePath(pathToRemove);
        const binderNode = binderValidation.data.node;
        let binderData;

        try {
            binderData = JSON.parse(binderNode.content || '{}');
        } catch (e) {
            return ErrorHandler.createError(`binder: could not parse '${binderPath}'. Invalid format.`);
        }

        let removed = false;
        if (binderData.sections) {
            for (const section in binderData.sections) {
                const index = binderData.sections[section].indexOf(absPathToRemove);
                if (index > -1) {
                    binderData.sections[section].splice(index, 1);
                    removed = true;
                    if (binderData.sections[section].length === 0) {
                        delete binderData.sections[section];
                    }
                    break;
                }
            }
        }

        if (!removed) {
            return ErrorHandler.createSuccess(`Path '${pathToRemove}' not found in binder.`);
        }

        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(
            binderValidation.data.resolvedPath,
            JSON.stringify(binderData, null, 2),
            { currentUser, primaryGroup }
        );

        if (saveResult.success) {
            await FileSystemManager.save();
            return ErrorHandler.createSuccess(`Removed '${pathToRemove}' from '${binderPath}'.`, { stateModified: true });
        } else {
            return ErrorHandler.createError(`binder: ${saveResult.error}`);
        }
    }

    async _handleExec(context) {
        const { args, dependencies } = context;
        const { FileSystemManager, CommandExecutor, ErrorHandler, OutputManager, Config } = dependencies;

        const separatorIndex = args.indexOf('--');
        if (separatorIndex === -1 || separatorIndex < 2) {
            return ErrorHandler.createError("Usage: binder exec <binder_file> -- <command>");
        }

        const binderPath = args[1];
        const commandParts = args.slice(separatorIndex + 1);

        if (commandParts.length === 0) {
            return ErrorHandler.createError("binder: missing command for 'exec'");
        }

        const binderValidation = FileSystemManager.validatePath(binderPath, { expectedType: 'file', permissions: ['read'] });
        if (!binderValidation.success) {
            return ErrorHandler.createError(`binder: ${binderValidation.error}`);
        }

        let binderData;
        try {
            binderData = JSON.parse(binderValidation.data.node.content || '{}');
        } catch (e) {
            return ErrorHandler.createError(`binder: could not parse '${binderPath}'. Invalid format.`);
        }

        const allPaths = Object.values(binderData.sections || {}).flat();
        if (allPaths.length === 0) {
            return ErrorHandler.createSuccess("Binder is empty, nothing to execute.");
        }

        for (const path of allPaths) {
            const node = FileSystemManager.getNodeByPath(path);
            if (!node) {
                await OutputManager.appendToOutput(`binder: skipping missing file: ${path}`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
                continue;
            }

            const commandString = commandParts
                .map(part => (part === '{}' ? `"${path}"` : part))
                .join(' ');

            const result = await CommandExecutor.processSingleCommand(commandString, { isInteractive: false });
            if (!result.success) {
                return ErrorHandler.createError(`binder: command failed for '${path}': ${result.error}`);
            }
        }

        return ErrorHandler.createSuccess("Binder 'exec' completed.");
    }
};

window.CommandRegistry.register(new BinderCommand());
