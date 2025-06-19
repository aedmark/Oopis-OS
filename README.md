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
# OopisOS v2.6: Open, Online, Persistent, Integrated System OS

Welcome to OopisOS, a sophisticated, fully client-side application that simulates a desktop operating system environment. It's a love letter to the command line, built with modern web technologies to create a space for education, development, and interactive entertainment.

It features a retro-style terminal, a persistent hierarchical file system with a full user/group permission model, a multi-user system with password authentication, an advanced text editor, a character-based paint program, a tool-using AI, an interactive text adventure engine, and a suite of command-line utilities with support for I/O redirection, piping, background processes, aliasing, and scripting.

### Key Features (v2.6)

- **100% Client-Side:** Runs entirely in the browser with no server-side dependencies. All user data is stored locally and persistently using IndexedDB and LocalStorage. Your world remains your own.
- **Advanced Terminal Interface:** An interactive command-line interface with history, tab completion, command aliasing (alias), command sequencing (;), background processes (&), and I/O redirection (> and >>).
- **Environment Variables:** Use `set`, `unset`, and shell expansion (`$VAR`, `${VAR}`) to manage session-specific variables.
- **Persistent Hierarchical File System:** A robust VFS managed via IndexedDB. Features a comprehensive suite of file management commands:
    - `ls`: Supports flags -l, -a, -R, -r, -t, -S, -X, -U, -d.
    - `find`: Supports predicates like -name, -type, -user, -perm, -mtime, -newermt and actions like -print, -exec, -delete.
    - `tree`: Display directory contents in a tree-like format.
    - `diff`: Compare two files line by line.
    - Standard commands: `mkdir`, `cd`, `touch`, `cat`, `cp` (with -p to preserve metadata), `mv`, `rm`, `pwd`.
- **Multi-User System with Groups & Permissions:**
    - Register users (`useradd`) with secure, hashed password prompts. A primary group is created for each user.
    - Login/logout (`login`, `logout`) and switch users (`su`), including to a `root` user with full system privileges (default password: `mcgoopis`).
    - Full user group management: `groupadd`, `groupdel`, `groups`, `usermod -aG`.
    - Unix-like permissions: `chmod` with 3-digit octal modes (e.g., 755) for owner, group, and other.
    - Ownership management: `chown`, `chgrp`.
- **Comprehensive Session Management:** Automatic session saving per user, manual `savestate`/`loadstate`, full file system `backup`/`restore` via JSON, and system/home directory `reset`/`clearfs` capabilities.
- **Enhanced Built-in Text Editor (`edit`):**
    - Full-screen editor for plain text, Markdown, and HTML with live preview.
    - Features include line numbers, toggleable word wrap, multiple view modes (Ctrl+P), a detailed status bar, and an "Export to HTML" function.
    - For Markdown/HTML, a formatting toolbar provides quick access to insert bold, italics, links, quotes, code, and lists.
    - Keyboard shortcuts: Ctrl+S (save/exit), Ctrl+O (exit/confirm), Ctrl+P (toggle preview), Ctrl+B/I (format).
- **ASCII/ANSI Art Editor (`paint`):** Create and edit character-based art with a dedicated paint program. Supports multiple colors, tools (pencil, eraser), undo/redo, and saves to the custom `.oopic` file format.
- **Tool-Using AI Integration (`gemini`):** Send a prompt to a Gemini AI model. The AI can now use OopisOS commands like `ls`, `cat`, `find`, and `tree` to explore the file system and gather information to provide more accurate, context-aware answers.
- **Job Control (`ps`, `kill`):** Run processes in the background with `&`, view them with `ps`, and terminate them with `kill`.
- **Networking Utilities (`wget`, `curl`):** Fetch content from the web directly within the OS. `wget` downloads files, while `curl` displays data in the terminal.
- **Interactive Text Adventure Game (`adventure`):** Launch and play text-based adventure games within a dedicated modal window. Supports loading custom adventures from JSON files.
- **Scripting Engine (`run`):** Execute sequences of OopisOS commands from script files. Supports comments (`#`) and argument passing (`$1`, `$@`, `$#`).
- **Common Utilities:** `echo`, `date`, `help`, `clear`, `history`, `alias`, `unalias`, `export`, `upload`, `grep` (with -i, -v, -n, -c, -R), `paint`, and `printscreen`.

### Getting Started

1. **Download:** Obtain `index.html`, all `.js` files, and `style.css`.
2. **Open:** Open `index.html` in any modern web browser.
3. **Interact:** The OopisOS terminal will load. You are logged in as "Guest". Start by typing `help` to see a list of available commands.

#### First Commands to Try:

Bash

```
# To get a feel for the system, populate the Guest home directory with a set of example files.
run /inflate.sh

# Explore the newly created files and directories with the 'tree' command
tree /home/Guest

# Test the networking capabilities by following the instructions
cat /home/Guest/net_practice/instructions.txt
wget https://raw.githubusercontent.com/aedmark/Oopis-OS/master/LICENSE.txt

# Create your own command shortcut
alias ll="ls -la"
ll /home

# Create a new user and a new group
login root mcgoopis
useradd mydev
groupadd projects
usermod -aG projects mydev
logout
login mydev

# Create a project and an executable script with arguments
mkdir my_project && cd my_project
chgrp projects .
edit my_script.sh
# Inside editor: type 'echo "My script works for $1!" && adventure', then Ctrl+S
chmod 770 my_script.sh
run ./my_script.sh "the best user"
```

### Core Concepts

#### The Terminal Interface

