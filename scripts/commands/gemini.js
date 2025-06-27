/**
 * @file Defines the 'gemini' command, enabling interaction with the Google Gemini AI model
 * within the OopisOS terminal. This command supports conversational memory and tool use
 * (OopisOS shell commands) for file system awareness, using a sophisticated two-stage
 * "plan-then-synthesize" approach for enhanced accuracy and efficiency.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    // --- STATE & CONFIGURATION ---
    let geminiConversationHistory = [];
    const COMMAND_WHITELIST = ['ls', 'cat', 'grep', 'find', 'tree', 'pwd'];

    /**
     * @private
     * @const {string} PLANNER_SYSTEM_PROMPT
     * @description The system instruction for the "Planner" stage. It instructs the AI
     * to analyze the user's request and the local file context, then formulate a plan
     * of shell commands to gather necessary information.
     */
    const PLANNER_SYSTEM_PROMPT = `You are a helpful and witty digital librarian embedded in the OopisOS terminal environment. Your goal is to assist the user by answering their questions about their file system.

Your FIRST task is to analyze the user's prompt and the provided local file context. Based on this, you must formulate a step-by-step plan of OopisOS commands to gather the necessary information.

RULES:
- Respond ONLY with a numbered list of the shell commands required.
- Do not add any commentary, explanation, or greetings.
- If no commands are needed (e.g., a general knowledge question), respond with the single word "ANSWER".
- You may only use the commands and flags listed in the "Tool Manifest" below. Do not invent flags or commands like 'xargs'.

--- TOOL MANIFEST ---
1. ls [FLAGS]: Lists files.
   -l: long format
   -a: show all (including hidden)
   -R: recursive
2. cat [FILE]: Displays file content.
3. grep [FLAGS] [PATTERN] [FILE]: Searches for patterns in files.
   -i: ignore case
   -v: invert match
   -n: show line number
   -R: recursive search
4. find [PATH] [EXPRESSIONS]: Finds files based on criteria.
   -name [PATTERN]: find by name (e.g., "*.txt")
   -type [f|d]: find by type (file or directory)
5. tree: Display directory contents as a tree.
6. pwd: Show the current directory.
--- END MANIFEST ---`;

    /**
     * @private
     * @const {string} SYNTHESIZER_SYSTEM_PROMPT
     * @description The system instruction for the "Synthesizer" stage. It instructs the AI
     * to take the original question and the results of the executed command plan, and
     * synthesize a final, user-facing answer.
     */
    const SYNTHESIZER_SYSTEM_PROMPT = `You are a helpful and witty digital librarian embedded in the OopisOS terminal environment.

Your SECOND task is to synthesize a final answer for the user.
You will be given the user's original prompt and the output from a series of commands that you previously planned.

RULES:
- Use the provided command outputs to formulate a comprehensive, natural language answer.
- Do not reference the commands themselves in your answer. Simply use the information they provided.
- If the context from the tools is insufficient, state that you could not find the necessary information in the user's files.
- Be friendly, conversational, and helpful in your final response.`;


    /**
     * @const {object} geminiCommandDefinition
     * @description The command definition for the 'gemini' command.
     */
    const geminiCommandDefinition = {
        commandName: "gemini",
        flagDefinitions: [
            { name: "new", short: "-n", long: "--new" },
            { name: "verbose", short: "-v", long: "--verbose" },
        ],
        argValidation: {
            min: 1,
            error: 'Insufficient arguments. Usage: gemini [-n|--new] "<prompt>"',
        },
        coreLogic: async (context) => {
            const { args, options, flags } = context;

            const _getApiKey = () => {
                return new Promise((resolve) => {
                    let apiKey = StorageManager.loadItem(
                        Config.STORAGE_KEYS.GEMINI_API_KEY,
                        "Gemini API Key"
                    );
                    if (apiKey) {
                        resolve({ success: true, key: apiKey });
                        return;
                    }
                    if (options.isInteractive) {
                        ModalInputManager.requestInput(
                            "Please enter your Gemini API key. It will be saved locally for future use.",
                            (providedKey) => {
                                if (!providedKey) {
                                    resolve({
                                        success: false,
                                        error: "API key cannot be empty.",
                                    });
                                    return;
                                }
                                StorageManager.saveItem(
                                    Config.STORAGE_KEYS.GEMINI_API_KEY,
                                    providedKey,
                                    "Gemini API Key"
                                );
                                OutputManager.appendToOutput(
                                    "API Key saved to local storage.",
                                    {
                                        typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                                    }
                                );
                                resolve({ success: true, key: providedKey });
                            },
                            () => {
                                resolve({ success: false, error: "API key entry cancelled." });
                            },
                            false,
                            options
                        );
                    } else {
                        resolve({
                            success: false,
                            error: "API key not set. Please run interactively to set it.",
                        });
                    }
                });
            };

            const _callGeminiApi = async (apiKey, conversation, systemPrompt) => {
                const GEMINI_API_URL = Config.API.GEMINI_URL;
                try {
                    const response = await fetch(GEMINI_API_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": apiKey,
                        },
                        body: JSON.stringify({
                            contents: conversation,
                            system_instruction: { parts: [{ text: systemPrompt }] },
                        }),
                    });

                    if (!response.ok) {
                        let errorBody = await response.json().catch(() => null);
                        if (response.status === 400 && errorBody?.error?.message.includes("API key not valid")) {
                            return { success: false, error: "INVALID_API_KEY" };
                        }
                        return { success: false, error: `API request failed: ${errorBody?.error?.message || response.statusText}` };
                    }
                    return { success: true, data: await response.json() };
                } catch (e) {
                    return { success: false, error: `Network or fetch error: ${e.message}` };
                }
            };

            // --- Main Orchestration Logic ---
            const apiKeyResult = await _getApiKey();
            if (!apiKeyResult.success) {
                return { success: false, error: `gemini: ${apiKeyResult.error}` };
            }
            const apiKey = apiKeyResult.key;

            if (flags.new) {
                geminiConversationHistory = [];
                if (options.isInteractive) {
                    await OutputManager.appendToOutput("Starting a new conversation with Gemini.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                }
            }

            const userPrompt = args.join(" ");

            // --- 1. LOCAL TRIAGE ---
            const lsResult = await CommandExecutor.processSingleCommand("ls -l", false);
            const localContext = `Current directory content:\n${lsResult.output || '(empty)'}`;
            const plannerPrompt = `User Prompt: "${userPrompt}"\n\n${localContext}`;

            if (options.isInteractive && flags.verbose) {
                await OutputManager.appendToOutput("Gemini is thinking...", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
            }

            // --- 2. STAGE 1: PLANNER ---
            const plannerResult = await _callGeminiApi(apiKey, [{ role: "user", parts: [{ text: plannerPrompt }] }], PLANNER_SYSTEM_PROMPT);

            if (!plannerResult.success) {
                if (plannerResult.error === "INVALID_API_KEY") {
                    StorageManager.removeItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
                    return { success: false, error: "gemini: Your API key is invalid. It has been removed. Please run the command again." };
                }
                return { success: false, error: `gemini: Planner stage failed. ${plannerResult.error}` };
            }

            const candidate = plannerResult.data.candidates?.[0];
            const planText = candidate?.content?.parts?.[0]?.text?.trim();

            if (!planText) {
                return { success: false, error: "gemini: AI failed to generate a valid plan." };
            }

            // --- 3. EXECUTION LOOP ---
            let executedCommandsOutput = "";
            if (planText.toUpperCase() !== "ANSWER") {
                const commandsToExecute = planText.split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
                if (flags.verbose && options.isInteractive) {
                    await OutputManager.appendToOutput(`Gemini's Plan:\n${commandsToExecute.map(c => `- ${c}`).join('\n')}`, { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                }

                for (const commandStr of commandsToExecute) {
                    const commandName = commandStr.split(' ')[0];
                    if (!COMMAND_WHITELIST.includes(commandName)) {
                        await OutputManager.appendToOutput(`Execution HALTED: AI attempted to run a non-whitelisted command: '${commandName}'.`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                        return { success: false, error: `Attempted to run restricted command: ${commandName}` };
                    }

                    if (flags.verbose && options.isInteractive) {
                        await OutputManager.appendToOutput(`> ${commandStr}`, { typeClass: Config.CSS_CLASSES.EDITOR_MSG });
                    }
                    const execResult = await CommandExecutor.processSingleCommand(commandStr, false);
                    const output = execResult.success ? execResult.output : `Error: ${execResult.error}`;

                    if (flags.verbose && options.isInteractive && output) {
                        await OutputManager.appendToOutput(output);
                    }
                    executedCommandsOutput += `--- Output of '${commandStr}' ---\n${output}\n\n`;
                }
            }

            // --- 4. STAGE 2: SYNTHESIZER ---
            const synthesizerPrompt = `Original user question: "${userPrompt}"\n\nContext from file system:\n${executedCommandsOutput || "No commands were run."}`;
            const synthesizerResult = await _callGeminiApi(apiKey, [{ role: "user", parts: [{ text: synthesizerPrompt }] }], SYNTHESIZER_SYSTEM_PROMPT);

            if (!synthesizerResult.success) {
                return { success: false, error: `gemini: Synthesizer stage failed. ${synthesizerResult.error}` };
            }

            const finalAnswer = synthesizerResult.data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!finalAnswer) {
                return { success: false, error: "gemini: AI failed to synthesize a final answer." };
            }

            // Add the full exchange to history for context in follow-up questions
            geminiConversationHistory.push({ role: "user", parts: [{ text: userPrompt }] });
            geminiConversationHistory.push({ role: "model", parts: [{ text: finalAnswer }] });

            return { success: true, output: finalAnswer };
        },
    };

    const geminiDescription = "Engages in a context-aware conversation with the Gemini AI.";

    const geminiHelpText = `Usage: gemini [-n|--new] [-v|--verbose]"

Engage in a context-aware conversation with the Gemini AI.

DESCRIPTION
       The gemini command sends a prompt to the Google Gemini AI model.
       It is a powerful assistant integrated directly into the OopisOS
       shell, capable of both general conversation and tasks that require
       awareness of the virtual file system.

       The entire prompt, if it contains spaces, should be enclosed in
       double quotes.

CAPABILITIES
       File System Awareness
              Gemini can use OopisOS commands (ls, cat, find, tree, etc.)
              to explore your file system, gather information, and provide
              truly context-aware answers about your files and projects.

       Conversational Memory
              The command remembers the history of your current conversation,
              allowing you to ask follow-up questions.

API KEY
       The first time you use the gemini command, you will be prompted
       to enter a Google AI Studio API key. This key is stored locally
       in your browser's storage and is required to make requests.

OPTIONS
       -n, --new
              Starts a new, fresh conversation, clearing any previous
              conversational memory from the current session.
              
       -v, --verbose
          Enable verbose logging to see the AI's step-by-step plan
          and the output of the commands it executes.

EXAMPLES
       # Ask a question that requires finding and reading files
       gemini "Summarize my README.md and list any scripts in this directory"

       # Ask a follow-up question
       gemini "Now, what was the first script you listed?"

       # Start a completely new conversation
       gemini -n "What is the capital of Illinois?"`;

    CommandRegistry.register("gemini", geminiCommandDefinition, geminiDescription, geminiHelpText);
})();