/**
 * Projects that emit declarations (libraries, monorepo packages) must be able
 * to export key trees and nodes. TypeScript then has to write their types into
 * a `.d.ts`, in full: keycraft 0.1 wrote parts of exported nodes as `any`.
 * Runs against the built package, like `package-consumer.test.ts`.
 */
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it("lets consumers export trees and nodes with declaration: true", () => {
  const fixture = fileURLToPath(
    new URL("./fixtures/exported-keys.ts", import.meta.url),
  );
  const program = ts.createProgram([fixture], {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    declaration: true,
    emitDeclarationOnly: true,
  });

  let declarations = "";
  const result = program.emit(undefined, (_fileName, text) => {
    declarations += text;
  });
  const errors = [
    ...ts.getPreEmitDiagnostics(program),
    ...result.diagnostics,
  ].map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));

  expect(errors).toEqual([]);
  expect(declarations).toContain(
    'keys: import("@kellanjs/keycraft").KeycraftKeys<',
  );
  expect(declarations).not.toMatch(/\bany\b/);
  expect(declarations).toContain(
    'searchKey: readonly ["notes", "byNotebook", string, "search", {',
  );
});
