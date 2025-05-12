import * as fs from 'node:fs/promises';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { generateFluentDeclaration } from '../src/declaration';

const files = new URL('./declaration', import.meta.url);

describe('declaration code generation', async () => {
  for (const file of await fs.readdir(files, { recursive: true })) {
    if (!file.endsWith('.ftl')) {
      continue;
    }

    it(`should translate ${file} to d.ts`, async () => {
      const url = new URL(`./declaration/${file}`, import.meta.url);
      const flt = await fs.readFile(url, 'utf-8');
      const node = generateFluentDeclaration(flt);
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
      await expect(printer.printFile(node)).toMatchFileSnapshot(
        `${url.pathname}.snap`,
      );
    });
  }
});
