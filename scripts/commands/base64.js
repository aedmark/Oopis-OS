(() => {
    "use strict";

    const base64CommandDefinition = {
        commandName: "base64",
        isInputStream: true,
        flagDefinitions: [
            { name: "decode", short: "-d", long: "--decode" }
        ],
        argValidation: {
            max: 1,
        },
        coreLogic: async (context) => {
            const {flags, inputItems, inputError} = context;

            if (inputError) {
                return {success: false, error: "base64: No readable input provided."};
            }

            const inputData = inputItems.map(item => item.content).join('\n');

            if (inputData === null || inputData === undefined) {
                return { success: true, output: "" };
            }

            try {
                if (flags.decode) {
                    const decodedData = atob(inputData.replace(/\s/g, ''));
                    return { success: true, output: decodedData };
                } else {
                    const encodedData = btoa(inputData);
                    return { success: true, output: encodedData.replace(/(.{64})/g, "$1\n") };
                }
            } catch (e) {
                if (e instanceof DOMException && e.name === "InvalidCharacterError") {
                    return { success: false, error: "base64: invalid input" };
                }
                return { success: false, error: `base64: an unexpected error occurred: ${e.message}` };
            }
        }
    };

    const base64Description = "Encode or decode data and print to standard output.";
    const base64HelpText = `Usage: base64 [OPTION]... [FILE]

Base64 encode or decode FILE, or standard input, to standard output.

DESCRIPTION
       The base64 command encodes or decodes data using the Base64 standard.
       This is useful for safely transmitting binary data through text-based channels.
       With no FILE, or when FILE is -, it reads from standard input.

OPTIONS
       -d, --decode
              Decode data.

EXAMPLES
       base64 my_script.sh
              Encodes the script and prints the Base64 string to the terminal.

       base64 my_script.sh > encoded.txt
              Encodes the script and saves the output to a new file.

       cat encoded.txt | base64 -d
              Decodes the content of 'encoded.txt' and prints the original script.`;

    CommandRegistry.register("base64", base64CommandDefinition, base64Description, base64HelpText);
})();