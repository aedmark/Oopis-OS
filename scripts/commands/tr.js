// scripts/commands/tr.js

window.TrCommand = class TrCommand extends Command {
    constructor() {
        super({
            commandName: "tr",
            description: "Translate, squeeze, or delete characters from standard input.",
            helpText: `Usage: tr [OPTION]... SET1 [SET2]
      Translate, squeeze, and/or delete characters from standard input, writing to standard output.
      DESCRIPTION
      The tr command copies the standard input to the standard output with substitution or deletion of selected characters.
      OPTIONS
      -c, --complement
            Use the complement of SET1.
      -d, --delete
            Delete characters in SET1, do not translate.
      -s, --squeeze-repeats
            Replace each sequence of a repeated character that is listed in the
            last specified SET with a single occurrence of that character.
      SETS
      Character ranges like 'a-z' are supported. The following character classes are also supported:
      [:alnum:] - All letters and digits.
      [:alpha:] - All letters.
      [:digit:] - All digits.
      [:lower:] - All lowercase letters.
      [:upper:] - All uppercase letters.
      [:space:] - All whitespace characters.
      [:punct:] - All punctuation characters.
      EXAMPLES
      echo "hello 123" | tr '[:lower:]' '[:upper:]'
      Translates to "HELLO 123".
      echo "hellloooo world" | tr -s 'o'
      Squeezes the 'o's, resulting in "helo world".
      echo "abc-123-def" | tr -d '[:digit:]'
      Deletes the digits, resulting in "abc--def".
      echo "abc-123-def" | tr -cs '[:alnum:]' '_'
      Replaces all non-alphanumeric characters with a single underscore.`,
            isInputStream: true,
            flagDefinitions: [
                { name: "delete", short: "-d", long: "--delete" },
                { name: "squeeze", short: "-s", long: "--squeeze-repeats" },
                { name: "complement", short: "-c", long: "--complement" },
            ],
        });
    }

    _expandSet(setStr) {
        const charClasses = {
            '[:alnum:]': 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            '[:alpha:]': 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '[:digit:]': '0123456789',
            '[:lower:]': 'abcdefghijklmnopqrstuvwxyz',
            '[:upper:]': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '[:space:]': ' \\t\\n\\r',
            '[:punct:]': '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
        };

        for (const cls in charClasses) {
            if (setStr.includes(cls)) {
                setStr = setStr.replace(cls, charClasses[cls]);
            }
        }

        const expanded = [];
        for (let i = 0; i < setStr.length; i++) {
            if (i + 1 < setStr.length && setStr[i + 1] === '-') {
                if (i + 2 < setStr.length) {
                    const start = setStr.charCodeAt(i);
                    const end = setStr.charCodeAt(i + 2);
                    for (let j = start; j <= end; j++) {
                        expanded.push(String.fromCharCode(j));
                    }
                    i += 2;
                } else {
                    expanded.push(setStr[i]);
                }
            } else {
                expanded.push(setStr[i]);
            }
        }
        return expanded;
    }

    async coreLogic(context) {
        const { args, flags, inputItems, inputError, dependencies } = context;
        const { ErrorHandler } = dependencies;

        if (inputError) {
            return ErrorHandler.createError("tr: No readable input provided.");
        }
        if (args.length === 0) {
            return ErrorHandler.createError("tr: missing operand");
        }

        const content = (inputItems || []).map(item => item.content).join('\n');
        let set1Str = args[0];
        let set2Str = args[1];

        if (flags.complement) {
            const allChars = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join('');
            const originalSet1 = new Set(this._expandSet(set1Str));
            set1Str = [...allChars].filter(char => !originalSet1.has(char)).join('');
        }

        let processedContent = content;

        if (flags.delete) {
            if (args.length > 2 || (args.length === 2 && !flags.squeeze)) {
                return ErrorHandler.createError("tr: extra operand with -d");
            }
            const deleteSet = new Set(this._expandSet(set1Str));
            processedContent = [...content].filter(char => !deleteSet.has(char)).join('');
        } else if (set2Str) {
            const set1 = this._expandSet(set1Str);
            const set2 = this._expandSet(set2Str);
            const translationMap = new Map();
            for (let i = 0; i < set1.length; i++) {
                const charToTranslate = set1[i];
                const translatedChar = set2[i] || set2[set2.length - 1];
                translationMap.set(charToTranslate, translatedChar);
            }
            processedContent = [...content].map(char => translationMap.get(char) || char).join('');
        }

        if (flags.squeeze) {
            const squeezeSetStr = flags.delete ? set2Str : (set2Str || set1Str);
            if (!squeezeSetStr) {
                return ErrorHandler.createError("tr: missing operand for -s");
            }
            const squeezeSet = new Set(this._expandSet(squeezeSetStr));
            let squeezedResult = "";
            let lastChar = null;
            for (const char of processedContent) {
                if (squeezeSet.has(char)) {
                    if (char !== lastChar) {
                        squeezedResult += char;
                    }
                } else {
                    squeezedResult += char;
                }
                lastChar = char;
            }
            processedContent = squeezedResult;
        }

        return ErrorHandler.createSuccess(processedContent);
    }
}

window.CommandRegistry.register(new TrCommand());
