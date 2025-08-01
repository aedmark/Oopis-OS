// scripts/commands/beep.js

window.BeepCommand = class BeepCommand extends Command {
    constructor() {
        super({
            commandName: "beep",
            description: "Plays a simple system beep.",
            helpText: `Usage: beep
      Plays a short, simple system tone through the emulated sound card.
      
      DESCRIPTION
      The beep command produces a standard terminal beep sound. It's useful
      for getting auditory feedback, such as signaling the completion of a
      long-running script or alerting the user to an event.
      
      This command requires the AudioContext to be active, which is
      initialized after the first user interaction with the terminal (a keypress or click).`
        });
    }

    async coreLogic(context) {
        const { dependencies } = context;
        const { SoundManager, ErrorHandler } = dependencies;

        if (!SoundManager.isInitialized) {
            await SoundManager.initialize();
            if (!SoundManager.isInitialized) {
                return ErrorHandler.createError(
                    "beep: AudioContext could not be started. Please click or type first."
                );
            }
        }

        SoundManager.beep();
        return ErrorHandler.createSuccess();
    }
};

window.CommandRegistry.register(new BeepCommand());
