# OopisOS and Gemini: The Tool-Using AI Assistant

### 1. Executive Summary

The `gemini` command is the conversational AI powerhouse of OopisOS. It is a versatile assistant that can function as a powerful, system-aware agent capable of executing commands to answer complex questions, or as a direct-line conversationalist to locally-run models. This dual nature makes it one of the most powerful and flexible tools in the entire OS, seamlessly bridging the gap between natural language and shell commands.

Unlike `chidi`, which is a specialist application for analyzing a pre-defined set of documents, `gemini` is a generalist that can reason about the state of the system, plan a course of action, and synthesize information from multiple sources—including the live file system—to fulfill a user's request.

### 2. Core Concepts: The Two Modes of Operation

The `gemini` command operates in two primary modes, determined by the chosen provider.

#### **A. Tool-Using Agent (Default `gemini` Provider)**

When using the default `gemini` provider, the command becomes a sophisticated, multi-step agent. This process is entirely automated:

1.  **Planning:** The AI first acts as a **Planner**. It analyzes your prompt and the current directory context, then formulates a step-by-step plan of whitelisted shell commands (`ls`, `cat`, `grep`, `find`, etc.) required to gather the necessary information.
2.  **Execution:** The `CommandExecutor` securely runs the commands from the plan. The output of these commands is captured.
3.  **Synthesis:** The AI then acts as a **Synthesizer**. It reviews your original question and the collected command outputs, and formulates a final, comprehensive, natural-language answer.

This is the most powerful mode, as it allows the AI to dynamically interact with your file system to answer questions like, "Which of my text files contains the word 'OopisOS'?"

#### **B. Direct Chat (Local Providers like `ollama` or `llm-studio`)**

When you specify a local provider using the `-p` flag, `gemini` acts as a direct conduit to your model. The conversational history and your prompt are sent directly, without a planning or tool-use phase. This is ideal for creative tasks, general knowledge questions, or code generation where file system context is not required.

### 3. Configuration: Connecting to Local Models

You can configure OopisOS to connect to any OpenAI-compatible local LLM provider, such as Ollama or LM Studio.

All provider configurations are stored in `scripts/config.js` within the `Config.API.LLM_PROVIDERS` object.

```javascript
// From scripts/config.js
LLM_PROVIDERS: {
    'gemini': {
        url: "[https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent](https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent)",
        defaultModel: "gemini-2.5-flash"
    },
    'ollama': {
        url: "http://localhost:11434/api/generate",
        defaultModel: "gemma3:12b"
    },
    'llm-studio': {
        url: "http://localhost:1234/v1/chat/completions",
        defaultModel: "lmstudio-community/gemma-2b-it-v1.1-gguf"
    }
}