// scripts/commands/rmdir.js

window.RmdirCommand = class RmdirCommand extends Command {
  constructor() {
    super({
      commandName: "rmdir",
      description: "Removes empty directories.",
      helpText: `Usage: rmdir <directory>...
      Remove empty directories.
      DESCRIPTION
      The rmdir command removes one or more empty directories.
      If a specified directory is not empty, the command will fail
      for that operand.
      To remove non-empty directories and their contents, use the
      'rm -r' command instead.
      EXAMPLES
      rmdir old_project
      Removes the 'old_project' directory, but only if it is empty.`,
      completionType: "paths",
      validations: {
        args: {
          min: 1,
          error: "missing operand"
        },
        paths: [{
          argIndex: 'all',
          options: {
            expectedType: 'directory',
            ownershipRequired: true
          },
        }, ],
      },
    });
  }

  async coreLogic(context) {
    const { validatedPaths, dependencies } = context;
    const { FileSystemManager, ErrorHandler } = dependencies;
    let allSuccess = true;
    let anyChangeMade = false;
    const errorMessages = [];

    for (const pathData of validatedPaths) {
      const { node, resolvedPath } = pathData;

      if (Object.keys(node.children).length > 0) {
        errorMessages.push(
            `rmdir: failed to remove '${pathData.arg}': Directory not empty`
        );
        allSuccess = false;
        continue;
      }

      const parentPath = resolvedPath.substring(
          0,
          resolvedPath.lastIndexOf("/")
      );
      const dirName = resolvedPath.substring(
          resolvedPath.lastIndexOf("/") + 1
      );
      const parentNode = FileSystemManager.getNodeByPath(parentPath);

      if (parentNode && parentNode.children[dirName]) {
        delete parentNode.children[dirName];
        parentNode.mtime = new Date().toISOString();
        anyChangeMade = true;
      } else {
        errorMessages.push(
            `rmdir: failed to remove '${pathData.arg}': Directory not found in parent`
        );
        allSuccess = false;
      }
    }

    if (!allSuccess) {
      return ErrorHandler.createError(errorMessages.join("\n"));
    }
    return ErrorHandler.createSuccess("", { stateModified: anyChangeMade });
  }
}

window.CommandRegistry.register(new RmdirCommand());
