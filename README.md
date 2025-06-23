```  
   /$$$$$$                      /$$            /$$$$$$   /$$$$$$   
 /$$__  $$                    |__/           /$$__  $$ /$$__  $$  
| $$  \ $$  /$$$$$$   /$$$$$$  /$$  /$$$$$$$| $$  \ $$| $$  \__/  
| $$  | $$ /$$__  $$ /$$__  $$| $$ /$$_____/| $$  | $$|  $$$$$$   
| $$  | $$| $$  \ $$| $$  \ $$| $$|  $$$$$$ | $$  | $$ \____  $$  
| $$  | $$| $$  | $$| $$  | $$| $$ \____  $$| $$  | $$ /$$  \ $$  
|  $$$$$$/|  $$$$$$/| $$$$$$$/| $$ /$$$$$$$/|  $$$$$$/|  $$$$$$/  
 \______/  \______/ | $$____/ |__/|_______/  \______/  \______/   
                    | $$                                          
                    | $$                                          
                    |__/  A Browser-Based OS Simulation  
```

# OopisOS v2.7: Open, Online, Persistent, Integrated System OS

Welcome to OopisOS, a sophisticated OS simulation that runs entirely within your browser. It's a self-contained, persistent world built on a foundation of privacy and exploration, featuring a rich command-line environment, a secure multi-user file system, and a suite of powerful integrated tools. All user data is stored locally in your browser; your world remains your own.

## Getting Started: The 60-Second Experience

1. **Open:** Simply open `index.html` in any modern web browser.
2. **Inflate:** You are logged in as "Guest". To see the system's potential, populate your home directory with a full suite of example files by running this command:
    
    Bash
    
    ```
    run /extras/inflate.sh
    ```
    
3. **Explore:** Now, explore the new files and directories that have been created:
    
    Bash
    
    ```
    tree /home/Guest/docs
    ```
    

Intrigued? Read on to discover the depth of what you can do in your new OS.

## Key Features Overview

OopisOS is equipped with a wide array of features, organized into several key areas:

#### Core Shell Experience

- **Advanced Terminal:** An interactive command-line with history, tab completion, and background processes (`&`).
- **Piping & Redirection:** Chain commands together with the pipe (`|`) or redirect output to files with `>` and `>>`.
- **Sequencing & Aliasing:** Execute multiple commands with `;` and create shortcuts for longer commands with `alias`.
- **Environment Variables:** Manage session-specific variables with `set`, `unset`, and `$VAR` expansion.

#### Persistent File System

- **Hierarchical VFS:** A robust virtual file system managed via IndexedDB that persists between sessions.
- **File Management:** A comprehensive suite of commands including `ls` (with numerous flags), `find` (with advanced predicates), `tree`, `diff`, `mkdir`, `cp`, `mv`, and `rm`.
- **File Content:** View files with `cat`, search inside them with `grep`, and edit them with a built-in editor.

#### Multi-User Security Model

- **User & Group Management:** Create users (`useradd`), groups (`groupadd`), and manage group memberships (`usermod -aG`).
- **Authentication:** A full login/logout system (`login`, `logout`, `su`) with secure, hashed password prompts.
- **Unix-like Permissions:** Use `chmod` with 3-digit octal modes (e.g., `755`) to control read, write, and execute permissions for the owner, group, and others.
- **Ownership Control:** Change file ownership with `chown` and `chgrp`.

#### Built-in Applications

- **Text Editor (`edit`):** A full-screen editor for plain text, Markdown, and HTML with live preview, a formatting toolbar, and keyboard shortcuts.
- **ASCII/ANSI Art Editor (`paint`):** A dedicated paint program to create character-based art with multiple colors and tools, saved in a custom `.oopic` format.
- **AI Librarian (`chidi`):** An advanced Markdown reader that uses AI to help you summarize, study, and ask questions about your documents.
- **Text Adventure Game (`adventure`):** An engine to play interactive, text-based adventure games.

#### Advanced Capabilities

- **Tool-Using AI (`gemini`):** An integrated Gemini AI that can use OopisOS commands like `find` and `cat` to explore the file system and answer your questions with context.
- **Scripting Engine (`run`):** Write and execute your own shell scripts with support for comments and arguments (`$1`, `$@`).
- **Networking Utilities:** Fetch content from the web directly into the OS using `wget` to download files or `curl` to display data in the terminal.

## Core Architectural Concepts

OopisOS is built on several foundational principles that ensure it is secure, modular, and persistent.

#### The Persistence Layer: A Self-Contained World

The entire state of OopisOS is stored locally and persistently within your browser, requiring no server interaction. This is achieved through a two-pronged storage strategy:

