// scripts/commands/remix.js

window.RemixCommand = class RemixCommand extends Command {
    constructor() {
        super({
            commandName: "remix",
            description: "Synthesizes a new article from two source documents using AI.",
            helpText: `Usage: remix [-p provider] [-m model] <file1> <file2>
      Combines and summarizes two documents into a unique article.
      DESCRIPTION
      The remix command uses the AI Manager to read two source files,
      understand the core ideas of each, and then generate a new,
      summarized article that synthesizes the information from both.
      It's a powerful tool for combining related topics or creating
      summaries of comparative works.
      PROVIDERS & MODELS
      -p, --provider <name>
      Specify the AI provider to use (e.g., 'gemini', 'ollama').
      If not specified, it defaults to 'gemini'. Using a local
      provider like 'ollama' does not require an API key.
      -m, --model <name>
      Specify a particular model for the chosen provider (e.g.,
      'llama3' for ollama). If not specified, the provider's
      default model is used.
      EXAMPLES
      remix /docs/api/permissions.md /docs/api/best_practices.md
      Creates a new article about the best practices for using the
      OopisOS permission model.
      remix -p ollama doc1.txt doc2.txt
      Uses the local 'ollama' provider for the remix.`,
            completionType: "paths",
            flagDefinitions: [
                { name: "provider", short: "-p", long: "--provider", takesValue: true },
                { name: "model", short: "-m", long: "--model", takesValue: true },
            ],
            validations: {
                args: {
                    exact: 2,
                    error: "Usage: remix <file1> <file2>"
                },
                paths: [{
                    argIndex: 0,
                    options: {
                        expectedType: 'file',
                        permissions: ['read']
                    }
                }, {
                    argIndex: 1,
                    options: {
                        expectedType: 'file',
                        permissions: ['read']
                    }
                }]
            },
        });
    }

    async coreLogic(context) {
        const { args, options, flags, validatedPaths, dependencies } = context;
        const { ErrorHandler, AIManager, OutputManager, Config, StorageManager } = dependencies;

        const file1Node = validatedPaths[0].node;
        const file1Path = validatedPaths[0].arg;
        const file2Node = validatedPaths[1].node;
        const file2Path = validatedPaths[1].arg;

        const file1Content = file1Node.content || "";
        const file2Content = file2Node.content || "";

        if (!file1Content.trim() || !file2Content.trim()) {
            return ErrorHandler.createError("remix: One or both input files are empty.");
        }

        const userPrompt = `Please synthesize the following two documents into a single, cohesive article. The article should blend the key ideas from both sources into a unique summary formatted in Markdown with paragraphs separated by double newlines.

--- DOCUMENT 1: ${file1Path} ---
${file1Content}
--- END DOCUMENT 1 ---

--- DOCUMENT 2: ${file2Path} ---
${file2Content}
--- END DOCUMENT 2 ---`;

        await OutputManager.appendToOutput("Remixing documents... The AI is pondering.", {
            typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        });

        const provider = flags.provider || "gemini";
        const model = flags.model || null;

        const apiKeyResult = await AIManager.getApiKey(provider, { isInteractive: true, dependencies });
        if (!apiKeyResult.success) {
            return ErrorHandler.createError(`remix: ${apiKeyResult.error}`);
        }
        const apiKey = apiKeyResult.data.key;

        const llmResult = await AIManager.callLlmApi(
            provider,
            model,
            [{ role: "user", parts: [{ text: userPrompt }] }],
            apiKey
        );

        if (llmResult.success) {
            let finalArticle = llmResult.answer;
            finalArticle = finalArticle.replace(/(?<!\n)\n(?!\n)/g, "\n\n");

            const articleHtml = DOMPurify.sanitize(marked.parse(finalArticle));
            const headerHtml = `
<h3>Remix of ${file1Path} & ${file2Path}</h3>`;

            return ErrorHandler.createSuccess(
                headerHtml + articleHtml,
                { asBlock: true, messageType: 'prose-output' }
            );
        } else {
            if (llmResult.error === "INVALID_API_KEY" && provider === 'gemini') {
                StorageManager.removeItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
                return ErrorHandler.createError("remix: Invalid API Key. The key has been removed. Please try again.");
            }
            return ErrorHandler.createError(`remix: The AI failed to process the documents. Reason: ${llmResult.error}`);
        }
    }
}

window.CommandRegistry.register(new RemixCommand());
