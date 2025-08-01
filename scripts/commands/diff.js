// gem/scripts/commands/diff.js

window.DiffCommand = class DiffCommand extends Command {
  constructor() {
    super({
      commandName: "diff",
      description: "Compares two files line by line.",
      helpText: `Usage: diff [-u] <file1> <file2>
      Compare two files line by line.
      OPTIONS
      -u, --unified
            Output in the unified diff format, compatible with the 'patch' command.
      DESCRIPTION
      The diff command analyzes two files and prints the lines that are
      different. By default, it uses a simple format. With the -u flag,
      it produces a unified diff that can be used to patch files.
      EXAMPLES
      diff original.txt updated.txt
      Shows the differences between the two text files.
      diff -u original.txt updated.txt > changes.patch
      Creates a patch file that can be applied with 'patch original.txt changes.patch'.`,
      completionType: "paths",
      flagDefinitions: [
        { name: "unified",
          short: "-u",
          long: "--unified"
        }
      ],
      validations: {
        args: {
          exact: 2,
          error: "Usage: diff [-u] <file1> <file2>"
        },
        paths: [{
          argIndex: 0,
          options: {
            expectedType: 'file',
            permissions: ['read']
          }
        }, {
          argIndex: 1,
          options: {
            expectedType: 'file',
            permissions: ['read']
          }
        }]
      },
    });
  }

  /**
   * Creates a diff string in the unified format.
   * This is the engine of our new feature! It uses a classic algorithm (LCS)
   * to find differences and formats them into hunks with context.
   * @param {string} text1 - Content of the original file.
   * @param {string} text2 - Content of the new file.
   * @param {string} fileName1 - Name of the original file.
   * @param {string} fileName2 - Name of the new file.
   * @returns {string} The formatted unified diff string.
   */

  _createUnifiedDiff(text1, text2, fileName1, fileName2) {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');

    const matrix = Array(lines1.length + 1).fill(null).map(() => Array(lines2.length + 1).fill(0));
    for (let i = 1; i <= lines1.length; i++) {
      for (let j = 1; j <= lines2.length; j++) {
        if (lines1[i - 1] === lines2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }

    let i = lines1.length, j = lines2.length;
    const diff = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
        diff.unshift({ type: 'common', line: lines1[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
        diff.unshift({ type: 'add', line: lines2[j - 1] });
        j--;
      } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
        diff.unshift({ type: 'del', line: lines1[i - 1] });
        i--;
      }
    }

    const hunks = [];
    const CONTEXT_SIZE = 3;
    let hunk = null;

    for (let k = 0; k < diff.length; k++) {
      const item = diff[k];
      if (item.type !== 'common') {
        if (hunk === null) {
          hunk = {
            oldStart: 0, newStart: 0,
            oldLines: 0, newLines: 0,
            items: []
          };
          const start = Math.max(0, k - CONTEXT_SIZE);
          for (let m = start; m < k; m++) {
            hunk.items.push(diff[m]);
          }
        }
        hunk.items.push(item);
      } else if (hunk !== null) {
        hunk.items.push(item);
        const isLastChangeInHunk = hunk.items.slice(-CONTEXT_SIZE - 1).every(h => h.type === 'common');
        if (k - hunk.items.findIndex(h => h !== 'common') > CONTEXT_SIZE && isLastChangeInHunk) {
          hunk.items.splice(-CONTEXT_SIZE);
          hunks.push(hunk);
          hunk = null;
        }
      }
    }
    if (hunk !== null) hunks.push(hunk);

    if (hunks.length === 0) return "";

    let oldLineNum = 1, newLineNum = 1;
    let output = [`--- ${fileName1}`, `+++ ${fileName2}`];

    for (const h of hunks) {
      let currentOld = -1, currentNew = -1;
      let oldHunkLines = 0, newHunkLines = 0;
      let hunkBody = [];

      for(const item of h.items) {
        if (currentOld === -1 && item.type !== 'add') currentOld = oldLineNum;
        if (currentNew === -1 && item.type !== 'del') currentNew = newLineNum;

        if (item.type === 'common') {
          oldLineNum++; newHunkLines++;
          newLineNum++; oldHunkLines++;
          hunkBody.push(' ' + item.line);
        } else if (item.type === 'del') {
          oldLineNum++; oldHunkLines++;
          hunkBody.push('-' + item.line);
        } else if (item.type === 'add') {
          newLineNum++; newHunkLines++;
          hunkBody.push('+' + item.line);
        }
      }

      const header = `@@ -${currentOld},${oldHunkLines} +${currentNew},${newHunkLines} @@`;
      output.push(header);
      output = output.concat(hunkBody);
    }

    return output.join('\n');
  }

  async coreLogic(context) {
    const { args, validatedPaths, dependencies } = context;
    const { DiffUtils, ErrorHandler } = dependencies;

    const file1Path = args[0];
    const file2Path = args[1];
    const file1Node = validatedPaths[0].node;
    const file2Node = validatedPaths[1].node;

    if (context.flags.unified) {
      const unifiedDiff = this._createUnifiedDiff(
          file1Node.content || "",
          file2Node.content || "",
          file1Path,
          file2Path
      );
      return ErrorHandler.createSuccess(unifiedDiff);
    } else {
      const diffResult = DiffUtils.compare(
          file1Node.content || "",
          file2Node.content || ""
      );
      return ErrorHandler.createSuccess(diffResult);
    }
  }
}

window.CommandRegistry.register(new DiffCommand());
