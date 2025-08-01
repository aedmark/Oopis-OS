// scripts/commands/echo.js

window.EchoCommand = class EchoCommand extends Command {
    constructor() {
        super({
            commandName: "echo",
            description: "Writes arguments to the standard output.",
            helpText: `Usage: echo [-e] [STRING]...
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
      BRACE EXPANSION
      The shell supports brace expansion before passing arguments to echo:
      {a,b,c}    Comma expansion - expands to separate arguments
      {1..10}    Sequence expansion - numeric ranges
      {a..z}     Sequence expansion - alphabetic ranges
      EXAMPLES
      echo Hello, world!
      Displays "Hello, world!".
      echo -e "A line.\\nA second line."
      Displays two lines of text.
      echo "User: $USER"
      Displays the name of the current user by expanding the
      $USER environment variable.
      echo file{1,2,3}.txt
      Displays "file1.txt file2.txt file3.txt".
      echo {1..5}
      Displays "1 2 3 4 5".`,
            flagDefinitions: [{ name: "enableBackslashEscapes", short: "-e" }],
        });
    }

    async coreLogic(context) {
        const { ErrorHandler } = context.dependencies;
        let output = context.args.join(" ");
        let suppressNewline = false;

        if (context.flags.enableBackslashEscapes) {
            const cIndex = output.indexOf("\\c");
            if (cIndex !== -1) {
                output = output.substring(0, cIndex);
                suppressNewline = true;
            }

            output = output
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\\\/g, "\\");
        }

        return ErrorHandler.createSuccess(output, { suppressNewline });
    }
}

window.CommandRegistry.register(new EchoCommand());
