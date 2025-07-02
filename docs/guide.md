# Welcome to OopisOS v3.2: "Brass Monkey"

#### *"That Funky Monkey"*

```
Guest@OopisOs:~$ echo "OopisOS is ready."  
OopisOS is ready.
```

## Table of Contents

- [Table of Contents](https://www.google.com/search?q=%23table-of-contents)
- [What is OopisOS?](https://www.google.com/search?q=%23what-is-oopisos)
- [Key Features at a Glance](https://www.google.com/search?q=%23key-features-at-a-glance)
- [User Guide](https://www.google.com/search?q=%23user-guide)
  - [Essential Commands](https://www.google.com/search?q=%23essential-commands)
  - [Data & System Utilities](https://www.google.com/search?q=%23data--system-utilities)
  - [Application Suite](https://www.google.com/search?q=%23application-suite)
- [Advanced Topics](https://www.google.com/search?q=%23advanced-topics)
  - [Shell Customization: The `PS1` Variable](https://www.google.com/search?q=%23shell-customization-the-ps1-variable)
  - [Privilege Escalation: `sudo` and `visudo`](https://www.google.com/search?q=%23privilege-escalation-sudo-and-visudo)
  - [File Archival: `zip` and `unzip`](https://www.google.com/search?q=%23file-archival-zip-and-unzip)
- [Developer Documentation](https://www.google.com/search?q=%23developer-documentation)
  - [The Command Contract](https://www.google.com/search?q=%23the-command-contract)
  - [On-Demand Command Loading](https://www.google.com/search?q=%23on-demand-command-loading)
- [Testing & Showcase Environment](https://www.google.com/search?q=%23testing--showcase-environment)
  - [The World-Builder: `inflate.sh`](https://www.google.com/search?q=%23the-world-builder-inflatesh)
  - [The Gauntlet: `diag.sh`](https://www.google.com/search?q=%23the-gauntlet-diagsh)
- [About & Credits](https://www.google.com/search?q=%23about--credits)
  - [The Creators](https://www.google.com/search?q=%23the-creators)
  - [The Social Contract (aka The Boring Legal Bit)](https://www.google.com/search?q=%23the-social-contract-aka-the-boring-legal-bit)

## What is OopisOS?

OopisOS is a sophisticated OS simulation that runs entirely within your browser. It's a self-contained, persistent world built on a foundation of privacy and exploration, featuring a rich command-line environment, a secure multi-user file system, and a suite of powerful integrated tools. All user data is stored locally in your browser; your world remains your own.

The "Brass Monkey" release is a complete systemic enhancement. We've made the system faster to boot, harder to break, and given you more control over your environment.

## Key Features at a Glance

- **A Rock-Solid File System:** A persistent VFS powered by IndexedDB with a full suite of management tools: `ls`, `find`, `tree`, `diff`, `cp`, `mv`, and `rm`. New in v3.2: Secure backup/restore with checksum verification.
- **An Empowered Command-Line:** Full history, tab-completion, piping (`|`), redirection (`>`), backgrounding (`&`), sequencing (`;`), and environment variable support. New in v3.2: a fully customizable prompt via the `PS1` variable.
- **A True Multi-User Security Model:** Create users (`useradd`) and groups (`groupadd`). Manage permissions with `chmod`, `chown`, and `chgrp`. Execute commands with elevated privileges using `sudo` and safely edit the rules with `visudo`.
- **A Full Suite of Applications:**
  - `edit`: A powerful text editor with live Markdown preview.
  - `paint`: A character-based art studio for your inner artist.
  - `chidi`: An AI-powered document analysis tool.
  - `gemini`: A tool-using AI assistant for your terminal.
  - `explore`: A graphical, two-pane file explorer.
- **System & Session Management:** Save and restore your entire session state with `savestate` and `loadstate`, or create full system `backup` files for transfer.

## User Guide

This guide covers the essential commands for navigating and interacting with the OopisOS environment. For a quick list of all commands, type `help`. For a detailed manual on a specific command, type `man [command_name]`.

### Essential Commands

|Command & Key Flags|What It Does|
|---|---|
|`help [cmd]`|Displays a list of commands or a command's basic syntax.|
|`ls [-l -a -R -r -t -S -X -d]`|Lists directory contents. The cornerstone of observation.|
|`tree [-L level] [-d]`|Like `ls`, but fancier. Displays files and directories in a tree structure.|
|`cd [directory]`|Changes your current location in the file system.|
|`pwd`|Prints the full path of your current working directory.|
|`mkdir [-p] [dir_name]`|Creates a new, empty directory.|
|`cat [-n] [file...]`|Displays the entire content of a file. Use `-n` for line numbers.|
|`echo [text]`|Repeats text back to you. Primarily used for writing to files.|
|`touch [-c -d 'date'] [file]`|Creates an empty file or updates its timestamp.|
|`rm [-r -f -i] [item]`|Removes (deletes) a file or directory. This is permanent.|
|`cp [-r -f -p -i] [src] [dest]`|Copies a file or directory.|
|`mv [-f -i] [src] [dest]`|Moves or renames a file or directory.|
|`grep [-i -v -n -c -R] [pat] [file]`|Searches for a text pattern within files.|
|`find [path] [expr]`|A powerful tool to find files based on various criteria.|

### Data & System Utilities

|Command & Key Flags|What It Does|
|---|---|
|`head [-n lines] [-c bytes] [file]`|Outputs the first part of a file.|
|`tail [-n lines] [-c bytes] [file]`|Outputs the last part of a file.|
|`diff [file1] [file2]`|Compares two files and shows the differences.|
|`sort [-r -n -u] [file]`|Sorts lines of text alphabetically or numerically.|
|`uniq [-c -d -u] [file]`|Filters or reports repeated adjacent lines.|
|`wc [-l -w -c] [file]`|Counts the lines, words, and bytes in a file.|
|`awk 'program' [file]`|A powerful tool for pattern-based text processing.|
|`xargs [command]`|Builds and executes command lines from standard input.|
|`df [-h]`|Reports the file system's overall disk space usage.|
|`du [-h -s] [path]`|Estimates the disk space used by a specific file or directory.|

### Application Suite

OopisOS comes with several built-in applications that run in a full-screen, modal interface, providing a richer experience than standard command-line tools.

- **`explore [path]`**
  Opens a graphical, two-pane file explorer. The left pane shows an expandable directory tree, and the right pane shows the contents of the selected directory. It's a powerful and intuitive way to navigate your file system.

- **`edit [file]`**
  Opens the OopisOS text editor. It's a surprisingly capable editor with features like live Markdown and HTML preview (`Ctrl+P`), a formatting toolbar, and keyboard shortcuts for saving (`Ctrl+S`) and exiting (`Ctrl+O`).

- **`paint [file.oopic]`**
  Unleash your creativity with the character-based art editor. It features a full canvas, multiple tools (pencil, eraser, shapes), a color palette, and saves your work to the custom `.oopic` format.

- **`chidi [path]`**
  The AI Librarian. Point `chidi` at a directory of Markdown files (`.md`) to open a dedicated reading interface. Here, you can ask the AI to summarize documents, generate study questions, or perform a query across all loaded documents to find specific information.

- **`adventure [file.json]`**
  Launches the text adventure game engine. You can play the default built-in game or load your own custom adventures from a `.json` file.

## Advanced Topics

Ready to wield true power? This section covers the tools that separate the administrators from the users.

### Shell Customization: The `PS1` Variable

In OopisOS, you have full control over the appearance of your command prompt. This is handled by a special environment variable called `PS1` (Prompt String 1). By default, this variable is not set, and the system uses its built-in prompt. To create your own, use the `set` command with a string containing special, backslash-escaped characters.

|Sequence|Description|
|---|---|
|`\u`|The current username (e.g., `Guest`).|
|`\h`|The hostname (e.g., `OopisOs`).|
|`\w`|The full path of the current working directory (e.g., `/home/Guest`).|
|`\W`|The basename of the current working directory (e.g., `Guest`).|
|`\$`|Displays a `#` if the user is `root`, otherwise a `$`.|
|`\\`|A literal backslash character.|

```bash
Guest@OopisOs:/home/Guest$ set PS1="[\u@\h \W]\\$ "
[Guest@OopisOs Guest]$ 
```

To revert to the default prompt, simply unset the variable with `unset PS1`.

### Privilege Escalation: `sudo` and `visudo`

Not all users are created equal. Some tasks, like installing software or modifying critical system files, require the power of the `root` user. The `sudo` command is your key to borrowing that power, safely and temporarily.

- **`sudo [command]`**
  The `sudo` (superuser do) command executes a single command with `root` privileges. The first time you use `sudo`, you will be prompted for *your own* password to verify your identity. If successful, a timestamp is recorded, and you won't need to enter your password again for a set period (typically 15 minutes).

- **`visudo`**
  Who gets to use `sudo`? That's controlled by the `/etc/sudoers` file. You must **never** edit this file directly with `edit`. The `visudo` command is the only safe way to modify it. It opens the file in the editor but adds a lock to prevent multiple simultaneous edits and, more importantly, performs a syntax check on save to prevent you from locking yourself out of the system. **Permissions:** Only the `root` user can run `visudo`.

### File Archival: `zip` and `unzip`

Manage collections of files by bundling them into a single archive.

- **`zip [archive.zip] [path_to_zip]`**
  Creates a simulated `.zip` archive containing the file or directory at the specified path. This is a recursive operation that preserves the directory structure within the archive.

- **`unzip [archive.zip] [destination_path]`**
  Extracts the contents of a `.zip` archive into the specified destination directory. If no destination is provided, it extracts to the current directory.

## Developer Documentation

The OopisOS v3.2 "Brass Monkey" release refines our modular command architecture. This design is a core component of the system's stability and makes adding new commands a secure and straightforward process. This is a brief overview; for the full architectural document, please see `/docs/developer.md`.

### The Command Contract

Adding a new command is a declarative process. Instead of writing boilerplate validation logic, you *declare* your command's requirements to the `CommandExecutor`. The executor enforces these rules *before* your command's core logic is ever run. This is a critical security and stability feature.

The contract is defined in a single object and includes:

- `flagDefinitions`: All flags the command accepts (e.g., `-v`, `--verbose`).
- `argValidation`: The number of arguments your command expects (e.g., min, max, exact).
- `pathValidation`: Which arguments are file paths and what type they should be (`file` or `directory`).
- `permissionChecks`: Which permissions (`read`, `write`, `execute`) the user must have on those paths.

### On-Demand Command Loading

As of v3.2, you no longer need to add a `<script>` tag to `index.html` when creating a new command. The `CommandExecutor` now dynamically loads command scripts from the `/scripts/commands/` directory the first time they are called in a session, improving initial boot speed.

## Testing & Showcase Environment

A brand new OS can feel... empty. To combat this digital loneliness and give you something to immediately play with, we've included two very special scripts.

### The World-Builder: `inflate.sh`

Think of this as the ultimate demo disk. A single command that terraforms your empty home directory into a bustling ecosystem of files, directories, and secrets, all designed for you to test, abuse, and explore.

Just run this command to create your new world:
`Guest@OopisOs:/> run /extras/inflate.sh`

### The Gauntlet: `diag.sh`

This is our quality assurance department, packed into a single script. It's a relentless stress test that runs a barrage of commands to ensure the OS doesn't melt into a puddle of ones and zeros under pressure. It is the definitive way to confirm all systems are operational.

`Guest@OopisOs:/> run /extras/diag.sh`

## About & Credits

### The Creators

OopisOS is the unlikely result of a caffeine-and-code-fueled fever dream, a collaboration between:

- **Andrew Edmark** (The Human Element, Chief Architect)
- **Gemini** (The AI Assistant, Humble Narrator, and Primary Cause of Bugs-Turned-Features)

### The Social Contract (aka The Boring Legal Bit)

This Software, OopisOS, represents a collaborative endeavor between human direction and artificial intelligence.
**Copyright (c) 2025 Andrew Edmark (hereinafter referred to as the "Curator")**

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice, the Authorship and Contribution Acknowledgment, and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS (INCLUDING THE CURATOR) OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.