# OopisOS v3.0 Architectural Documentation

## 1. Design Philosophy & Core Principles

This document provides a comprehensive architectural overview of the OopisOS v3.0 project. It is intended for developers who will build upon, extend, or maintain the system. To contribute effectively, it is essential to first understand the philosophical underpinnings of the architecture.

OopisOS is more than a simulated operating system; it is an exploration of a fully self-contained, secure, and persistent client-side application paradigm. Its design is governed by five foundational pillars. Every component and decision must be weighed against these principles.

1.  **Radical Self-Reliance:** The system is 100% client-side. It has no dependency on a backend server for its core logic, state, or execution. This principle dictates that all functionality, from command execution to data storage, must be achievable within the confines of a modern web browser.
2.  **Architected Persistence:** The system state is not ephemeral. The virtual file system, user credentials, session data, and command history are all meticulously persisted locally. This ensures a continuous, reliable user experience across sessions and makes the user the sole custodian of their data.
3.  **Enforced Modularity:** The system is composed of discrete, specialized components with well-defined responsibilities and interfaces. This is not merely for organization; it is a critical strategy for security, maintainability, and extensibility. Logic is never intermingled; it is orchestrated.
4.  **Security by Design:** Security is not a feature or an afterthought; it is a foundational requirement woven into the fabric of the architecture. This is manifested through a strict permission model, sandboxed execution for untrusted content, robust input validation, and secure credential handling. We operate on the principle of least privilege.
5.  **Contained & Orchestrated Execution:** All operations flow through specific, controlled channels. The Command Executor is the central orchestrator for command processing, and the Output Manager is the sole conduit for display. This containment ensures predictability, simplifies debugging, and prevents unintended side effects.

## 2. System Architecture

The architecture is layered, ensuring a clear separation of concerns. Each layer communicates through well-defined APIs provided by the manager modules.

#### **Layer 1: The System Bootstrap & Core Plane**

This is the foundational layer that brings the OS to life.

-   `index.html`: The vessel. Defines the minimal DOM structure required for the system to attach to. Its primary responsibility is loading all JavaScript modules in a precise, deterministic order, which is critical for ensuring dependencies are met before initialization.
-   `main.js`: The "ignition sequence." On `window.onload`, it initiates the boot process, caches essential DOM elements for performance, and systematically initializes all manager modules. It establishes the primary connection between the user and the system by setting up the core terminal event listeners.
-   `config.js`: The system's constitution. A centralized, immutable source of truth for system-wide constants. This includes everything from default permission modes to UI message strings. Centralizing configuration prevents magic strings and numbers, making the system more maintainable and predictable.
-   `utils.js`: A toolkit of pure, stateless functions. These are globally accessible utilities for common, repetitive tasks (DOM creation, string manipulation, etc.). Their stateless nature makes them safe, predictable, and highly reusable.

#### **Layer 2: The Command Lifecycle & Execution Engine**

This layer is responsible for translating user input into secure, executable actions. The multi-stage pipeline is a classic, robust design pattern chosen specifically to isolate and secure each phase of command processing.

-   `lexpar.js`: Contains the **Lexer** and **Parser**. The Lexer deconstructs the raw command string into a sequence of well-defined tokens (e.g., `WORD`, `OPERATOR_PIPE`), neutralizing the ambiguity of raw text. The Parser then constructs an abstract syntax tree—a structured, executable representation of command pipelines—from this token stream. This structured representation is vital for the executor to understand the user's intent without ambiguity.
-   `commexec.js`: The **CommandExecutor** is the heart of the system's logic, acting as a central processing unit. It does **not** contain any command-specific logic itself. Its sole purpose is to orchestrate the execution pipeline: managing I/O between piped commands, handling file redirection (`>`/`>>`), and managing background processes (`&`). This separation is a key security feature, preventing command-level logic from influencing the execution environment itself.
-   `scripts/commands/registry.js`: The **CommandRegistry** serves as the system's central service locator for commands. Each command file registers itself, its definition, and its help text. This allows for a completely decoupled, file-based command system where new commands can be added without modifying the core executor.
-   `scripts/commands/*.js`: Each file is a self-contained, modular command definition. This design ensures that command logic is isolated, easy to maintain, and can be tested independently.

