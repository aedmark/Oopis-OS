(() => {
    "use strict";

    const duCommandDefinition = {
        commandName: "du",
        flagDefinitions: [
            { name: "humanReadable", short: "-h", long: "--human-readable" },
            { name: "summarize", short: "-s", long: "--summarize" },
        ],
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;
            const paths = args.length > 0 ? args : ['.'];
            const outputLines = [];
            let hadError = false;

            const formatSize = (size) => {
                return flags.humanReadable ? Utils.formatBytes(size, 1) : size;
            };

            for (const pathArg of paths) {
                const pathValidation = FileSystemManager.validatePath("du", pathArg);
                if (pathValidation.error) {
                    outputLines.push(pathValidation.error);
                    hadError = true;
                    continue;
                }
                const startNode = pathValidation.node;

                if (!FileSystemManager.hasPermission(startNode, currentUser, "read")) {
                    outputLines.push(`du: cannot read directory '${pathArg}': Permission denied`);
                    hadError = true;
                    continue;
                }

                if (flags.summarize) {
                    const totalSize = FileSystemManager.calculateNodeSize(startNode);
                    outputLines.push(`${formatSize(totalSize)}\t${pathArg}`);
                } else {
                    const entries = [];
                    const recurse = (node, path) => {
                        if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
                            if (FileSystemManager.hasPermission(node, currentUser, "read")) {
                                Object.keys(node.children).forEach(name => {
                                    recurse(node.children[name], `${path === '/' ? '' : path}/${name}`);
                                });
                            }
                        }
                        const size = FileSystemManager.calculateNodeSize(node);
                        entries.push({ size, path });
                    };

                    recurse(startNode, pathArg);
                    entries.forEach(entry => {
                        outputLines.push(`${formatSize(entry.size)}\t${entry.path}`);
                    });
                }
            }

            return {
                success: !hadError,
                output: outputLines.join('\n')
            };
        }
    };

    const duDescription = "Estimates file and directory space usage.";
    const duHelpText = `Usage: du [OPTION]... [FILE]...

Summarize disk usage of the set of FILEs, recursively for directories.

DESCRIPTION
       The du command displays the disk usage of files and directories.

OPTIONS
       -h, --human-readable
              Print sizes in human-readable format (e.g., 1K, 234M, 2G).
       -s, --summarize
              Display only a total for each argument.

EXAMPLES
       du /home/Guest
              Displays the size of each file and subdirectory within
              the Guest user's home, plus a total.

       du -sh /home/Guest/docs
              Displays a single, human-readable total size for the
              docs directory.`;

    CommandRegistry.register("du", duCommandDefinition, duDescription, duHelpText);
})();