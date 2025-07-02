# OopisOS v3.3 Architectural Documentation

- [OopisOS v3.3 Architectural Documentation](#oopisos-v32-architectural-documentation)
  * [1\. Design Philosophy & Core Principles](#1-design-philosophy--core-principles)
  * [2\. System Architecture: A Layered Model](#2-system-architecture-a-layered-model)
    + [Layer 1: The System Bootstrap & Core Plane](#layer-1-the-system-bootstrap--core-plane)
    + [Layer 2: The Command Lifecycle & Execution Engine](#layer-2-the-command-lifecycle--execution-engine)
    + [Layer 3: The State & Persistence Core](#layer-3-the-state--persistence-core)
    + [Layer 4: The Human-Interface Bridge](#layer-4-the-human-interface-bridge)
  * [3\. Core Component Deep Dive](#3-core-component-deep-dive)
    + [The Command System: Secure by Process](#the-command-system-secure-by-process)
    + [The File System: A Bastion of State](#the-file-system-a-bastion-of-state)
    + [User & Credential Management](#user--credential-management)
    + [Full-Screen Applications: Contained Ecosystems](#full-screen-applications-contained-ecosystems)
  * [4\. Extending the System: The Command Contract](#4-extending-the-system-the-command-contract)
    + [Step 1: Create the Command File](#step-1-create-the-command-file)
    + [Step 2: Define the Command Contract](#step-2-define-the-command-contract)
    + [Step 3: Write the Core Logic](#step-3-write-the-core-logic)
    + [Step 4: Register the Command](#step-4-register-the-command)

## 1\. Design Philosophy & Core Principles

This document provides a comprehensive architectural overview of the OopisOS project. It is intended for developers who will build upon, extend, or maintain the system. To contribute effectively, it is essential to understand the philosophical underpinnings of the architecture.

OopisOS is more than a simulated operating system; it is an exploration of a fully self-contained, secure, and persistent client-side application paradigm. Its design is governed by five foundational pillars. Every component and decision must be weighed against these principles:

1.  **Radical Self-Reliance:** The system is 100% client-side. It has no dependency on a backend server for its core logic, state, or execution. All functionality—command execution, data storage, etc.—must be achievable within a modern web browser.
2.  **Architected Persistence:** The system state is not ephemeral. The virtual file system, user credentials, session data, and command history are all persisted locally using the browser's storage APIs. The user is the sole custodian of their data.
3.  **Enforced Modularity:** The system is composed of discrete, specialized components with clear responsibilities. Logic is never intermingled; it is orchestrated.
4.  **Security by Design:** Security is foundational, not a feature. A strict permission model, sandboxed execution for untrusted content, input validation, and secure credential handling enforce the principle of least privilege at every layer.
5.  **Contained & Orchestrated Execution:** All operations flow through controlled channels. The `CommandExecutor` handles processing, while the `OutputManager` controls display. This ensures predictability and prevents unintended side effects.

-----

## 2\. System Architecture: A Layered Model

The architecture is layered, ensuring a clear separation of concerns. Each layer communicates through well-defined APIs, creating a stable and predictable system.

### Layer 1: The System Bootstrap & Core Plane

- **`index.html`:** The vessel. Defines the minimal DOM structure and loads all JavaScript modules in the correct, deterministic order.
- **`main.js`:** The ignition sequence. On `window.onload`, it initiates the boot process, caches essential DOM elements, initializes all manager modules, and connects the user to the terminal.
- **`config.js`:** The system's constitution. A centralized source of constants—permission modes, UI strings, default paths, etc.
- **`utils.js`:** A library of pure, stateless utility functions for common tasks like DOM creation, string manipulation, and data validation.

### Layer 2: The Command Lifecycle & Execution Engine

- **`lexpar.js`:** Contains the **Lexer** and **Parser**. This is the first stage of the command lifecycle, responsible for converting raw input strings into a structured, executable representation (an abstract syntax tree).
- **`commexec.js`:** The **CommandExecutor** is the heart of the OS. It orchestrates the entire command lifecycle: it receives the parsed command, validates it against the "Command Contract," manages I/O redirection, handles background jobs, and isolates command logic.
- **`scripts/commands/registry.js`:** The **CommandRegistry** is the central manifest where all command modules register their definitions, descriptions, and help texts.
- **`scripts/commands/*.js`:** Each file in this directory represents a self-contained, modular command that adheres to the Command Contract.

### Layer 3: The State & Persistence Core

- **`storage.js`:** The `StorageManager` and `IndexedDBManager` provide a clean, abstracted API for all data persistence, separating the rest of the system from the implementation details of `localStorage` and `IndexedDB`.
- **`fs_manager.js`:** The **FileSystemManager** is the sole authority for the virtual file system. It maintains the in-memory `fsData` object, enforces all permission checks via `hasPermission()`, and handles the serialization of the file system to IndexedDB.
- **`user_manager.js` & `group_manager.js`:** These modules manage the system's social fabric. They handle authentication, user/group creation, and secure credential storage using the Web Crypto API.
- **`session_manager.js`:** Tracks all ephemeral session state: the current user stack (`su`/`logout`), environment variables, and manual session snapshots (`savestate`/`loadstate`).

### Layer 4: The Human-Interface Bridge

- **`terminal_ui.js`:** Manages all direct interaction with the terminal interface, including prompt behavior, tab completion, history navigation, and modal dialogs.
- **`output_manager.js`:** The sole, disciplined channel for all output to the terminal screen. It ensures consistent formatting and handles output suppression for background jobs or redirected streams.

-----

## 3\. Core Component Deep Dive

### The Command System: Secure by Process

1.  **Input & Expansion**: User input is received. The `CommandExecutor` expands environment variables (`$VAR`) and aliases.
2.  **Tokenization & Parsing**: The `Lexer` breaks the command string into tokens (words, operators), and the `Parser` assembles these into a structured command pipeline.
3.  **Validation (The Command Contract)**: The `CommandExecutor` validates the parsed command against its registered definition, checking argument counts, path validity, and permissions **before** any logic is run.
4.  **Execution**: The command's `coreLogic` is invoked with a secure, validated context object containing all necessary arguments, flags, and options.

### The File System: A Bastion of State

- **Structure & Persistence**: The file system exists as a single, large JavaScript object (`fsData`). This object is a direct, in-memory representation of the entire directory tree. Upon modification, the `FileSystemManager` serializes this object and persists it to IndexedDB.
- **Security Gateway**: All file system operations, without exception, must pass through the `hasPermission()` gatekeeper within the `FileSystemManager`. This function is the final authority on access control.

### User & Credential Management

- **Secure by Default**: Passwords are never stored in plaintext. The `UserManager` uses the browser's native **Web Crypto API (SHA-256)** to securely hash passwords before they are persisted to `localStorage`.
- **Centralized Authentication**: All login logic resides in the `UserManager`. Secure password input is handled by the `ModalInputManager` to prevent leakage into command history or the screen.

### Full-Screen Applications: Contained Ecosystems

- **`edit` (Editor)**: Demonstrates the separation of state and UI. The `EditorManager` tracks the file content and dirty state, while the `EditorUI` simply renders it. Untrusted user-generated content (e.g., HTML) is rendered in a sandboxed `<iframe>` to prevent XSS attacks.
- **`paint` (Art Studio)**: The `PaintManager` maintains the canvas as an abstract data model, completely decoupled from the `PaintUI` that renders it. Artwork is serialized to a custom JSON format (`.oopic`).
- **`chidi` (Analyzer)**: Implements a Retrieval-Augmented Generation (RAG) strategy. It performs a local keyword search on the document corpus to create a focused context before calling the external AI API, optimizing for relevance and efficiency.

-----

## 4\. Extending the System: The Command Contract

Adding a new command to OopisOS is a simple and secure process that follows a clear, declarative pattern. As of v3.3, you **do not** need to add a `<script>` tag to `index.html`. The `CommandExecutor` will dynamically load your command script on first use.

### Step 1: Create the Command File

Create a new file in `/scripts/commands/`. The filename must exactly match the command name you wish to use (e.g., `mycommand.js`).

### Step 2: Define the Command Contract

At the top of your file, create a `const` object for your command's definition. This object declares your command's requirements to the `CommandExecutor`.

```javascript
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
    { pathArgIndex: 0, permissions: ["read"] },
    { pathArgIndex: 1, permissions: ["write"] } // Example check
  ],

  // The core logic function comes next...
  coreLogic: async (context) => { /* ... */ }
};
```

### Step 3: Write the Core Logic

The `coreLogic` function is an `async` function that receives a single `context` object. This object contains everything your command needs, already parsed and validated.

```javascript
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

```javascript
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