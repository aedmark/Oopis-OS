# OopisOS v3.1 Command Reference

This document provides a comprehensive reference for all available commands in OopisOS. Each entry includes a description, usage syntax, details on all available options, and practical examples. For a quick list of commands, type `help`.

---

### Table of Contents
1.  [Getting Started & Help](#getting-started--help)
2.  [Navigation & Observation](#navigation--observation)
3.  [File Content & Manipulation](#file-content--manipulation)
4.  [File System Operations](#file-system-operations)
5.  [Users & Groups](#users--groups)
6.  [Permissions & Ownership](#permissions--ownership)
7.  [System Administration](#system-administration)
8.  [Networking & Data Transfer](#networking--data-transfer)
9.  [Archival](#archival)
10. [Session & State Management](#session--state-management)
11. [Process & Scripting](#process--scripting)
12. [AI & Advanced Tools](#ai--advanced-tools)

---

### Getting Started & Help

#### `help`
**Description:** Displays a list of commands or a command's syntax.
**Usage:** `help [command]`
**Details:** Displays a list of all available commands. If a command name is provided, it displays the command's usage syntax. For a full, detailed manual page for a command, use `man <command>`.

#### `man`
**Description:** Formats and displays the manual page for a command.
**Usage:** `man <command>`
**Details:** Displays the comprehensive manual page for the specified command, including a detailed description and a list of all available options.

#### `clear`
**Description:** Clears the terminal screen of all previous output.
**Usage:** `clear`
**Details:** This does not clear your command history, which can still be accessed with the up and down arrow keys. To clear history, use the `history -c` command.

---

### Navigation & Observation

#### `ls`
**Description:** Lists directory contents and file information.
**Usage:** `ls [OPTION]... [FILE]...`
**Details:** Lists information about the FILEs (the current directory by default).
**Options:**
- `-l, --long`: Use a long listing format.
- `-a, --all`: Do not ignore entries starting with `.`.
- `-R, --recursive`: List subdirectories recursively.
- `-r, --reverse`: Reverse order while sorting.
- `-t`: Sort by modification time, newest first.
- `-S`: Sort by file size, largest first.
- `-X`: Sort alphabetically by entry extension.
- `-U`: Do not sort; list entries in directory order.
- `-d, --dirs-only`: List directories themselves, not their contents.

#### `cd`
**Description:** Changes the current working directory.
**Usage:** `cd <directory>`
**Details:** Changes the current working directory to the specified `<directory>`. Recognizes `.` (current) and `..` (parent) special directories.

#### `pwd`
**Description:** Prints the current working directory.
**Usage:** `pwd`
**Details:** Writes the full, absolute pathname of the current working directory to standard output.

#### `tree`
**Description:** Lists directory contents in a tree-like format.
**Usage:** `tree [OPTION]... [PATH]`
**Details:** Recursively lists the contents of the given directory.
**Options:**
- `-L <level>, --level <level>`: Descend only `<level>` directories deep.
- `-d, --dirs-only`: List directories only.

---

### File Content & Manipulation

#### `cat`
**Description:** Concatenate and display the content of files.
**Usage:** `cat [FILE]...`
**Details:** Reads files sequentially, writing them to the standard output. If no files are specified, reads from standard input.

#### `echo`
**Description:** Writes arguments to the standard output.
**Usage:** `echo [STRING]...`
**Details:** Writes its arguments separated by spaces, terminated by a newline. The shell expands environment variables (like `$USER`) before they are passed to echo.

#### `touch`
**Description:** Changes file timestamps or creates empty files.
**Usage:** `touch [OPTION]... FILE...`
**Details:** Updates the modification time of each FILE to the current time. A FILE argument that does not exist is created empty.
**Options:**
- `-c, --no-create`: Do not create any files.
- `-d, --date=<string>`: Parse `<string>` and use it instead of the current time.
- `-t <stamp>`: Use `[[CC]YY]MMDDhhmm[.ss]` instead of the current time.

#### `edit`
**Description:** Opens a file in the full-screen text editor.
**Usage:** `edit <filename>`
**Details:** Launches a powerful, full-screen text editor. If `<filename>` does not exist, it will be created upon saving. Features include live Markdown/HTML preview (`Ctrl+P`) and keyboard shortcuts for saving (`Ctrl+S`) and exiting (`Ctrl+O`).

#### `paint`
**Description:** Opens the character-based art editor.
**Usage:** `paint [filename.oopic]`
**Details:** Launches a full-screen, grid-based editor for creating ASCII and ANSI art. Features multiple tools and colors. Artwork is saved in the `.oopic` format.

---

### File System Operations

#### `mkdir`
**Description:** Creates one or more new directories.
**Usage:** `mkdir [OPTION]... <DIRECTORY>...`
**Options:**
- `-p, --parents`: Create parent directories as needed.

#### `rm`
**Description:** Removes files or directories.
**Usage:** `rm [OPTION]... [FILE]...`
**Details:** Permanently removes each specified file.
**Options:**
- `-r, -R, --recursive`: Remove directories and their contents recursively.
- `-f, --force`: Ignore nonexistent files and arguments, never prompt.
- `-i, --interactive`: Prompt before every removal.

#### `cp`
**Description:** Copies files and directories.
**Usage:** `cp [OPTION]... <source> <destination>` or `cp [OPTION]... <source>... <directory>`
**Details:** Copies source files to a destination.
**Options:**
- `-r, -R, --recursive`: Copy directories recursively.
- `-f, --force`: If a destination file cannot be opened, remove it and try again.
- `-p, --preserve`: Preserve the original file's mode, owner, group, and modification time.
- `-i, --interactive`: Prompt before overwriting an existing file.

#### `mv`
**Description:** Move or rename files and directories.
**Usage:** `mv [OPTION]... <source> <destination>`
**Details:** Renames SOURCE to DEST, or moves SOURCE(s) to DIRECTORY.
**Options:**
- `-f, --force`: Do not prompt before overwriting.
- `-i, --interactive`: Prompt before overwriting an existing file.

#### `diff`
**Description:** Compares two files line by line.
**Usage:** `diff <file1> <file2>`
**Details:** Analyzes two files and prints the lines that are different.

#### `find`
**Description:** Searches for files in a directory hierarchy.
**Usage:** `find [path...] [expression]`
**Details:** Searches for files based on a set of criteria.
**Expressions:**
- `-name <pattern>`: File name matches shell pattern.
- `-type <f|d>`: File is of type file (`f`) or directory (`d`).
- `-user <name>`: File is owned by user `<name>`.
- `-perm <mode>`: File's permission bits are exactly `<mode>` (octal).
- `-mtime <n>`: File's data was last modified `n`*24 hours ago.
- `-newermt <date>`: File modified more recently than `<date>`.
- `-delete`: Deletes found files.
- `-exec <cmd> {} ;`: Executes `<cmd>` on found files.

---

### Users & Groups

#### `login`
**Description:** Logs in as a user, starting a new session.
**Usage:** `login <username> [password]`
**Details:** Starts a new session, clearing any existing `su` session stack.

#### `logout`
**Description:** Logs out of the current user session.
**Usage:** `logout`
**Details:** Terminates the current `su` session and returns to the previous user.

#### `su`
**Description:** Switches to another user, stacking the session.
**Usage:** `su [username] [password]`
**Details:** Starts a new shell session as another user (defaults to `root`). Use `logout` to return.

#### `whoami`
**Description:** Prints the current effective user name.
**Usage:** `whoami`

#### `useradd`
**Description:** Creates a new user account.
**Usage:** `useradd <username>`
**Details:** Creates a new user and prompts for a password. Also creates a matching primary group and home directory.

#### `removeuser`
**Description:** Removes a user account and all associated data.
**Usage:** `removeuser [-f] <username>`
**Details:** Permanently deletes a user, their home directory, and group memberships. `root` and `Guest` cannot be removed.
**Options:** `-f, --force`: Do not prompt for confirmation.

#### `listusers`
**Description:** Lists all registered users on the system.
**Usage:** `listusers`

#### `groupadd`
**Description:** Creates a new user group.
**Usage:** `groupadd <groupname>`

#### `groupdel`
**Description:** Deletes an existing user group.
**Usage:** `groupdel <groupname>`
**Details:** Cannot remove the primary group of an existing user.

#### `groups`
**Description:** Displays the group memberships for a user.
**Usage:** `groups [username]`

#### `usermod`
**Description:** Modifies a user account, primarily for group membership.
**Usage:** `usermod -aG <groupname> <username>`
**Details:** Adds the user to the supplementary `<groupname>`.

---

### Permissions & Ownership

#### `chmod`
**Description:** Changes the access permissions of a file or directory.
**Usage:** `chmod <mode> <path>`
**Details:** `<mode>` is a 3-digit octal number (e.g., `755`) representing permissions for owner, group, and others.

#### `chown`
**Description:** Changes the user ownership of a file or directory.
**Usage:** `chown <owner> <path>`
**Details:** Only `root` can change the ownership of a file.

#### `chgrp`
**Description:** Changes the group ownership of a file or directory.
**Usage:** `chgrp <group> <path>`
**Details:** You must be the owner of the file or `root` to change the group.

---

### System Administration

#### `sudo`
**Description:** Executes a command as the superuser (root).
**Usage:** `sudo <command> [arguments]`
**Details:** Allows a permitted user to execute a command as `root`. Prompts for the user's own password on first use.

#### `visudo`
**Description:** Safely edits the `/etc/sudoers` file.
**Usage:** `visudo`
**Details:** The only safe way to edit the sudoers file, which controls `sudo` access. Performs syntax checking on save. Only `root` can run this command.

#### `reset`
**Description:** Resets the entire OopisOS system to factory defaults.
**Usage:** `reset`
**Details:** **WARNING:** This is irreversible and erases all users, files, and settings.

#### `reboot`
**Description:** Reboots the OopisOS virtual machine.
**Usage:** `reboot`
**Details:** Reloads the browser page. All persisted data is restored.

---

### Networking & Data Transfer

#### `wget`
**Description:** The non-interactive network downloader.
**Usage:** `wget [-O <file>] <URL>`
**Details:** Downloads content from a URL and saves it to a file.
**Options:** `-O <file>`: Write to `<file>` instead of deriving the name from the URL.

#### `curl`
**Description:** Transfer data from or to a server.
**Usage:** `curl [options] <URL>`
**Details:** Fetches content and displays it in the terminal.
**Options:**
- `-o, --output <file>`: Write output to `<file>`.
- `-i, --include`: Include protocol response headers.
- `-L, --location`: (Not yet implemented) Follow redirects.

#### `upload`
**Description:** Uploads files or folders from your local machine to OopisOS.
**Usage:** `upload [-f] [-r] [destination_directory]`
**Details:** Opens a file dialog to select files for upload.
**Options:**
- `-f, --force`: Do not prompt; automatically overwrite existing files.
- `-r, --recursive`: Allows uploading of an entire directory.

#### `export`
**Description:** Downloads a file from OopisOS to your local machine.
**Usage:** `export <file_path>`

---

### Archival

#### `zip`
**Description:** Creates a compressed .zip archive of a file or directory.
**Usage:** `zip <archive.zip> <path>`
**Details:** Creates a simulated archive of a file or directory. Can be extracted with `unzip`.

#### `unzip`
**Description:** Extracts files from a .zip archive.
**Usage:** `unzip <archive.zip> [destination]`
**Details:** Extracts a simulated `.zip` archive created by the `zip` command.

---

### Session & State Management

#### `history`
**Description:** Displays or clears the command history.
**Usage:** `history [-c]`
**Options:** `-c, --clear`: Clear the command history.

#### `alias`
**Description:** Create, remove, and display command aliases.
**Usage:** `alias [name='command']...`

#### `unalias`
**Description:** Removes one or more defined aliases.
**Usage:** `unalias <alias_name>...`

#### `set`
**Description:** Set or display environment variables.
**Usage:** `set [variable[=value]] ...`

#### Customizing the Prompt (PS1)
You can customize the terminal prompt by setting the `PS1` environment variable. The system will parse the following special sequences:
- `\u`: The current username.
- `\h`: The hostname.
- `\w`: The full path of the current working directory.
- `\W`: The basename of the current working directory.
- `\$`: Displays a `$` for normal users, or a `#` for the `root` user.
- `\\`: A literal backslash.
  **Example:** `set PS1='\u@\h:\w\$ '` recreates the default prompt.
  **Example:** `set PS1='(\s) \w> '` creates a prompt like `(OopisOS) /home/Guest>`.

#### `unset`
**Description:** Unsets one or more environment variables.
**Usage:** `unset <variable_name>...`

#### `savefs`
**Description:** Manually saves the current file system state.
**Usage:** `savefs`

#### `savestate`
**Description:** Manually saves a snapshot of the current session.
**Usage:** `savestate`

#### `loadstate`
**Description:** Loads the last manually saved session state.
**Usage:** `loadstate`

#### `backup`
**Description:** Creates a backup of the current OopisOS system state.
**Usage:** `backup`
**Details:** Creates a downloadable JSON file containing a snapshot of the entire system state, including a SHA-256 checksum for integrity.

#### `restore`
**Description:** Restores the entire system state from a backup file.
**Usage:** `restore`
**Details:** Prompts to upload a backup file, verifies its checksum, and overwrites the entire current system state.

#### `printscreen`
**Description:** Saves the visible terminal output to a file.
**Usage:** `printscreen <filepath>`

---

### Process & Scripting

#### `run`
**Description:** Executes a shell script.
**Usage:** `run <script_path> [arguments...]`
**Details:** Executes a script file containing OopisOS commands. Supports comments (`#`) and arguments (`$1`, `$@`, `$#`).

#### `ps`
**Description:** Reports a snapshot of current background jobs.
**Usage:** `ps`
**Details:** Displays the PID and command for jobs started with `&`.

#### `kill`
**Description:** Terminates a background job.
**Usage:** `kill <job_id>`

#### `delay`
**Description:** Pauses execution for a specified time.
**Usage:** `delay <milliseconds>`

---

### AI & Advanced Tools

#### `gemini`
**Description:** Engages in a context-aware conversation with the Gemini AI.
**Usage:** `gemini [-n] [-v] "<prompt>"`
**Details:** An AI assistant that can use OopisOS commands to explore the file system and answer questions.
**Options:**
- `-n, --new`: Starts a new conversation.
- `-v, --verbose`: Enable verbose logging to see the AI's step-by-step plan and command execution.

#### `chidi`
**Description:** Opens the Chidi.md Markdown reader for a specified file or directory.
**Usage:** `chidi <path>`
**Details:** Launches a modal app to read and analyze Markdown files with AI assistance.

#### `adventure`
**Description:** Starts an interactive text adventure game.
**Usage:** `adventure [path_to_game.json]`
**Details:** Launches the text adventure engine. Loads a default game or a custom one from a JSON file.