# OopisOS Security Policy v4.0

## I. Philosophy

OopisOS treats security as a foundational principle, not an afterthought. Our model is built on three pillars: **client-side sandboxing**, **explicit user permissions**, and **architected containment**.

Most importantly, we believe that **your data is none of our business.** OopisOS is designed to be a private, self-contained world that runs entirely in your browser. We have no servers, we collect no telemetry, and we have no access to your files or credentials.

## II. The Core Security Model

Our security is not a single feature, but a series of interlocking components that govern every action within the OS.

### Authentication (`UserManager`)

- **Secure Hashing:** Passwords are never stored in plaintext. They are securely hashed using the browser's native **Web Crypto API with the SHA-256 algorithm** before being stored locally.

- **Audited Flows:** Login (`login`) and user-switching (`su`) flows are handled through a single, audited authentication manager to prevent timing attacks, bypasses, or credential leakage.


### Authorization (`FileSystemManager`)

- **Centralized Gatekeeping:** All file system access is gated by the `FileSystemManager.hasPermission()` function. There are no back doors.

- **Granular Permissions:** This function rigorously checks file ownership (`owner`, `group`) against the file's octal mode (`rwx`) and the current user's identity for every operation.

- **Superuser Exception:** The `root` user is an explicit, carefully managed exception that bypasses standard permission checks, as is standard in Unix-like systems.


### Privilege Escalation (`SudoManager`)

- **Controlled Elevation:** The `sudo` command allows for temporary, controlled privilege escalation. Access is governed by the `/etc/sudoers` file, which is only editable by `root` via the `visudo` command.

- **Scoped Privileges:** Escalated privileges are granted for only a single command and are immediately revoked within a `try...finally` block to ensure they do not persist longer than necessary.


## III. The User's Security Toolkit: Data Integrity and Transformation

Beyond the system's built-in protections, OopisOS provides you with the tools to create your own "chain of custody" for your data. These utilities allow you to verify, secure, and transport your information with confidence.

|Command|Role in Security|Use Case Example|
|---|---|---|
|`cksum`|**Verification:** Calculates a checksum (a unique digital fingerprint) for a file. This allows you to verify that a file has not been altered or corrupted.|`cksum my_script.sh`|
|`base64`|**Transformation:** Encodes binary data into plain text. This is essential for safely sending or storing complex files in text-based systems without data loss.|`cat photo.oopic \| base64 > photo.txt`|
|`ocrypt`|**Obscurity (Educational):** A simple password-based cipher for obscuring data. **This is not secure encryption**, but serves to demonstrate the principles of data transformation.|`ocrypt mypass secret.txt > hidden.dat`|
|`sync`|**Persistence:** Manually forces all pending filesystem changes to be written to the database, ensuring data integrity before a critical operation.|`sync`|

This suite of tools embodies the OopisOS philosophy: security is not just something the system _has_, it is something the user _does_. By combining these commands, you can create a verifiable workflow to ensure your data remains exactly as you intended.

## IV. Data Privacy & Persistence

OopisOS is designed to be completely private.

- **Local Storage:** All your data—the file system, user accounts, and session information—is stored exclusively in your browser's `localStorage` and `IndexedDB`. It never leaves your computer.

- **User Control:** You have full control over your data. You can export it with the `backup` command or permanently erase it with the `reset` command.


## V. Best Practices for Users

- **Guard the Root Password:** Do not share your `root` password. It provides unrestricted access to the entire virtual file system.

- **Principle of Least Privilege:** Operate as a standard user (`Guest`) for daily tasks. Only use `su` or `sudo` when administrative privileges are required.

- **Audit Permissions:** Regularly review file permissions using `ls -l` to ensure they are set as you expect.

- **Be Wary of Unknown Scripts:** Be cautious when running scripts (`run` command) or viewing files from untrusted sources, just as you would on any other OS.


## VI. Reporting a Vulnerability

The security of OopisOS is our top priority. If you believe you have found a security vulnerability, we encourage you to report it to us responsibly.

Please email a detailed description of the issue to **oopismcgoopis@gmail.com**. We are committed to working with you to understand and resolve the issue promptly.