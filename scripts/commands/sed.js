// scripts/commands/sed.js

window.SedCommand = class SedCommand extends Command {
    constructor() {
        super({
            commandName: "sed",
            description: "Stream editor for filtering and transforming text.",
            helpText: `Usage: sed <script> [file...]
      A stream editor for text transformation.
      DESCRIPTION
      The sed (stream editor) command filters and transforms text from
      an input stream (a file or a pipe). It reads the input line by line,
      applies a script to each line, and then outputs the modified line.
      This version supports the basic substitution command:
      s/regexp/replacement/flags
      The only supported flag is 'g' for global (all occurrences on a line)
      replacement.
      EXAMPLES
      echo "hello world" | sed 's/world/OopisOS/'
      Prints "hello OopisOS".
      cat file.txt | sed 's/error/warning/g'
      Replaces all occurrences of "error" with "warning" in file.txt.`,
            isInputStream: true,
            completionType: "paths"
        });
    }

    async coreLogic(context) {
        const { args, inputItems, inputError, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (inputError) {
            return ErrorHandler.createError("sed: No readable input or permission denied.");
        }
        if (args.length === 0) {
            return ErrorHandler.createError("sed: no script specified.");
        }

        const script = args[0];
        const substitutionRegex = /^s\/(.+?)\/(.*?)\/([g]?)$/;
        const match = script.match(substitutionRegex);

        if (!match) {
            return ErrorHandler.createError(`sed: invalid script: ${script}`);
        }

        const [, pattern, replacement, flags] = match;
        const regex = new RegExp(pattern, flags);

        const content = (inputItems || []).map(item => item.content).join('\n');
        const lines = content.split('\n');
        const transformedLines = lines.map(line => line.replace(regex, replacement));

        return ErrorHandler.createSuccess(transformedLines.join('\n'));
    }
};

window.CommandRegistry.register(new SedCommand());
