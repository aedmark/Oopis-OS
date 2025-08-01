// scripts/commands/curl.js

window.CurlCommand = class CurlCommand extends Command {
  constructor() {
    super({
      commandName: "curl",
      description: "Transfer data from or to a server.",
      helpText: `Usage: curl [options] <URL>
      Transfer data from or to a server.
      DESCRIPTION
      curl is a tool to transfer data from or to a server. By default,
      it prints the fetched content to standard output.
      Note: Due to browser security restrictions, curl is subject to
      Cross-Origin Resource Sharing (CORS) policies and may not be able
      to fetch content from all URLs.
      OPTIONS
      -o, --output <file>
      Write output to <file> instead of standard output.
      -i, --include
      Include protocol response headers in the output.
      -L, --location
      Follow redirects.
      EXAMPLES
      curl https://api.github.com/zen
      Displays a random piece of GitHub zen wisdom.
      curl -o page.html https://example.com
      Downloads the content of example.com and saves it to a
      file named 'page.html'.`,
      completionType: "paths",
      flagDefinitions: [
        {
          name: "output",
          short: "-o",
          long: "--output",
          takesValue: true,
        },
        {
          name: "include",
          short: "-i",
          long: "--include",
        },
        {
          name: "location",
          short: "-L",
          long: "--location",
        },
      ],
      validations: {
        args: {
          min: 1,
          error: "Usage: curl [options] <URL>"
        }
      },
    });
  }

  async coreLogic(context) {
    const { args, flags, currentUser, dependencies } = context;
    const { FileSystemManager, UserManager, ErrorHandler } = dependencies;
    let currentUrl = args[0];
    const maxRedirects = 10;

    try {
      for (let i = 0; i < maxRedirects; i++) {
        const response = await fetch(currentUrl, { redirect: "manual" });

        if (
            response.status >= 300 &&
            response.status < 400 &&
            response.headers.has("location")
        ) {
          if (!flags.location) {
            return ErrorHandler.createError(
                `curl: Redirected to ${response.headers.get("location")}. Use -L to follow.`
            );
          }
          currentUrl = new URL(response.headers.get("location"), currentUrl)
              .href;
          continue;
        }

        const content = await response.text();
        let outputString = "";

        if (flags.include) {
          outputString += `HTTP/1.1 ${response.status} ${response.statusText}\n`;
          response.headers.forEach((value, name) => {
            outputString += `${name}: ${value}\n`;
          });
          outputString += "\n";
        }

        outputString += content;

        if (flags.output) {
          const pathValidationResult = FileSystemManager.validatePath(
              flags.output,
              {
                allowMissing: true,
                expectedType: "file",
              }
          );

          if (!pathValidationResult.success) {
            return ErrorHandler.createError(
                `curl: ${pathValidationResult.error}`
            );
          }
          const pathValidation = pathValidationResult.data;
          if (
              pathValidation.node &&
              pathValidation.node.type === "directory"
          ) {
            return ErrorHandler.createError(
                `curl: output file '${flags.output}' is a directory`
            );
          }

          const primaryGroup =
              UserManager.getPrimaryGroupForUser(currentUser);
          if (!primaryGroup) {
            return ErrorHandler.createError(
                "curl: critical - could not determine primary group for user."
            );
          }

          const saveResult = await FileSystemManager.createOrUpdateFile(
              pathValidation.resolvedPath,
              outputString,
              {
                currentUser,
                primaryGroup,
              }
          );

          if (!saveResult.success) {
            return ErrorHandler.createError(`curl: ${saveResult.error}`);
          }
          await FileSystemManager.save();
          return ErrorHandler.createSuccess("");
        } else {
          return ErrorHandler.createSuccess(outputString);
        }
      }

      return ErrorHandler.createError("curl: Too many redirects.");
    } catch (e) {
      let errorMsg = `curl: (7) Failed to connect to host. This is often a network issue or a CORS policy preventing access.`;
      if (e instanceof TypeError && e.message.includes("Failed to fetch")) {
        errorMsg = `curl: (7) Couldn't connect to server. The server may be down, or a CORS policy is blocking the request from the browser.`;
      } else if (e instanceof URIError) {
        errorMsg = `curl: (3) URL using bad/illegal format or missing URL`;
      }
      return ErrorHandler.createError(errorMsg);
    }
  }
}

window.CommandRegistry.register(new CurlCommand());