#### **Layer 3: The State & Persistence Core**

This layer manages the system's "memory"—both short-term (session) and long-term (disk).

-   `storage.js`: A low-level abstraction layer. The `StorageManager` provides a robust, standardized interface for `localStorage`, while the `IndexedDBManager` handles the more complex, asynchronous operations required for the file system database. This abstraction allows us to change the underlying storage mechanism in the future without refactoring the entire system.
-   `fs_manager.js`: The **FileSystemManager** is the gatekeeper for the entire virtual file system. It manages the in-memory representation (`fsData`) and orchestrates its persistence to `IndexedDB`. The choice of `IndexedDB` is deliberate: it provides transactional, asynchronous storage suitable for the complex, object-based nature of a file system.
-   `user_manager.js`: The **UserManager** and **GroupManager** control all aspects of identity and authentication. They are the sole authorities on user accounts, password validation (using the Web Crypto API for secure hashing), and group memberships.
-   `session_manager.js`: The **SessionManager** and **EnvironmentManager** handle the ephemeral state of a user's session. This includes the user stack for `su`/`logout`, environment variables (`$USER`, `$PATH`), and the crucial logic for creating and restoring session snapshots.

#### **Layer 4: The Human-Interface Bridge**

This layer abstracts all user interaction, ensuring that the core system remains independent of the presentation layer.

-   `terminal_ui.js`: Manages the interactive surface of the terminal. This includes the command prompt, user input line, sophisticated tab completion, and modal dialogs. Its components are designed to be script-aware, a critical feature for testing and automation.
-   `output_manager.js`: The single, disciplined channel for all terminal display output. By forcing all output through the `OutputManager`, we ensure consistent formatting, proper handling of output streams, and the ability to suppress or redirect output when full-screen applications are active.

## 3. Core Component Deep Dive

Here, we analyze key components through the lens of our architectural principles.

### The Command System: Secure by Process

The command execution flow is a direct implementation of our **Security by Design** and **Contained Execution** principles.

1.  **Input & Expansion:** The `CommandExecutor` first performs environment variable and alias expansion. This happens _before_ tokenization.
2.  **Tokenization (Lexer):** The command string is converted into a safe, predictable sequence of tokens. This step neutralizes potentially malicious input by transforming it into a structured format.
3.  **Parsing (Parser):** The token stream is built into an Abstract Syntax Tree. This creates a formal, unambiguous execution plan. At this stage, a malformed command is simply a parsing error, not a potential security exploit.
4.  **Execution (Executor):** The `CommandExecutor` traverses the execution plan. It looks up the requested command in the `CommandRegistry` and invokes it, passing a **secure, pre-validated context object**. The command's `coreLogic` only receives what the executor has deemed safe and valid.

### The File System: A Bastion of State

-   **Structure & Persistence:** The VFS is a single, coherent JavaScript object (`fsData`), a design that allows for atomic updates and simple serialization. Using `IndexedDB` (via `FileSystemManager`) ensures **Architected Persistence** with transactional integrity, preventing data corruption.
-   **Security Gateway:** The `hasPermission` function in `FileSystemManager` is the **single source of truth** for all access control. All file operations, without exception, must pass through this gateway. It rigorously checks user/group ownership against a node's octal `mode`. This centralization is a cornerstone of our security model. The `root` user's ability to bypass these checks is an explicit, and carefully managed, exception.

### User & Credential Management: The Keys to the Kingdom

-   **Secure Storage:** We use the browser's built-in **Web Crypto API** to perform one-way SHA-256 hashing of passwords before they are stored. Plaintext passwords never touch our persistent storage. This is a non-negotiable implementation of **Security by Design**.
-   **Centralized Authentication:** All authentication logic is centralized in the `UserManager`. This prevents the proliferation of disparate, potentially insecure login flows. When interactive password entry is required, the `ModalInputManager` is used to provide a secure, dedicated input channel, preventing password leakage into command history or the screen.

