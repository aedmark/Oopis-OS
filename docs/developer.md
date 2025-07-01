# OopisOS v3.2 Architectural Documentation

- [1. Design Philosophy & Core Principles](#1-design-philosophy--core-principles)
- [2. System Architecture](#2-system-architecture)
  - [Layer 1: The System Bootstrap & Core Plane](#2-system-architecture-layer-1-the-system-bootstrap--core-plane)
  - [Layer 2: The Command Lifecycle & Execution Engine](#2-system-architecture-layer-2-the-command-lifecycle--execution-engine)
  - [Layer 3: The State & Persistence Core](#2-system-architecture-layer-3-the-state--persistence-core)
  - [Layer 4: The Human-Interface Bridge](#2-system-architecture-layer-4-the-human-interface-bridge)
- [3. Core Component Deep Dive](#3-core-component-deep-dive)
  - [The Command System: Secure by Process](#3-core-component-deep-dive-the-command-system-secure-by-process)
  - [The File System: A Bastion of State](#3-core-component-deep-dive-the-file-system-a-bastion-of-state)
  - [User & Credential Management](#3-core-component-deep-dive-user--credential-management)
  - [Full-Screen Applications: Contained Ecosystems](#3-core-component-deep-dive-full-screen-applications-contained-ecosystems)
- [4. Extending the System: Adding New Commands](#4-extending-the-system-adding-new-commands)

## 1. Design Philosophy & Core Principles

This document provides a comprehensive architectural overview of the OopisOS project. It is intended for developers who will build upon, extend, or maintain the system. To contribute effectively, it is essential to understand the philosophical underpinnings of the architecture.

OopisOS is more than a simulated operating system; it is an exploration of a fully self-contained, secure, and persistent client-side application paradigm. Its design is governed by five foundational pillars. Every component and decision must be weighed against these principles:

1. **Radical Self-Reliance** The system is 100% client-side. It has no dependency on a backend server for its core logic, state, or execution. All functionality—command execution, data storage, etc.—must be achievable within a modern web browser.

2. **Architected Persistence** The system state is not ephemeral. The virtual file system, user credentials, session data, and command history are all persisted locally. The user is the sole custodian of their data.

3. **Enforced Modularity** The system is composed of discrete, specialized components with clear responsibilities. Logic is never intermingled; it is orchestrated.

4. **Security by Design** Security is foundational. A strict permission model, sandboxed execution for untrusted content, input validation, and secure credential handling enforce the principle of least privilege.

5. **Contained & Orchestrated Execution** All operations flow through controlled channels. The Command Executor handles processing, while the Output Manager controls display. This ensures predictability and prevents unintended side effects.

---
## 2. System Architecture

The architecture is layered, ensuring a clear separation of concerns. Each layer communicates through well-defined APIs.

### Layer 1: The System Bootstrap & Core Plane

- `index.html`  
  The vessel. Defines the minimal DOM structure and loads all JavaScript modules in order.

- `main.js`  
  The ignition sequence. On `window.onload`, it initiates boot, caches DOM elements, initializes manager modules, and connects the user to the terminal.

- `config.js`  
  The system's constitution. A centralized source of constants—permission modes, UI strings, etc.

- `utils.js`  
  Stateless utility functions for DOM creation, string manipulation, etc.

---
### Layer 2: The Command Lifecycle & Execution Engine

- `lexpar.js`  
  Contains the **Lexer** and **Parser**. Converts raw command strings into tokens, then into an abstract syntax tree (AST).

- `commexec.js`  
  The **CommandExecutor** orchestrates execution. It manages I/O, redirection, background jobs, and isolates command logic.

- `scripts/commands/registry.js`  
  The **CommandRegistry** stores all command definitions, descriptions, and help texts.

- `scripts/commands/*.js`  
  Each file defines a modular command.

---
### Layer 3: The State & Persistence Core

- `storage.js`  
  The `StorageManager` handles `localStorage`, while `IndexedDBManager` manages database storage.

- `fs_manager.js`  
  The **FileSystemManager** maintains the virtual file system (`fsData`) and persists it using `IndexedDB`.

- `user_manager.js`  
  Manages authentication and user/group data. Uses Web Crypto API for secure password hashing.

- `session_manager.js`  
  Tracks session state: user stack, environment variables, and session snapshots.


---

### Layer 4: The Human-Interface Bridge

- `terminal_ui.js`  
  Controls the terminal interface, including prompt behavior, tab completion, and modals.

- `output_manager.js`  
  The sole channel for output. Ensures formatting and handles redirection/suppression of output.

---
## 3. Core Component Deep Dive

### The Command System: Secure by Process

1. **Input & Expansion**: Variable and alias expansion occurs before tokenization.

2. **Tokenization**: The Lexer generates structured tokens.

3. **Parsing**: Tokens are compiled into an AST.

4. **Execution**: The CommandExecutor uses the AST to invoke registered commands in a safe, validated context.

---
### The File System: A Bastion of State

- **Structure & Persistence**: The file system is a JavaScript object (`fsData`) serialized and stored with `IndexedDB`.

- **Security Gateway**: All file operations pass through `hasPermission` in `FileSystemManager`.

---
### User & Credential Management

- **Secure Storage**: Passwords are hashed using SHA-256 via Web Crypto API. No plaintext storage.

- **Centralized Authentication**: All login logic resides in `UserManager`. Secure input uses `ModalInputManager`.

---
### Full-Screen Applications: Contained Ecosystems

- **`edit` (Editor)**: UI and logic are separated. Live preview uses a sandboxed `<iframe>`.

- **`paint` (Art Studio)**: The canvas is an abstract data model decoupled from the DOM. Files are saved as JSON.

- **`chidi` (Analyzer)**: Implements Retrieval-Augmented Generation (RAG) with local file filtering.

---
## 4. Extending the System: Adding New Commands

**Step 1: Create the Command File** Create `/scripts/commands/mycommand.js`. The filename must match the command name.

**Step 2: Define the Command Contract**

```javascript
// scripts/commands/mycommand.js
(() => {
  "use strict";

  const myCommandDefinition = {
    commandName: "mycommand",
    // flagDefinitions, argValidation, etc.
    coreLogic: async (context) => {
      // Secure, validated execution context
      return { success: true, output: "Execution complete." };
    }
  };

  const myCommandDescription = "A brief, one-line description of the command.";
  const myCommandHelpText = "The detailed help text for the 'man' command.";

  CommandRegistry.register(
    "mycommand",
    myCommandDefinition,
    myCommandDescription,
    myCommandHelpText
  );
})();