/**
 * @file Defines the 'cksum' command, which calculates a file's checksum and byte count.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const cksumCommandDefinition = {
        commandName: "cksum",
        flagDefinitions: [],
        coreLogic: async (context) => {
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

            const processContent = (content, fileName) => {
                const checksum = crc32(content);
                const byteCount = content.length;
                if (fileName && fileName !== 'stdin') {
                    return `${checksum} ${byteCount} ${fileName}`;
                }
                return `${checksum} ${byteCount}`;
            };

            const outputLines = [];
            let hadError = false;

            for await (const item of Utils.generateInputContent(context)) {
                if (!item.success) {
                    outputLines.push(item.error);
                    hadError = true;
                    continue;
                }
                outputLines.push(processContent(item.content, item.sourceName));
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