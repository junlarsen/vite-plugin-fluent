import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  createBundleExport,
  createBundleResourceRegistration,
  createFluentImport,
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

describe('createBundleExport', () => {
  it('can export the string contents as a FluentBundle', () => {
    const node = createBundleExport('en-US');
    expect(stringify(node)).toMatchInlineSnapshot(
      `"export const bundle = new FluentBundle('en-US');"`,
    );
  });
});

describe('createBundleResourceRegistration', () => {
  it('can register the resource with the bundle', () => {
    const node = createBundleResourceRegistration();
    expect(stringify(node)).toMatchInlineSnapshot(
      `"bundle.addResource(resource);"`,
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
