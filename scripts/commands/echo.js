(() => {
    "use strict";

    const echoCommandDefinition = {
        commandName: "echo",
        flagDefinitions: [
            {name: "enableBackslashEscapes", short: "-e"}
        ],
        coreLogic: async (context) => {
            let output = context.args.join(" ");

            if (context.flags.enableBackslashEscapes) {
                // Interpret backslash escapes
                output = output.replace(/\\n/g, '\n')
                    .replace(/\\t/g, '\t')
                    .replace(/\\c/g, '') // Used to stop further output
                    .replace(/\\\\/g, '\\');
            }

            // Handle the \c sequence, which suppresses the trailing newline and further output.
            const parts = output.split('\\c');
            const finalOutput = parts[0];

            return {
                success: true,
                output: finalOutput,
            };
        },
    };

    const echoDescription = "Writes arguments to the standard output.";

    const echoHelpText = `Usage: echo [-e] [STRING]...

Write arguments to the standard output.

DESCRIPTION
       The echo utility writes its arguments separated by spaces,
       terminated by a newline, to the standard output.

OPTIONS
       -e     Enable interpretation of backslash escapes.

ESCAPES
       If -e is in effect, the following sequences are recognized:
       \\\\     backslash
       \\n     new line
       \\t     horizontal tab
       \\c     produce no further output (the trailing newline is suppressed)

EXAMPLES
       echo Hello, world!
              Displays "Hello, world!".

       echo -e "A line.\\nA second line."
              Displays two lines of text.

       echo "User: $USER"
              Displays the name of the current user by expanding the
              $USER environment variable.`;

    CommandRegistry.register("echo", echoCommandDefinition, echoDescription, echoHelpText);
})();