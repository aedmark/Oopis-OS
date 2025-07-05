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

# OopisOS v3.7: Your Friendly Neighborhood LLM Edition

Welcome to OopisOS, a sophisticated OS simulation that runs entirely on your local machine. It's a self-contained, persistent world built on a foundation of privacy and exploration, featuring a rich command-line environment, a secure multi-user file system, and now, a suite of powerful, integrated AI tools. All user data is stored locally; your world remains your own.

## What's New in v3.7: Your AI Copilot

This release integrates a powerful and flexible AI toolkit directly into the OS core, making it your "Friendly Neighborhood LLM."

- **The Gemini Gateway**: The `gemini` command now supports local LLM providers like Ollama and LM Studio. You can chat with your own models or use the default cloud provider for sophisticated, tool-using AI assistance.

- **Smarter Analysis with Chidi**: The `chidi` AI librarian can now accept piped input, allowing you to create dynamic document sets for analysis using commands like `find`.

- **Creative Suite Expansion**: We've added a full `BASIC` IDE (`basic`) for retro programming and a personal journaling system (`log`).

- **True Portability as Standard**: Portability is now the default, enforced behavior. OopisOS is a completely self-contained application, perfect for running from a USB drive.


## Key Features Overview

OopisOS is more than just a terminal; it's a complete ecosystem.

#### Core Shell Experience

- **Advanced Terminal:** An interactive command-line with history, tab completion, and background processes (`&`).

- **Piping & Redirection:** Chain commands together with the pipe (`|`) or redirect output to files with `>` and `>>`.

- **Sequencing & Aliasing:** Execute multiple commands with `;` and create shortcuts for longer commands with `alias`.

- **Environment Variables:** Manage session-specific variables with `set`, `unset`, and `$VAR` expansion.


#### Multi-User Security Model

- **True Multi-User Environment:** Create users (`useradd`), groups (`groupadd`), and manage group memberships (`usermod -aG`).

- **Privilege Escalation:** Execute commands as the superuser with `sudo` and safely manage permissions with `visudo`.

- **Unix-like Permissions:** Use `chmod` with 3-digit octal modes (e.g., `755`) to control read, write, and execute permissions.

- **Ownership Control:** Change file ownership with `chown` and group ownership with `chgrp`.


#### Persistent File System & Applications

- **Hierarchical VFS:** A robust virtual file system powered by IndexedDB that persists between sessions.

- **File Management:** A comprehensive suite of commands including `ls`, `find`, `tree`, `diff`, `mkdir`, `cp`, `mv`, `rm`, `zip`, and `unzip`.

- **Application Suite:**

  - `gemini`: Your new AI copilot. Chat with local or cloud-based LLMs, and watch as it uses system tools to find answers.

  - `chidi`: An AI-powered document analysis tool to summarize and query your files.

  - `basic`: An integrated development environment for the classic BASIC programming language.

  - `log`: A secure, timestamped journaling application.

  - `edit`: A powerful text editor with live Markdown preview.

  - `paint`: A character-based art studio for your inner artist.

  - `adventure`: A powerful, data-driven text adventure engine to play and build interactive fiction.


## Core Architectural Concepts

OopisOS is built on several foundational principles that ensure it is secure, modular, and persistent.

#### The Persistence Layer: A Self-Contained World

The entire state of OopisOS is stored locally and persistently on your machine, requiring no server interaction.

- **IndexedDB:** Provides the robust, transactional database needed to manage the entire hierarchical file system.

- **LocalStorage:** Acts as a faster key-value store for session-critical data like user credentials, command history, and aliases.


#### The Security Model: Control and Privacy

- **User Roles:** The system includes a "superuser" (`root`) with full privileges, alongside standard users who are subject to permission checks. The default `root` password is `mcgoopis`.

- **Password Hashing:** User passwords are not stored in plain text. They are securely hashed using the browser's Web Crypto API.

- **Permission System:** The `chmod` command implements the standard Unix-like octal permission model.


#### The Command Contract: Secure by Design

The v3.0 "Keystone" release introduced a new, highly modular command architecture. Adding a new command is a declarative process where you _declare_ your command's requirements to the `CommandExecutor`, which enforces these rules _before_ your command's core logic is ever run. This is a critical security and stability feature. The contract includes:

- `flagDefinitions`: All flags the command accepts.

- `argValidation`: The number of arguments your command expects.

- `pathValidation`: Which arguments are file paths and what type they should be.

- `permissionChecks`: Which permissions (`read`, `write`, `execute`) the user must have on those paths.


## For Developers: Contributing to OopisOS

The codebase is organized into modular files with clear responsibilities.

- `main.js`: Main entry point and bootloader.

- `commexec.js`: The Command Executor, which orchestrates the command lifecycle.

- `scripts/commands/registry.js`: The registry where all command modules register themselves.

- `scripts/commands/*.js`: Self-contained modules for each individual command.

- `fs_manager.js`: The gatekeeper for all Virtual File System operations and permission checks.

- `user_manager.js`: Handles all logic for users, groups, and authentication.


To add a new command, simply create a new file in `/scripts/commands/`, define the command's contract and logic using the standard pattern. The command will be loaded dynamically on first use.

## Further Documentation

To keep this document focused, more detailed information has been moved to separate files.

- **`/docs/guide.md`:** The full, styled User Guide.

- **`/docs/command_reference.md`:** An exhaustive reference for every command.

- **`/docs/developer.md`:** In-depth architectural documentation for contributors.

- **`/docs/security.md`:** A detailed overview of the OopisOS security model.

- **`/docs/tutorial.md`:** Guided tutorials for more complex tasks.

- **`/docs/adventure.md`:** A comprehensive guide to creating custom adventures with the text adventure engine.

- **`/docs/taco.md`:** A whimsical-yet-formal paper on the "El Código del Taco" architectural model.