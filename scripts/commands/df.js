/**
 * @file Defines the 'df' (disk free) command for OopisOS.
 * It reports the virtual file system's disk space usage.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const dfCommandDefinition = {
        commandName: "df",
        flagDefinitions: [
            { name: "humanReadable", short: "-h", long: "--human-readable" },
        ],
        argValidation: {
            max: 0, // df doesn't take path arguments in this implementation
        },
        coreLogic: async (context) => {
            const { flags } = context;

            const totalSize = Config.FILESYSTEM.MAX_VFS_SIZE;
            const rootNode = FileSystemManager.getNodeByPath('/');
            const usedSize = FileSystemManager.calculateNodeSize(rootNode);
            const availableSize = totalSize - usedSize;
            const usePercentage = totalSize > 0 ? Math.round((usedSize / totalSize) * 100) : 0;

            const format = flags.humanReadable ? Utils.formatBytes : (bytes) => bytes;

            const header = "Filesystem      Size      Used     Avail   Use%  Mounted on";
            const separator = "----------  --------  --------  --------  ----  ----------";
            const data = [
                "OopisVFS".padEnd(10),
                String(format(totalSize)).padStart(8),
                String(format(usedSize)).padStart(8),
                String(format(availableSize)).padStart(8),
                `${usePercentage}%`.padStart(4),
                "/".padEnd(10)
            ].join("  ");

            const output = [header, separator, data].join('\n');

            return { success: true, output: output };
        }
    };

    const dfDescription = "Reports file system disk space usage.";
    const dfHelpText = `Usage: df [OPTION]...

Show information about the file system on which each specified FILE resides,
or all file systems by default.

DESCRIPTION
       The df command displays the total amount of available disk space
       for the OopisOS virtual file system.

OPTIONS
       -h, --human-readable
              Print sizes in powers of 1024 (e.g., 1023M).

EXAMPLES
       df
              Displays the disk usage in bytes.

       df -h
              Displays the disk usage in a human-readable format.`;

    CommandRegistry.register("df", dfCommandDefinition, dfDescription, dfHelpText);
})();