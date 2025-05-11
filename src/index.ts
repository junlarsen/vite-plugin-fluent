import * as fs from 'node:fs/promises';
import * as ts from 'typescript';
import type { Plugin } from 'vite';
import { transformFluentFile } from './transform.js';

const FTL_FILE_REGEX = /\.ftl\?locale=[A-Za-z-]+$/;

export function fluent(): Plugin {
  return {
    name: 'vite-plugin-fluent',
    transform: async (source, id) => {
      if (!FTL_FILE_REGEX.test(id)) {
        return null;
      }
      const segments = id.split('?');
      if (segments.length !== 2) {
        throw new Error(
          'Invalid FTL file path, did you forget to add the `?locale=[locale]` query parameter?',
        );
      }
      const [filePath, queryString] = segments;
      const queryParams = new URLSearchParams(queryString);
      const locale = queryParams.get('locale');
      if (locale === null) {
        throw new Error(
          'Failed to extract locale from FTL file path, did you forget to add the `?locale=[locale]` query parameter?',
        );
      }
      console.log(filePath);
      const ftl = await fs.readFile(filePath, 'utf-8');
      const node = await transformFluentFile(ftl, filePath, locale);
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
      const typescript = printer.printFile(node);
      return {
        code: typescript,
      };
    },
  };
}
