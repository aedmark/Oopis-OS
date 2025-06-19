// scripts/commands/reboot.js

(() => {
    "use strict";
    const rebootCommandDefinition = {
        commandName: "reboot",
        argValidation: { exact: 0 },
        coreLogic: async () => {
            await OutputManager.appendToOutput(
                "Rebooting OopisOS (reloading browser page and clearing cache)...",
                {
                    typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                }
            );
            setTimeout(() => {
                window.location.reload();
            }, 500);
            return { success: true, output: null };
        },
    };

   const rebootDescription = "Reboots OopisOS by reloading the browser page and clearing its cache, preserving user data.";
   const rebootHelpText = "Usage: reboot";
   CommandRegistry.register("reboot", rebootCommandDefinition, rebootDescription, rebootHelpText);
})();