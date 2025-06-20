# OopisOS Developer Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Project Overview](#project-overview)
3. [Architecture](#architecture)
4. [Setup and Installation](#setup-and-installation)
5. [Core Components](#core-components)
   - [Command System](#command-system)
   - [File System](#file-system)
   - [User Management](#user-management)
   - [Terminal UI](#terminal-ui)
   - [Output Management](#output-management)
6. [Adding New Commands](#adding-new-commands)
7. [APIs and Extension Points](#apis-and-extension-points)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Introduction

This documentation is intended for developers who want to understand, modify, or extend the OopisOS project. OopisOS is a web-based terminal/OS simulation that provides a Unix-like environment in the browser.

## Project Overview

OopisOS is a JavaScript-based terminal emulator that simulates a Unix-like operating system in the browser. It features:

- Command-line interface with tab completion
- Virtual file system with persistence
- User authentication and permissions
- Command pipelines and I/O redirection
- Background processes
- Full-screen applications (editor, paint, text adventures)

The project is designed to be modular, extensible, and educational, demonstrating concepts from operating systems and web development.

## Architecture

OopisOS follows a modular architecture with clear separation of concerns. The system is organized into several key modules:

1. **Core System**
   - `main.js`: Entry point and initialization
   - `config.js`: System-wide configuration
   - `utils.js`: Utility functions

2. **Command Processing**
   - `commexec.js`: Command execution and pipeline handling
   - `lexpar.js`: Command parsing and tokenization

3. **Storage and State**
   - `fs_manager.js`: Virtual file system
   - `user_manager.js`: User authentication and permissions
   - `storage.js`: Local storage management
   - `session_manager.js`: User session management

4. **User Interface**
   - `terminal_ui.js`: Terminal interface components
   - `output_manager.js`: Terminal output handling
   - `editor.js`: Text editor application

5. **Commands**
   - Individual command implementations in `scripts/commands/`

## Setup and Installation

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Basic understanding of JavaScript and web development

### Development Setup
1. Clone the repository
2. Open the project in your preferred code editor
3. Launch the application by opening `index.html` in a browser
4. For local development, you may need to use a local web server due to browser security restrictions

### Project Structure
```
oopisOS/
├── docs/                  # Documentation
├── extras/                # Helper scripts
├── fonts/                 # Custom fonts
├── scripts/               # Core JavaScript files
│   ├── commands/          # Individual command implementations
│   ├── commexec.js        # Command executor
│   ├── config.js          # System configuration
│   ├── ...                # Other core modules
├── index.html             # Main entry point
├── style.css              # Global styles
└── README.md              # Project overview
```

## Core Components

### Command System

The command system is responsible for parsing, validating, and executing user commands. It's primarily implemented in `commexec.js`.

#### Key Features
- Command parsing and tokenization
- Pipeline execution
- I/O redirection
- Background process management
- Command history

#### Command Execution Flow
1. User input is captured in the terminal
2. Input is processed by `CommandExecutor.processSingleCommand()`
3. Environment variables and aliases are expanded
4. The command string is tokenized and parsed into pipelines
5. Each pipeline is executed, with output from one command feeding into the next
6. Results are displayed in the terminal or redirected to files

### File System

The virtual file system provides a hierarchical structure of files and directories with Unix-like permissions. It's implemented in `fs_manager.js`.

#### Key Features
- In-memory file system structure
- Persistence to IndexedDB
- Path resolution (absolute/relative)
- Permission checking
- File and directory operations

#### File System Structure
Each node in the file system is an object with the following properties:
- `type`: Either "file" or "directory"
- `content`: For files, the text content
- `children`: For directories, an object mapping names to child nodes
- `owner`: Username of the owner
- `group`: Group name
- `mode`: Octal permission mode (e.g., 0o755)
- `mtime`: Modification timestamp

### User Management

User management handles authentication, user sessions, and group membership. It's implemented in `user_manager.js`.

#### Key Features
- User authentication with password hashing
- Session management (login, logout, su)
- Group membership
- Permission checking

#### User Authentication Flow
1. User provides username and password
2. Password is hashed using SHA-256
3. Hash is compared with stored credentials
4. On success, user session is established
5. Home directory is set as current working directory

### Terminal UI

The terminal UI manages the command prompt, user input, and various UI components. It's implemented in `terminal_ui.js`.

#### Key Features
- Command prompt customization
- Input handling
- Tab completion
- Modal dialogs
- Password input

#### UI Components
- `TerminalUI`: Core terminal interface
- `ModalManager`: Confirmation dialogs
- `ModalInputManager`: Single-line input requests
- `TabCompletionManager`: Command and path completion

### Output Management

Output management handles displaying text in the terminal. It's implemented in `output_manager.js`.

#### Key Features
- Styled output (errors, warnings, etc.)
- Console method overrides
- Background process output handling
- Full-screen application support

## Adding New Commands

Adding a new command to OopisOS involves creating a new JavaScript file in the `scripts/commands/` directory and registering it with the command system.

### Command File Structure

Each command file should follow this structure:

```javascript
// scripts/commands/mycommand.js

/**
 * @file Implements the 'mycommand' command.
 */
CommandRegistry.register({
    name: "mycommand",
    description: "Brief description of what the command does",
    helpText: `
Usage: mycommand [OPTIONS] ARGUMENTS
Detailed explanation of the command and its options.

Options:
  -f, --flag    Description of this flag
  -o, --option  Description of this option

Examples:
  mycommand file.txt       Example usage
  mycommand -f directory   Another example
`,
    definition: {
        commandName: "mycommand",
        flagDefinitions: [
            { name: "f", alias: "flag", description: "Description of flag" },
            { name: "o", alias: "option", description: "Description of option", expectsValue: true }
        ],
        argValidation: {
            minArgs: 1,
            maxArgs: 2,
            errorMessage: "Usage: mycommand [OPTIONS] ARG1 [ARG2]"
        },
        pathValidation: [
            {
                argIndex: 0,
                options: {
                    allowMissing: false,
                    expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE
                }
            }
        ],
        permissionChecks: [
            {
                pathArgIndex: 0,
                permissions: ["read"]
            }
        ],
        completionType: "files", // or "users", "commands", etc.
        coreLogic: async (context) => {
            const { args, flags, validatedPaths } = context;
            
            // Command implementation goes here
            
            return {
                success: true,
                output: "Command executed successfully"
            };
        }
    }
});
```

### Command Registration Process

1. Create a new file in `scripts/commands/` named after your command
2. Implement the command using the structure above
3. The command will be automatically loaded and registered when the system initializes

### Command Handler Context

The `coreLogic` function receives a context object with the following properties:

- `args`: Array of command arguments
- `flags`: Object containing parsed flags
- `validatedPaths`: Object containing validated file system paths
- `currentUser`: Username of the current user
- `options`: Additional options, including `stdinContent` for pipeline input
- `signal`: AbortSignal for cancellation (used in background processes)

### Command Result Object

The `coreLogic` function should return an object with the following properties:

- `success`: Boolean indicating if the command succeeded
- `output`: String output of the command (displayed in terminal or piped to next command)
- `error`: Error message if `success` is false
- `messageType`: Optional CSS class for styling the output

## APIs and Extension Points

OopisOS provides several APIs and extension points for developers:

### Command Registry

The `CommandRegistry` allows registering new commands:

```javascript
CommandRegistry.register({
    name: "commandname",
    description: "Command description",
    helpText: "Detailed help text",
    definition: { /* Command definition */ }
});
```

### File System API

The `FileSystemManager` provides methods for file system operations:

```javascript
// Get a file or directory
const node = FileSystemManager.getNodeByPath("/path/to/file");

// Create or update a file
await FileSystemManager.createOrUpdateFile("/path/to/file", "content", {
    currentUser: "username",
    primaryGroup: "groupname"
});

// Check permissions
const hasPermission = FileSystemManager.hasPermission(node, "username", "read");
```

### User Management API

The `UserManager` and `GroupManager` provide methods for user operations:

```javascript
// Register a new user
await UserManager.register("username", "password");

// Create a group
GroupManager.createGroup("groupname");

// Add user to group
GroupManager.addUserToGroup("username", "groupname");
```

### Terminal UI API

The `TerminalUI` and `OutputManager` provide methods for UI operations:

```javascript
// Append output to terminal
await OutputManager.appendToOutput("Text to display", {
    typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG
});

// Update the command prompt
TerminalUI.updatePrompt();

// Set input state
TerminalUI.setInputState(true);
```

## Best Practices

### Command Implementation

1. **Validate inputs thoroughly**: Use the built-in validation mechanisms
2. **Check permissions**: Always verify the user has appropriate permissions
3. **Handle errors gracefully**: Return clear error messages
4. **Support pipelines**: Process stdin when appropriate
5. **Document your command**: Provide clear help text and examples

### File System Operations

1. **Always validate paths**: Use `FileSystemManager.validatePath()`
2. **Check permissions**: Use `FileSystemManager.hasPermission()`
3. **Update modification times**: Call `_updateNodeAndParentMtime()`
4. **Save changes**: Call `FileSystemManager.save()` after modifications

### User Interface

1. **Use appropriate CSS classes**: Use the predefined classes in `Config.CSS_CLASSES`
2. **Handle background processes**: Consider the user experience when processes run in background
3. **Support tab completion**: Implement the `completionType` property in your command definition

## Troubleshooting

### Common Issues

1. **Command not found**: Ensure the command file is in the correct location and properly registered
2. **Permission denied**: Check file permissions and current user
3. **File system errors**: Check path validation and ensure the file system is properly initialized
4. **UI not updating**: Ensure DOM elements are properly referenced and updated

### Debugging Tips

1. **Use console.log**: The browser console shows all logs, including those displayed in the terminal
2. **Inspect the file system**: Use `FileSystemManager.getFsData()` to view the current state
3. **Check user sessions**: Use `SessionManager.getStack()` to view the session stack
4. **Test commands individually**: Use simple test cases before complex ones