(() => {
    "use strict";
    /**
     * @file Defines the 'reboot' command, which reloads the OopisOS virtual machine by reloading the browser page.
     * User data and session information are preserved due to persistent storage.
     * @author Andrew Edmark
     * @author Gemini
     */

    /**
     * @const {object} rebootCommandDefinition
     * @description The command definition for the 'reboot' command.
     * This object specifies the command's name, argument validation (no arguments expected),
     * and the core logic for initiating a system reboot.
     */
    const rebootCommandDefinition = {
        commandName: "reboot",
        argValidation: { exact: 0 }, // This command takes no arguments.
        /**
         * The core logic for the 'reboot' command.
         * It outputs a message indicating the reboot, then asynchronously
         * reloads the entire browser page after a short delay.
         * @async
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async () => {
            await OutputManager.appendToOutput(
                "Rebooting OopisOS (reloading browser page)...",
                {
                    typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                }
            );
            // Reload the page after a short delay to allow the message to be displayed.
            setTimeout(() => {
                window.location.reload();
            }, 500);
            return { success: true, output: null }; // Return success with no explicit output as page will reload.
        },
    };

    const rebootDescription = "Reboots the OopisOS virtual machine.";

    const rebootHelpText = `Usage: reboot

Reboot the OopisOS virtual machine.

DESCRIPTION
       The reboot command safely reloads the OopisOS environment by
       reloading the browser page.

       Because all user data, files, and session information are saved
       to persistent browser storage, your entire system state will be
       preserved and restored after the reboot is complete. This is
       useful for applying certain configuration changes or recovering
       from a UI glitch.`;

    CommandRegistry.register("reboot", rebootCommandDefinition, rebootDescription, rebootHelpText);
})();