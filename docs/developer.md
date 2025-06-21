# OopisOS Developer Documentation

## Table of Contents
1.  [Introduction](#introduction)
2.  [Project Overview](#project-overview)
3.  [Architecture](#architecture)
4.  [Setup and Installation](#setup-and-installation)
5.  [Core Components](#core-components)
   -   [Command System](#command-system)
   -   [File System](#file-system)
   -   [User & Group Management](#user--group-management)
   -   [Session & State Management](#session--state-management)
   -   [Terminal UI & Output](#terminal-ui--output)
   -   [The Editor Application (`edit`)](#the-editor-application-edit)
   -   [The Paint Application (`paint`)](#the-paint-application-paint)
   -   [The Chidi.md Reader & Analyzer (`chidi`)](#the-chidi-md-reader--analyzer-chidi)
6.  [Adding New Commands](#adding-new-commands)
7.  [APIs and Extension Points](#apis-and-extension-points)
8.  [Best Practices](#best-practices)
9.  [Troubleshooting](#troubleshooting)

## Introduction

This documentation is intended for developers who want to understand, modify, or extend the OopisOS project. OopisOS is a web-based terminal/OS simulation that provides a Unix-like environment in the browser, built with vanilla JavaScript and a focus on modularity.

## Project Overview

OopisOS is a JavaScript-based terminal emulator that simulates a Unix-like operating system in the browser. It features:

-   Command-line interface with tab completion and history.
-   Virtual file system with persistence via IndexedDB.
-   A multi-user system with groups and a robust permission model.
-   Command pipelines, I/O redirection, and background processes.
-   Full-screen applications including a text editor, a character-based paint program, and an AI-powered document analyzer.

The project is designed to be modular, extensible, and educational, demonstrating concepts from operating systems and web development.

## Architecture

OopisOS follows a modular architecture with clear separation of concerns. The system is organized into several key modules, with most logic encapsulated in manager objects (e.g., `FileSystemManager`, `UserManager`).

1.  **Core System**
   -   `main.js`: Entry point, initialization, and primary event listeners.
   -   `config.js`: System-wide configuration constants and messages.
   -   `utils.js`: Globally accessible utility functions.

2.  **Command Processing**
   -   `lexpar.js`: The Lexer and Parser, which transform raw command strings into a structured, executable format.
   -   `commexec.js`: The `CommandExecutor`, which orchestrates command validation and execution, including pipelines and background jobs.
   -   `scripts/commands/`: Individual command definition files, which register themselves with the `CommandRegistry`.

3.  **Storage and State**
   -   `storage.js`: Wrappers for `localStorage` and `IndexedDB` (`StorageManager`, `IndexedDBManager`).
   -   `fs_manager.js`: The virtual file system, managing the in-memory data structure and its persistence.
   -   `user_manager.js`: User authentication, group management, and permission logic.
   -   `session_manager.js`: User session stack (`su`/`logout`), environment variables, and state saving/loading.

4.  **User Interface**
   -   `terminal_ui.js`: Manages the terminal's interactive components, including the prompt, input line, modals, and tab completion.
   -   `output_manager.js`: Manages all text output to the terminal screen and overrides `console` methods.

5.  **Applications**
   -   `editor.js`: The full-screen text editor application (`edit`).
   -   `oopis_paint.js`: The character-based art studio application (`paint`).
   -   `chidi_app.js`: The AI-powered Markdown analyzer (`chidi`).
   -   `text_adventure.js`: The text adventure game engine (`adventure`).

## Setup and Installation

### Prerequisites
-   A modern web browser (e.g., Chrome, Firefox).
-   A local web server for development to avoid issues with browser security policies (CORS).

### Development Setup
1.  Clone the repository.
2.  Navigate to the project directory.
3.  Start a local web server (e.g., `python -m http.server` or using a tool like Live Server for VS Code).
4.  Open the provided URL in your browser.

### Project Structure
```

oopisOS/

├── docs/ # Documentation files

├── extras/ # Helper scripts (diag.sh, inflate.sh)

├── fonts/ # Custom fonts (VT323)

├── scripts/ # Core JavaScript files

│ ├── commands/ # Individual command implementations

│ ├── commexec.js # Command executor

│ ├── config.js # System configuration

│ ├── fs_manager.js # File System logic

│ ├── user_manager.js # User/Group logic

│ ├── ... # Other core modules

├── index.html # Main entry point and script loader

├── style.css # Global styles

└── README.md # Project overview

````

## Core Components

### Command System
The command system is the brain of the shell.

-   **Lexer (`lexpar.js`):** Tokenizes the raw input string into units like `WORD`, `STRING_DQ` (double-quoted string), and operators (`|`, `>`). It correctly handles escaped characters and quoted strings.
-   **Parser (`lexpar.js`):** Takes the stream of tokens and builds a hierarchical structure of `ParsedPipeline` objects. This structure separates commands, handles I/O redirection, and flags background processes.
-   **Executor (`commexec.js`):** Iterates through the `ParsedPipeline` objects. For each pipeline, it executes segments sequentially, piping the output of one command to the input of the next. It manages file redirection and launches background jobs in a non-blocking way using `setTimeout`.
-   **Environment Variables:** Before lexing, the `CommandExecutor` expands any environment variables (e.g., `$USER`, `${HOME}`) using the `EnvironmentManager`.

### File System
The virtual file system (`fs_manager.js`) is the backbone of data persistence.

-   **Data Structure:** A single JavaScript object (`fsData`) represents the entire file system tree, starting from the root `/`. Directories are objects with a `children` property, and files are objects with a `content` property.
-   **Persistence:** The `fsData` object is stored as a single entry in IndexedDB. The `save()` function serializes and writes the entire tree, while `load()` retrieves it on startup. This provides a robust and transactional way to handle persistence.
-   **Permissions:** A node's `mode` property stores a 3-digit octal number (e.g., `0o755`). The `hasPermission(node, username, permissionType)` function checks if a user has read, write, or execute permissions by evaluating their ownership against the owner, group, and other permission bits.

### User & Group Management
This system (`user_manager.js`) provides a secure, multi-user environment.

-   **Users & Passwords:** User credentials (username and hashed password) are stored in `localStorage`. Passwords are never stored in plain text; they are hashed using the Web Crypto API's SHA-256 implementation before being stored or compared.
-   **Groups:** Group definitions and memberships are stored in a separate `localStorage` entry. A user's primary group is defined in their credential object, while supplementary groups are stored in the main group list. The `GroupManager` provides functions to manage this data.
-   **Authentication Flow:** The `login` and `su` commands use a shared `_handleAuthFlow` function, which centralizes the logic for checking passwords and prompting the user for input via the `ModalInputManager` when necessary.

### Session & State Management
This system (`session_manager.js`) ensures a persistent and personalized user experience.

-   **Session Stack:** A simple array, `userSessionStack`, tracks the active user sessions. `su` pushes a user onto the stack, and `logout` pops them off. This enables a clear and predictable session history.
-   **Automatic State:** Before switching users (via `su` or `login`), the `saveAutomaticState` function saves the current user's terminal output, command history, current path, and environment variables to `localStorage`. `loadAutomaticState` restores this when the user logs back in.
-   **Manual State & Backups:** `savestate` and `backup` provide more robust snapshots. `savestate` saves the session *and* a deep copy of the entire file system to `localStorage`. `backup` bundles this and all other user-related `localStorage` data into a single downloadable JSON file.

### Terminal UI & Output
This system (`terminal_ui.js` and `output_manager.js`) creates the user's interactive experience.

-   **Modals:** The `ModalManager` is a crucial component that can request user confirmation. It's script-aware; if a script is running, it will automatically consume the next line of the script as the answer (e.g., 'YES' or 'no'). For interactive users, it presents either a terminal-based prompt or a graphical modal.
-   **Tab Completion:** The `TabCompletionManager` provides context-aware suggestions. It analyzes the input to determine if the user is completing a command name, a username (for commands like `login`), or a file path, and provides relevant options.

### The Editor Application (`edit`)
The `edit` command launches a sophisticated application managed by `editor.js`.

-   **Architecture:** It uses two main modules, `EditorUI` and `EditorManager`. `EditorUI` handles all DOM creation, manipulation, and event listeners. `EditorManager` manages the application state (file path, content, dirty status, etc.) and orchestrates the UI updates and file system interactions.
-   **File-Aware Modes:** The editor determines the `currentFileMode` (e.g., 'markdown', 'html', 'text') based on the file extension. This mode dictates whether features like the live preview and formatting toolbar are enabled.
-   **Live Preview:** For Markdown and HTML, a debounced `renderPreview` function is called after user input. For Markdown, it uses the `marked.js` library. For HTML, it cleverly injects the content and necessary styles into a sandboxed `<iframe>` to render the user's code safely.
-   **Undo/Redo:** The editor maintains an `undoStack` and `redoStack`. New states are pushed onto the `undoStack` after a short debounce following user input. This provides a robust, non-blocking undo history.

### The Paint Application (`paint`)
The `paint` command launches a character-based art studio managed by `oopis_paint.js`.

-   **Architecture:** Similar to the editor, it's divided into `PaintUI` (DOM) and `PaintManager` (state). `PaintUI` builds the toolbar and the grid-based canvas, while `PaintManager` handles tool selection, color changes, drawing logic, and the undo/redo stacks.
-   **Canvas Data Model:** The canvas is represented by a 2D array, `canvasData`. Each element in the array is an object `{ char, fg, bg }` representing a single cell on the grid. Drawing operations directly modify this data model, which is then re-rendered by `PaintUI.renderCanvas`.
-   **File Format:** When saving, the `canvasData` array, along with width and height metadata, is serialized into a JSON string and saved with the `.oopic` extension. This makes the art portable and easy to parse.

### The Chidi.md Reader & Analyzer (`chidi`)
The `chidi` command launches an advanced Markdown tool managed by `chidi_app.js`.

-   **Architecture:** The `ChidiApp` is a self-contained object that manages its own modal UI, state, and API interactions. It is launched by the `chidi` command, which first gathers all target `.md` files.
-   **File Gathering:** The command's `getMarkdownFiles` function recursively traverses the specified path, respecting read/execute permissions, to build a list of all `.md` files to load into the app.
-   **AI Interaction (RAG):** For the "Ask" feature, Chidi employs a Retrieval-Augmented Generation (RAG) strategy. Instead of sending all documents to the AI, it first performs a local keyword search on the user's question to find the most relevant files. It then constructs a single, focused prompt containing only the content of these relevant files, leading to more accurate answers and efficient API usage.

## Adding New Commands
Adding a new command involves creating a new JavaScript file in the `scripts/commands/` directory and registering it with the command system.

### Command File Structure
Each command should be an IIFE that registers itself with the `CommandRegistry`. The modern declarative pattern is strongly preferred.

```javascript
// scripts/commands/mycommand.js
(() => {
    "use strict";

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
                argIndex: 0,
                options: { expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE }
            }
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read"]
            }
        ],
        // The core logic only runs if all the above checks pass.
        coreLogic: async (context) => {
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

    const myCommandDescription = "A brief description of what the command does.";
    const myCommandHelpText = `
Usage: mycommand [OPTIONS] <path>

A detailed explanation of the command and its options.

OPTIONS
  -v, --verbose    Enable verbose output.

EXAMPLES
  mycommand /home/Guest/README.md       Example usage
`;

    CommandRegistry.register("mycommand", myCommandDefinition, myCommandDescription, myCommandHelpText);
})();
````

### Command Registration Process

1. Create the new file in `scripts/commands/`.
2. Add a `<script>` tag for your new command file in `index.html`, ensuring it's loaded after `registry.js` but before `commexec.js`.
3. The `CommandExecutor` will automatically discover and integrate your command on boot.

## APIs and Extension Points

OopisOS provides several manager objects that expose APIs for extension.

- **`CommandRegistry`:** `register(name, definition, description, helpText)` to add new commands.
- **`FileSystemManager`:** Provides a suite of functions for VFS interaction: `getNodeByPath`, `createOrUpdateFile`, `deleteNodeRecursive`, `hasPermission`, etc.
- **`UserManager` & `GroupManager`:** `register`, `login`, `su`, `logout`, `createGroup`, `addUserToGroup`, etc.
- **`TerminalUI` & `OutputManager`:** `appendToOutput`, `updatePrompt`, `setInputState`, `ModalManager.request`, etc.

## Best Practices

- **Modularity:** Keep logic within its relevant manager or command file. Use the provided APIs instead of direct DOM manipulation where possible.
- **Declarative Validation:** For new commands, leverage the `argValidation`, `pathValidation`, and `permissionChecks` properties to let the `CommandExecutor` handle boilerplate error checking.
- **User Experience:** Use the `ModalManager` for destructive actions. Provide clear error messages and help text.
- **State Management:** For new applications, follow the pattern of separating UI logic from state management (like in `editor.js` and `oopis_paint.js`).

## Troubleshooting

- **Command Not Found:** Ensure your command's `<script>` tag is present in `index.html` and is loaded in the correct order.
- **Permission Denied:** Use `ls -l` and `groups` to verify the current user's permissions and group memberships for the target file/directory.
- **File System Errors:** Use `backup` to inspect the raw `fsData` object for potential corruption.
- **UI Not Updating:** Ensure you are using the `OutputManager` and `TerminalUI` APIs, which are aware of the application's overall state (e.g., editor active, modal active).