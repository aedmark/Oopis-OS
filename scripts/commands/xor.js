/*
    Xor's purpose is purely educational, demonstrating a simple XOR cipher.
    It provides no real security (but someday it might!)
*/

(() => {
    "use strict";

    function xorCipher(data, key) {
        let output = '';
        for (let i = 0; i < data.length; i++) {
            const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            output += String.fromCharCode(charCode);
        }
        return output;
    }

    const xorCommandDefinition = {
        commandName: "xor",
        coreLogic: async (context) => {
            const { args, options, currentUser } = context;

            let inputData = "";
            let password = null;
            let filePath = null;

            if (args.length === 2) {
                password = args[0];
                filePath = args[1];
            } else if (args.length === 1) {
                if (options.stdinContent !== null) {
                    password = args[0];
                } else {
                    filePath = args[0];
                }
            }

            if (filePath) {
                const pathValidation = FileSystemManager.validatePath("xor", filePath, { expectedType: 'file' });
                if (pathValidation.error) {
                    return { success: false, error: pathValidation.error };
                }
                if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                    return { success: false, error: `xor: cannot read '${filePath}': Permission denied` };
                }
                inputData = pathValidation.node.content || "";
            } else if (options.stdinContent !== null) {
                inputData = options.stdinContent;
            } else {
                return { success: false, error: "xor: requires data from a file or standard input" };
            }

            if (password === null) {
                if (!options.isInteractive) {
                    return { success: false, error: "xor: password must be provided as an argument in non-interactive mode." };
                }
                password = await new Promise(resolve => {
                    ModalInputManager.requestInput(
                        "Enter password for xor:",
                        (pw) => resolve(pw),
                        () => resolve(null),
                        true // Obscured input
                    );
                });

                if (password === null) {
                    return { success: true, output: "Operation cancelled." };
                }
            }

            if (!password) {
                return { success: false, error: "xor: password cannot be empty." };
            }

            const processedData = xorCipher(inputData, password);
            return { success: true, output: processedData };
        }
    };

    const xorDescription = "Simple symmetric XOR cipher for data obfuscation (educational).";
    const xorHelpText = `Usage: xor [password] [FILE]
       cat [FILE] | xor [password]

Obfuscate data using a simple password-based XOR cipher.

DESCRIPTION
       xor transforms data from a FILE or standard input using a symmetric
       XOR cipher. The same command and password are used for both obfuscation
       and reversal.

       WARNING: This utility is for educational purposes only. It provides
       NO REAL SECURITY and should not be used to protect sensitive data.

PIPELINE SECURITY
       For enhanced security, use the new 'ocrypt' command which implements
       strong, modern encryption. 'xor' can be combined with 'base64' to make
       its binary output safe for text-based storage.

       Obfuscate: cat secret.txt | xor "my-pass" | base64 > safe.txt
       De-obfuscate: cat safe.txt | base64 -d | xor "my-pass" > secret.txt`;

    CommandRegistry.register(xorCommandDefinition.commandName, xorCommandDefinition, xorDescription, xorHelpText);
})();