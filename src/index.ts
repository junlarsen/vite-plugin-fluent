import * as fs from 'node:fs/promises';
import * as ts from 'typescript';
import type { Plugin } from 'vite';
import { generateFluentDeclaration } from './declaration.js';
import { transformFluentFile } from './transform.js';

const FTL_FILE_REGEX = /\.ftl$/;

export function fluent(): Plugin {
  return {
    name: 'vite-plugin-fluent',
    transform: async (source, id) => {
      if (!FTL_FILE_REGEX.test(id)) {
        return null;
      }
      // Generate the JavaScript code for the FTL module
      const ftl = await fs.readFile(id, 'utf-8');
      const javascriptSource = transformFluentFile(ftl);
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
      const typescript = printer.printFile(javascriptSource);

      // Generate the TypeScript declaration file for the FTL module
      const declarationSource = generateFluentDeclaration(ftl);
      const declarationPath = `${id}.d.ts`;
      const declaration = printer.printFile(declarationSource);
      await fs.writeFile(declarationPath, declaration, 'utf-8');
      return {
        code: typescript,
      };
    },
  };
}
