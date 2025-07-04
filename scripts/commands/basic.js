/**
 * @file Defines the 'basic' command, which launches the Oopis Basic IDE.
 * @author The Engineer
 */

(() => {
    "use strict";

    const basicCommandDefinition = {
        commandName: "basic",
        argValidation: {
            max: 1,
            error: "Usage: basic [filename.bas]"
        },
        pathValidation: [{
            argIndex: 0,
            optional: true,
            options: { allowMissing: true, expectedType: 'file' }
        }],
        permissionChecks: [{
            pathArgIndex: 0,
            permissions: ["read"]
        }],
        coreLogic: async (context) => {
            const { options, validatedPaths } = context;

            if (!options.isInteractive) {
                return { success: false, error: "basic: Cannot be run in a non-interactive mode." };
            }

            // Ensure the application modules are loaded
            if (typeof BasicManager === 'undefined' || typeof BasicUI === 'undefined' || typeof BasicInterpreter === 'undefined') {
                return { success: false, error: "basic: The BASIC application modules are not loaded." };
            }

            let fileContent = null;
            let filePath = null;
            if (validatedPaths[0] && validatedPaths[0].node) {
                fileContent = validatedPaths[0].node.content;
                filePath = validatedPaths[0].resolvedPath;
            }

            // Launch the modal app. The app itself will handle the lifecycle.
            BasicManager.enter(context, { content: fileContent, path: filePath });

            // The command's job is done once the app is launched.
            return { success: true, output: "" };
        }
    };

    const description = "Launches the Oopis Basic Integrated Development Environment.";
    const helpText = `Usage: basic [filename.bas]

Launches a full-screen Integrated Development Environment for Oopis Basic.

DESCRIPTION
    Oopis Basic is a simple, line-numbered programming language integrated
    into the OS. Running 'basic' opens the IDE. If a filename is provided,
    that file will be loaded into the editor buffer.

IDE COMMANDS
    LIST          - Displays the current program in memory.
    RUN           - Executes the current program.
    SAVE "file"   - Saves the program to a file. If no filename is given,
                  saves to the file that was originally loaded.
    LOAD "file"   - Loads a program from a file.
    NEW           - Clears the current program from memory.
    EXIT          - Exits the BASIC environment.`;

    CommandRegistry.register("basic", basicCommandDefinition, description, helpText);
})();