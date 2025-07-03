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

# OopisOS v3.4: A Self-Reliant OS for a New Paradigm

Welcome to OopisOS, a simulated operating system that is more than a project—it's an exploration. It is a complete, persistent, and secure Unix-like environment that is **radically self-reliant**, running entirely within your web browser with zero server-side dependencies. This is a sandbox for learning, a studio for creation, and a laboratory for interacting with AI, all built on a foundation of privacy and control.

This project is a testament to what a focused, collaborative partnership between human architecture and AI-driven development can produce. We have built the engine, stocked the toolbox, and opened the gates. Now, it is your turn to build the world.

**[Explore the Live Demo on itch.io](https://aedmark.itch.io/oopisos)** | **[View the Source on GitHub](https://github.com/aedmark/oopis-os)**

-----

### For the CLI & Retro Computing Fans: A Return to the Command Line

If you believe the most powerful user interface is a blinking cursor, OopisOS was built for you. It embodies the core philosophy of the classic Unix shell: power, efficiency, and control.

* **An Uncompromising Command Set**: This is a true shell environment with piping (`|`), I/O redirection (`>` and `>>`), background jobs (`&`), and command sequencing (`;`). It features a powerful suite of Unix-like commands, including `find`, `grep`, `ls`, `diff`, `awk`, and the new `zip` and `unzip` for file archival.
* **The Joy of a Text-Based World**: The `paint` command launches a full-screen character-based art studio, while the `adventure` command starts a classic text-based game engine. Use `edit` and `paint` to create and run your own interactive fiction.
* **Total Control and Customization**: Define your workflow with persistent command shortcuts using `alias` and `unalias`, manage environment variables with `set` and `unset`, and exert granular control over the security model with `chmod`, `chown`, and `chgrp`.

-----

### For the AI & Machine Learning Community: An OS as an Agentic Sandbox

OopisOS v3.3 fully embraces the modern AI landscape by integrating a large language model not as a gimmick, but as a core system component.

* **The `gemini` Command**: A practical implementation of a "tool-using" AI agent. It can use OopisOS commands like `ls`, `cat`, and `find` to explore the file system and gather information before answering your questions, all while inheriting the permissions of the current user.
* **The `chidi` Application**: Our flagship "AI Librarian" for deep analysis of your documents. `chidi` implements a Retrieval-Augmented Generation (RAG) strategy; when you ask a question, it first performs a local keyword analysis to find the most relevant files, then constructs a highly focused prompt for the AI, resulting in faster, more accurate answers.

-----

### For Educators, Students & Hobbyists: The Ultimate Sandbox

OopisOS was architected to be a safe, engaging, and powerful environment for exploration and creation.

* **Learn Without Fear**: The entire system is sandboxed. You can experiment with a multi-user environment, master file permissions with `chmod`, learn administrative tasks with `sudo`, and even simulate `rm -rf /` without any risk to your actual computer. The `reset` command is your safety net.
* **A Tangible Scripting Engine**: The `run` command transforms the OS into a simple but effective game engine. Write shell scripts to learn automation, or use `echo`, `mkdir`, and argument-passing (`$1`, `$@`) to create simple narrative games and puzzles.
* **Instant Onboarding with the World-Builder**: We believe in learning by doing. Just type `run /extras/inflate.sh`, and the system will terraform your empty home directory into a bustling showcase environment, giving you a rich world to explore from your very first session.

-----

### For JavaScript & Web Developers: An Architectural Deep Dive

OopisOS is a case study in the power of the modern web platform, built with a deliberate decision to forgo frameworks in a commitment to **Radical Self-Reliance**.

* **The Command Contract**: Instead of writing boilerplate validation, developers *declare* a command's requirements (arguments, flags, path validation, permissions) to the `CommandExecutor`. The executor enforces these rules *before* the command's core logic is ever run, ensuring security and stability.
* **Architected Persistence**: The system’s state is managed by a dual-pronged strategy. The entire Virtual File System resides in **IndexedDB** for its transactional, asynchronous power, while session-critical data like credentials and aliases leverage the rapid, synchronous access of **LocalStorage**.
* **Security by Design**: Security is foundational. The `UserManager` uses the browser’s native **Web Crypto API (SHA-256)** to securely hash passwords. All file access is gated through the `FileSystemManager.hasPermission()` function. `sudo` and `visudo` provide a controlled workflow for privilege escalation.

-----

## Your Turn at the Console

### Getting Started

1.  **Open:** Launch `index.html` in any modern web browser.
2.  **Inflate Your World:** You start as the `Guest` user. To populate your file system with a rich set of example files, directories, and scripts, run the `inflate.sh` world-builder script.
    ```bash
    run /extras/inflate.sh
    ```
3.  **Explore:** See your new world with `tree` and `ls -R`, read the `README.md` file with `cat`, and begin your journey.

### The Challenge

* **For the Tinkerers:** We challenge you to create. Build a text adventure with the `adventure` engine, design a title screen with the `paint` studio, and write a script with `run` to tie it all together.
* **For the Developers:** We challenge you to extend. The modular command architecture was designed for you. Add a new command, integrate an external API, or use the codebase as a case study for building complex, framework-free web applications. The schematics are in `/docs/developer.md`.
* **For the AI Enthusiasts:** We challenge you to explore. Push the limits of the `gemini` agent. Teach the `chidi` librarian about a new subject by feeding it your own documents.

### Further Documentation

To keep this document focused, more detailed information has been moved to separate files within the `/docs` directory:

* **`guide.html`:** The full, styled User Guide.
* **`command_reference.md`:** An exhaustive reference for every command.
* **`developer.md`:** In-depth architectural documentation for contributors.
* **`security.md`:** A detailed overview of the OopisOS security model.
* **`tutorial.md`:** Guided tutorials for more complex tasks.
* **`adventure.md`:** A comprehensive guide to creating custom adventures with the text adventure engine.