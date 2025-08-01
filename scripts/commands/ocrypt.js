// scripts/commands/ocrypt.js

function _transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

function _matrixMultiply(A, B) {
  const result = Array(A.length)
      .fill(0)
      .map(() => Array(B[0].length).fill(0));
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B[0].length; j++) {
      for (let k = 0; k < A[0].length; k++) {
        result[i][j] = (result[i][j] + A[i][k] * B[k][j]) % 256;
      }
    }
  }
  return result;
}

function _getBlock(data, index, blockSize) {
  const block = Array(blockSize).fill(0);
  for (let i = 0; i < blockSize; i++) {
    if (index + i < data.length) {
      block[i] = data[index + i];
    }
  }
  return block;
}

function _generateKeyMatrix(keyString, size) {
  let hash = 0;
  for (let i = 0; i < keyString.length; i++) {
    hash = (hash << 5) - hash + keyString.charCodeAt(i);
    hash |= 0;
  }
  const matrix = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0));
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      hash = (hash * 16807 + (i * size + j)) % 2147483647;
      matrix[i][j] = Math.abs(hash % 256);
    }
  }
  return matrix;
}

window.OcryptCommand = class OcryptCommand extends Command {
  constructor() {
    super({
      commandName: "ocrypt",
      description: "Encrypts or decrypts files using a custom block cipher.",
      helpText: `Usage: ocrypt [-d] <key> <inputfile> [outputfile]
      Encrypt or decrypt a file using a key.
      DESCRIPTION
      ocrypt is a simple custom block cipher for demonstration purposes.
      It uses a key-derived matrix to transform 8-byte blocks of data.
      If [outputfile] is not provided, the result is printed to standard output.
      OPTIONS
      -d, --decrypt
      Decrypt the input file instead of encrypting.
      WARNING
      This tool is for educational purposes ONLY. It is NOT
      cryptographically secure and should not be used to protect
      sensitive data.`,
      flagDefinitions: [
        { name: "decrypt", short: "-d", long: "--decrypt" },
      ],
      validations: {
        args: { min: 2, max: 3, error: "Usage: ocrypt [-d] <key> <inputfile> [outputfile]" },
        paths: [{
          argIndex: 1,
          options: { expectedType: 'file', permissions: ['read'] }
        }]
      },
    });
  }

  async coreLogic(context) {
    const { args, flags, currentUser, validatedPaths, dependencies } = context;
    const { FileSystemManager, UserManager, ErrorHandler } = dependencies;
    const blockSize = 8;

    const key = args[0];
    const inputFileNode = validatedPaths[0].node;
    const outputFile = args.length === 3 ? args[2] : null;

    const keyMatrix = _generateKeyMatrix(key, blockSize);
    const operationMatrix = flags.decrypt ? _transpose(keyMatrix) : keyMatrix;

    const textEncoder = new TextEncoder();
    const inputBytes = textEncoder.encode(inputFileNode.content || "");
    const outputBytes = new Uint8Array(inputBytes.length);

    for (let i = 0; i < inputBytes.length; i += blockSize) {
      const block = _getBlock(inputBytes, i, blockSize);
      const blockMatrix = [block];
      const resultMatrix = _matrixMultiply(blockMatrix, operationMatrix);
      for (let j = 0; j < blockSize; j++) {
        if (i + j < outputBytes.length) {
          outputBytes[i + j] = resultMatrix[0][j];
        }
      }
    }

    const textDecoder = new TextDecoder("utf-8", { fatal: true });
    let outputContent;
    try {
      outputContent = textDecoder.decode(outputBytes);
    } catch (e) {
      outputContent = Array.from(outputBytes)
          .map((byte) => String.fromCharCode(byte))
          .join("");
    }

    if (outputFile) {
      const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
      const saveResult = await FileSystemManager.createOrUpdateFile(
          outputFile,
          outputContent,
          { currentUser, primaryGroup }
      );

      if (!saveResult.success) {
        return ErrorHandler.createError(`ocrypt: ${saveResult.error}`);
      }
      return ErrorHandler.createSuccess("", { stateModified: true });
    } else {
      return ErrorHandler.createSuccess(outputContent);
    }
  }
}

window.CommandRegistry.register(new OcryptCommand());
