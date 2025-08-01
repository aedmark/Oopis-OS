// scripts/commands/login.js

window.LoginCommand = class LoginCommand extends Command {
    constructor() {
        super({
            commandName: "login",
            description: "Logs in as a user, starting a new session.",
            helpText: `Usage: login <username> [password]
      Log in as a user and start a new session.
      DESCRIPTION
      The login command starts a new session for the specified <username>.
      If the user account has a password, and one is not provided in the
      command, the system will prompt for it.
      Unlike the 'su' command which stacks user sessions, 'login'
      clears any existing session stack and starts a fresh one. This
      means any active 'su' sessions will be terminated.
      EXAMPLES
      login root
      Prompts for the root user's password and logs in.
      login Guest
      Logs in as the Guest user (no password required).`,
            completionType: "users",
            validations: {
                args: {
                    min: 1,
                    max: 2,
                    error: "Usage: login <username> [password]"
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, options, dependencies } = context;
        const { UserManager, ErrorHandler, Config } = dependencies;
        const username = args[0];
        const providedPassword = args.length === 2 ? args[1] : null;

        const result = await UserManager.login(
            username,
            providedPassword,
            options
        );

        if (result.success) {
            const resultData = result.data || {};
            if (resultData.isLogin) {
                return ErrorHandler.createSuccess(
                    `${Config.MESSAGES.WELCOME_PREFIX} ${username}${Config.MESSAGES.WELCOME_SUFFIX}`,
                    { effect: "clear_screen" }
                );
            }
            if (resultData.noAction) {
                return ErrorHandler.createSuccess(resultData.message);
            }
            return ErrorHandler.createSuccess(null);
        } else {
            return result;
        }
    }
}

window.CommandRegistry.register(new LoginCommand());
