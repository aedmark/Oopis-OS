# Oopis Basic Language Reference

Welcome to Oopis Basic, the integrated programming language of OopisOS. This guide details all supported keywords, commands, and special system functions.

## IDE Commands

These commands are typed directly into the prompt and are not part of a program.

-   **RUN**: Executes the program currently in memory.
-   **LIST**: Displays the lines of the current program, in order.
-   **SAVE "filename.bas"**: Saves the current program to the specified file in the virtual file system.
-   **LOAD "filename.bas"**: Clears the current program and loads a new one from the specified file.
-   **NEW**: Clears the program currently in memory.
-   **EXIT**: Exits the BASIC environment and returns to the OopisOS terminal.

## BASIC Keywords (used in program lines)

Every line in a BASIC program must start with a line number.

-   **PRINT** _expression_
    Prints the value of the expression to the screen. The expression can be a string literal in quotes, a variable, or a combination of them using `+`.
    `10 PRINT "HELLO, " + A$`

-   **INPUT** _variable_
-   **INPUT** _"prompt"_, _variable_
    Pauses the program, displays an optional prompt, and waits for the user to enter a value, which is then stored in the specified variable. String variables must end with a `$`.
    `20 INPUT "WHAT IS YOUR NAME? ", N$`

-   **LET** _variable_ = _expression_
    Assigns the value of an expression to a variable. The `LET` keyword is optional.
    `30 LET A = 10`
    `35 B = 20`

-   **IF** _condition_ **THEN** _action_
    If the condition is true, it performs the action. The action can be any valid BASIC statement, such as `GOTO` or `PRINT`.
    `40 IF A > 5 THEN GOTO 100`
    `45 IF N$ = "ANDREW" THEN PRINT "GREETINGS, CREATOR."`

-   **GOTO** _linenumber_
    Unconditionally jumps program execution to the specified line number.
    `50 GOTO 10`

-   **GOSUB** _linenumber_
    Jumps to a subroutine at the specified line number, remembering where it came from.
    `60 GOSUB 1000`

-   **RETURN**
    Returns from a subroutine to the line immediately following the `GOSUB` call.
    `1010 RETURN`

-   **REM** _comment_
    A remark or comment. The rest of the line is ignored by the interpreter.
    `5 REM THIS IS A COMMENT`

## OopisOS System Integration Functions

These special functions, used within expressions, allow your BASIC programs to interact directly with the underlying operating system.

-   **SYS_CMD("command")**
    Executes an OopisOS shell command and returns its output as a string.
    `50 LET D$ = SYS_CMD("ls -l")`

-   **SYS_READ("filepath")**
    Reads the content of a file from the virtual file system and returns it as a string.
    `60 LET F$ = SYS_READ("/home/Guest/readme.txt")`

-   **SYS_WRITE("filepath", "content")**
    Writes the provided content to a specified file in the virtual file system, creating or overwriting it as needed. Returns nothing.
    `70 SYS_WRITE("log.txt", "Program executed successfully.")`