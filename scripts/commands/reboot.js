// scripts/commands/reboot.js

window.RebootCommand = class RebootCommand extends Command {
    constructor() {
        super({
            commandName: "reboot",
            description: "Reboots the OopisOS virtual machine.",
            helpText: `Usage: reboot
      Reboot the OopisOS virtual machine.
      DESCRIPTION
      The reboot command safely reloads the OopisOS environment by
      reloading the browser page.
      Because all user data, files, and session information are saved
      to persistent browser storage, your entire system state will be
      preserved and restored after the reboot is complete. This is
      useful for applying certain configuration changes or recovering
      from a UI glitch.`,
            validations: {
                args: {
                    exact: 0
                }
            },
        });
    }

    async coreLogic(context) {
        const { dependencies } = context;
        const { ErrorHandler, Config } = dependencies;
        setTimeout(() => {
            window.location.reload();
        }, 500);
        return ErrorHandler.createSuccess(
            "Rebooting OopisOS (reloading browser page)...",
            {
                messageType: Config.CSS_CLASSES.SUCCESS_MSG,
            }
        );
    }
}

window.CommandRegistry.register(new RebootCommand());
