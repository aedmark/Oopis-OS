/**
 * @file Defines the 'gemini' command, enabling interaction with the Google Gemini AI model
 * within the OopisOS terminal. This command supports conversational memory and tool use
 * (OopisOS shell commands) for file system awareness.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    // START - MOVED STATE AND CONFIG HERE
    /**
     * @private
     * @type {Array<object>}
     * @description Stores the ongoing conversation history with the Gemini AI.
     * Each element in the array represents a turn in the conversation, containing
     * 'role' (user/model/function) and 'parts' (text or function calls/responses).
     */
    let geminiConversationHistory = [];

    /**
     * @private
     * @const {string} GEMINI_SYSTEM_PROMPT
     * @description The system instruction provided to the Gemini AI, defining its persona,
     * goals, and guidelines for using tools and responding to users.
     */
    const GEMINI_SYSTEM_PROMPT = `You are a helpful and witty digital librarian embedded in the OopisOS terminal environment. Your goal is to assist the user by answering their questions.

    You have access to a set of tools (OopisOS shell commands) that you can use to explore the user's virtual file system to gather information for your answers.

    When the user asks a question, you must first determine if running one or more shell commands would be helpful.
    - If the file system contains relevant information, plan and execute the necessary commands. Then, synthesize an answer based on the command output.
    - If the request is a general knowledge question not related to the user's files, answer it directly without using any tools.
    - Do not make up file paths or content. Only use information returned from the tools.
    - Be friendly and conversational in your final response.`;
    // END - MOVED STATE AND CONFIG HERE

    /**
     * @const {object} geminiCommandDefinition
     * @description The command definition for the 'gemini' command.
     * This object specifies the command's name, supported flags (e.g., -n for new conversation),
     * argument validation, and the core logic for managing the AI interaction flow.
     */
    const geminiCommandDefinition = {
        commandName: "gemini",
        flagDefinitions: [
            {
                name: "new",
                short: "-n",
                long: "--new",
            },
        ],
        argValidation: {
            min: 1,
            error: 'Insufficient arguments. Usage: gemini [-n|--new] "<prompt>"',
        },
        /**
         * The core logic for the 'gemini' command.
         * It orchestrates the entire AI interaction:
         * 1. Retrieves/prompts for the Gemini API key.
         * 2. Manages the conversation history, including starting new conversations if requested.
         * 3. Sends user prompts and previous turns to the Gemini API.
         * 4. Processes the AI's response, which might be a text reply or a tool (shell command) call.
         * 5. If a tool call, executes the shell command and feeds its output back to the AI.
         * 6. Continues the loop until the AI provides a text response or an error occurs.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @param {string[]} context.args - The arguments provided to the command, forming the user's prompt.
         * @param {object} context.options - Execution options, including `isInteractive` for UI prompts.
         * @param {object} context.flags - An object containing the parsed flags (e.g., `new`).
         * @returns {Promise<object>} A promise that resolves to a command result object
         * containing the AI's final text response or an error.
         */
        coreLogic: async (context) => {
            const { args, options, flags } = context;

            /**
             * @private
             * @async
             * @returns {Promise<{success: boolean, key?: string, error?: string}>} A promise that resolves
             * to an object containing the API key or an error message. It will prompt the user if needed.
             * @description Retrieves the Gemini API key from local storage or prompts the user for it.
             * The key is then saved for future use.
             */
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
                            false, // Not obscured input (key is visible)
                            options // Pass context for scripting
                        );
                    } else {
                        resolve({
                            success: false,
                            error: "API key not set. Please run interactively to set it.",
                        });
                    }
                });
            };

            /**
             * @private
             * @async
             * @param {string} apiKey - The Gemini API key.
             * @param {Array<object>} conversationHistory - The current conversation history to send to the API.
             * @returns {Promise<{success: boolean, data?: object, error?: string}>} A promise that resolves
             * to an object containing the API response data or an error message.
             * @description Makes the actual API call to the Gemini model, including the conversation history
             * and the defined OopisOS tools.
             */
            const _callGeminiApi = async (apiKey, conversationHistory) => {
                const GEMINI_API_URL = Config.API.GEMINI_URL; // Get API URL from Config.
                /**
                 * @const {Array<object>} OopisOS_TOOLS
                 * @description Defines the shell commands that Gemini can call as tools.
                 * Each tool includes its name, description, and parameter schema.
                 */
                const OopisOS_TOOLS = [
                    {
                        function_declarations: [
                            {
                                name: "ls",
                                description: "Lists directory contents or file information.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        path: {
                                            type: "STRING",
                                            description:
                                                "The path of the directory or file to list. Defaults to the current directory.",
                                        },
                                    },
                                },
                            },
                            {
                                name: "cat",
                                description: "Concatenates and displays file content.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        path: {
                                            type: "STRING",
                                            description:
                                                "The path to the file whose content should be displayed.",
                                        },
                                    },
                                },
                            },
                            {
                                name: "pwd",
                                description: "Prints the current working directory path.",
                                parameters: { type: "OBJECT", properties: {} },
                            },
                            {
                                name: "find",
                                description: "Searches for files in a directory hierarchy.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        path: {
                                            type: "STRING",
                                            description: "The starting path for the search.",
                                        },
                                        expression: {
                                            type: "STRING",
                                            description:
                                                "The search expression (e.g., '-name \"*.txt\"').",
                                        },
                                    },
                                },
                            },
                            {
                                name: "grep",
                                description: "Searches for patterns within files.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        pattern: {
                                            type: "STRING",
                                            description: "The pattern to search for.",
                                        },
                                        path: {
                                            type: "STRING",
                                            description:
                                                "The path of the file or directory to search in.",
                                        },
                                    },
                                },
                            },
                            {
                                name: "tree",
                                description: "Lists directory contents in a tree-like format.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        path: {
                                            type: "STRING",
                                            description:
                                                "The path of the directory to display as a tree. Defaults to the current directory.",
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ];

                try {
                    const response = await fetch(GEMINI_API_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": apiKey,
                        },
                        body: JSON.stringify({
                            contents: conversationHistory,
                            tools: OopisOS_TOOLS, // Pass the defined tools to the AI.
                            system_instruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] }, // Provide system prompt.
                        }),
                    });

                    // Handle non-OK HTTP responses.
                    if (!response.ok) {
                        let errorBody = null;
                        try {
                            errorBody = await response.json(); // Attempt to parse error body for more details.
                        } catch (e) {
                            // If parsing fails, use generic error message.
                            return {
                                success: false,
                                error: `API request failed with status ${response.status}. ${response.statusText}`,
                            };
                        }
                        // Specific handling for invalid API key.
                        if (
                            response.status === 400 &&
                            errorBody?.error?.message.includes("API key not valid")
                        ) {
                            return { success: false, error: "INVALID_API_KEY" };
                        }
                        // General API error with message from response body.
                        return {
                            success: false,
                            error: `API request failed with status ${response.status}. ${
                                errorBody?.error?.message || response.statusText
                            }`,
                        };
                    }

                    const jsonData = await response.json();
                    return { success: true, data: jsonData };
                } catch (e) {
                    console.error("Gemini API fetch error:", e);
                    return {
                        success: false,
                        error: `Network or fetch error: ${e.message}`,
                    };
                }
            };

            // Get API key; prompt if not found.
            const apiKeyResult = await _getApiKey();
            if (!apiKeyResult.success) {
                return { success: false, error: `gemini: ${apiKeyResult.error}` };
            }
            const apiKey = apiKeyResult.key;

            const userPrompt = args.join(" "); // Combine arguments into a single prompt string.
            if (userPrompt.trim() === "") {
                return { success: false, error: "gemini: Prompt cannot be empty." };
            }

            // If '-n' or '--new' flag is present, clear conversation history.
            if (flags["new"]) {
                geminiConversationHistory = [];
                if (options.isInteractive) {
                    await OutputManager.appendToOutput(
                        "Starting a new conversation with Gemini.",
                        { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG }
                    );
                }
            }

            // Add the user's prompt to the conversation history.
            geminiConversationHistory.push({
                role: "user",
                parts: [{ text: userPrompt }],
            });

            // Display "thinking" message only for initial interactive prompts.
            if (options.isInteractive && geminiConversationHistory.length <= 1) {
                await OutputManager.appendToOutput("Gemini is thinking...", {
                    typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                });
            }

            // Loop to handle multi-turn interactions (e.g., tool calls).
            while (true) {
                const apiResult = await _callGeminiApi(
                    apiKey,
                    geminiConversationHistory
                );

                if (!apiResult.success) {
                    geminiConversationHistory.pop(); // Remove the user's prompt as the API call failed for it.
                    if (apiResult.error === "INVALID_API_KEY") {
                        StorageManager.removeItem(Config.STORAGE_KEYS.GEMINI_API_KEY); // Remove invalid key.
                        return {
                            success: false,
                            error:
                                "gemini: Your API key is invalid. It has been removed. Please run the command again to enter a new key.",
                        };
                    }
                    return {
                        success: false,
                        error: `gemini: An error occurred. ${apiResult.error}`,
                    };
                }

                const result = apiResult.data;
                const candidate =
                    result.candidates && result.candidates.length > 0
                        ? result.candidates[0]
                        : undefined;

                // Handle cases where no valid candidate or content is returned.
                if (!candidate || !candidate.content || !candidate.content.parts) {
                    geminiConversationHistory.pop(); // Remove the user's prompt if AI response is invalid.

                    const blockReason =
                        result.promptFeedback && result.promptFeedback.blockReason
                            ? result.promptFeedback.blockReason
                            : null;

                    if (blockReason) {
                        return {
                            success: false,
                            error: `gemini: Prompt was blocked. Reason: ${blockReason}.`,
                        };
                    }

                    const errorMessage =
                        result.error && result.error.message
                            ? result.error.message
                            : "Received an invalid or empty response from the API.";
                    return { success: false, error: `gemini: ${errorMessage}` };
                }

                let textResponse = "";
                let functionCall = null;
                // Iterate through parts to find text or function calls.
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        textResponse += part.text;
                    } else if (part.functionCall) {
                        functionCall = part.functionCall;
                        break; // Prioritize function calls.
                    }
                }

                // Prepare the AI's response turn for history.
                const modelResponseTurn = {
                    role: "model",
                    parts: candidate.content.parts,
                };

                // If a function call is detected, execute it as a shell command.
                if (functionCall) {
                    geminiConversationHistory.push(modelResponseTurn); // Add AI's tool call to history.
                    if (textResponse && options.isInteractive) {
                        await OutputManager.appendToOutput(textResponse); // Output any text preamble from AI.
                    }

                    if (options.isInteractive) {
                        const funcName = functionCall.name;
                        const funcArgs = JSON.stringify(functionCall.args || {});
                        await OutputManager.appendToOutput(
                            `Gemini is exploring with: ${funcName}(${funcArgs})`,
                            { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG }
                        );
                    }

                    const commandName = functionCall.name;
                    // Format command arguments for `processSingleCommand`.
                    const commandArgs = Object.values(functionCall.args || {})
                        .map((arg) => (typeof arg === "string" ? `"${arg}"` : arg))
                        .join(" ");
                    const fullCommandStr = `${commandName} ${commandArgs}`.trim();

                    // Execute the shell command (tool).
                    const execResult = await CommandExecutor.processSingleCommand(
                        fullCommandStr,
                        false // Commands executed by Gemini are non-interactive.
                    );

                    // Add the tool's response to the conversation history.
                    geminiConversationHistory.push({
                        role: "function",
                        parts: [
                            {
                                functionResponse: {
                                    name: commandName,
                                    response: {
                                        content: execResult.success
                                            ? execResult.output || "(No output from command)"
                                            : `Error: ${execResult.error || "Command failed"}`,
                                    },
                                },
                            },
                        ],
                    });
                } else if (textResponse) {
                    // If AI returns a text response, add it to history and return it as command output.
                    geminiConversationHistory.push(modelResponseTurn);
                    const formattedResponse = textResponse.replace(/\n\s*\n/g, '\n\n');
                    return { success: true, output: textResponse };
                } else {
                    // If AI returns neither text nor function call (unexpected), remove user prompt and report error.
                    geminiConversationHistory.pop();
                    return {
                        success: false,
                        error: "gemini: Received an empty or unsupported response.",
                    };
                }
            }
        },
    };

    const geminiDescription = "Engages in a context-aware conversation with the Gemini AI.";

    const geminiHelpText = `Usage: gemini [-n|--new] "<prompt>"

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

EXAMPLES
       # Ask a question that requires finding and reading files
       gemini "Summarize my README.md and list any scripts in this directory"

       # Ask a follow-up question
       gemini "Now, what was the first script you listed?"

       # Start a completely new conversation
       gemini -n "What is the capital of Illinois?"`;

    CommandRegistry.register("gemini", geminiCommandDefinition, geminiDescription, geminiHelpText);
})();