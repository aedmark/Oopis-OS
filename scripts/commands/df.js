// scripts/commands/df.js

window.DfCommand = class DfCommand extends Command {
    constructor() {
        super({
            commandName: "df",
            description: "Reports file system disk space usage.",
            helpText: `Usage: df [OPTION]...
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
      Displays the disk usage in a human-readable format.`,
            flagDefinitions: [
                { name: "humanReadable", short: "-h", long: "--human-readable" },
            ],
            validations: {
                args: {
                    max: 0
                }
            },
        });
    }

    async coreLogic(context) {
        const { flags, dependencies } = context;
        const { Config, FileSystemManager, Utils, ErrorHandler } = dependencies;

        const totalSize = Config.FILESYSTEM.MAX_VFS_SIZE;
        const rootNode = FileSystemManager.getNodeByPath("/");
        const usedSize = FileSystemManager.calculateNodeSize(rootNode);
        const availableSize = totalSize - usedSize;
        const usePercentage =
            totalSize > 0 ? Math.round((usedSize / totalSize) * 100) : 0;

        const format = flags.humanReadable
            ? Utils.formatBytes
            : (bytes) => bytes;

        const header =
            "Filesystem      Size      Used     Avail   Use%  Mounted on";
        const separator =
            "----------  --------  --------  --------  ----  ----------";
        const data = [
            "OopisVFS".padEnd(10),
            String(format(totalSize)).padStart(8),
            String(format(usedSize)).padStart(8),
            String(format(availableSize)).padStart(8),
            `${usePercentage}%`.padStart(4),
            "/".padEnd(10),
        ].join("  ");

        const output = [header, separator, data].join("\n");

        return ErrorHandler.createSuccess(output);
    }
}

window.CommandRegistry.register(new DfCommand());