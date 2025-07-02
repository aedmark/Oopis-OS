# OopisOS v3.2 Command Reference

- [OopisOS v3.2 Command Reference](https://www.google.com/search?q=%23oopisos-v32-command-reference)
  - [A Note on the Structure of This Document](https://www.google.com/search?q=%23a-note-on-the-structure-of-this-document)
- [1. Core Concepts: Observation & Security](https://www.google.com/search?q=%231-core-concepts-observation--security)
- [2. The Social Fabric: User & Group Management](https://www.google.com/search?q=%232-the-social-fabric-user--group-management)
- [3. The Workshop: Fundamental File Operations](https://www.google.com/search?q=%233-the-workshop-fundamental-file-operations)
- [4. The Assembly Line: Text Processing & Automation](https://www.google.com/search?q=%234-the-assembly-line-text-processing--automation)
- [5. The Bridge: Networking & System Integrity](https://www.google.com/search?q=%235-the-bridge-networking--system-integrity)
- [6. The Cockpit: High-Level Applications](https://www.google.com/search?q=%236-the-cockpit-high-level-applications)
- [7. The Environment: Shell & Session Control](https://www.google.com/search?q=%237-the-environment-shell--session-control)

### A Note on the Structure of This Document

The commands in this reference are presented in a deliberate order designed to build your understanding of the system from the ground up. The progression is as follows:

1.  **Observation & Security:** The foundational tools for seeing the file system and understanding its rules (`ls`, `chmod`, `find`).
2.  **User & Group Management:** The commands that manage the actors in our security model (`useradd`, `sudo`, `chown`).
3.  **Fundamental File Operations:** The essential tools for daily work (`cat`, `mkdir`, `cp`, `rm`).
4.  **Text Processing & Automation:** A powerful suite of utilities for manipulating data and automating tasks (`grep`, `sort`, `awk`, `run`).
5.  **Networking & System Integrity:** Tools for connecting to the outside world and managing the system's state (`wget`, `backup`).
6.  **High-Level Applications:** The suite of built-in, full-screen applications (`edit`, `paint`, `chidi`).
7.  **Shell & Session Control:** Commands for customizing your environment and managing your session (`alias`, `set`, `history`, `logout`).

-----

## 1\. Core Concepts: Observation & Security

| Command | Description |
| :--- | :--- |
| `ls` | Lists directory contents. Use `-l` for details, `-a` for hidden files, `-R` for recursion. |
| `tree` | Displays the contents of a directory in a visually structured, tree-like format. |
| `pwd` | Prints the full, absolute path of your current working directory. |
| `diff` | Compares two files line by line, showing additions, deletions, and common lines. |
| `df` | Reports the virtual file system's overall disk space usage. Use `-h` for human-readable sizes. |
| `du` | Estimates and displays the disk space used by a specific file or directory. |
| `chmod`| Changes the permission mode of a file (e.g., `chmod 755 script.sh`). |
| `find` | Searches for files based on criteria like name (`-name`), type (`-type`), or permissions (`-perm`). |

-----

## 2\. The Social Fabric: User & Group Management

| Command | Description |
| :--- | :--- |
| `useradd` | Creates a new user account and their home directory. |
| `removeuser` | Permanently deletes a user account, with an option to remove their home directory. |
| `groupadd` | Creates a new user group. |
| `groupdel` | Deletes an existing user group. |
| `usermod` | Modifies a user's group memberships (`-aG <group> <user>`). |
| `passwd` | Changes a user's password interactively. |
| `chown` | Changes the user ownership of a file or directory. |
| `chgrp` | Changes the group ownership of a file or directory. |
| `sudo` | Executes a single command with superuser (root) privileges. |
| `visudo`| Safely edits the `/etc/sudoers` file to manage who can use `sudo`. |
| `login` | Logs in as a different user, replacing the current session entirely. |
| `logout`| Logs out of a stacked session created with `su`, returning to the previous user. |
| `su` | Switches to another user, stacking the new session on top of the old one. |
| `whoami`| Prints the username of the currently active user. |
| `groups`| Displays the group memberships for a specified user. |
| `listusers`| Lists all registered user accounts on the system. |

-----

## 3\. The Workshop: Fundamental File Operations

| Command | Description |
| :--- | :--- |
| `mkdir` | Creates a new directory. Use `-p` to create parent directories as needed. |
| `touch` | Creates a new empty file or updates the timestamp of an existing one. |
| `echo` | Writes arguments to the output. Used with `>` or `>>` to write to files. |
| `cat` | Concatenates and displays the content of one or more files. |
| `head` | Outputs the first part (default: 10 lines) of a file. |
| `tail` | Outputs the last part (default: 10 lines) of a file. |
| `cp` | Copies files or directories. Use `-r` for recursive, `-p` to preserve metadata. |
| `mv` | Moves or renames files and directories. |
| `rm` | Removes (deletes) files or directories. Use `-r` for recursive, `-f` to force. |
| `zip` | Creates a simulated `.zip` archive containing a specified file or directory. |
| `unzip` | Extracts files and directories from a simulated `.zip` archive. |
| `upload`| Opens a dialog to upload files from your local machine into the OopisOS file system. |
| `export`| Opens a dialog to download a file from the OopisOS file system to your local machine. |

-----

## 4\. The Assembly Line: Text Processing & Automation

| Command | Description |
| :--- | :--- |
| `grep` | Searches for a pattern within files or standard input (`-i` for case-insensitivity). |
| `sort` | Sorts lines of text from a file or standard input (`-n` for numeric, `-r` for reverse). |
| `uniq` | Reports or filters out adjacent repeated lines (`-c` to count, `-d` for duplicates). |
| `wc` | Counts lines (`-l`), words (`-w`), and bytes (`-c`) in files or standard input. |
| `awk` | A powerful pattern-scanning and text-processing language for complex data extraction. |
| `shuf` | Generates a random permutation of its input lines. |
| `xargs` | Builds and executes command lines from standard input, connecting commands. |
| `run` | Executes a shell script (`.sh` file), with support for arguments (`$1`, `$@`). |
| `delay` | Pauses execution for a specified number of milliseconds. Essential for scripts. |
| `printscreen`| Captures all visible text in the terminal and saves it to a file. |

-----

## 5\. The Bridge: Networking & System Integrity

| Command | Description |
| :--- | :--- |
| `wget` | A non-interactive network downloader for fetching files from URLs. |
| `curl` | A versatile tool for transferring data from or to a server, often used for API interaction. |
| `ps` | Displays a list of currently running background processes started with `&`. |
| `kill` | Terminates a background process by its Job ID (found via `ps`). |
| `savestate`| Manually saves a complete snapshot of the current user's session and file system. |
| `loadstate`| Restores the last manually saved state for the current user. |
| `backup`| Creates a secure, downloadable backup file of the entire OS state with a checksum. |
| `restore`| Restores the entire OS from a downloaded backup file, wiping the current state. |
| `clearfs`| Permanently erases all contents within the current user's home directory. |
| `reboot`| Reboots the OopisOS virtual machine by reloading the page, preserving all data. |
| `reset` | Wipes ALL OopisOS data (users, files, settings) and performs a factory reset. |

-----

## 6\. The Cockpit: High-Level Applications

| Command | Description |
| :--- | :--- |
| `edit` | Opens a powerful, full-screen text editor with live Markdown/HTML preview. |
| `paint` | Launches a graphical, character-based art studio for creating ASCII and ANSI art. |
| `explore`| Opens a graphical, two-pane file explorer for intuitive navigation. |
| `chidi` | The "AI Librarian." Launches a modal application to read and analyze Markdown files with AI. |
| `gemini`| Interacts with a tool-using Gemini AI model that can execute commands to answer questions. |
| `adventure`| Starts the interactive text adventure game engine. |

-----

## 7\. The Environment: Shell & Session Control

| Command | Description |
| :--- | :--- |
| `help` | Displays a list of all commands or a specific command's syntax. |
| `man` | Formats and displays the detailed manual page for a given command. |
| `history`| Displays or clears the command history for the current session (`-c` to clear). |
| `clear` | Clears the terminal screen of all previous output. |
| `alias` | Creates or displays command shortcuts (e.g., `alias ll='ls -l'`). |
| `unalias`| Removes one or more defined aliases. |
| `set` | Sets or displays session-specific environment variables (e.g., `set MY_VAR="hello"`). |
| `unset` | Removes one or more environment variables. |
| `date` | Displays the current system date and time. |
| `check_fail`| A diagnostic tool to verify that a given command correctly produces an error. |