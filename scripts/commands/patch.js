// gem/scripts/commands/patch.js

window.PatchCommand = class PatchCommand extends Command {
    constructor() {
        super({
            commandName: "patch",
            description: "Applies a diff file to a target file.",
            helpText: `Usage: patch <target_file> <patch_file>
      Applies a patch to a file.
      DESCRIPTION
      The patch command takes a patch file (usually created with the
      'diff' command) and applies the changes to a target file.
      It's a powerful tool for applying updates to text-based files
      without having to replace the entire file.
      WARNING
      This command directly modifies the target file. It is recommended
      to have a backup of the target file before applying a patch.`,
            completionType: "paths",
            validations: {
                args: {
                    exact: 2,
                    error: "Usage: patch <target_file> <patch_file>"
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        expectedType: 'file',
                        permissions: ['read', 'write']
                    }
                }, {
                    argIndex: 1,
                    options: {
                        expectedType: 'file',
                        permissions: ['read']
                    }
                }]
            },
        });
    }

    /**
     * Parses a unified diff format string into an array of hunk objects.
     * Each hunk object contains information about a specific change.
     * This is designed to be compatible with a standard patch utility.
     * @param {string} patchContent The string content of the patch file.
     * @returns {Array<Object>} An array of hunk objects.
     * @throws {Error} If the patch format is invalid.
     */

    _parsePatch(patchContent) {

        const lines = patchContent.split('\n');
        const hunks = [];
        let currentHunk = null;

        const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

        for (const line of lines) {
            if (line.startsWith('---') || line.startsWith('+++')) {
                continue;
            }

            if (line.startsWith('@@')) {
                if (currentHunk) {
                    hunks.push(currentHunk);
                }

                const match = line.match(hunkHeaderRegex);
                if (!match) {
                    throw new Error(`Invalid hunk header: ${line}`);
                }

                currentHunk = {
                    oldStart: parseInt(match[1], 10),
                    // If the line count isn't specified, it defaults to 1.
                    oldLines: match[2] ? parseInt(match[2], 10) : 1,
                    newStart: parseInt(match[3], 10),
                    newLines: match[4] ? parseInt(match[4], 10) : 1,
                    lines: [],
                };
            } else if (currentHunk) {
                if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
                    currentHunk.lines.push(line);
                }
            }
        }

        if (currentHunk) {
            hunks.push(currentHunk);
        }

        if (hunks.length === 0 && patchContent.trim() !== "") {
            throw new Error("Patch file contains no valid hunks.");
        }

        return hunks;
    }

    async coreLogic(context) {
        const { args, validatedPaths, currentUser, dependencies } = context;
        const { FileSystemManager, UserManager, ErrorHandler, PatchUtils } = dependencies;

        if (!PatchUtils || !PatchUtils.applyPatch) {
            return ErrorHandler.createError("patch: Patch utility is not available.");
        }

        const targetFileNode = validatedPaths[0].node;
        const targetFilePath = validatedPaths[0].resolvedPath;
        const patchFileNode = validatedPaths[1].node;

        const targetContent = targetFileNode.content || "";
        const patchContent = patchFileNode.content || "";

        try {
            const patchObject = this._parsePatch(patchContent);

            if (patchObject.length === 0) {
                return ErrorHandler.createSuccess(`'${args[0]}' is already up to date.`, { stateModified: false });
            }

            const patchedContent = PatchUtils.applyPatch(targetContent, patchObject);

            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            const saveResult = await FileSystemManager.createOrUpdateFile(
                targetFilePath,
                patchedContent,
                { currentUser, primaryGroup }
            );

            if (!saveResult.success) {
                return ErrorHandler.createError(`patch: ${saveResult.error}`);
            }

            return ErrorHandler.createSuccess(`Successfully patched '${args[0]}'.`, { stateModified: true });
        } catch (e) {
            return ErrorHandler.createError(`patch: Failed to apply patch. Error: ${e.message}`);
        }
    }
};

window.CommandRegistry.register(new PatchCommand());