OopisOS provides a standard command-line interface with advanced shell features:

- **Piping (`|`):** Send the output of one command to the input of another. `history | grep "ls"`
- **Redirection (`>`, `>>`):** Write command output to a file (overwrite with `>` or append with `>>`). `date >> /data/logs/system.log`
- **Sequencing (`;`):** Execute multiple commands on a single line. `cd / && ls -a`
- **Backgrounding (`&`):** Run a command asynchronously. See active jobs with `ps` and terminate with `kill [job_id]`. `delay 5000 &`
- **Aliasing (`alias`):** Create shortcuts for longer commands. `alias ll="ls -l"`
- **Environment Variables (`set`, `unset`):** Create session-specific variables with `set VAR="value"` and use them in commands with `$VAR`.

#### User and Permission Model

OopisOS features a multi-user environment with a Unix-like permission system.

- **Default Users:**
    - `Guest`: The initial user. Has no password. Primary group is `Guest`.
    - `root`: The "superuser." Can bypass all file permission checks. Default password is `mcgoopis`. Primary group is `root`.
    - `userDiag`: A special user for testing with the password `pantload`. Primary group is `userDiag`.
- **Authentication:** `login` and `su` will prompt for a password if the target account has one. Passwords are case-sensitive and securely hashed.
- **Permissions (`chmod`):** The `chmod` command uses a three-digit octal mode. The first digit is for the owner, the second for the group, and the third for others. Each is a sum of Read (4), Write (2), and Execute (1). Example: `chmod 750 script.sh` gives `rwx` to the owner, `r-x` to the group, and no permissions to others.
- **Ownership (`chown`, `chgrp`):** Only the `root` user can change a file's owner (`chown`). The owner or `root` can change the group (`chgrp`).
- **Groups (`groupadd`, `usermod`):** Create new groups with `groupadd` and add users to them with `usermod -aG [group] [user]`.

#### The Text Editor (`edit`)

A powerful, full-screen text editor with features for both developers and writers.

- **Modes:** Auto-detects plain text, Markdown, and HTML files for special features.
- **Live Preview:** Renders Markdown and HTML in a toggleable preview pane (Ctrl+P).
- **Formatting Toolbar:** For Markdown/HTML, provides quick access to common formatting actions like bold, italics, lists, and code blocks.
- **Export:** Rendered Markdown or HTML can be exported to a downloadable `.html` file with a single click.
- **Key Shortcuts:** Ctrl+S (Save & Exit), Ctrl+O (Exit/Confirm Discard), Ctrl+P (Toggle Preview), Ctrl+B/I (Format Bold/Italic).

#### AI Integration (`gemini`)

Interact with a Gemini AI model that can use OopisOS commands to answer your questions.

- **Syntax:** `gemini [-n] "<prompt>"`
- **Functionality:** Ask a question. Gemini can run commands like `ls`, `cat`, `find`, and `tree` to explore the file system for context, then synthesize an answer based on the results. Use `-n` to start a new, memory-free conversation.

#### Scripting Engine (`run`)

Automate tasks by writing shell scripts.

- Create a text file containing a sequence of OopisOS commands (conventionally with a `.sh` extension).
- **Features:** Supports comments (`#`) and argument passing (`$1`, `$@`, `$#`).
- **Execution:** Make the script executable (`chmod 700 your_script.sh`) then run it with `run ./your_script.sh arg1 arg2`.

#### Utility Scripts: `inflate` & `diag`

- **inflate.sh:** Run this script (`run /inflate.sh`) to populate the `/home/Guest` directory with a diverse set of example files and directories. This is perfect for creating a "showcase" environment to explore.
- **diag.sh:** This is a comprehensive, non-interactive diagnostic test suite (`run /diag.sh`) that verifies the core functionality of most commands, their flags, error handling, and interaction with the permission and group systems.

### Developer Guide

#### Project Structure

- `main.js`: Main entry point, event listeners.
- `config.js`: Central configuration for the entire OS.
- `utils.js`: Helper and utility functions.
- `storage.js`: Manages LocalStorage and IndexedDB interactions.
- `fs_manager.js`: Core logic for the virtual file system.
- `user_manager.js`: Handles users, groups, and authentication.
- `session_manager.js`: Manages saving and loading of user sessions.
- `output_manager.js`: Controls all output to the terminal screen.
- `terminal_ui.js`: Manages terminal UI state and interactions (prompt, input, etc.).
- `lexpar.js`: Lexer and Parser for command-line input.
- `commexec.js`: Command Executor and definitions for all built-in commands.
- `editor.js`: All logic for the text editor.
- `paint.js`: All logic for the ASCII/ANSI art editor.
- `adventure.js`: All logic for the text adventure game engine.

#### Adding a New Command (The v2.6 Way)

1. Open `commexec.js`.
2. Define your command's logic and validation rules using the declarative `createCommandHandler` pattern.
3. Add the new command definition to the `commands` object.

JavaScript

```
// In commexec.js:
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

// 3. Add it to the main commands object
commands.mycmd = {
    handler: createCommandHandler(myNewCmdDefinition),
    description: "A one-line summary for the 'help' command.",
    helpText: "Usage: mycmd [file]\n\nExplain your command in detail here."
};
```

### Technology Stack

- **Frontend & Logic:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **UI Styling:** Tailwind CSS (pre-compiled).
- **Markdown Parsing:** Marked.js.
- **AI Interaction:** Google Gemini API.
- **Persistent Storage:** IndexedDB (for the file system) and LocalStorage (for session states, user list, editor preferences, aliases).