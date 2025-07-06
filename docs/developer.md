# OopisOS Architectural Documentation

### _A Developer's Guide to El Código del Taco_

## 1. Design Philosophy: The Tao of Code

This document provides a comprehensive architectural overview of the OopisOS project, intended for developers who will build upon, extend, or maintain the system. To contribute effectively, one must first understand the philosophy that underpins its construction.

OopisOS is an exploration of a fully **self-reliant**, **secure**, and **persistent** client-side application paradigm. Its design is governed by five foundational pillars:

1. **Radical Self-Reliance**: The system is 100% client-side, with no backend dependency for its core logic.

2. **Architected Persistence**: The system state is not ephemeral; the user is the sole custodian of their locally persisted data.

3. **Enforced Modularity**: The system is composed of discrete, specialized components that are orchestrated, never intermingled.

4. **Security by Design**: A strict permission model, sandboxed execution, and secure credential handling are foundational, not features.

5. **Contained & Orchestrated Execution**: All operations flow through controlled channels, ensuring predictability and preventing side effects.


## 2. The "El Código del Taco" Architectural Model

The most effective way to understand the system is through the "El Código del Taco" model, which deconstructs the application into seven distinct, concentric layers.

|Layer|Ingredient|Responsibility|OopisOS Implementation|
|---|---|---|---|
|**1**|**The Protein**|**Core Business Logic:** The reason the app exists.|`commexec.js`, `lexpar.js`, `fs_manager.js`|
|**2**|**The Lettuce**|**Presentation Layer:** The UI/UX.|`terminal_ui.js`, `output_manager.js`, `basic_app.js`, ...|
|**3**|**The Cheese**|**Feature & Enhancement Layer:** Valuable but non-essential features.|`BasicInterpreter.js`, `gemini.js`, `chidi.js`, `alias.js`|
|**4**|**The Salsa**|**API & Data Layer:** The unifying agent for data access.|`storage.js` (`StorageManager`, `IndexedDBManager`)|
|**5**|**The Onions**|**Utility & Environment Layer:** Potent, non-negotiable helpers.|`utils.js`, `config.js`|
|**6**|**The Jalapeño**|**Security & Validation Layer:** Controlled heat and protection.|`sudo_manager.js`, `fs_manager.js`'s `hasPermission`|
|**7**|**The Fold**|**Build & Deployment:** The final, critical assembly.|`index.html`, `sw.js`|

---

## 3. Core Component Deep Dive

### The Command System: Secure by Process

The `CommandExecutor` is the heart of the system, orchestrating a secure command lifecycle.

1. **Input & Expansion**: User input is received. The `CommandExecutor` expands environment variables (`$VAR`) and aliases.

2. **Tokenization & Parsing**: The `Lexer` and `Parser` in `lexpar.js` convert the command string into a structured, executable representation.

3. **Validation (The Command Contract)**: The `CommandExecutor` validates the parsed command against its registered definition, checking argument counts, path validity, and permissions **before** any logic is run.

4. **Execution**: The command's `coreLogic` is invoked with a secure, validated context object.


### The File System: A Bastion of State

- **Structure & Persistence**: The file system exists as a single JavaScript object (`fsData`) that is serialized and stored in IndexedDB via the `FileSystemManager`.

- **Security Gateway**: All file system operations, without exception, must pass through the `hasPermission()` gatekeeper within the `FileSystemManager`, which is the final authority on access control.


### User & Credential Management

- **Secure Storage**: Passwords are never stored in plaintext. `UserManager` uses the browser's native **Web Crypto API (SHA-256)** to securely hash all passwords.

- **Centralized Authentication**: All login logic resides in `UserManager`. Secure password input is handled by the `ModalInputManager` to prevent leakage into command history or the screen.

### The BASIC Subsystem: A Sandboxed Environment

The Oopis BASIC feature is a two-part system designed for safe, sandboxed code execution:

-   **`basic_app.js` (The IDE):** This is a presentation-layer component that provides the full-screen Integrated Development Environment. It manages the UI, program buffer (`LIST`, `SAVE`, `LOAD`), and user commands (`RUN`, `NEW`).

-   **`BasicInterpreter.js` (The Engine):** This is a self-contained language parser and executor. Crucially, it has **no direct access** to the file system or command executor.

To interact with the host OS, the interpreter uses a specific set of `SYS_` functions (`SYS_CMD`, `SYS_READ`, `SYS_WRITE`). These functions act as a secure bridge, routing their requests through the main `CommandExecutor` and `FileSystemManager`. This design ensures that any program run via the BASIC interpreter is still subject to the OS's fundamental permission model, maintaining system integrity.

---

## 4. Extending the System: The Command Contract

Adding a new command to OopisOS is a simple and secure process that follows a clear, declarative pattern. As of v3.3, you **do not** need to add a `<script>` tag to `index.html`. The `CommandExecutor` will dynamically load your command script on first use.

### Step 1: Create the Command File

Create a new file in `/scripts/commands/`. The filename must exactly match the command name (e.g., `mycommand.js`).

### Step 2: Define the Command Contract

At the top of your file, create a `const` object for your command's definition. This object declares your command's requirements to the `CommandExecutor`.

JavaScript

```
// scripts/commands/mycommand.js
const myCommandDefinition = {
  commandName: "mycommand",

  // Define accepted flags
  flagDefinitions: [
    { name: "force", short: "-f", long: "--force" },
    { name: "outputFile", short: "-o", takesValue: true }
  ],

  // Define argument count rules
  argValidation: {
    min: 1,
    max: 2,
    error: "Usage: mycommand [-f] [-o file] <source> [destination]"
  },

  // Define which arguments are paths and their validation rules
  pathValidation: [
    { argIndex: 0, options: { expectedType: 'file' } },
    { argIndex: 1, options: { allowMissing: true } }
  ],

  // Define required permissions on those paths
  permissionChecks: [
    { pathArgIndex: 0, permissions: ["read"] }
  ],

  // The core logic function comes next...
  coreLogic: async (context) => { /* ... */ }
};
```

### Step 3: Write the Core Logic

The `coreLogic` function is an `async` function that receives a single `context` object. This object contains everything your command needs, already parsed and validated by the `CommandExecutor`.

JavaScript

```
coreLogic: async (context) => {
  const { args, flags, currentUser, validatedPaths, options } = context;

  // Your logic here. You can trust that:
  // - `args` contains the correct number of non-flag arguments.
  // - `flags.force` is a boolean, `flags.outputFile` is a string or null.
  // - `validatedPaths[0].node` is a valid file node.
  // - The user has 'read' permission on validatedPaths[0].

  return { success: true, output: "Execution complete." };
}
```

### Step 4: Register the Command

Finally, register your command, its one-line description, and its detailed help text with the `CommandRegistry`.

JavaScript

```
// At the end of your file
const myCommandDescription = "A brief, one-line description of the command.";
const myCommandHelpText = `Usage: mycommand [options]...

The detailed help text for the 'man' command.`;

CommandRegistry.register(
    myCommandDefinition.commandName,
    myCommandDefinition,
    myCommandDescription,
    myCommandHelpText
);
```