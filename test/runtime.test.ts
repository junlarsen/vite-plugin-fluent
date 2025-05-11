import { FluentBundle } from '@fluent/bundle';
import { importFromString } from 'module-from-string';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { transformFluentFile } from '../src/transform';

const source = `
hello = Hello world!
with-args = Hello { $name }!
    .with-attr = Hello again!
`;
const sourceFile = transformFluentFile(source);
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const code = printer.printFile(sourceFile);
const module = await importFromString(code);
const bundle = new FluentBundle('en-US', {
  useIsolating: false,
});
bundle.addResource(module.resource);

describe('runtime code', () => {
  it('works for arguments', () => {
    const output = module.formatMessage(bundle, 'with-args', { name: 'John' });
    expect(output).toMatchInlineSnapshot(`"Hello John!"`);
  });

  it('works without arguments', () => {
    const output = module.formatMessage(bundle, 'hello', {});
    expect(output).toMatchInlineSnapshot(`"Hello world!"`);
  });

  it('works with arguments and error list', () => {
    const errors = [] as Error[];
    const output = module.formatMessage(bundle, 'hello', {}, errors);
    expect(output).toMatchInlineSnapshot(`"Hello world!"`);
  });

  it('works without arguments but with errors list', () => {
    const errors = [] as Error[];
    const output = module.formatMessage(bundle, 'hello', errors);
    expect(output).toMatchInlineSnapshot(`"Hello world!"`);
  });

  it('can read attributes', () => {
    const output = module.formatMessage(bundle, 'with-args.with-attr', {
      name: 'John',
    });
    expect(output).toMatchInlineSnapshot(`"Hello again!"`);
  });
});
