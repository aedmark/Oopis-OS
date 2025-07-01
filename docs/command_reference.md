# OopisOS Command Reference

- [OopisOS Command Reference](#oopisos-command-reference)
  + [A Note on the Structure of This Document](#a-note-on-the-structure-of-this-document)
  + [`ls`](#ls)
  + [`chmod`](#chmod)
  + [`find`](#find)
  + [`useradd`](#useradd)
  + [`groupadd`](#groupadd)
  + [`usermod`](#usermod)
  + [`chown`](#chown)
  + [`chgrp`](#chgrp)
  + [`cat`](#cat)
  + [`mkdir`](#mkdir)
  + [`touch`](#touch)
  + [`cp`](#cp)
  + [`mv`](#mv)
  + [`rm`](#rm)
  + [`ps`](#ps)
  + [`kill`](#kill)
  + [`wget`](#wget)
  + [`curl`](#curl)
  + [`run`](#run)
  + [`edit`](#edit)
  + [`paint`](#paint)
  + [`chidi`](#chidi)
  + [`adventure`](#adventure)
  + [`gemini`](#gemini)

This document provides a comprehensive reference for all available commands in OopisOS. Each entry includes a description, syntax, details on all available options, and practical examples.

---

### A Note on the Structure of This Document

The commands in this reference are presented in a deliberate order designed to build your understanding of the system from the ground up. The progression is as follows:

1. **Core Concepts of Observation and Security:** We begin with `ls`, `chmod`, and `find`. These are the foundational tools for observing the file system and understanding its security model. Before you can effectively act upon the system, you must be able to see its structure (`ls`), understand its rules (`chmod`), and locate its components (`find`).

2. **User and Group Management:** Building on the concept of permissions, the next section details the commands that manage the actors in our security model: `useradd`, `groupadd`, `usermod`, `chown`, and `chgrp`. This block fully defines the "who" that the permission rules apply to, establishing the complete multi-user environment.

3. **Fundamental File Operations:** Once you understand the layout of the system and its rules of access, we introduce the essential tools for daily work: `cat`, `mkdir`, `touch`, `cp`, `mv`, and `rm`. These are the fundamental verbs of file manipulation—the actions you will use constantly within the established structure.

4. **Advanced System Utilities:** This section introduces a higher level of interaction. It includes process management (`ps`, `kill`), connecting to the outside world (`wget`, `curl`), and automation through scripting (`run`). These tools allow you to manage the OS at a deeper level and extend its capabilities.

5. **High-Level Applications:** Finally, we document the suite of built-in applications: `edit`, `paint`, `chidi`, `adventure`, and `gemini`. These are the "destinations" within the OS—complex programs that leverage all the underlying concepts of files, permissions, and system interaction. They are presented last as they represent the culmination of the system's capabilities.


---

### `ls`

**Description:** Lists the contents of a directory.

**Usage:** `ls [options] [path]`

**Details:**

- If no `path` is provided, the contents of the current directory are listed.
- **Flags:**
  - `-l`: Use a long listing format, showing permissions, owner, group, size, modification date, and name.
  - `-a`: Do not ignore entries starting with `.`.
  - `-R`: List subdirectories recursively.
  - `-r`: Reverse the order while sorting.
  - `-t`: Sort by modification time, newest first.
  - `-S`: Sort by file size, largest first.
  - `-X`: Sort alphabetically by file extension.
  - `-U`: Do not sort; list entries in directory order.
  - `-d`: List directories themselves, not their contents.

**Permissions:** Requires `read` permission on the target directory to view its contents.

---

### `chmod`

**Description:** Changes the permission mode of a file or directory.

**Usage:** `chmod <mode> <path>`

**Details:**

- The `mode` is a 3-digit octal number. Each digit represents permissions for a different entity:
  - **First digit:** Owner's permissions.
  - **Second digit:** Group's permissions.
  - **Third digit:** Others' permissions.
- Each digit is a sum of values representing specific permissions:
  - **Read (r):** 4
  - **Write (w):** 2
  - **Execute (x):** 1

**Permissions:** Only the file's owner or the `root` user can change a file's permissions.

---

### `find`

**Description:** Searches for files in a directory hierarchy.

**Usage:** `find [path] [predicates] [actions]`

**Details:**

- The `find` command searches the specified `path` for files and directories that match a set of `predicates` and then performs an `action` on them.
- **Predicates:**
  - `-name <pattern>`: Find files with a name matching the glob pattern.
  - `-type <d|f>`: Find by type, either directory (`d`) or file (`f`).
  - `-user <name>`: Find files owned by the specified user.
  - `-perm <mode>`: Find files with a specific permission mode (e.g., `755`).
  - `-mtime <n>`: Find files modified `n` days ago.
  - `-newermt <date>`: Find files modified more recently than the given date.
- **Actions:**
  - `-print`: (Default action) Print the full path of the matched file to the terminal.
  - `-exec <command> {} \;`: Execute a command on each matched file. The `{}` is replaced by the file path.
  - `-delete`: Delete the matched files.

**Permissions:** Requires `read` and `execute` permissions on the directories it searches. Actions like `-exec` or `-delete` require additional permissions on the target files themselves (e.g., `write`).

### `useradd`

**Description:** Creates a new user account.

**Usage:** `useradd <username>`

**Details:**

- When executed, this command prompts for a password for the new user. The password is then securely hashed and stored.
- A new primary group with the same name as the `username` is automatically created and assigned to the user.

**Permissions:** Only the `root` user can create new user accounts.

---

### `groupadd`

**Description:** Creates a new user group.

**Usage:** `groupadd <groupname>`

**Details:**

- This command adds a new group to the system, which can then be assigned to users or files.

**Permissions:** Only the `root` user can create new groups.

---

### `usermod`

**Description:** Modifies a user's group memberships.

**Usage:** `usermod -aG <groupname> <username>`

**Details:**

- The `-aG` flag is used to **a**ppend a user to a supplementary **G**roup. This adds the user to the new group without removing them from their existing groups.

**Permissions:** Only the `root` user can modify user accounts.

---

### `chown`

**Description:** Changes the owner of a file or directory.

**Usage:** `chown <username> <path>`

**Details:**

- This command transfers ownership of the file or directory at the specified `path` to the given `username`.

**Permissions:** Only the `root` user can change a file's owner.

---

### `chgrp`

**Description:** Changes the group ownership of a file or directory.

**Usage:** `chgrp <groupname> <path>`

**Details:**

- This command changes the group assignment for the file or directory at the specified `path`.

**Permissions:** The file's current owner or the `root` user can change its group.

### `cat`

**Description:** Concatenates and displays the content of files.

**Usage:** `cat <file...>`

**Details:**

- Reads files sequentially, writing their contents to standard output.
- If multiple files are specified, their contents are displayed one after another.

**Permissions:** Requires `read` permission on the file(s) being displayed.

---

### `mkdir`

**Description:** Creates a new directory.

**Usage:** `mkdir <directory_path>`

**Details:**

- Creates a new, empty directory at the specified path.

**Permissions:** Requires `write` permission in the parent directory where the new directory is being created.

---

### `touch`

**Description:** Creates an empty file or updates a file's timestamp.

**Usage:** `touch <file_path>`

**Details:**

- If the file does not exist, an empty file is created at the specified path.
- If the file already exists, its modification timestamp is updated to the current time.

**Permissions:** Requires `write` permission in the parent directory to create a new file. Requires `write` permission on the file itself to update its timestamp.

---

### `cp`

**Description:** Copies files or directories.

**Usage:** `cp [options] <source> <destination>`

**Details:**

- Copies the `source` file or directory to the `destination`.
- **Flags:**
  - `-p`: Preserves metadata (permissions, owner, group, timestamps) during the copy.

**Permissions:** Requires `read` permission on the `source` file and `write` permission in the `destination` directory.

---

### `mv`

**Description:** Moves or renames files and directories.

**Usage:** `mv <source> <destination>`

**Details:**

- If the `destination` is a directory, the `source` is moved into it.
- If the `destination` is a filename, the `source` is renamed to it.

**Permissions:** Requires `write` permission in the parent directory of the `source` and in the `destination` directory.

---

### `rm`

**Description:** Removes (deletes) files or directories.

**Usage:** `rm <path>`

**Details:**

- Permanently deletes the file or directory at the specified path.
- Use with caution, as this action cannot be undone.

**Permissions:** Requires `write` permission on the parent directory of the item being removed.

### `ps`

**Description:** Displays a list of currently running background processes.

**Usage:** `ps`

**Details:**

- This command provides the `Job ID`, `Status`, and `Command` for all processes that were started with the background operator (`&`).
- The `Job ID` provided by `ps` is used as the target for the `kill` command.

**Permissions:** Any user can view their own processes. No special permissions are required.

---

### `kill`

**Description:** Terminates a background process.

**Usage:** `kill <job_id>`

**Details:**

- The `<job_id>` is the numerical ID of the process you wish to terminate, which can be found by running the `ps` command.

**Permissions:** A user can only terminate their own background processes.

---

### `wget`

**Description:** Downloads a file from a URL.

**Usage:** `wget <URL> [output_filename]`

**Details:**

- Fetches the content from the specified `<URL>` and saves it as a file in the current directory.
- If `output_filename` is provided, the downloaded file is saved with that name. Otherwise, it will attempt to use the name from the URL.

**Permissions:** Requires `write` permission in the directory where the file will be saved.

---

### `curl`

**Description:** Fetches content from a URL and displays it in the terminal.

**Usage:** `curl <URL>`

**Details:**

- Fetches the content from the specified `<URL>` and prints it directly to the standard output. This is useful for viewing the raw content of text files, APIs, or HTML without saving a file.

**Permissions:** No special file system permissions are required as it outputs directly to the terminal.

---

### `run`

**Description:** Executes a script file containing a sequence of OopisOS commands.

**Usage:** `run <script_path> [arg1] [arg2] ...`

**Details:**

- Executes the commands listed in the `<script_path>` file line by line.
- The scripting engine supports:
  - **Comments:** Lines beginning with `#` are ignored.
  - **Arguments:** Pass arguments to the script from the command line. They can be accessed within the script using `$1`, `$2`, etc. `$@` refers to all arguments, and `$#` gives the count of arguments.

**Permissions:** Requires `execute` permission on the script file itself.

### `edit`

**Description:** Opens a powerful, full-screen text editor.

**Usage:** `edit <file_path>`

**Details:**

- A full-featured text editor for plain text, Markdown, and HTML files.
- **Features:**
  - Auto-detects file type to enable special features like live preview for Markdown and HTML.
  - Toggleable live preview pane (`Ctrl+P`).
  - Formatting toolbar for Markdown/HTML (bold, italics, lists, etc.).
  - Keyboard shortcuts for saving (`Ctrl+S`), exiting (`Ctrl+O`), and formatting (`Ctrl+B`/`Ctrl+I`).

**Permissions:** Requires `read` permission on `<file_path>` to open and view. Requires `write` permission on the file to save any changes.

---

### `paint`

**Description:** Opens a graphical editor for creating ASCII and ANSI character-based art.

**Usage:** `paint [file_path.oopic]`

**Details:**

- A dedicated, full-screen canvas for creating character art. Your work is saved to the custom `.oopic` file format.
- **Features:**
  - 80x24 character canvas.
  - Tools include a Pencil and an Eraser (`P`/`E` keys).
  - A 6-color ANSI palette for adding color (`1-6` keys).
  - Supports undo/redo (`Ctrl+Z`/`Ctrl+Y`) and saving (`Ctrl+S`).

**Permissions:** Requires `read` permission on the file to open it. Requires `write` permission in the target directory to save the file.

---

### `chidi`

**Description:** Launches The AI Librarian, a tool for analyzing Markdown documents.

**Usage:** `chidi <path>`

**Details:**

- `chidi` recursively finds all `.md` files in the given `path` and loads them into a dedicated reading and analysis interface.
- **Features:**
  - Provides a clean, rendered view of your Markdown files.
  - Allows for easy navigation between multiple loaded documents.
  - Uses Gemini AI to summarize documents, generate study questions, or answer questions using the content of one or all loaded documents.

**Permissions:** Requires `read` permission for any `.md` files it discovers in the search path.

---

### `adventure`

**Description:** Starts the interactive text adventure game engine.

**Usage:** `adventure [path_to_game.json]`

**Details:**

- Launches a text-based adventure game in a dedicated modal window.
- If no path is provided, it loads a default, built-in adventure.
- You can load custom adventures by providing a path to a compatible JSON file.

**Permissions:** Requires `read` permission on the `.json` file when loading a custom adventure.

---

### `gemini`

**Description:** Interacts with a tool-using Gemini AI model.

**Usage:** `gemini [-n] "<prompt>"`

**Details:**

- Sends your `<prompt>` to the Gemini AI. The AI can execute OopisOS commands (`ls`, `find`, `cat`, etc.) to gather information from the file system to formulate a context-aware answer.
- **Flags:**
  - `-n`: Starts a new, memory-free conversation, ignoring previous context.

**Permissions:** The AI's ability to execute commands is bound by the permissions of the current user. It cannot read a file or directory that you do not have permission to read.