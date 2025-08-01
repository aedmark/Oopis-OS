// scripts/commands/gemini.js

window.GeminiCommand = class GeminiCommand extends Command {
    constructor() {
        super({
            commandName: "gemini",
            dependencies: [
                "apps/gemini_chat/gemini_chat_ui.js",
                "apps/gemini_chat/gemini_chat_manager.js",
            ],
            applicationModules: ["GeminiChatManager", "GeminiChatUI", "App"],
            description:
                "Engages in a context-aware conversation with a configured AI model.",
            helpText: `Usage: gemini [-c | --chat] [-n|--new] [-v|--verbose] [-p provider] [-m model] [-f|--force] "<prompt>"
    Engage in a context-aware conversation with an AI model.
    DESCRIPTION
    The gemini command sends a prompt to a configured AI model.
    When using the default 'gemini' provider (Google's API), it acts as a powerful
    assistant capable of using system tools to answer questions about your files.
    It orchestrates multiple steps behind the scenes (planning, tool execution, synthesis).
    When using a local provider (e.g., 'ollama', 'llm-studio'), the user's prompt
    is sent directly to the local model. Tool-use capabilities for local models
    depend on the model's own training and user's explicit instructions in the prompt.
    If a local provider is specified but unavailable, it will fall back to the
    default 'gemini' provider and notify you.
    The entire prompt, if it contains spaces, must be enclosed in double quotes.
    MODES
    -c, --chat
    Launches the full-screen Gemini Chat application for an interactive
    conversational experience.
    PROVIDERS & MODELS
    -p, --provider   Specify the provider (e.g., 'ollama', 'gemini').
    Defaults to 'gemini'.
    -m, --model      Specify a model for the provider (e.g., 'llama3').
    Defaults to the provider's default model.
    OPTIONS
    -n, --new
    Starts a new, fresh conversation, clearing any previous
    conversational memory from the current session.
    -v, --verbose
    Only applicable to the 'gemini' provider. Enable verbose logging to see
    the AI's step-by-step plan and the output of the commands it executes.
    -f, --force
    Forces the use of the selected provider for the entire tool-use
    orchestration (planning, tool execution, and synthesis steps).
    This allows experimenting with local models to perform structured
    tool-use. Results may vary significantly based on the local model's
    training. An API key is only required if 'gemini' is the chosen
    provider for this orchestration.
    EXAMPLES
    gemini -c
    Launches the interactive chat application.
    gemini "Summarize my README.md and list any scripts in this directory"
    (Uses Google Gemini, leveraging its tool-use capabilities)
    `,
            flagDefinitions: [
                { name: "chat", short: "-c", long: "--chat" },
                { name: "new", short: "-n", long: "--new" },
                { name: "verbose", short: "-v", long: "--verbose" },
                { name: "provider", short: "-p", long: "--provider", takesValue: true },
                { name: "model", short: "-m", long: "--model", takesValue: true },
                {
                    name: "forceToolUse",
                    short: "-f",
                    long: "--force",
                    description:
                        "Force the Gemini tool-use logic (planner/synthesizer) for any provider.",
                },
            ],
        });
    }

    async coreLogic(context) {

        const { args, options, flags, dependencies } = context;
        const { ErrorHandler, AppLayerManager, GeminiChatManager, GeminiChatUI, App, OutputManager, Config, AIManager } = dependencies;

        if (flags.chat) {
            if (!options.isInteractive) {
                return ErrorHandler.createError(
                    "gemini: Chat mode can only be run in interactive mode."
                );
            }
            if (
                typeof GeminiChatManager === "undefined" ||
                typeof GeminiChatUI === "undefined" ||
                typeof App === "undefined"
            ) {
                return ErrorHandler.createError(
                    "gemini: The GeminiChat application modules are not loaded."
                );
            }
            AppLayerManager.show(new GeminiChatManager(), {
                provider: flags.provider,
                model: flags.model,
                dependencies: dependencies
            });
            return ErrorHandler.createSuccess("");
        }

        if (args.length === 0) {
            return ErrorHandler.createError(
                'Insufficient arguments. Usage: gemini [-p provider] [-m model] "<prompt>"'
            );
        }

        const userPrompt = args.join(" ");

        if (flags.new) {
            let conversationHistory = [];
            if (options.isInteractive) {
                await OutputManager.appendToOutput("Starting a new conversation.", {
                    typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                });
            }
        }

        if (options.isInteractive) {
            await OutputManager.appendToOutput("AI is thinking...", {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            });
        }

        const verboseCallback = flags.verbose && options.isInteractive ?
            (message, typeClass) => {
                OutputManager.appendToOutput(message, { typeClass });
            } :
            null;

        let conversationHistory = [];

        const agentResult = await AIManager.performAgenticSearch(
            userPrompt,
            conversationHistory,
            flags.provider || "gemini",
            flags.model || null, {
                ...options,
                verboseCallback,
                dependencies: dependencies
            }
        );

        if (agentResult.success) {
            const finalAnswer = agentResult.data;
            conversationHistory.push({
                role: "user",
                parts: [{ text: userPrompt }],
            });
            conversationHistory.push({
                role: "model",
                parts: [{ text: finalAnswer }],
            });
            return ErrorHandler.createSuccess(finalAnswer);
        } else {
            return ErrorHandler.createError(`gemini: ${agentResult.error}`);
        }

    }
}

window.CommandRegistry.register(new GeminiCommand());
