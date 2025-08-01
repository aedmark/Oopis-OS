// scripts/commands/export.js

window.ExportCommand = class ExportCommand extends Command {
    constructor() {
        super({
            commandName: "export",
            description: "Downloads a file from OopisOS to your local machine.",
            helpText: `Usage: export <file_path>
      Download a file from OopisOS to your local machine.
      DESCRIPTION
      The export command initiates a browser download for the file
      specified by <file_path>. This allows you to save files from
      the OopisOS virtual file system onto your actual computer's
      hard drive.
      EXAMPLES
      export /home/Guest/documents/report.txt
      Triggers a download of 'report.txt' to your computer.`,
            completionType: "paths",
            validations: {
                args: {
                    exact: 1,
                    error: "expects exactly one file path."
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        expectedType: 'file',
                        permissions: ['read']
                    }
                }]
            },
        });
    }

    async coreLogic(context) {
        const { validatedPaths, dependencies } = context;
        const { Config, Utils, ErrorHandler } = dependencies;
        const { node, resolvedPath } = validatedPaths[0];

        const fileName = resolvedPath.substring(
            resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
        );

        const blob = new Blob([node.content || ""], {
            type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);

        const a = Utils.createElement("a", {
            href: url,
            download: fileName,
        });

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        return ErrorHandler.createSuccess(
            `${Config.MESSAGES.EXPORTING_PREFIX}${fileName}${Config.MESSAGES.EXPORTING_SUFFIX}`
        );
    }
}

window.CommandRegistry.register(new ExportCommand());
