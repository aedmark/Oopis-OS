// scripts/commands/run.js

window.RunCommand = class RunCommand extends Command {
  constructor() {
    super({
      commandName: "run",
      description: "Executes a script file as a series of commands.",
      helpText: `Usage: run <script_path>
      Execute a script from a file.
      DESCRIPTION
      The run command reads the specified script file and executes its
      contents line by line as if they were typed into the terminal.
      This is useful for automating repetitive tasks.
      - Lines starting with # are treated as comments and ignored.
      - Blank lines are ignored.
      EXAMPLES
      run setup_project.sh
      Executes the commands listed in the 'setup_project.sh' file.`,
      completionType: "paths",
      validations: {
        args: {
          exact: 1,
          error: "Usage: run <script_path>"
        },
        paths: [{
          argIndex: 0,
          options: {
            expectedType: 'file',
            permissions: ['read', 'execute']
          }
        }]
      },
    });
  }

  async coreLogic(context) {
    const { validatedPaths, dependencies } = context;
    const { CommandExecutor, ErrorHandler } = dependencies;
    const fileNode = validatedPaths[0].node;

    const scriptContent = fileNode.content || "";
    const lines = scriptContent.split("\n");

    try {
      await CommandExecutor.executeScript(lines, {
        isInteractive: false,
      });
      return ErrorHandler.createSuccess("We did it!");
    } catch (e) {
      return ErrorHandler.createError(`run: ${e.message}`);
    }
  }
}

window.CommandRegistry.register(new RunCommand());

