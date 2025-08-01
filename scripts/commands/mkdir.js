// scripts/commands/mkdir.js

window.MkdirCommand = class MkdirCommand extends Command {
  constructor() {
    super({
      commandName: "mkdir",
      description: "Creates one or more new directories.",
      helpText: `Usage: mkdir [OPTION]... <DIRECTORY>...
      Create the DIRECTORY(ies), if they do not already exist.
      DESCRIPTION
      The mkdir command creates one or more new directories with the
      specified names.
      OPTIONS
      -p, --parents
      Create parent directories as needed. If this option is not
      specified, the full path prefix of each operand must already
      exist.
      BRACE EXPANSION
      The shell supports brace expansion before passing arguments to mkdir:
      {a,b,c}    Comma expansion - creates multiple directories
      {1..10}    Sequence expansion - numeric ranges
      {a..z}     Sequence expansion - alphabetic ranges
      EXAMPLES
      mkdir documents
      Creates a new directory named 'documents' in the current
      directory.
      mkdir -p projects/assets/images
      Creates the 'projects', 'assets', and 'images' directories
      if they do not already exist.
      mkdir {dir1,dir2,dir3}
      Creates three directories: dir1, dir2, and dir3.
      mkdir test{1..5}
      Creates five directories: test1, test2, test3, test4, test5.`,
      completionType: "paths",
      flagDefinitions: [
        {
          name: "parents",
          short: "-p",
          long: "--parents",
        },
      ],
      validations: {
        args: { min: 1 }
      },
    });
  }

  async coreLogic(context) {
    const { args, flags, currentUser, dependencies } = context;
    const { UserManager, FileSystemManager, ErrorHandler } = dependencies;
    let allSuccess = true;
    const messages = [];
    let changesMade = false;
    const nowISO = new Date().toISOString();

    const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
    if (!primaryGroup) {
      return ErrorHandler.createError(
          `mkdir: critical - could not determine primary group for user '${currentUser}'`
      );
    }

    for (const pathArg of args) {
      const resolvedPath = FileSystemManager.getAbsolutePath(pathArg);
      const dirName = resolvedPath.substring(
          resolvedPath.lastIndexOf("/") + 1
      );

      if (
          resolvedPath === "/" ||
          dirName === "" ||
          dirName === "." ||
          dirName === ".."
      ) {
        messages.push(
            `mkdir: cannot create directory '${pathArg}': Invalid path or name`
        );
        allSuccess = false;
        continue;
      }

      const parentPathForTarget =
          resolvedPath.substring(0, resolvedPath.lastIndexOf("/")) || "/";
      let parentNodeToCreateIn;

      if (flags.parents) {
        const parentDirResult =
            FileSystemManager.createParentDirectoriesIfNeeded(resolvedPath);
        if (!parentDirResult.success) {
          messages.push(`mkdir: ${parentDirResult.error}`);
          allSuccess = false;
          continue;
        }
        parentNodeToCreateIn = parentDirResult.data;
      } else {
        const parentValidationResult = FileSystemManager.validatePath(
            parentPathForTarget,
            { expectedType: "directory", permissions: ["write"] }
        );
        if (!parentValidationResult.success) {
          messages.push(
              `mkdir: cannot create directory '${pathArg}': ${parentValidationResult.error.replace(parentPathForTarget + ":", "").trim()}`
          );
          allSuccess = false;
          continue;
        }
        parentNodeToCreateIn = parentValidationResult.data.node;
      }

      if (
          parentNodeToCreateIn.children &&
          parentNodeToCreateIn.children[dirName]
      ) {
        const existingItem = parentNodeToCreateIn.children[dirName];
        if (existingItem.type === "file") {
          messages.push(
              `mkdir: cannot create directory '${pathArg}': File exists`
          );
          allSuccess = false;
        } else if (existingItem.type === "directory" && !flags.parents) {
        }
      } else {
        parentNodeToCreateIn.children[dirName] =
            FileSystemManager._createNewDirectoryNode(
                currentUser,
                primaryGroup
            );
        parentNodeToCreateIn.mtime = nowISO;
        changesMade = true;
      }
    }

    if (!allSuccess) {
      return ErrorHandler.createError(messages.join("\n"));
    }
    return ErrorHandler.createSuccess("", { stateModified: changesMade });
  }
}

window.CommandRegistry.register(new MkdirCommand());