- **IndexedDB:** Provides the robust, transactional database needed to manage the entire hierarchical file system. Every directory, file, and its contents are stored here.
- **LocalStorage:** Acts as a faster key-value store for session-critical data, including the list of registered users, command history, aliases, and other user-specific preferences.

This separation ensures that the file system is durable and well-structured, while session data is loaded quickly. Your entire digital world is self-contained and will be waiting for you when you return.

#### The Security Model: Control and Privacy

Security and multi-user capabilities are not an afterthought; they are central to the OS design.

- **User Roles:** The system includes a "superuser" (`root`) with full privileges, alongside standard users who are subject to permission checks. This allows for safe system administration and protected user spaces. The default `root` password is `mcgoopis`.
- **Password Hashing:** User passwords are not stored in plain text. They are securely hashed, meaning that even direct inspection of the stored data will not reveal a user's password.
- **Permission System:** The `chmod` command implements the standard Unix-like octal permission model. Each digit represents a set of permissions (Read=4, Write=2, Execute=1) for the User, Group, and Other, respectively. For example, `chmod 751` on a script grants full control to the owner (`rwx`), read/execute to the group (`r-x`), and execute-only to everyone else (`--x`).

#### The Command Execution Pipeline: A Modular Engine

Every command you type follows a structured, modular path from input to execution. This design promotes stability and makes the system easy to extend.

- **Lexing and Parsing (`lexpar.js`):** The input string is first broken down into a sequence of tokens and then parsed into a structured command, complete with arguments, flags, and redirection/piping instructions.
- **Command Execution (`commexec.js`):** The parsed command is passed to the executor, which validates permissions and runs the corresponding function. This is also where background processes (`&`) are managed, allowing the OS to handle long-running tasks without freezing the terminal. You can view and manage these tasks with `ps` and `kill`.

## For Developers: Contributing to OopisOS

#### Project Structure

The codebase is organized into modular files, each with a clear responsibility.

- `main.js`: Main entry point, glues the system together and handles top-level event listeners.
- `config.js`: Centralized configuration for OS-wide settings.
- `storage.js`: An abstraction layer that manages all interactions with `IndexedDB` and `LocalStorage`.
- `fs_manager.js`: The heart of the VFS, translating file operations into `storage.js` calls.
- `user_manager.js`: Handles all logic for users, groups, permissions, and authentication.
- `session_manager.js`: Manages saving and loading user sessions and system state.
- `output_manager.js`: Controls all output rendering to the terminal screen.
- `terminal_ui.js`: Manages the terminal's UI state (prompt, input field, history navigation).
- `lexpar.js`: The Lexer and Parser for all command-line input.
- `commexec.js`: The Command Executor and registry for all built-in command definitions.
- `editor.js`: All logic for the `edit` text editor application.
- `oopis_paint.js`: All logic for the `paint` ASCII/ANSI art editor application.
- `chidi_app.js`: All logic for the `chidi` Markdown analyzer application.
- `text_adventure.js`: The engine for the `adventure` game application.

#### Adding a New Command (The v2.7 Way)

Adding a new command is a declarative process designed to be simple and secure.

1. Create a new command file in `/scripts/commands/`.
2. Register the command in `index.html` with a `<script>` tag.
3. Use the `CommandRegistry.register` pattern to define the command, its validation rules, and its core logic.

JavaScript

```
// In /scripts/commands/mycmd.js:
(() => {
    "use strict";
    const myNewCmdDefinition = {
        commandName: "mycmd",
        // 1. Define validation rules
        argValidation: { min: 1, error: "mycmd needs at least one argument!" },
        pathValidation: [{ argIndex: 0, options: { expectedType: 'file' } }],
        permissionChecks: [{ pathArgIndex: 0, permissions: ['read'] }],

        // 2. Write the core logic, knowing the inputs are already vetted!
        coreLogic: async (context) => {
            const { args, options, currentUser, validatedPaths } = context;
            const pathInfo = validatedPaths[0]; // Guaranteed to be a valid, readable file.
            return { success: true, output: `Successfully processed ${pathInfo.resolvedPath}` };
        }
    };

    const description = "A one-line summary for the 'help' command.";
    const helpText = "Usage: mycmd [file]\n\nExplain your command in detail here.";

    // 3. Register it with the system
    CommandRegistry.register("mycmd", myNewCmdDefinition, description, helpText);
})();
```

## Further Documentation

To keep this document focused on core concepts, more detailed information has been moved to separate files.

- **`/docs/command_reference.md`:** An exhaustive reference for every command, including all flags and usage examples.
- **`/docs/tutorial.md`:**  A collection of guided tutorials for more complex tasks, like writing shell scripts and managing project permissions.