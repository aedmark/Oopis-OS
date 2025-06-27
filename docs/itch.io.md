## OopisOS v3.0: The OS is the Game

A persistent, in-browser, retro-futuristic Operating System. Hack the system, build your own tools, or create entire narrative games from the command line. This isn't just a simulation; it's a sandbox for digital creation.

### What is this place?

You've discovered OopisOS, a sophisticated operating system simulation that is radically self-reliant, running entirely within your web browser. It's a persistent, self-contained world built on the core principles of privacy, security, and exploration. Thanks to the magic of your browser's own storage, everything you do—every file you create, every user you add, every command you type—will be here waiting for you the next time you boot up.

It's a love letter to the command-line interfaces of yore, but with a modern, modular twist perfect for creating your own fun. Lovingly crafted by a human (Andrew Edmark) and his trusty AI sidekick (Gemini), OopisOS is an ode to the joy of computing.

### Key Features (The Gameplay)

In OopisOS, traditional system features are your gameplay mechanics. The world is your sandbox.

- **Explore a Persistent Digital World:** The core of the game is a hierarchical file system that remembers your every change. Create directories (`mkdir`), leave secret notes (`edit`), uncover the system's structure (`ls`, `tree`), and find what you're looking for with a powerful `find` command.
    
- **Administer the System with `sudo`:** Assume administrative powers safely. Instead of logging in as `root` for simple tasks, use the `sudo` command to execute commands with elevated privileges. This is the new, secure way to manage the system.
    
- **Master True Multi-User Security:** The permission system _is_ a gameplay mechanic. Create users (`useradd`) and groups (`groupadd`). Lock down files, create secret directories, and manage access for different users using `chmod`, `chown`, and `chgrp`. Edit the sudoers file with `visudo` to control who can use `sudo`.
    
- **Archive Your Work:** Bundle up entire projects or directories into a single file with `zip`, and extract them later with `unzip`.
    
- **Consult the AI Librarian (`chidi`):** Launch a dedicated application to analyze your Markdown files. It recursively finds all `.md` files in a path and lets you use AI to summarize, study, and ask questions about them.
    
- **Wield a Tool-Using AI (`gemini`):** The system has a resident AI. Use the `gemini` command to ask it questions. It can use system tools like `ls`, `cat`, and `tree` to understand the world state and give you better answers.
    
- **Connect to the Real Internet:** Use `wget` to download files from the web directly into your virtual file system. Use `curl` to fetch data from APIs.
    
- **Automate the World with `run`:** Write your own scripts to automate tasks or create narrative events. The scripting engine supports argument passing (`$1`, `$@`, `$#`), allowing you to create truly interactive programs.
    
- **Customize Your Shell:** Use `set` and `unset` to create session-specific environment variables. Use them in scripts (`echo "Welcome, $PLAYER_NAME"`) for dynamic workflows.
    
- **Play & Create Text Adventures:** Launch the built-in text adventure game with the `adventure` command, or use the engine to run your own JSON-based games.
    
- **Express Yourself with `paint`:** For when text isn't enough, launch a full-screen character-based art editor. Create ASCII and ANSI art masterpieces and save them.
    
- **Your In-Game IDE (`edit`):** The powerful `edit` command is your built-in development environment with live Markdown and HTML preview.
    
- **Master Asynchronous Chaos (`ps` & `kill`):** Run processes in the background with `&`. See what you've unleashed with `ps` and terminate runaway jobs with `kill`.
    
- **Save & Share Your Universe:** Use `backup` to export your entire OS state—users, files, and all—into a single JSON file. `restore` lets you (or a friend) load it back in.
    

### A Modder's Paradise: Your Engine for Text-Based Worlds

This is where OopisOS truly shines for creators. Its modularity makes it a powerful and accessible engine for building your own interactive experiences.

- **Built-in Adventure Game Engine:** The `adventure` command isn't just for playing; it's for creating. The engine can load custom games from any JSON file you create in the virtual file system.
    
- **Visual World-Building with `paint`:** Create in-game maps, item art, or stylized narrative screens using the character-based paint editor.
    
- **Powerful Scripting with `run`:** The `run` command is your key to creating interactive events. You can write scripts that display text, change the world state by creating or deleting files, and use environment variables to track player choices.
    
- **A Sandbox of Discovery:** What happens if you `rm -r -f /` as the `root` user? (Don't worry, the `reset` command is your safety net). Can you write a script that creates other scripts? The system is your playground for emergent storytelling.
    

You have a complete, self-contained universe for creating, playing, and sharing text-based and narrative-driven games.

### Your First Session

Ready to dive in? Here's how to get started:

1. **Boot Up:** Just launch the game in your browser. You'll start as the `Guest` user.
    
2. **Inflate the World:** The file system is a blank canvas. To populate it with a rich set of example files, directories, and scripts to play with, run the command: `run /extras/inflate.sh`
    
3. **Explore:** Once the script is finished, type `tree` to see your new world. Read the `README.md` file (`cat README.md`) for more hints!
    

What will you create?