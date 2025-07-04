# Welcome to OopisOS v3.5: "The Architect's Edition"

#### "The Tao is embodied in all software -- regardless of how insignificant."

```
Guest@OopisOs:~$ echo "OopisOS is ready."  
OopisOS is ready.
```

## What is OopisOS?

OopisOS is a sophisticated OS simulation that runs entirely within your browser. It's a self-contained, persistent world built on a foundation of privacy and exploration, featuring a rich command-line environment, a secure multi-user file system, and a suite of powerful integrated tools. All user data is stored locally in your browser; your world remains your own.

The "Architect's Edition" refines the core experience, focusing on robust security, a richer toolset for data manipulation, and deeper integration of AI-driven features.

## Key Features at a Glance

- **A Rock-Solid File System:** A persistent VFS powered by IndexedDB with a full suite of management tools: `ls`, `find`, `tree`, `diff`, `cp`, `mv`, `rm`, `zip`, and `unzip`.

- **An Empowered Command-Line:** Full history, tab-completion, piping (`|`), redirection (`>`), backgrounding (`&`), sequencing (`;`), and environment variable support with a customizable prompt via `PS1`.

- **A True Multi-User Security Model:** Create users (`useradd`) and groups (`groupadd`). Manage permissions with `chmod`, `chown`, and `chgrp`. Execute commands with elevated privileges using `sudo` and safely edit the rules with `visudo`.

- **A Full Suite of Applications:**

  - `edit`: A powerful text editor with live Markdown preview.

  - `paint`: A character-based art studio for your inner artist.

  - `explore`: A graphical, two-pane file explorer.

  - `chidi`: An AI-powered document analysis tool.

  - `gemini`: A tool-using AI assistant for your terminal.

  - `adventure`: A powerful, data-driven text adventure engine to play and build interactive fiction.

  - `basic`: An integrated development environment for the classic BASIC programming language.

  - `log`: A journaling system for secure, private logs.

  
## User Guide

This guide covers the essential commands for navigating and interacting with the OopisOS environment. For a quick list of all commands, type `help`. For a detailed manual on a specific command, type `man [command_name]`.

### Essential Commands

|Command & Key Flags|What It Does|
|---|---|
|`help [cmd]`|Displays a list of commands or a command's basic syntax.|
|`ls [-l -a -R -r -t -S -X -d]`|Lists directory contents. The cornerstone of observation.|
|`tree [-L level] [-d]`|Like `ls`, but fancier. Displays files and directories in a tree.|
|`cd [directory]`|Changes your current location in the file system.|
|`pwd`|Prints the full path of your current working directory.|
|`mkdir [-p] [dir_name]`|Creates a new, empty directory.|
|`cat [-n] [file...]`|Displays the entire content of a file. Use `-n` for line numbers.|
|`echo [text]`|Repeats text back to you. Primarily used for writing to files.|
|`touch [-c -d 'date'] [file]`|Creates an empty file or updates its timestamp.|
|`rm [-r -f -i] [item]`|Removes (deletes) a file or directory. This is permanent.|
|`cp [-r -f -p -i] [src] [dest]`|Copies a file or directory.|
|`mv [-f -i] [src] [dest]`|Moves or renames a file or directory.|
|`grep [-i -v -n -c -R] [pat]`|Searches for a text pattern within files.|
|`find [path] [expr]`|A powerful tool to find files based on various criteria.|

### Data & System Utilities

|Command & Key Flags|What It Does|
|---|---|
|`head [-n lines] [-c bytes]`|Outputs the first part of a file.|
|`tail [-n lines] [-c bytes]`|Outputs the last part of a file.|
|`diff [file1] [file2]`|Compares two files and shows the differences.|
|`sort [-r -n -u] [file]`|Sorts lines of text alphabetically or numerically.|
|`uniq [-c -d -u] [file]`|Filters or reports repeated adjacent lines.|
|`wc [-l -w -c] [file]`|Counts the lines, words, and bytes in a file.|
|`awk 'program' [file]`|A powerful tool for pattern-based text processing.|
|`xargs [command]`|Builds and executes command lines from standard input.|
|`df [-h]`|Reports the file system's overall disk space usage.|
|`du [-h -s] [path]`|Estimates disk space used by a specific file/directory.|
|`base64 [-d]`|Encodes or decodes data to standard output.|
|`cksum [file]`|Calculates a checksum and byte count for a file.|

### Application Suite

OopisOS comes with several built-in applications that run in a full-screen, modal interface, providing a richer experience than standard command-line tools.

- **`explore [path]`** Opens a graphical, two-pane file explorer. The left pane shows an expandable directory tree, and the right pane shows the contents of the selected directory. It's a powerful and intuitive way to navigate your file system.

- **`edit [file]`** Opens the OopisOS text editor. It's a surprisingly capable editor with features like live Markdown and HTML preview (`Ctrl+P`), a formatting toolbar, and keyboard shortcuts for saving (`Ctrl+S`) and exiting (`Ctrl+O`).

