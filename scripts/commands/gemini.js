// scripts/commands/gemini.js
(() => {
    "use strict";

    let conversationHistory = [];
    const COMMAND_WHITELIST = ['ls', 'cat', 'grep', 'find', 'tree', 'pwd', 'head', 'shuf', 'xargs', 'echo', 'tail', 'csplit', 'wc', 'awk', 'sort', 'touch'];

    const PLANNER_SYSTEM_PROMPT = `You are a command-line planning AI for OopisOS. Your task is to analyze the user's prompt and the provided system context, then generate a step-by-step plan of OopisOS commands to gather the necessary information.

**Rules:**
- If the user's request requires no commands (e.g., a general knowledge question), respond with the direct answer immediately. DO NOT generate a plan.
- If the request is ambiguous, ask for clarification.
- You may ONLY use commands from the "Tool Manifest". Do not use any other commands or flags.
- Each command in the plan must be simple and stand-alone. No advanced shell syntax (like command substitution or complex pipes) is allowed.
- Enclose any arguments that contain spaces in double quotes (e.g., cat "a file with spaces.txt").

--- TOOL MANIFEST ---
ls [-l, -a, -R], cat, grep [-i, -v, -n, -R], find [path] -name [pattern] -type [f|d], tree, pwd, head [-n], tail [-n], wc, touch, xargs, shuf, tail, csplit, awk, sort, echo, man, help, set, history, mkdir
--- END MANIFEST ---`;

    const SYNTHESIZER_SYSTEM_PROMPT = `You are a helpful digital librarian. Your task is to synthesize a final, natural-language answer for the user based on their original prompt and the provided output from a series of commands.

**Rules:**
- Formulate a comprehensive answer using only the provided command outputs.
- Do not reference the commands themselves in your final answer.
- If the tool context is insufficient to answer the question, state that you could not find the necessary information in the user's files.
- Be friendly, conversational, and helpful.`;


    const geminiCommandDefinition = {
        commandName: "gemini",
        flagDefinitions: [
            { name: "chat", short: "-c", long: "--chat" },
            { name: "new", short: "-n", long: "--new" },
            { name: "verbose", short: "-v", long: "--verbose" },
            { name: "provider", short: "-p", long: "--provider", takesValue: true },
            { name: "model", short: "-m", long: "--model", takesValue: true },
            { name: "forceToolUse", short: "-f", long: "--force", description: "Force the Gemini tool-use logic (planner/synthesizer) for any provider." }
        ],
        coreLogic: async (context) => {
            const {args, options, flags} = context;

            try {
                if (flags.chat) {
                    if (!options.isInteractive) {
                        return { success: false, error: "gemini: Chat mode can only be run in interactive mode." };
                    }
                    if (typeof GeminiChatManager === 'undefined') {
                        return { success: false, error: "gemini: The GeminiChatManager module is not loaded." };
                    }
                    await GeminiChatManager.enter(flags.provider, flags.model);
                    return { success: true, output: "" };
                }

                if (args.length === 0) {
                    return { success: false, error: 'Insufficient arguments. Usage: gemini [-p provider] [-m model] "<prompt>"'};
                }

                let provider = flags.provider || 'gemini';
                const originalProvider = provider;
                const model = flags.model || null;
                let apiKey = null;
                let isNewKeyProvided = false;

                const userPrompt = args.join(" ");

                const requiresGeminiApiKey = provider === 'gemini';

                if (requiresGeminiApiKey) {
                    const apiKeyResult = await new Promise(resolve => {
                        let key = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
                        if (key) resolve({ success: true, key, fromStorage: true });
                        else ModalInputManager.requestInput(
                            "Please enter your Gemini API key:",
                            (providedKey) => {
                                if (!providedKey || providedKey.trim() === "") {
                                    resolve({
                                        success: false,
                                        error: "API key entry cancelled or empty."
                                    });
                                    return;
                                }
                                StorageManager.saveItem(Config.STORAGE_KEYS.GEMINI_API_KEY, providedKey, "Gemini API Key");
                                OutputManager.appendToOutput("API Key saved. Launching Chidi...", {
                                    typeClass: Config.CSS_CLASSES.SUCCESS_MSG
                                });
                                resolve({
                                    success: true,
                                    key: providedKey
                                });
                            },
                            () => {
                                resolve({
                                    success: false,
                                    error: "API key entry cancelled."
                                });
                            },
                            false,
                            options
                        );
                    });

                    if (!apiKeyResult.success) return { success: false, error: `gemini: ${apiKeyResult.error}` };
                    apiKey = apiKeyResult.key;
                    isNewKeyProvided = !apiKeyResult.fromStorage;
                }

                if (flags.new) {
                    conversationHistory = [];
                    if (options.isInteractive) await OutputManager.appendToOutput("Starting a new conversation.", {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG});
                }

                if (options.isInteractive) await OutputManager.appendToOutput("AI is thinking...", {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG});

                const isGeminiProvider = provider === 'gemini';
                const shouldUseToolUseLogic = isGeminiProvider || flags.forceToolUse;

                if (shouldUseToolUseLogic) {

                    const pwdResult = await CommandExecutor.processSingleCommand("pwd", { suppressOutput: true });
                    const lsResult = await CommandExecutor.processSingleCommand("ls -la", { suppressOutput: true });
                    const historyResult = await CommandExecutor.processSingleCommand("history", { suppressOutput: true });
                    const setResult = await CommandExecutor.processSingleCommand("set", { suppressOutput: true });

                    const localContext = `
## OopisOS Session Context ##
Current Directory:
${pwdResult.output || '(unknown)'}

Directory Listing:
${lsResult.output || '(empty)'}

Recent Commands:
${historyResult.output || '(none)'}

Environment Variables:
${setResult.output || '(none)'}
`;
                    const plannerPrompt = `User Prompt: "${userPrompt}"\\n\\n${localContext}`;

                    const plannerConversation = [...conversationHistory, { role: "user", parts: [{ text: plannerPrompt }] }];

                    let plannerResult = await Utils.callLlmApi(provider, model, plannerConversation, apiKey, PLANNER_SYSTEM_PROMPT);

                    if (!plannerResult.success && plannerResult.error === 'LOCAL_PROVIDER_UNAVAILABLE') {
                        if (options.isInteractive) {
                            await OutputManager.appendToOutput(`gemini: Could not connect to '${originalProvider}' for planning. Falling back to Google Gemini for tool orchestration.`, {typeClass: Config.CSS_CLASSES.WARNING_MSG});
                        }
                        provider = 'gemini';
                        const fallbackApiKeyResult = await new Promise(resolve => {
                            let key = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
                            if (key) resolve({ success: true, key: key, fromStorage: true });
                            else resolve({ success: false, error: "Google Gemini API key not found for fallback." });
                        });
                        if (!fallbackApiKeyResult.success) return { success: false, error: `gemini: ${fallbackApiKeyResult.error}` };
                        apiKey = fallbackApiKeyResult.key;
                        isNewKeyProvided = !fallbackApiKeyResult.fromStorage;

                        plannerResult = await Utils.callLlmApi(provider, model, plannerConversation, apiKey, PLANNER_SYSTEM_PROMPT);
                    }

                    if (!plannerResult.success) {
                        if (plannerResult.error === "INVALID_API_KEY") {
                            StorageManager.removeItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
                            if (options.isInteractive) {
                                await OutputManager.appendToOutput("Gemini API key was invalid and has been removed.", {typeClass: Config.CSS_CLASSES.WARNING_MSG});
                            }
                            return { success: false, error: "gemini: Your API key is invalid. Please run the command again." };
                        }
                        return { success: false, error: `gemini: Planner stage failed. ${plannerResult.error}` };
                    }

                    if (isNewKeyProvided && requiresGeminiApiKey) {
                        StorageManager.saveItem(Config.STORAGE_KEYS.GEMINI_API_KEY, apiKey);
                        if (options.isInteractive) {
                            await OutputManager.appendToOutput("Gemini API key saved successfully.", {typeClass: Config.CSS_CLASSES.SUCCESS_MSG});
                        }
                    }

                    const planText = plannerResult.answer?.trim();
                    if (!planText) return { success: false, error: "gemini: AI failed to generate a valid plan or response." };

                    const firstWordOfPlan = planText.split(/\\s+/)[0];
                    if (!COMMAND_WHITELIST.includes(firstWordOfPlan)) {
                        conversationHistory.push({ role: "user", parts: [{ text: userPrompt }] });
                        conversationHistory.push({ role: "model", parts: [{ text: planText }] });
                        return { success: true, output: planText };
                    }

                    let executedCommandsOutput = "";
                    const commandsToExecute = planText.split('\\n').map(line => line.replace(/^\\d+\\.\\s*/, '').trim()).filter(Boolean);
                    if (flags.verbose && options.isInteractive) {
                        await OutputManager.appendToOutput(`AI's Plan:\\n${commandsToExecute.map(c => `- ${c}`).join('\\n')}`, {typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG});
                    }

                    if (!flags.confirm && options.isInteractive) {
                        const confirmed = await new Promise(resolve => {
                            ModalManager.request({
                                context: 'terminal',
                                messageLines: ["The AI has proposed the following plan:", ...commandsToExecute.map(c => `  - ${c}`), "Execute this plan?"],
                                onConfirm: () => resolve(true),
                                onCancel: () => resolve(false)
                            });
                        });

                        if (!confirmed) {
                            await OutputManager.appendToOutput("Execution cancelled by user.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                            return { success: true, output: "" };
                        }
                    }

                    for (const commandStr of commandsToExecute) {
                        const commandName = commandStr.split(' ')[0];
                        if (!COMMAND_WHITELIST.includes(commandName)) {
                            await OutputManager.appendToOutput(`Execution HALTED: AI attempted to run a non-whitelisted command: '${commandName}'.`, {typeClass: Config.CSS_CLASSES.ERROR_MSG});
                            return { success: false, error: `Attempted to run restricted command: ${commandName}` };
                        }

                        if (flags.verbose && options.isInteractive) {
                            await OutputManager.appendToOutput(`> ${commandStr}`, {typeClass: Config.CSS_CLASSES.EDITOR_MSG});
                        }
                        const execResult = await CommandExecutor.processSingleCommand(commandStr, {suppressOutput: !flags.verbose});
                        const output = execResult.success ? execResult.output : `Error: ${execResult.error}`;
                        executedCommandsOutput += `--- Output of '${commandStr}' ---\\n${output}\\n\\n`;
                    }

                    const synthesizerPrompt = `Original user question: "${userPrompt}"\\n\\nContext from file system:\\n${executedCommandsOutput || "No commands were run."}`;
                    const synthesizerResult = await Utils.callLlmApi(provider, model, [{ role: "user", parts: [{ text: synthesizerPrompt }] }], apiKey, SYNTHESIZER_SYSTEM_PROMPT);

                    if (!synthesizerResult.success) {
                        return { success: false, error: `gemini: Synthesizer stage failed. ${synthesizerResult.error}` };
                    }

                    const finalAnswer = synthesizerResult.answer;
                    if (!finalAnswer) {
                        return { success: false, error: "gemini: AI failed to synthesize a final answer." };
                    }

                    conversationHistory.push({ role: "user", parts: [{ text: userPrompt }] });
                    conversationHistory.push({ role: "model", parts: [{ text: finalAnswer }] });

                    return { success: true, output: finalAnswer };

                } else {
                    const directConversation = [...conversationHistory, { role: "user", parts: [{ text: userPrompt }] }];
                    const directResult = await Utils.callLlmApi(provider, model, directConversation, apiKey, null);
                    if (!directResult.success) {
                        if (directResult.error === 'LOCAL_PROVIDER_UNAVAILABLE') {
                            if (options.isInteractive) {
                                await OutputManager.appendToOutput(`gemini: Could not connect to '${originalProvider}'. Falling back to default 'gemini' provider.`, {typeClass: Config.CSS_CLASSES.WARNING_MSG});
                            }
                            const fallbackCommand = `gemini ${flags.new ? '-n ' : ''}${flags.verbose ? '-v ' : ''}"${userPrompt}"`;
                            return await CommandExecutor.processSingleCommand(fallbackCommand, options);
                        }
                        return { success: false, error: `gemini: Local LLM interaction failed. ${directResult.error}` };
                    }

                    const finalAnswer = directResult.answer;
                    if (!finalAnswer) {
                        return { success: false, error: "gemini: Local LLM failed to generate a response." };
                    }

                    conversationHistory.push({ role: "user", parts: [{ text: userPrompt }] });
                    conversationHistory.push({ role: "model", parts: [{ text: finalAnswer }] });

                    return { success: true, output: finalAnswer };
                }
            } catch (e) {
                return { success: false, error: `gemini: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const geminiDescription = "Engages in a context-aware conversation with a configured AI model.";
    const geminiHelpText = `Usage: gemini [-c | --chat] [-n|--new] [-v|--verbose] [-p provider] [-m model] [-f|--force] "<prompt>"

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
`;

    CommandRegistry.register("gemini", geminiCommandDefinition, geminiDescription, geminiHelpText);
})();