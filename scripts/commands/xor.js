// scripts/commands/xor.js
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
        isInputStream: true,
        completionType: "paths", // Preserved for tab completion
        firstFileArgIndex: 1, // The first arg is the password
        coreLogic: async (context) => {
            const { args, options, inputItems, inputError } = context;

            try {
                if (inputError) {
                    return { success: false, error: "xor: No readable input provided or permission denied." };
                }

                if (!inputItems || inputItems.length === 0) {
                    return { success: true, output: "" };
                }

                const inputData = inputItems.map(item => item.content).join('\\n');

                let password = args[0];

                if (password === null || password === undefined) {
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
            } catch (e) {
                return { success: false, error: `xor: An unexpected error occurred: ${e.message}` };
            }
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