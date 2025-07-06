# Oopis Basic: A Primer on Embedded Scripting

Welcome to Oopis Basic, the integrated programming language of OopisOS. This guide details all supported keywords, commands, and special system functions, providing a robust toolset for everything from simple scripts to interactive programs. It is a throwback to the classic days of computing, allowing users to write, `LIST`, and `RUN` line-numbered programs directly within the OS.

## The Oopis Basic IDE

The gateway to BASIC is its own Integrated Development Environment (IDE), launched with the `basic` command. This provides a focused, full-screen experience for writing and executing code.

### IDE Commands

These commands are typed directly into the prompt and are not part of a program.

- **RUN**: Executes the program currently in memory.

- **LIST**: Displays the lines of the current program, in order.

- **SAVE "filename.bas"**: Saves the current program to the specified file in the virtual file system.

- **LOAD "filename.bas"**: Clears the current program and loads a new one from the specified file.

- **NEW**: Clears the program currently in memory.

- **EXIT**: Exits the BASIC environment and returns to the OopisOS terminal.


## The Language: Keywords & Syntax

Every line in a BASIC program must start with a line number. This structure is fundamental to the language's execution flow, especially for control statements like `GOTO`.

- PRINT expression

  Prints the value of the expression to the screen. The expression can be a string literal in quotes, a variable, or a combination of them using +.

  10 PRINT "HELLO, " + A$

- **INPUT** _variable_

- INPUT "prompt", variable

  Pauses the program, displays an optional prompt, and waits for the user to enter a value, which is then stored in the specified variable. String variables must end with a $.

  20 INPUT "WHAT IS YOUR NAME? ", N$

- LET variable = expression

  Assigns the value of an expression to a variable. The LET keyword is optional.

  30 LET A = 10

  35 B = 20

- IF condition THEN action

  If the condition is true, it performs the action. The action can be any valid BASIC statement, such as GOTO or PRINT.

  40 IF A > 5 THEN GOTO 100

  45 IF N$ = "ANDREW" THEN PRINT "GREETINGS, CREATOR."

- GOTO linenumber

  Unconditionally jumps program execution to the specified line number.

  50 GOTO 10

- GOSUB linenumber

  Jumps to a subroutine at the specified line number, remembering where it came from.

  60 GOSUB 1000

- RETURN

  Returns from a subroutine to the line immediately following the GOSUB call.

  1010 RETURN

- REM comment

  A remark or comment. The rest of the line is ignored by the interpreter.

  5 REM THIS IS A COMMENT

- END

  Terminates the program execution.


## OopisOS System Integration Functions

The true power of Oopis Basic lies in its integration with the host operating system. These special functions, used within expressions, allow your BASIC programs to interact directly with the underlying OS, read and write files, and execute shell commands. This is accomplished via a secure bridge, ensuring that any program run via the interpreter is still subject to the OS's fundamental permission model.

- SYS_CMD("command")

  Executes an OopisOS shell command and returns its output as a string.

  50 LET D$ = SYS_CMD("ls -l")

- SYS_READ("filepath")

  Reads the content of a file from the virtual file system and returns it as a string.

  60 LET F$ = SYS_READ("/home/Guest/readme.txt")

- SYS_WRITE("filepath", "content")

  Writes the provided content to a specified file in the virtual file system, creating or overwriting it as needed. Returns nothing.

  70 SYS_WRITE("log.txt", "Program executed successfully.")


## Roadmap and Future Enhancements

The Oopis Basic subsystem, while robust, is a foundational implementation with a clear path for future growth. The development team is actively exploring the following enhancements to increase its power and flexibility:

- **Expanded Mathematical Functions:** Integration of standard mathematical functions beyond basic arithmetic, such as `SIN()`, `COS()`, `TAN()`, `SQR()` (square root), and `RND()` (random number generation).

- **Looping Constructs:** Implementation of `FOR...NEXT` loops to allow for more complex and efficient iterative algorithms, reducing the reliance on `IF...GOTO` structures.

- **Data Structures:** Introduction of `DATA` and `READ` statements to allow for embedding static data directly within a program, as well as support for single-dimension arrays (`DIM`) for managing lists of numbers or strings.

- **Enhanced String Manipulation:** Adding functions like `LEFT$()`, `RIGHT$()`, `MID$()`, and `LEN()` to provide finer control over string processing.

- **Graphical "Poke" Commands:** A potential `SYS_POKE(x, y, char, color)` function that would allow BASIC programs to directly draw characters to the terminal screen, enabling the creation of simple animations and graphical applications from within the BASIC environment.****