### Full-Screen Applications: Contained Ecosystems

Our full-screen applications (`edit`, `paint`, `chidi`) are not just features; they are case studies in applying our architectural principles.

-   **`edit` (The Editor):** Demonstrates the separation of concerns. The `EditorUI` handles only rendering, while the `EditorManager` manages state (content, dirty status, undo/redo stacks). The live HTML preview is rendered in a **sandboxed `<iframe>`**. This is a critical security measure to prevent style conflicts and, more importantly, to block execution of potentially malicious scripts within a user's document, perfectly exemplifying **Security by Design**.
-   **`paint` (The Art Studio):** The canvas is an abstract data model (a 2D array of objects), completely decoupled from the DOM. `PaintUI`'s only job is to render this model. Saved `.oopic` files are a clean JSON serialization of this model, embodying **Architected Persistence** in a portable format.
-   **`chidi` (The Analyzer):** The "Ask" feature's use of a Retrieval-Augmented Generation (RAG) strategy is a prime example of **Radical Self-Reliance** and intelligent design. By pre-filtering for relevant files locally before constructing a focused prompt for the Gemini API, the application conserves external resources, improves accuracy, and operates efficiently within the constraints of the client environment.

## 4. Extending the System: Adding New Commands

The process for adding new commands is designed to be simple, secure, and consistent with our principle of **Enforced Modularity**.

**Step 1: Create the Command File** Create a new file in `scripts/commands/` (e.g., `mycommand.js`). The file itself is the module.

**Step 2: Define the Command Contract** Inside the file, use an IIFE to prevent global scope pollution. Define your command using the declarative object pattern. This pattern is not for convenience; it is a **security contract**. You are declaring the command's requirements to the executor.

```javascript
// scripts/commands/mycommand.js
(() => {
    "use strict";

    // The command's formal definition and contract with the CommandExecutor.
    const myCommandDefinition = {
        commandName: "mycommand",
        // Declare all flags. The executor will parse them for you.
        flagDefinitions: [
            { name: "verbose", short: "-v", long: "--verbose" }
        ],
        // Declare argument cardinality. The executor enforces this.
        argValidation: {
            min: 1,
            error: "Usage: mycommand [-v] <path>"
        },
        // Declare which arguments are paths and their expected type.
        // The executor validates existence and type.
        pathValidation: [
            {
                argIndex: 0,
                options: { expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE }
            }
        ],
        // Declare required permissions. The executor performs the check
        // using the FileSystemManager's security gateway.
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read"]
            }
        ],
        // The core logic only executes if every single one of the
        // above declarations is satisfied by the executor.
        coreLogic: async (context) => {
            // 'context' is a secure, pre-validated object. You can trust its contents.
            const { args, flags, currentUser, validatedPaths } = context;
            
            // Thanks to the contract, this path is guaranteed to exist and be readable.
            const pathInfo = validatedPaths[0];
            
            if (flags.verbose) {
                await OutputManager.appendToOutput(`Verbose mode ON for user ${currentUser}`);
            }

            const content = pathInfo.node.content;
            
            return {
                success: true,
                output: `Successfully processed ${pathInfo.resolvedPath}. Content length: ${content.length}.`
            };
        }
    };

    // Human-readable documentation for the 'help' and 'man' commands.
    const myCommandDescription = "A brief, one-line description of the command.";
    const myCommandHelpText = `Usage: mycommand [OPTIONS] <path>

A detailed explanation of the command, its purpose, and its behavior.
This text is the foundation of our user-facing documentation.

OPTIONS
  -v, --verbose    Enable verbose, detailed output.`;

    // Register the command, its contract, and its documentation with the system.
    CommandRegistry.register("mycommand", myCommandDefinition, myCommandDescription, myCommandHelpText);
})();