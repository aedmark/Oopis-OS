# OopisOS v3.1 Security Policy

## I. Philosophy

OopisOS treats security as a foundational principle, not an afterthought. Our model is built on three pillars: client-side sandboxing, explicit user permissions, and architected containment.

Most importantly, we believe that **your data is none of our business.** OopisOS is designed to be a private, self-contained world that runs entirely in your browser. We have no servers, we collect no telemetry, and we have no access to your files or credentials.

## II. Core Security Components

### Authentication (`UserManager`)

* **Secure Hashing:** Passwords are never stored in plaintext. They are securely hashed using the browser's native Web Crypto API with the SHA-256 algorithm before being stored locally.
* **Audited Flows:** Login and user-switching (`su`) flows are handled through a single, audited authentication manager to prevent timing attacks, bypasses, or credential leakage.

### Authorization (`FileSystemManager`)

* **Centralized Gatekeeping:** All file system access is gated by the `FileSystemManager.hasPermission()` function. There are no back doors.
* **Granular Permissions:** This function rigorously checks file ownership (`owner`, `group`) against the file's octal mode (`rwx`) and the current user's identity for every operation.
* **Superuser Exception:** The `root` user is an explicit, carefully managed exception that bypasses standard permission checks, as is standard in Unix-like systems.

### Privilege Escalation (`SudoManager`)

* **Controlled Elevation:** The `sudo` command allows for temporary, controlled privilege escalation. Access is governed by the `/etc/sudoers` file, which is only editable by `root` via the `visudo` command.
* **Scoped Privileges:** Escalated privileges are granted for only a single command and are immediately revoked within a `try...finally` block to ensure they do not persist longer than necessary.

### Sandboxing & Containment

* **Script Governor:** The `run` command includes a governor that limits the maximum number of commands a single script can execute. This prevents denial-of-service from infinite loops.
* **AI Tool Sandboxing:** The `gemini` command is sandboxed. It can only execute a specific whitelist of safe, primarily read-only commands (`ls`, `cat`, `tree`, etc.) to perform its analysis. It cannot execute destructive commands or modify the file system on its own.

### AI & Data Privacy

* **Local API Key Storage:** The `gemini` and `chidi` tools require a Google Gemini API key. This key is stored exclusively in your browser's local storage and is never transmitted to us.
* **Third-Party Data Flow:** Be aware that using the AI tools involves sending data to Google's API. Specifically, `chidi` sends the content of the documents you are analyzing to provide its summaries and answers.

## III. Data Integrity & Persistence

OopisOS is designed to be completely private.

* **Local Storage:** All your data—the file system, user accounts, and session information—is stored exclusively in your browser's `localStorage` and `IndexedDB`. It never leaves your computer.
* **Backup Integrity:** The `backup` command creates a downloadable JSON file of your entire system state. This file includes a SHA-256 checksum of its contents. When you use the `restore` command, this checksum is verified to ensure the backup file has not been corrupted or tampered with, guaranteeing a safe restoration.
* **User Control:** You have full control over your data. You can export it with the `backup` command or permanently erase it with the `reset` command.

## IV. Best Practices for Users

* **Guard the Root Password:** Do not share your `root` password. It provides unrestricted access to the entire virtual file system.
* **Principle of Least Privilege:** Operate as a standard user (`Guest`) for daily tasks. Only use `su` or `sudo` when administrative privileges are required.
* **Manage Your API Key:** Treat your Gemini API key like a password. It is stored locally, but you are responsible for its security.
* **Audit Permissions:** Regularly review file permissions using `ls -l` to ensure they are set as you expect.
* **Be Wary of Unknown Scripts:** Be cautious when running scripts (`run` command) or viewing files from untrusted sources, just as you would on any other OS.

## V. Reporting a Vulnerability

The security of OopisOS is our top priority. If you believe you have found a security vulnerability, we encourage you to report it to us responsibly.

Please email a detailed description of the issue to **oopismcgoopis@gmail.com**. We are committed to working with you to understand and resolve the issue promptly.