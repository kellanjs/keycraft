/**
 * Checks the text of compile errors, which type tests can't see: they only
 * assert that an error happens, not what it says. Compiles intentionally
 * wrong code against the built package, like `package-consumer.test.ts`, so
 * the messages are the ones consumers get.
 */
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

// TypeScript works with forward slashes, even on Windows.
const file = fileURLToPath(
  new URL("./__error-messages__.ts", import.meta.url),
).replaceAll("\\", "/");

const code = `
import { keycraft } from "@kellanjs/keycraft";

const keys = keycraft({
  $meta: null,
  users: {
    byId: (id: string) => id,
    count: 1,
    $scoep: (id: string) => id,
  },
  sets: { $scope: (tags: Set<string>) => tags },
  notes: { byId: { $scope: (id: string) => id, comments: null } },
});

// The valid part of the tree is still typed: no errors below this line
keys.notes.byId("1").comments.$key;
`;

/** Type-checks `code` as a file in this folder and returns each error's text. */
function errors(): string[] {
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile } = host;
  host.fileExists = (name) => name === file || fileExists(name);
  host.readFile = (name) => (name === file ? code : readFile(name));
  host.getSourceFile = (name, version, ...rest) =>
    name === file
      ? ts.createSourceFile(name, code, version)
      : getSourceFile(name, version, ...rest);

  const program = ts.createProgram([file], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

const messages = errors();

it("reports each mistake once, and nothing else", () => {
  expect(messages).toHaveLength(5);
});

it("names the full path of a reserved key", () => {
  expect(messages[0]).toBe(
    `Type 'null' is not assignable to type '"Key '$meta' can't start with '$': that prefix is reserved for keycraft's own properties, like $scope"'.`,
  );
  expect(messages[3]).toBe(
    `Type '(id: string) => string' is not assignable to type '"Key 'users.$scoep' can't start with '$': that prefix is reserved for keycraft's own properties, like $scope"'.`,
  );
});

it("explains what's wrong with a value", () => {
  expect(messages[1]).toBe(
    `Type '(id: string) => string' is not assignable to type '"Key 'users.byId' is a function: to make a key that takes arguments, use { $scope: ... }"'.`,
  );
  expect(messages[2]).toBe(
    `Type 'number' is not assignable to type '"Key 'users.count' must be null or an object"'.`,
  );
  expect(messages[4]).toContain(
    `"Key 'sets.$scope' must return key data: strings, numbers, booleans, null, undefined, or arrays and plain objects of those (for a Date, return date.toISOString() or date.getTime())"`,
  );
});
