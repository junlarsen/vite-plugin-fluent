import * as fs from 'node:fs/promises';
import * as ts from 'typescript';

const runtime = await fs.readFile(
  new URL('./runtime/runtime.js', import.meta.url),
  'utf-8',
);

/**
 * Transform a Fluent file into a JavaScript* file.
 *
 * We use the TypeScript compiler API to generate the syntax tree, but we are
 * cautious to only print code that is valid JavaScript. This is because the
 * Vite plugin must receive valid JavaScript code from the transform.
 *
 * In addition to the Fluent file, we also generate a .d.ts declaration file to
 * go along with the generated JavaScript. This makes the .ftl files completely
 * type-safe, even though we are only exposing the plain Fluent APIs.
 */
export function transformFluentFile(fluent: string): ts.SourceFile {
  const importDeclaration = createFluentImport();
  const resourceExport = createResourceExport(fluent);
  const inlineRuntime = createInlineRuntime();

  return ts.factory.createSourceFile(
    [importDeclaration, resourceExport, ...inlineRuntime],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
}

/**
 * Create the import statement for the `@fluent/bundle` package.
 *
 * This imports the FluentResource and FluentBundle classes from the package.
 *
 * @example
 * ```
 * import { FluentResource, FluentBundle } from '@fluent/bundle';
 * ```
 */
export function createFluentImport() {
  const fluentResource = ts.factory.createIdentifier('FluentResource');
  const fluentBundle = ts.factory.createIdentifier('FluentBundle');
  const fluentResourceImportSpecifier = ts.factory.createImportSpecifier(
    false,
    undefined,
    fluentResource,
  );
  const fluentBundleImportSpecifier = ts.factory.createImportSpecifier(
    false,
    undefined,
    fluentBundle,
  );
  const namedImports = ts.factory.createNamedImports([
    fluentResourceImportSpecifier,
    fluentBundleImportSpecifier,
  ]);
  const importClause = ts.factory.createImportClause(
    false,
    undefined,
    namedImports,
  );
  const importSource = ts.factory.createStringLiteral('@fluent/bundle');
  return ts.factory.createImportDeclaration(
    undefined,
    importClause,
    importSource,
  );
}

/**
 * Generate the top-level export for the `@fluent/bundle` FluentResource value.
 *
 * This function generates something akin to the following TypeScript code.
 *
 * @example
 * ```
 * export const resource = new FluentResource(<ftl content>);
 * ```
 */
export function createResourceExport(fluent: string) {
  const content = ts.factory.createStringLiteral(fluent, true);
  const className = ts.factory.createIdentifier('FluentResource');
  const constructorCall = ts.factory.createNewExpression(
    className,
    [],
    [content],
  );
  const variableDeclaration = ts.factory.createVariableDeclaration(
    'resource',
    undefined,
    undefined,
    constructorCall,
  );
  const variableDeclarationList = ts.factory.createVariableDeclarationList(
    [variableDeclaration],
    ts.NodeFlags.Const,
  );
  return ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    variableDeclarationList,
  );
}

/**
 * Create the statements from inlining the runtime.js file.
 */
export function createInlineRuntime() {
  const sourceFile = ts.createSourceFile(
    'runtime.js',
    runtime,
    ts.ScriptTarget.Latest,
    undefined,
    ts.ScriptKind.JS,
  );
  return sourceFile.statements;
}
