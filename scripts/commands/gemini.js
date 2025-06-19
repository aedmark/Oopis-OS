// scripts/commands/gemini.js

(() => {
    "use strict";

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

        const _callGeminiApi = async (apiKey, conversationHistory) => {
            const GEMINI_API_URL = Config.API.GEMINI_URL
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
                        tools: OopisOS_TOOLS,
                        system_instruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
                    }),
                });

                if (!response.ok) {
                    let errorBody = null;
                    try {
                        errorBody = await response.json();
                    } catch (e) {
                        return {
                            success: false,
                            error: `API request failed with status ${response.status}. ${response.statusText}`,
                        };
                    }
                    if (
                        response.status === 400 &&
                        errorBody?.error?.message.includes("API key not valid")
                    ) {
                        return { success: false, error: "INVALID_API_KEY" };
                    }
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

        const apiKeyResult = await _getApiKey();
        if (!apiKeyResult.success) {
            return { success: false, error: `gemini: ${apiKeyResult.error}` };
        }
        const apiKey = apiKeyResult.key;

        const userPrompt = args.join(" ");
        if (userPrompt.trim() === "") {
            return { success: false, error: "gemini: Prompt cannot be empty." };
        }

        if (flags["new"]) {
            geminiConversationHistory = [];
            if (options.isInteractive) {
                await OutputManager.appendToOutput(
                    "Starting a new conversation with Gemini.",
                    { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG }
                );
            }
        }

        geminiConversationHistory.push({
            role: "user",
            parts: [{ text: userPrompt }],
        });

        if (options.isInteractive && geminiConversationHistory.length <= 1) {
            await OutputManager.appendToOutput("Gemini is thinking...", {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            });
        }

        while (true) {
            const apiResult = await _callGeminiApi(
                apiKey,
                geminiConversationHistory
            );

            if (!apiResult.success) {
                geminiConversationHistory.pop(); // Remove the failed user prompt
                if (apiResult.error === "INVALID_API_KEY") {
                    StorageManager.removeItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
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

            if (!candidate || !candidate.content || !candidate.content.parts) {
                geminiConversationHistory.pop(); // The user's prompt failed, so remove it.

                // Explicitly check for promptFeedback and its blockReason property
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

                // Explicitly check for an error message on the result object
                const errorMessage =
                    result.error && result.error.message
                        ? result.error.message
                        : "Received an invalid or empty response from the API.";
                return { success: false, error: `gemini: ${errorMessage}` };
            }

            let textResponse = "";
            let functionCall = null;
            for (const part of candidate.content.parts) {
                if (part.text) {
                    textResponse += part.text;
                } else if (part.functionCall) {
                    functionCall = part.functionCall;
                    break;
                }
            }

            const modelResponseTurn = {
                role: "model",
                parts: candidate.content.parts,
            };

            if (functionCall) {
                geminiConversationHistory.push(modelResponseTurn);
                if (textResponse && options.isInteractive) {
                    await OutputManager.appendToOutput(textResponse);
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
                const commandArgs = Object.values(functionCall.args || {})
                    .map((arg) => (typeof arg === "string" ? `"${arg}"` : arg))
                    .join(" ");
                const fullCommandStr = `${commandName} ${commandArgs}`.trim();
                const execResult = await CommandExecutor.processSingleCommand(
                    fullCommandStr,
                    false
                );

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
                geminiConversationHistory.push(modelResponseTurn);
                return { success: true, output: textResponse };
            } else {
                geminiConversationHistory.pop();
                return {
                    success: false,
                    error: "gemini: Received an empty or unsupported response.",
                };
            }
        }
    },
};

        const geminiDescription = "Sends a context-aware prompt to Gemini AI.";
        const geminiHelpText = `Usage: gemini [-n|--new] "<prompt>"

			Engages in a context-aware conversation with the Gemini AI.

			FEATURES:
			- FILE SYSTEM AWARENESS: Can run OopisOS commands (ls, cat, find, etc.)
			to gather information from your file system to answer questions.

			- CONVERSATIONAL MEMORY: Remembers the previous turns of your
			conversation. You can ask follow-up questions, and Gemini will
			understand the context.

			- SESSION CONTROL:
			-n, --new    Starts a new, fresh conversation, clearing any
			previous conversational memory for this session.

			EXAMPLES:
			# Ask a question that requires finding and reading files
			gemini "Summarize my README.md and list the functions in diag_2.3.sh"

			# Ask a follow-up question (Gemini remembers the context)
			gemini "Now, what was the first function you listed?"

			# Start a completely new conversation, ignoring the previous one
			gemini -n "What is OopisOS?"`;

    CommandRegistry.register("gemini", geminiCommandDefinition, geminiDescription, geminiHelpText);
})();