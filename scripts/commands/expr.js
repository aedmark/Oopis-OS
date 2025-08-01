// scripts/commands/expr.js

window.ExprCommand = class ExprCommand extends Command {
    constructor() {
        super({
            commandName: "expr",
            description: "Evaluates a mathematical expression.",
            helpText: `Usage: expr <expression>
      Evaluates a mathematical expression and prints the result.
      DESCRIPTION
      The expr utility evaluates an integer expression and writes the
      result to the standard output. The expression can include the
      following operators: + - * / % ( )
      Each part of the expression should be a separate argument.
      EXAMPLES
      expr 10 + 10
      Displays "20".
      expr \\( 10 + 10 \\) \\* 2
      Displays "40". Note that parentheses and the multiplication
      operator must be escaped to prevent the shell from interpreting them.`,
            isInputStream: false,
        });
    }

    async coreLogic(context) {
        const { args, dependencies } = context;
        const { ErrorHandler } = dependencies;

        const expression = args.join(" ");

        try {
            const result = new Function(`return ${expression}`)();
            if (typeof result !== 'number' || !isFinite(result)) {
                return ErrorHandler.createError(`expr: invalid expression`);
            }
            return ErrorHandler.createSuccess(String(result));
        } catch (e) {
            return ErrorHandler.createError(`expr: invalid expression`);
        }
    }
}

window.CommandRegistry.register(new ExprCommand());
