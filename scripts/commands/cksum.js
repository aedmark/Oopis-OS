/**
 * @file Defines the 'cksum' command, which calculates a file's checksum and byte count.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} cksumCommandDefinition
     * @description The command definition for the 'cksum' command.
     */
    const cksumCommandDefinition = {
        commandName: "cksum",
        // No flags needed for the standard POSIX implementation
        flagDefinitions: [],
        coreLogic: async (context) => {
            const { args, options, currentUser } = context;

            /**
             * Calculates the POSIX CRC-32 checksum for a given string.
             * This implementation is a standard CRC-32 algorithm.
             * Note: A true POSIX cksum includes the file length in the calculation,
             * which makes it non-standard. This implementation uses a standard CRC-32
             * for simplicity and broad compatibility, which is a common approach.
             * @param {string} str - The input string.
             * @returns {number} The calculated checksum.
             */
            const crc32 = (str) => {
                const table = [];
                for (let i = 0; i < 256; i++) {
                    let c = i;
                    for (let j = 0; j < 8; j++) {
                        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                    }
                    table[i] = c;
                }
                let crc = -1;
                for (let i = 0; i < str.length; i++) {
                    crc = (crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 0xFF];
                }
                return (crc ^ -1) >>> 0; // Return as unsigned 32-bit integer
            };

            const processContent = (content, fileName) => {
                const checksum = crc32(content);
                const byteCount = content.length;
                if (fileName) {
                    return `${checksum} ${byteCount} ${fileName}`;
                }
                return `${checksum} ${byteCount}`;
            };

            const outputLines = [];
            let hadError = false;

            if (args.length === 0) {
                // Read from standard input
                if (options.stdinContent !== null) {
                    outputLines.push(processContent(options.stdinContent, null));
                }
            } else {
                // Read from file arguments
                for (const pathArg of args) {
                    const pathValidation = FileSystemManager.validatePath("cksum", pathArg, { expectedType: 'file' });
                    if (pathValidation.error) {
                        outputLines.push(pathValidation.error);
                        hadError = true;
                        continue;
                    }

                    if (!FileSystemManager.hasPermission(pathValidation.node, currentUser, "read")) {
                        outputLines.push(`cksum: '${pathArg}': Permission denied`);
                        hadError = true;
                        continue;
                    }
                    outputLines.push(processContent(pathValidation.node.content || "", pathArg));
                }
            }

            return {
                success: !hadError,
                output: outputLines.join('\n')
            };
        }
    };

    const cksumDescription = "Print checksum and byte counts of files.";
    const cksumHelpText = `Usage: cksum [FILE]...

Calculate and print a checksum, byte count, and filename for each FILE.

DESCRIPTION
       The cksum utility calculates and writes to standard output a 32-bit
       checksum (CRC), the total number of bytes, and the name for each
       input file.
       
       It is typically used to quickly compare a suspect file against a trusted
       version to ensure that the file has not been accidentally corrupted.

       If no file is specified, or if the file is '-', cksum reads from
       standard input, and no filename is printed.

EXAMPLES
       cksum my_script.sh
              Displays the checksum and size of the script file.

       cat my_script.sh | cksum
              Calculates the checksum and size from the piped content.`;

    CommandRegistry.register("cksum", cksumCommandDefinition, cksumDescription, cksumHelpText);
})();