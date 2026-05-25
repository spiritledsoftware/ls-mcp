import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

function getLineColumn(source: string, offset: number): { line: number; column: number } {
  const prefix = source.slice(0, offset);
  const lines = prefix.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function parseJsonc(source: string, filePath: string): unknown {
  const errors: ParseError[] = [];
  const value = parse(source, errors, { allowTrailingComma: true, disallowComments: false });

  if (errors.length > 0) {
    const error = errors[0];
    const position = getLineColumn(source, error.offset);
    throw new Error(
      `${filePath}: ${printParseErrorCode(error.error)} at line ${position.line}, column ${position.column}`,
    );
  }

  return value;
}
