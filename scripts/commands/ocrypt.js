/**
 * @file Defines the 'ocrypt' command, a simple symmetric XOR cipher utility.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * Performs a simple XOR cipher on data using a key.
     * @param {string} data - The input string to encrypt or decrypt.
     * @param {string} key - The password to use for the cipher.
     * @returns {string} The processed string.
     */
    function xorCipher(data, key) {
        let output = '';
        for (let i = 0; i < data.length; i++) {
            const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            output += String.fromCharCode(charCode);
        }
        return output;
    }

    /**
     * @const {object} ocryptCommandDefinition
     * @description The command definition for the 'ocrypt' command.
     */
    const ocryptCommandDefinition = {
        commandName: "ocrypt",
        flagDefinitions: [
            { name: "decode", short: "-d", long: "--decode" }
        ],
        // Usage: ocrypt [password] [file]
        // We will handle argument logic internally due to the optional nature
        // of the file and the required (but prompted) nature of the password.
        coreLogic: async (context) => {
            const { args, flags, options, currentUser } = context;

            let inputData = "";
            let password = null;
            let filePath = null;

            // Determine input source and password from arguments
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

            // Handle file input
            if (filePath) {
                const pathValidation = FileSystemManager.validatePath("ocrypt", filePath, { expectedType: 'file' });
                if (pathValidation.error) {
                    return { success: false, error: pathValidation.error };
                }
                if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                    return { success: false, error: `ocrypt: cannot read '${filePath}': Permission denied` };
                }
                inputData = pathValidation.node.content || "";
            } else if (options.stdinContent !== null) {
                inputData = options.stdinContent;
            } else {
                return { success: false, error: "ocrypt: requires data from a file or standard input" };
            }

            // Prompt for password if not provided
            if (password === null) {
                password = await new Promise(resolve => {
                    ModalInputManager.requestInput(
                        "Enter password for ocrypt:",
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
                return { success: false, error: "ocrypt: password cannot be empty." };
            }

            // The XOR operation is symmetrical, so the same function is used for encrypting and decrypting.
            const processedData = xorCipher(inputData, password);
            return { success: true, output: processedData };
        }
    };

    const ocryptDescription = "Simple symmetric encryption/decryption using a password.";
    const ocryptHelpText = `Usage: ocrypt [password] [FILE]
       cat [FILE] | ocrypt [password]

Encrypt or decrypt data using a simple password-based XOR cipher.

DESCRIPTION
       ocrypt transforms data read from a FILE or standard input using a
       symmetric XOR cipher with the provided password as the key. The same
       command and password are used for both encryption and decryption.

       If a password is not provided as an argument, you will be prompted
       to enter one interactively.

       WARNING: This utility is for educational purposes and basic data
       obscurity. It is NOT a cryptographically secure encryption method
       and should not be used to protect sensitive data.

OPTIONS
       -d, --decode
              This flag is included for conceptual compatibility with other
              tools like 'base64'. Since the XOR cipher is symmetrical, this
              flag has no effect on the operation but can be used for clarity
              in scripts.

PIPELINE SECURITY
       For enhanced security, 'ocrypt' is best used in a pipeline with 'base64'
       to make the encrypted binary output safe for text-based storage and transfer.

       Encrypt: cat secret.txt | ocrypt "my-pass" | base64 > safe.txt
       Decrypt: cat safe.txt | base64 -d | ocrypt "my-pass" > secret.txt`;

    CommandRegistry.register("ocrypt", ocryptCommandDefinition, ocryptDescription, ocryptHelpText);
})();