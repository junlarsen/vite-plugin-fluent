import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createResourceDeclarationExport } from '../src/declaration';
import {
  createFluentImport,
  createFormatMessageExport,
  createResourceExport,
} from '../src/transform';

/** Stringify a TypeScript node for testing. */
function stringify(node: ts.Node): string {
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });
  const sourceFile = ts.createSourceFile(
    'test.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

describe('createResourceExport', () => {
  it('can export the string contents as a FluentResource', () => {
    const node = createResourceExport('hello = Hello World!');
    expect(stringify(node)).toMatchInlineSnapshot(
      `"export const resource = new FluentResource('hello = Hello World!');"`,
    );
  });

  it('can deal with single-quotes in the fluent input', () => {
    const node = createResourceExport("hello = It's nice outside!");
    expect(stringify(node)).toMatchInlineSnapshot(
      `"export const resource = new FluentResource('hello = It\\'s nice outside!');"`,
    );
  });
});

describe('createFluentImport', () => {
  it('can import the FluentBundle and FluentResource classes', () => {
    const node = createFluentImport();
    expect(stringify(node)).toMatchInlineSnapshot(
      `"import { FluentResource, FluentBundle } from "@fluent/bundle";"`,
    );
  });
});

describe('createResourceDeclarationExport', () => {
  it('can create the resource declaration', () => {
    const node = createResourceDeclarationExport();
    expect(stringify(node)).toMatchInlineSnapshot(
      `"export declare const resource: FluentResource;"`,
    );
  });
});

describe('createFormatMessageExport', () => {
  it('can create the formatMessage export', () => {
    const node = createFormatMessageExport();
    expect(stringify(node)).toMatchInlineSnapshot(
      `
      "export function formatMessage(bundle, id, args, error) {
          return bundle.formatPattern(bundle.getMessage(id).value, args, error);
      }"
    `,
    );
  });
});
