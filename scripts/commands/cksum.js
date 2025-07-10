// Corrected File: aedmark/oopis-os-dev/Oopis-OS-DEV-d433f2298e4704d53000b05f98b059a46e2196eb/scripts/commands/cksum.js
(() => {
    "use strict";

    const cksumCommandDefinition = {
        commandName: "cksum",
        isInputStream: true, // ADDED
        flagDefinitions: [],
        coreLogic: async (context) => {
            // MODIFIED
            const {args, inputItems, inputError} = context;

            if (inputError) {
                return {success: false, error: "cksum: No readable input provided or permission denied."};
            }

            // MODIFIED
            const input = inputItems.map(item => item.content).join('\\n');

            if (input === null || input === undefined) {
                return {success: false, error: "cksum: No readable input provided."};
            }

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
                return (crc ^ -1) >>> 0;
            };

            const checksum = crc32(input);
            const byteCount = input.length;
            const fileName = inputItems.length === 1 && inputItems[0].sourceName !== 'stdin' ? `${inputItems[0].sourceName}` : '';

            return {
                success: true,
                output: `${checksum} ${byteCount}${fileName}`
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