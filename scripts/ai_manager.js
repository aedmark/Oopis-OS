// scripts/ai_manager.js

class AIManager {
  constructor() {
    this.dependencies = {};
    this.PLANNER_SYSTEM_PROMPT = `You are a command-line Agent for OopisOS. Your goal is to formulate a plan of simple, sequential OopisOS commands to gather the necessary information to answer the user's prompt.

**Core Directives:**
1.  **Analyze the Request:** Carefully consider the user's prompt and the provided system context (current directory, files, etc.).
2.  **Formulate a Plan:** Create a step-by-step, numbered list of OopisOS commands.
3.  **Use Your Tools:** You may ONLY use commands from the "Tool Manifest" provided below. Do not invent commands or flags.
4.  **Simplicity is Key:** Each command in the plan must be simple and stand-alone. Do not use complex shell features like piping (|) or redirection (>) in your plan.
5.  **Be Direct:** If the prompt is a general knowledge question (e.g., "What is the capital of France?") or a simple greeting, answer it directly without creating a plan.
6.  **Quote Arguments:** Always enclose file paths or arguments that contain spaces in double quotes (e.g., cat "my file.txt").

--- TOOL MANIFEST ---
ls [-l, -a, -R], cd, cat, grep [-i, -v, -n, -R], find [path] -name [pattern] -type [f|d], tree, pwd, head [-n], tail [-n], wc, touch, xargs, shuf, tail, csplit, awk, sort, echo, man, help, set, history, mkdir
--- END MANIFEST ---`;

    this.SYNTHESIZER_SYSTEM_PROMPT = `You are a helpful digital librarian. Your task is to synthesize a final, natural-language answer for the user based on their original prompt and the provided output from a series of commands.

**Rules:**
- Formulate a comprehensive answer using only the provided command outputs.
- If the tool context is insufficient to answer the question, state that you don't know enough to answer.`;

    this.COMMAND_WHITELIST = [
      "ls", "cat", "cd", "grep", "find", "tree", "pwd", "head", "shuf",
      "xargs", "echo", "tail", "csplit", "wc", "awk", "sort", "touch",
    ];
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  async getApiKey(provider, options = {}) {
    const {StorageManager, ModalManager, OutputManager, Config} = this.dependencies;
    if (provider !== "gemini") {
      return {success: true, data: {key: null}};
    }

    const key = StorageManager.loadItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
    if (key) {
      return {success: true, data: {key, fromStorage: true}};
    }

    if (!options.isInteractive) {
      return {
        success: false,
        error: "A Gemini API key is required. Please run `gemini` once in an interactive terminal to set it up.",
      };
    }

    return new Promise((resolve) => {
      ModalManager.request({
        context: "terminal",
        type: "input",
        messageLines: ["Please enter your Gemini API key:"],
        obscured: true,
        onConfirm: (providedKey) => {
          if (!providedKey || providedKey.trim() === "") {
            resolve({
              success: false,
              error: "API key entry cancelled or empty.",
            });
            return;
          }
          StorageManager.saveItem(
              Config.STORAGE_KEYS.GEMINI_API_KEY,
              providedKey,
              "Gemini API Key"
          );
          OutputManager.appendToOutput("API Key saved.", {
            typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
          });
          resolve({
            success: true,
            data: {
              key: providedKey,
              fromStorage: false,
            },
          });
        },
        onCancel: () => {
          resolve({success: false, error: "API key entry cancelled."});
        },
        options,
      });
    });
  }

  async getTerminalContext() {
    const {CommandExecutor} = this.dependencies;
    const pwdResult = await CommandExecutor.processSingleCommand("pwd", {
      suppressOutput: true,
      isInteractive: false,
    });
    const lsResult = await CommandExecutor.processSingleCommand("ls -la", {
      suppressOutput: true,
      isInteractive: false,
    });
    const historyResult = await CommandExecutor.processSingleCommand(
        "history",
        {suppressOutput: true}
    );
    const setResult = await CommandExecutor.processSingleCommand("set", {
      suppressOutput: true,
    });

    return `## OopisOS Session Context ##
Current Directory:
${pwdResult.output || "(unknown)"}

Directory Listing:
${lsResult.output || "(empty)"}

Recent Commands:
${historyResult.output || "(none)"}

Environment Variables:
${setResult.output || "(none)"}`;
  }

  async callLlmApi(
      provider,
      model,
      conversation,
      apiKey,
      systemPrompt = null
  ) {
    const {Config} = this.dependencies;
    const providerConfig =
        typeof Config !== "undefined" ? Config.API.LLM_PROVIDERS[provider] : null;
    if (!providerConfig) {
      return {
        success: false,
        error: `LLM provider '${provider}' not configured.`,
      };
    }

    let url = providerConfig.url;
    let headers = {
      "Content-Type": "application/json",
    };
    let body;

    const chatMessages = [];
    if (systemPrompt) {
      chatMessages.push({
        role: "system",
        content: systemPrompt,
      });
    }
    conversation.forEach((turn) => {
      if (
          turn.role === "user" ||
          turn.role === "model" ||
          turn.role === "assistant"
      ) {
        chatMessages.push({
          role: turn.role === "model" ? "assistant" : turn.role,
          content: turn.parts.map((p) => p.text).join("\n"),
        });
      }
    });

    switch (provider) {
      case "gemini":
        headers["x-goog-api-key"] = apiKey;

        const filteredConversation = conversation.filter(
            (turn) => turn.role === "user" || turn.role === "model"
        );

        const requestBody = {
          contents: filteredConversation,
        };

        if (systemPrompt) {
          requestBody.systemInstruction = {
            parts: [
              {
                text: systemPrompt,
              },
            ],
          };
        }

        body = JSON.stringify(requestBody);
        break;
      case "ollama":
        url = url.replace("/generate", "/chat");
        body = JSON.stringify({
          model: model || providerConfig.defaultModel,
          messages: chatMessages,
          stream: false,
        });
        break;
      case "llm-studio":
        body = JSON.stringify({
          model: model || providerConfig.defaultModel,
          messages: chatMessages,
          temperature: 0.7,
          stream: false,
        });
        break;
      default:
        return {
          success: false,
          error: `Unsupported LLM provider: ${provider}`,
        };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
      });
      if (!response.ok) {
        const errorText = await response.text();
        if (
            provider === "gemini" &&
            response.status === 400 &&
            errorText.includes("API_KEY_INVALID")
        ) {
          return {
            success: false,
            error: "INVALID_API_KEY",
          };
        }
        return {
          success: false,
          error: `API request failed with status ${response.status}: ${errorText}`,
        };
      }

      const responseData = await response.json();
      let finalAnswer;
      switch (provider) {
        case "gemini":
          finalAnswer = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
          break;
        case "ollama":
          finalAnswer = responseData.message?.content || responseData.response;
          break;
        case "llm-studio":
          finalAnswer = responseData.choices?.[0]?.message?.content;
          break;
      }

      return finalAnswer
          ? {
            success: true,
            answer: finalAnswer,
          }
          : {
            success: false,
            error: "AI failed to generate a valid response.",
          };
    } catch (e) {
      if (provider !== "gemini" && e instanceof TypeError) {
        return {
          success: false,
          error: `LOCAL_PROVIDER_UNAVAILABLE`,
        };
      }
      return {
        success: false,
        error: `Network or fetch error: ${e.message}`,
      };
    }
  }

  async performAgenticSearch(
      prompt,
      history,
      provider,
      model,
      options = {}
  ) {
    const {verboseCallback, isInteractive} = options;
    const {ErrorHandler, StorageManager, Config} = this.dependencies;

    const INTENT_CLASSIFIER_PROMPT = `You are an intent classification agent for a command-line OS. Your task is to determine if the user's prompt is a general knowledge question/statement or if it is a query related to the local file system.

Respond with ONLY ONE of the following classifications:
- 'filesystem_query': If the user is asking about files, directories, system state, or asking to perform an action on the local system (e.g., "summarize my files", "list scripts", "what's in the docs folder?").
- 'general_query': If the user is asking a general knowledge question, making a statement, or having a conversation not related to the local file system (e.g., "what is the capital of France?", "tell me a story", "hello there").

User Prompt: "{{prompt}}"`;

    const apiKeyResult = await this.getApiKey(provider, {isInteractive, dependencies: this.dependencies});
    if (!apiKeyResult.success) {
      return ErrorHandler.createError(`AIManager: ${apiKeyResult.error}`);
    }
    let apiKey = apiKeyResult.data.key;

    const intentPrompt = INTENT_CLASSIFIER_PROMPT.replace("{{prompt}}", prompt);
    if (verboseCallback) {
      verboseCallback("AI is determining user intent...", "text-subtle");
    }

    let intentResult = await this.callLlmApi(
        provider,
        model,
        [{role: "user", parts: [{text: intentPrompt}]}],
        apiKey,
        null
    );

    if (!intentResult.success && intentResult.error === "LOCAL_PROVIDER_UNAVAILABLE" && provider !== "gemini") {
      if (verboseCallback) verboseCallback(`Could not connect to '${provider}'. Falling back to Google Gemini for intent classification.`, "text-warning");
      provider = "gemini";
      const fallbackKeyResult = await this.getApiKey(provider, {isInteractive, dependencies: this.dependencies});
      if (!fallbackKeyResult.success) return fallbackKeyResult;
      apiKey = fallbackKeyResult.data.key;
      intentResult = await this.callLlmApi(provider, model, [{
        role: "user",
        parts: [{text: intentPrompt}]
      }], apiKey, null);
    }

    const intent = intentResult.success ? intentResult.answer.trim().toLowerCase() : 'filesystem_query';
    if (verboseCallback) {
      verboseCallback(`Intent classified as: ${intent}`, "text-subtle");
    }

    if (intent.includes('general_query')) {
      if (verboseCallback) verboseCallback("Engaging general knowledge module...", "text-subtle");
      const generalPrompt = `You are a helpful assistant.`;
      const generalConversation = [...history, {role: "user", parts: [{text: prompt}]}];
      const finalResult = await this.callLlmApi(provider, model, generalConversation, apiKey, generalPrompt);

      if (finalResult.success) {
        return ErrorHandler.createSuccess(finalResult.answer);
      } else {
        return ErrorHandler.createError(`General Query failed: ${finalResult.error}`);
      }

    } else {
      if (verboseCallback) verboseCallback("Engaging filesystem tool-use module...", "text-subtle");
      const plannerContext = await this.getTerminalContext();
      const plannerPrompt = `User Prompt: "${prompt}"\n\n${plannerContext}`;
      const plannerConversation = [
        ...history,
        {
          role: "user",
          parts: [{text: plannerPrompt}],
        },
      ];

      let plannerResult = await this.callLlmApi(
          provider,
          model,
          plannerConversation,
          apiKey,
          this.PLANNER_SYSTEM_PROMPT
      );

      if (!plannerResult.success) {
        if (plannerResult.error === "INVALID_API_KEY" && provider === "gemini") {
          StorageManager.removeItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
          if (verboseCallback) verboseCallback("Gemini API key was invalid and has been removed.", "text-warning");
        }
        return ErrorHandler.createError(`Planner stage failed: ${plannerResult.error}`);
      }

      const planText = plannerResult.answer?.trim();
      if (!planText) return ErrorHandler.createError("AI failed to generate a valid plan.");

      const commandsToExecute = planText
          .split("\n")
          .filter((line) => {
            if (!line) return false;
            const commandName = line.split(" ")[0];
            return this.COMMAND_WHITELIST.includes(commandName);
          });

      if (commandsToExecute.length === 0) {
        return ErrorHandler.createSuccess(planText);
      }

      let executedCommandsOutput = "";
      if (verboseCallback) {
        verboseCallback(`AI's Plan:\n${commandsToExecute.map((c) => `- ${c}`).join("\n")}`, "text-subtle");
      }

      for (const commandStr of commandsToExecute) {
        const commandName = commandStr.split(" ")[0];
        if (!this.COMMAND_WHITELIST.includes(commandName)) {
          const errorMsg = `Execution HALTED: AI attempted to run a non-whitelisted command: '${commandName}'.`;
          if (verboseCallback) verboseCallback(errorMsg, "text-error");
          return ErrorHandler.createError(`Attempted to run restricted command: ${commandName}`);
        }

        if (verboseCallback) verboseCallback(`> ${commandStr}`, "text-info");
        const execResult = await this.dependencies.CommandExecutor.processSingleCommand(
            commandStr, {suppressOutput: true, isInteractive: false}
        );
        const output = execResult.success ? execResult.output || "(No output)" : `Error: ${execResult.error}`;
        if (verboseCallback) verboseCallback(output, "text-secondary");
        executedCommandsOutput += `--- Output of '${commandStr}' ---\n${output}\n\n`;
      }

      const synthesizerPrompt = `Original user question: "${prompt}"\n\nContext from file system:\n${executedCommandsOutput || "No commands were run."}`;
      const synthesizerResult = await this.callLlmApi(
          provider,
          model,
          [{role: "user", parts: [{text: synthesizerPrompt}]}],
          apiKey,
          this.SYNTHESIZER_SYSTEM_PROMPT
      );

      if (!synthesizerResult.success) {
        return ErrorHandler.createError(`Synthesizer stage failed: ${synthesizerResult.error}`);
      }

      const finalAnswer = synthesizerResult.answer;
      if (!finalAnswer) {
        return ErrorHandler.createError("AI failed to synthesize a final answer.");
      }
      return ErrorHandler.createSuccess(finalAnswer);
    }
  }
}
