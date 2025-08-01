// scripts/commands/xor.js

window.XorCommand = class XorCommand extends Command {
    constructor() {
        super({
            commandName: "xor",
            description: "Applies a simple XOR cipher to a file.",
            helpText: `Usage: xor <key> <inputfile> [outputfile]
      Apply a simple XOR cipher to a file.
      DESCRIPTION
      xor is a simple symmetric encryption utility that uses a repeating
      key XOR cipher. It is intended for educational/demonstration
      purposes and is NOT cryptographically secure.
      The same command and key are used for both encryption and decryption.
      If [outputfile] is not specified, the result is printed to standard output.
      WARNING
      This tool is for educational purposes ONLY. It is NOT
      cryptographically secure and should not be used to protect
      sensitive data.`,
            validations: {
                args: {
                    min: 2,
                    max: 3,
                    error: "Usage: xor <key> <inputfile> [outputfile]"
                },
                paths: [{
                    argIndex: 1,
                    options: { expectedType: 'file', permissions: ['read'] }
                }]
            },
        });
    }

    async coreLogic(context) {
        const { args, currentUser, validatedPaths, dependencies } = context;
        const { FileSystemManager, UserManager, ErrorHandler } = dependencies;

        const key = args[0];
        const inputFileNode = validatedPaths[0].node;
        const outputFile = args.length === 3 ? args[2] : null;

        const inputContent = inputFileNode.content || "";
        let outputContent = "";

        for (let i = 0; i < inputContent.length; i++) {
            const charCode = inputContent.charCodeAt(i);
            const keyCode = key.charCodeAt(i % key.length);
            outputContent += String.fromCharCode(charCode ^ keyCode);
        }

        if (outputFile) {
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            const saveResult = await FileSystemManager.createOrUpdateFile(
                outputFile,
                outputContent,
                { currentUser, primaryGroup }
            );

            if (!saveResult.success) {
                return ErrorHandler.createError(`xor: ${saveResult.error}`);
            }
            return ErrorHandler.createSuccess("", { stateModified: true });
        } else {
            return ErrorHandler.createSuccess(outputContent);
        }
    }
}

window.CommandRegistry.register(new XorCommand());
