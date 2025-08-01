// scripts/commands/printscreen.js

window.PrintscreenCommand = class PrintscreenCommand extends Command {
    constructor() {
        super({
            commandName: "printscreen",
            description: "Captures the screen content as an image or text.",
            helpText: `Usage: printscreen [output_file]
      Capture a screenshot of the current OopisOS screen.
      DESCRIPTION
      The printscreen command captures the visible content of the terminal.
      It has two modes:
      - Image Mode (default, interactive): Generates a PNG image of the
        terminal and initiates a browser download. This uses the html2canvas
        library to render the DOM.
      - Text Dump Mode (non-interactive): If an [output_file] is specified,
        it dumps the visible text content of the terminal to that file. This
        is primarily used for automated testing.
      NOTE: Image capture may not work on all browsers due to varying
      support for the necessary rendering technologies.`,
            validations: {
                args: {
                    max: 1
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, options, currentUser, dependencies } = context;
        const { Utils, OutputManager, ErrorHandler, Config, FileSystemManager, UserManager } = dependencies;
        const outputFilename = args[0];

        if (!options.isInteractive || outputFilename) {
            if (!outputFilename) {
                return ErrorHandler.createError("printscreen: output file is required in non-interactive mode.");
            }
            const terminalElement = document.getElementById("terminal");
            const screenText = terminalElement ? terminalElement.innerText || "" : "Error: Could not find terminal element.";

            const absolutePath = FileSystemManager.getAbsolutePath(outputFilename);

            const saveResult = await FileSystemManager.createOrUpdateFile(
                absolutePath,
                screenText,
                {
                    currentUser: currentUser,
                    primaryGroup: UserManager.getPrimaryGroupForUser(currentUser),
                }
            );

            if (saveResult.success) {
                await FileSystemManager.save();
                return ErrorHandler.createSuccess(`Screen content saved to '${absolutePath}'`, { stateModified: true });
            } else {
                return ErrorHandler.createError(`printscreen: ${saveResult.error}`);
            }
        }

        try {
            const terminalElement = document.getElementById("terminal");
            if (terminalElement) {
                terminalElement.classList.add("no-cursor");
            }

            await OutputManager.appendToOutput("Generating screenshot...");
            await new Promise((resolve) => setTimeout(resolve, 50));

            const { html2canvas } = window;
            if (typeof html2canvas === "undefined") {
                if (terminalElement) terminalElement.classList.remove("no-cursor");
                return ErrorHandler.createError("printscreen: html2canvas library not loaded.");
            }

            const canvas = await html2canvas(terminalElement, {
                backgroundColor: "#000",
                logging: false,
                useCORS: true,
                allowTaint: true,
            });

            const fileName = `OopisOS_Screenshot_${new Date().toISOString().replace(/:/g, "-")}.png`;
            const a = Utils.createElement("a", {
                href: canvas.toDataURL("image/png"),
                download: fileName,
            });

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (terminalElement) {
                terminalElement.classList.remove("no-cursor");
            }

            return ErrorHandler.createSuccess(`Screenshot saved as '${fileName}'`);
        } catch (e) {
            if (document.getElementById("terminal")) {
                document.getElementById("terminal").classList.remove("no-cursor");
            }
            return ErrorHandler.createError(`printscreen: Failed to capture screen. ${e.message}`);
        }
    }
}

window.CommandRegistry.register(new PrintscreenCommand());
