# OopisOS v2.7 Developer Documentation

- [1. Introduction](#1-introduction)
- [2. Project Overview](#2-project-overview)
- [3. Architecture](#3-architecture)
    - [Core System & Entry Point](#3-architecture)
    - [Command Processing Layer](#3-architecture)
    - [State & Persistence Layer](#3-architecture)
    - [UI & Interaction Layer](#3-architecture)
    - [Applications](#3-architecture)

- [4. Setup and Installation](#4-setup-and-installation)
    - [Prerequisites](#prerequisites)
    - [Development Setup](#development-setup)
    - [Project Structure](#project-structure)

- [5. Core Components](#5-core-components)
    - [Command System](#command-system)
    - [File System](#file-system)
    - [User & Group Management](#user--group-management)
    - [Session & State Management](#session--state-management)
    - [Terminal UI & Output](#terminal-ui--output)
    - [The Editor Application (`edit`)](#the-editor-application-edit)
    - [The Paint Application (`paint`)](#the-paint-application-paint)
    - [The Chidi.md Reader & Analyzer (`chidi`)](#the-chidimd-reader--analyzer-chidi)

- [6. Adding New Commands](#6-adding-new-commands)


## 1. Introduction

This documentation provides a comprehensive technical overview of the OopisOS v2.7 project. It is intended for developers who wish to understand, modify, or extend the system. OopisOS is a sophisticated, client-side web application that simulates a Unix-like operating system, emphasizing modularity, extensibility, and modern JavaScript practices.

## 2. Project Overview

OopisOS is a self-contained, browser-based terminal environment. Key characteristics include:

- **100% Client-Side:** The application runs entirely in the browser, with no backend server dependency.
- **Persistent State:** Data, including the file system, user credentials, and session information, is persisted locally using `IndexedDB` and `localStorage`.
- **Modular Architecture:** The system is composed of discrete manager modules and a file-based command registration system, promoting maintainability and extensibility.
- **Rich Feature Set:** Includes a hierarchical file system, a multi-user model with groups and permissions, a suite of ~60 commands, I/O redirection and piping, background job control, and several full-screen applications (`edit`, `paint`, `chidi`, `adventure`).

## 3. Architecture

OopisOS is built on a modular architecture where different concerns are handled by specialized manager objects.

1. **Core System & Entry Point**

    - `index.html`: The main entry point. It defines the basic DOM structure and is responsible for loading all necessary JavaScript modules in the correct order.
    - `main.js`: Handles the OS boot sequence (`window.onload`), caching essential DOM elements, initializing all managers, and setting up the primary terminal event listeners.
    - `config.js`: A central module providing system-wide configuration constants, from API endpoints to default file permissions and UI message strings.
    - `utils.js`: A collection of globally accessible, stateless utility functions for tasks like DOM element creation, string formatting, and data validation.
2. **Command Processing Layer**

    - `lexpar.js`: Contains the **Lexer** and **Parser**. The Lexer transforms the raw command string into a sequence of tokens (e.g., `WORD`, `OPERATOR_PIPE`). The Parser then consumes this token stream to build a structured, executable representation of command pipelines.
    - `commexec.js`: The **CommandExecutor** is the central orchestrator for all command execution. It does _not_ contain command logic itself. Instead, it processes the parsed pipelines, manages I/O between piped commands, handles output redirection (`>`/`>>`), and launches/manages background processes (`&`).
    - `scripts/commands/registry.js`: The **CommandRegistry** provides a central `register` function. Each individual command file calls this function to make the `CommandExecutor` aware of its existence, definition, and help text.
    - `scripts/commands/*.js`: Each file in this directory defines a single command, its validation rules, and its core logic. This modular approach keeps command logic isolated and maintainable.
3. **State & Persistence Layer**

    - `storage.js`: Implements the `StorageManager` (a robust wrapper for `localStorage`) and the `IndexedDBManager` (which handles the database connection for the file system).
    - `fs_manager.js`: The **FileSystemManager** controls the in-memory representation of the virtual file system (`fsData`) and orchestrates saving it to and loading it from `IndexedDB`.
    - `user_manager.js`: The **UserManager** and **GroupManager** handle user accounts, authentication (password hashing, login/su flow), and group memberships.
    - `session_manager.js`: Contains the **SessionManager** (which manages the user stack for `su`/`logout` and manual/automatic session state snapshots) and the **EnvironmentManager** (which handles session-specific variables like `$USER` and `$PATH`).
4. **UI & Interaction Layer**

    - `terminal_ui.js`: Manages all interactive components of the terminal, including the prompt, the user input line, tab completion logic (`TabCompletionManager`), and modal dialogs (`ModalManager`, `ModalInputManager`).
    - `output_manager.js`: The sole conduit for displaying text on the terminal screen. It handles formatting, styling, and console overrides.
5. **Applications**

    - `editor.js`: The full-screen text editor application (`edit`).
    - `oopis_paint.js`: The character-based art studio application (`paint`).
    - `chidi_app.js`: The AI-powered Markdown analyzer (`chidi`).
    - `text_adventure.js`: The text adventure game engine (`adventure`).

## 4. Setup and Installation

### Prerequisites

- A modern web browser that supports ES6+ JavaScript, `IndexedDB`, and the Web Crypto API.
- For local development, a simple web server is required to handle file loading without running into CORS issues.

### Development Setup

1. Clone or download the project repository.
2. Navigate to the project's root directory in your local terminal.
3. Start a local web server. A simple one can be run with Python: `python -m http.server`.
4. Open your browser and navigate to the local server's address (e.g., `http://localhost:8000`).

### Project Structure

Plaintext

```
oopisOS/
├── docs/                 # Documentation files (guide.html, zine.html, etc.)
├── extras/               # Helper scripts (diag.sh, inflate.sh)
├── scripts/
│   ├── commands/         # <-- All individual command definitions reside here
│   │   ├── ls.js
│   │   ├── cat.js
│   │   └── ... (60+ command files)
│   ├── chidi_app.js
│   ├── commexec.js       # Command Executor
│   ├── config.js
│   ├── editor.js
│   ├── fs_manager.js
│   ├── lexpar.js
│   ├── main.js           # Main boot sequence
│   ├── marked.min.js     # Markdown parsing library
│   ├── oopis_paint.js
│   ├── output_manager.js
│   ├── registry.js       # Command Registry
│   ├── session_manager.js
│   ├── storage.js
│   ├── terminal_ui.js
│   ├── text_adventure.js
│   ├── user_manager.js
│   └── utils.js
├── style.css             # Unified stylesheet
├── index.html            # Main application entry point
└── LICENSE.txt
```

## 5. Core Components

### Command System

The command system is the heart of OopisOS's interactivity. The execution flow is as follows:

1. **Input:** The user types a command in the terminal UI.
2. **Environment Variable Expansion:** The `CommandExecutor` first scans the raw string for `$VAR` or `${VAR}` patterns and replaces them with values from the `EnvironmentManager`.
3. **Alias Expansion:** The first word of the command is checked against the `AliasManager`. If it's an alias, it's expanded (recursively, with a depth limit to prevent loops).
4. **Tokenization:** The resulting command string is passed to the `Lexer`, which breaks it into a flat array of `Token` objects (e.g., `WORD`, `OPERATOR_PIPE`).
5. **Parsing:** The `Parser` consumes the token stream and builds an array of `ParsedPipeline` objects. Each pipeline contains segments (the commands) and metadata for redirection or backgrounding.
6. **Execution:** The `CommandExecutor` iterates through the pipelines. For each command segment, it looks up the command handler in the `commands` object (populated at boot time from the `CommandRegistry`). It then calls this handler, passing a context object with parsed arguments, flags, and options.

### File System

- **Data Structure:** The entire file system is a single JavaScript object stored in `fsData`. Directories are nodes with a `children` property. Files are nodes with `content`, `owner`, `group`, and `mode` properties.
- **Persistence:** The `FileSystemManager` uses the `IndexedDBManager` to save the `fsData` object. This provides a transactional, asynchronous, and robust storage mechanism suitable for larger data sets.
- **Permissions:** The `hasPermission` function in `FileSystemManager` is the single source of truth for all access control. It checks a user's name and group memberships against a node's owner, group, and 3-digit octal `mode`. The `root` user bypasses all checks.

### User & Group Management

- **Credentials:** Usernames, securely hashed passwords (SHA-256 via the Web Crypto API), and primary group assignments are stored in a single object in `localStorage`.
- **Groups:** A separate `localStorage` object maps group names to arrays of member usernames.
- **Authentication Flow:** The `UserManager` centralizes the authentication logic. It first attempts to authenticate with a command-line-provided password. If that fails or isn't provided, and the user account requires a password, it uses the `ModalInputManager` to securely prompt the user.

### Session & State Management

- **Session Stack:** A simple array, `userSessionStack`, tracks the active user. `su` pushes a user onto the stack; `logout` pops from it.
- **Automatic State:** Before a user switch (`su` or `login`), the current session (terminal output, history, environment variables) is saved to a user-specific key in `localStorage`. This state is restored when the user's session becomes active again.
- **Manual Snapshots (`savestate`):** This saves the current session state _and_ a complete, deep-copied snapshot of the entire file system to `localStorage`.
- **Full Backup (`backup`):** This command gathers all `localStorage` data (users, groups, all session states) and the current file system snapshot into a single JSON object that is then offered to the user as a downloadable file.

### Terminal UI & Output

- **Modularity:** The UI is managed by a set of distinct modules within `terminal_ui.js`:
    - `ModalManager`: Handles graphical and terminal-based (Y/N) confirmation dialogs. Crucially, it is script-aware and will consume input from a running script instead of prompting a real user.
    - `ModalInputManager`: Manages single-line, dedicated input for things like passwords, with support for obscured input.
    - `TabCompletionManager`: Provides context-aware completion for commands, paths, and users.
- **Single Output Channel:** All terminal output is routed through `OutputManager.appendToOutput`. This ensures that output is correctly handled, styled, and suppressed when full-screen applications are active.

### The Editor Application (`edit`)

The editor (`editor.js`) is a modal application with a clear separation of concerns.

- **`EditorUI`:** Manages all DOM elements. It builds the layout, updates the status bar, renders line numbers, and handles view mode changes. It receives instructions from the `EditorManager`.
- **`EditorManager`:** Manages the application's state, including the file path, content, dirty status, undo/redo stacks, and current view mode. It processes all user input (keyboard shortcuts, button clicks) and orchestrates UI updates and file system interactions via the `FileSystemManager`.
- **Live Preview:** For HTML, the preview is rendered in a sandboxed `<iframe>` to prevent style conflicts and execution of malicious scripts. For Markdown, the `marked.js` library is used to convert the text to HTML, which is then injected into the preview pane.

### The Paint Application (`paint`)

The paint application (`oopis_paint.js`) provides a character-based art studio.

- **Data Model:** The canvas is a 2D array, where each cell is an object: `{ char, fg, bg }`. All drawing operations manipulate this data model, which is then rendered to the DOM by `PaintUI`.
- **File Format:** Saved `.oopic` files are JSON serializations of the canvas data model, including width and height metadata. This makes them portable and easy to parse.
- **Undo/Redo:** Like the editor, it uses an undo/redo stack, saving the entire `canvasData` state after each drawing action (debounced for performance).

### The Chidi.md Reader & Analyzer (`chidi`)

The Chidi application (`chidi_app.js`) is a powerful tool for working with Markdown files.

- **Recursive File Gathering:** The `chidi` command recursively traverses the specified directory to find all `.md` files, respecting read and execute permissions.
- **RAG Strategy:** The "Ask" feature uses a **Retrieval-Augmented Generation** approach. To answer a question across all loaded documents, it first performs a local keyword search to identify the most relevant files. It then constructs a single, focused prompt for the Gemini API containing only the content of those relevant files. This improves accuracy, reduces API token usage, and allows it to handle a larger corpus of documents than would fit in a single prompt.

## 6. Adding New Commands

The v2.7 architecture makes adding new commands simple and clean.

**Step 1: Create the Command File**

Create a new JavaScript file in the `scripts/commands/` directory (e.g., `mycommand.js`).

**Step 2: Define the Command**

Inside your new file, create an IIFE and define your command using the declarative object pattern. Register it with the `CommandRegistry`.

JavaScript

```
// scripts/commands/mycommand.js
(() => {
    "use strict";

    // 1. Define the command's behavior and requirements.
    const myCommandDefinition = {
        commandName: "mycommand",
        flagDefinitions: [
            { name: "verbose", short: "-v", long: "--verbose" }
        ],
        argValidation: {
            min: 1,
            error: "Usage: mycommand [-v] <path>"
        },
        pathValidation: [
            {
                argIndex: 0, // Validate the first argument (at index 0) as a path.
                options: { expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE }
            }
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read"]
            }
        ],
        // 2. Write the core logic. It only runs if all the above checks pass.
        coreLogic: async (context) => {
            // The context object contains everything you need, fully validated.
            const { args, flags, currentUser, validatedPaths } = context;
            
            // validatedPaths[0] is guaranteed to be a valid, readable file path object.
            const pathInfo = validatedPaths[0];
            
            if (flags.verbose) {
                await OutputManager.appendToOutput(`Verbose mode ON for user ${currentUser}`);
            }

            // Command implementation goes here...
            const content = pathInfo.node.content;
            
            return {
                success: true,
                output: `Successfully processed ${pathInfo.resolvedPath}. Content length: ${content.length}.`
            };
        }
    };

    // 3. Define the help texts for 'help' and 'man'.
    const myCommandDescription = "A brief, one-line description for the 'help' command.";
    const myCommandHelpText = `Usage: mycommand [OPTIONS] <path>

A detailed explanation of the command, its purpose, and how to use it.
This text is used by the 'man' command.

OPTIONS
  -v, --verbose    Enable verbose output.

EXAMPLES
  mycommand /home/Guest/README.md       An example of how to use the command.`;

    // 4. Register the command with the system.
    CommandRegistry.register("mycommand", myCommandDefinition, myCommandDescription, myCommandHelpText);
})();

```

**Step 3: Register the Script in `index.html`**

Open `index.html` and add a `<script>` tag for your new command file. It must be placed after `scripts/commands/registry.js` but before `scripts/commexec.js`.

HTML

```
...
<script src="./scripts/commands/registry.js"></script>
<script src="./scripts/commands/ls.js"></script>
<script src="./scripts/commands/mycommand.js"></script> <script src="./scripts/commands/pwd.js"></script>
...
<script src="./scripts/commexec.js"></script>
...
```

The `CommandExecutor` will automatically discover and integrate your command upon the next page load.

## 7. APIs and Extension Points

The primary way to extend OopisOS is by adding new commands, but you can also interact with the core managers:

- **`CommandRegistry`**: Use `register()` to add new commands.
- **`FileSystemManager`**: Provides a robust API for all VFS interactions: `getNodeByPath`, `createOrUpdateFile`, `deleteNodeRecursive`, `hasPermission`, etc.
- **`UserManager` & `GroupManager`**: Manage users and groups programmatically.
- **`TerminalUI` & `OutputManager`**: Control the terminal display, request user input, and manage modal dialogs.

## 8. Best Practices

- **Leverage the Framework:** Use the declarative command definition pattern (`argValidation`, `pathValidation`, `permissionChecks`) to let the `CommandExecutor` handle common validation and error-checking tasks.
- **Use the Managers:** Interact with the file system, users, and terminal UI through their respective manager APIs. Avoid direct DOM manipulation outside of dedicated UI modules like `EditorUI`.
- **Provide User Feedback:** For long-running or destructive operations, use the `ModalManager` to request confirmation. Provide clear success and error messages via the `OutputManager`.
- **Document Your Work:** For any new command, provide a clear `description` and comprehensive `helpText` upon registration.

## 9. Troubleshooting

- **Command Not Found:**
    1. Verify the `<script>` tag for your command exists in `index.html`.
    2. Check the browser's developer console for any syntax errors in your command file that might prevent it from loading.
    3. Ensure the `commandName` in your definition object matches what you're typing.
- **Permission Denied:** Use `ls -l` and `groups` to verify the active user's permissions for the target file or directory. Remember that you need write permission on a directory to create or delete files within it.
- **Unexpected Behavior:** Use `console.log` within your command's `coreLogic` to inspect the `context` object you receive. Check that arguments, flags, and validated paths are what you expect. Use the `diag.sh` script to test for regressions in core functionality.