
---
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

# OopisOS v5.1 : **A Pocket-Sized, AI-Powered, Web-Based Operating System**

Welcome, friend, to OopisOS! You're about to embark on an incredible journey into a world of productivity, creativity, and cutting-edge technology, all running right here in your browser. This guide is your trusted companion, your roadmap to becoming an OopisOS power-user. Let's dive in!
## Recent Changes
- **OopisOS Desktop Enhancement:** Enhanced the desktop app with functional file management, context menus, keyboard shortcuts, and proper windowed app support
- **Brace Expansion Implementation:** Added shell brace expansion functionality supporting comma expansion and sequence expansion in the command preprocessing pipeline
- **JSDoc Documentation:** Added comprehensive JSDoc comments to multiple OopisOS application files for better code documentation
- **Modal Apps in Desktop Environment:** Fixed integration issues to allow modal apps (Paint, Editor, Basic) to run properly inside desktop windows
- **File Content Loading Fix:** Resolved issue where files opened in desktop environment showed blank content due to incorrect data passing

## Chapter 1: What is OopisOS?

OopisOS is a complete, simulated operating system designed for the modern web. It's a love letter to the classic command-line interfaces of Unix-like systems, supercharged with a suite of powerful graphical applications and groundbreaking AI tools. Whether you're here to learn the ropes of the command line, write code, create art, play games, or collaborate on a project, OopisOS has something for you.
## Chapter 2: Your First Steps - The Terminal

The heart of OopisOS is the **Terminal**. This is where you'll interact with the system by typing commands.
### The Prompt
When you first arrive, you'll see a line of text ending in `>`. This is the command prompt. It tells you who you are and where you are. By default, you are the `Guest` user in your home directory.

`Guest@OopisOs:~$ >`

- `Guest`: Your current username.
- `OopisOs`: The system's hostname.
- `~`: A shortcut for your home directory (`/home/Guest`).
- `>`: The prompt symbol. If you were the `root` user, this would be a `#`.

### Entering Commands

Simply type a command and press **Enter**. For example, try this:

```
echo Hello, OopisOS!
```

The system will respond by printing "Hello, OopisOS!" to the screen. Congratulations, you've just run your first command!
### Getting Help

Two essential commands will be your best friends:

- `help`: Displays a list of all available commands.
- `man <command>`: Shows the "manual page" for a specific command, giving you a detailed description and a list of all its options (e.g., `man ls`).

## Chapter 3: The File System - Your Digital World

OopisOS has its own virtual file system, just like any other OS. It's a tree-like structure of files and directories.
### Key Concepts

- **Files**: Contain data, like text, code, or even art.
- **Directories**: Containers that hold files and other directories.
- **Path**: The address of a file or directory.
  - **Absolute Path**: Starts from the root of the file system, `/`. Example: `/home/Guest/documents`.
  - **Relative Path**: Starts from your current location. Example: `documents`.
- **Special Directories**:
  - `.` (dot): Represents your current directory.
  - `..` (dot-dot): Represents the parent directory (one level up).

### Navigating the File System

These are the three most fundamental commands for moving around:
- `pwd` (Print Working Directory): Shows you where you are right now.
- `ls` (List): Lists the contents of the current directory. Try `ls -l` for a more detailed "long" view.
- `cd` (Change Directory): Moves you to a different directory. `cd documents` moves you into the `documents` directory. `cd ..` moves you up one level. `cd /` takes you to the very top, the root directory.
## Chapter 4: Core Commands - Your Toolkit

Here is a categorized list of essential commands you'll use every day. Remember to use `man <command>` for more details!
### File & Directory Management

- `mkdir <name>`: Creates a new directory.
- `touch <file>`: Creates a new, empty file or updates the timestamp of an existing one.
- `cp <source> <destination>`: Copies a file or directory. Use `cp -r` for directories.
- `mv <source> <destination>`: Moves or renames a file or directory.
- `rm <file>`: Deletes a file. Use `rm -r` to delete a directory and all its contents (use with caution!).
- `cat <file>`: Displays the entire content of a file.
- `head <file>` / `tail <file>`: Displays the beginning or end of a file.
### User & System Management