- **`paint [file.oopic]`** Unleash your creativity with the character-based art editor. It features a full canvas, multiple tools (pencil, eraser, shapes), a color palette, and saves your work to the custom `.oopic` format.

- **`chidi [path]`** The AI Librarian. Point `chidi` at a directory of Markdown files (`.md`) to open a dedicated reading interface. Here, you can ask the AI to summarize documents, generate study questions, or perform a query across all loaded documents to find specific information.

- **`adventure [file.json]`** Launches the powerful, data-driven text adventure engine. Play the built-in "Architect's Apprentice" tutorial to learn the ropes, or load your own custom adventures from a `.json` file to create and explore new worlds. For a full guide on creating your own adventures, see `/docs/adventure.md`.

- **`gemini "<prompt>"`** A tool-using AI assistant that can execute shell commands to answer questions about your file system or provide general knowledge.

- **`basic [file.bas]`** Launches the Oopis Basic Integrated Development Environment. It's a throwback to the classic days of computing, allowing you to write, `LIST`, and `RUN` line-numbered programs. Use `SAVE` and `LOAD` within the IDE to manage your `.bas` files.

- **'log'** Keep a captain's log of your daily adventures.

## Advanced Topics

Ready to wield true power? This section covers the tools that separate the administrators from the users.

### Shell Customization: The `PS1` Variable

You have full control over your command prompt's appearance via the `PS1` environment variable. Use `set` with a string containing special, backslash-escaped characters.

|Sequence|Description|
|---|---|
|`\u`|The current username (e.g., `Guest`).|
|`\h`|The hostname (e.g., `OopisOs`).|
|`\w`|The full path of the current working directory.|
|`\W`|The basename of the current working directory.|
|`\$`|Displays a `#` if the user is `root`, otherwise a `$`.|
|`\\`|A literal backslash character.|

```
Guest@OopisOs:/home/Guest$ set PS1="[\u@\h \W]\\$ "
[Guest@OopisOs Guest]$
```

### Privilege Escalation: `sudo` and `visudo`

Some tasks require the power of the `root` user. `sudo` is your key to borrowing that power, safely and temporarily.

- **`sudo [command]`** Executes a single command with `root` privileges. You will be prompted for _your own_ password to verify your identity.

- **`visudo`** The only safe way to edit the `/etc/sudoers` file, which controls who can use `sudo`. It locks the file and performs a syntax check on save to prevent you from locking yourself out.


### File Archival: `zip` and `unzip`

Manage collections of files by bundling them into a single archive.

- **`zip [archive.zip] [path_to_zip]`** Creates a simulated `.zip` archive containing the file or directory.

- **`unzip [archive.zip] [destination_path]`** Extracts the contents of a `.zip` archive into the specified destination.


### Advanced Command Chaining: `&&`, `||`, and Pipes

The shell supports powerful logical operators for more intelligent command-line workflows.

- **The AND Operator (`&&`)**: The command to the right runs **only** if the command to the left succeeds. `mkdir new_project && cd new_project`

- **The OR Operator (`||`)**: The command to the right runs **only** if the command to its left _fails_. `grep "FATAL" system.log || echo "No fatal errors found."`


## Developer Documentation

The OopisOS v3.5 "Architect's Edition" continues to build on our modular command architecture. For the full architectural document, please see `/docs/developer.md`.

### The Command Contract

Adding a new command is a declarative process. You _declare_ your command's requirements (flags, arguments, path validation, permissions) to the `CommandExecutor`, which enforces these rules _before_ your command's core logic is ever run, ensuring stability and security.

## Testing & Showcase Environment

A brand new OS can feel... empty. To combat this, we've included two very special scripts.

### The World-Builder: `inflate.sh`

A single command that terraforms your empty home directory into a bustling ecosystem of files, directories, and secrets, all designed for you to test and explore.

`Guest@OopisOs:/> run /extras/inflate.sh`

### The Gauntlet: `diag.sh`

Our quality assurance department in a script. It's a relentless stress test that runs a barrage of commands to ensure all systems are operational.

`Guest@OopisOs:/> run /extras/diag.sh`

## About & Credits

### The Creators

OopisOS is the unlikely result of a caffeine-and-code-fueled fever dream, a collaboration between:

- **Andrew Edmark** (The Human Element, Chief Architect)

- **Gemini** (The AI Assistant, Humble Narrator, and Primary Cause of Bugs-Turned-Features)


### The Social Contract (aka The Boring Legal Bit)

This Software, OopisOS, represents a collaborative endeavor between human direction and artificial intelligence. **Copyright (c) 2025 Andrew Edmark (hereinafter referred to as the "Curator")**

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice, the Authorship and Contribution Acknowledgment, and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS (INCLUDING THE CURATOR) OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.