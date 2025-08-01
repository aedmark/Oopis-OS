// scripts/commands/explore.js

window.ExploreCommand = class ExploreCommand extends Command {
    constructor() {
        super({
            commandName: "explore",
            dependencies: [
                "apps/explorer/explorer_ui.js",
                "apps/explorer/explorer_manager.js",
            ],
            applicationModules: ["ExplorerManager", "ExplorerUI", "App"],
            description: "Opens the graphical file explorer.",
            helpText: `Usage: explore [path]
      Launches the graphical file explorer application.
      DESCRIPTION
      The explore command opens a two-pane graphical user interface for
      navigating the file system. The left pane shows a directory tree,
      and the right pane shows the contents of the selected directory.
      If an optional [path] is provided, the explorer will attempt to
      start at that location.
      Right-click on files, directories, or the pane background to access
      actions like creating, renaming, moving, and deleting items.`,
            completionType: "paths",
            validations: {
                args: {
                    max: 1,
                    error: "Usage: explore [path]"
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, options, dependencies } = context;
        const { ErrorHandler, AppLayerManager, ExplorerManager } = dependencies;

        if (!options.isInteractive) {
            return ErrorHandler.createError(
                "explore: Can only be run in an interactive session."
            );
        }

        if (
            typeof ExplorerManager === "undefined" ||
            typeof AppLayerManager === "undefined"
        ) {
            return ErrorHandler.createError(
                "explore: Explorer application module is not loaded."
            );
        }

        const startPath = args.length > 0 ? args[0] : null;

        AppLayerManager.show(new ExplorerManager(), { startPath: startPath, dependencies: dependencies });

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new ExploreCommand());