- `whoami`: Shows your current username.
- `login <user>`: Logs in as a different user, starting a fresh session.
- `su <user>`: Switches to another user, stacking the session. Use `logout` to return.
- `passwd`: Change your password.
- `useradd <name>` / `removeuser <name>`: Create or delete user accounts (root only).
- `ps` / `jobs`: List currently running background processes.
- `kill <job_id>`: Stop a running background process.
- `oopis-get`: The OopisOS package manager. Use `oopis-get install <package>` to add new commands and features to your system!
- `reboot`: Restarts the OopisOS system.
- `reset`: A powerful command to reset the _entire_ OS to its factory state. **Warning: This erases everything!**
### Text Manipulation & Pipelines

One of the most powerful features of a command line is the ability to chain commands together using the "pipe" (`|`) operator. The output of the first command becomes the input for the second!

- `grep <pattern> <file>`: Searches for a pattern within a file.
- `sort`: Sorts lines of text alphabetically or numerically.
- `uniq`: Filters out repeated adjacent lines.
- `wc`: Counts lines, words, and characters.
- `cut`: Extracts sections from each line.
- `sed`: A "stream editor" for find-and-replace operations.

**Example Pipeline:** Find all unique error lines in a log file and count them.
```
cat system.log | grep "ERROR" | sort | uniq | wc -l
```

## Chapter 5: The Application Suite

OopisOS isn't just a command line! Launch these powerful graphical applications by typing their name in the terminal.

- `explore`: A two-pane graphical file explorer. Navigate with ease, and right-click on items for context-sensitive actions like creating, renaming, and deleting.
- `edit [file]`: A powerful, context-aware text editor. It automatically enables live previews for Markdown (`.md`) and HTML (`.html`) files, and features syntax highlighting for code.
- `paint [file.oopic]`: Unleash your creativity! `paint` is a full-screen, grid-based editor for creating amazing ASCII and ANSI art.
- `adventure [file.json]`: Start an interactive text adventure game! Play the built-in game or use `adventure --create <file>` to build your own.
- `log ["entry"]`: Your personal journal. Run it without arguments to open the full app, or pass a quick note in quotes to log it instantly.
- `basic [file.bas]`: A complete IDE for the Oopis Basic programming language, with advanced functions that can interact with the OS itself.
- `top`: A real-time, dynamic view of all running background processes.
## Chapter 6: The OopisX Desktop Environment

Ready to move beyond the command line? OopisOS features a full graphical user interface (GUI) called OopisX.

To start it, simply type: `x`

This will launch you into a familiar desktop environment complete with draggable application windows, a taskbar to manage them, and icons on your desktop for quick access to your files. Double-click an icon to open it with its default application. This is the perfect way to manage multiple tasks and enjoy a more visual workflow. To exit the GUI, simply close the "Desktop Manager" window.
## Chapter 7: The AI Revolution in OopisOS

OopisOS integrates next-generation AI to make you more productive and creative.

- `gemini "<prompt>"`: This is your primary AI assistant. It can understand your files and use other OS commands to gather information and answer your questions.
  - **Example**: `gemini "Summarize my README.md and list any scripts in this directory"`
  - **Chat Mode**: Use `gemini -c` to launch a full-screen, interactive chat application.
- `chidi [path]`: The AI-powered document analyst. Launch it on a file or directory to get summaries, ask questions about the content, and get study suggestions. It's like having a research assistant built right into your OS.
- `remix <file1> <file2>`: A creative AI tool that reads two documents and synthesizes a brand new article blending the key ideas from both sources.

---
# Closing

This guide is just the beginning. The best way to learn is by doing. Explore the file system, try out the commands, write a script, create some art, and build an adventure.

OopisOS is your oyster.

We're so excited to see what you'll create!

Welcome to the committee.
Welcome to OopisOS.