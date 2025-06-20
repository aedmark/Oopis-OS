/**
 * @file Defines the 'echo' command, which prints arguments to the standard output.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} echoCommandDefinition
     * @description The command definition for the 'echo' command.
     * This object specifies the command's name and its core logic for
     * outputting provided arguments.
     */
    const echoCommandDefinition = {
        commandName: "echo",
        // No argValidation needed as 'echo' accepts any number of arguments.
        coreLogic: async (context) => {
            // Join all provided arguments with a space and return as output.
            return {
                success: true,
                output: context.args.join(" "),
            };
        },
    };

    const echoDescription = "Writes arguments to the standard output.";

    const echoHelpText = `Usage: echo [STRING]...

Write arguments to the standard output.

DESCRIPTION
       The echo utility writes its arguments separated by spaces,
       terminated by a newline, to the standard output.

       It is commonly used in shell scripts to display messages or used
       with redirection operators ('>' or '>>') to write text into files.
       The shell will expand environment variables (like $USER) before
       they are passed to echo.

EXAMPLES
       echo Hello, world!
              Displays "Hello, world!".

       echo "This is a sentence." > new_file.txt
              Creates a new file named 'new_file.txt' containing the
              text "This is a sentence.".

       echo "User: $USER"
              Displays the name of the current user by expanding the
              $USER environment variable.`;

    // Register the command with the CommandRegistry.
    CommandRegistry.register("echo", echoCommandDefinition, echoDescription, echoHelpText);
})();