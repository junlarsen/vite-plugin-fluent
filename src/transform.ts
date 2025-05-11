import { parse } from '@fluent/syntax';
import * as ts from 'typescript';

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
export async function transformFluentFile(
  fluent: string,
  file: string,
  locale: string,
): Promise<ts.SourceFile> {
  const syntaxTree = parse(fluent, { withSpans: false });
  const importDeclaration = createFluentImport();
  const resourceExport = createResourceExport(fluent);
  const bundleExport = createBundleExport(locale);
  const bundleResourceRegistration = createBundleResourceRegistration();

  return ts.factory.createSourceFile(
    [
      importDeclaration,
      resourceExport,
      bundleExport,
      bundleResourceRegistration,
    ],
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
 * Generate the top-level export for the `@fluent/bundle` FluentBundle value.
 *
 * This function generates something akin to the following TypeScript code.
 *
 * @example
 * ```
 * export const bundle = new FluentBundle('en-US');
 * ```
 */
export function createBundleExport(locale: string) {
  const content = ts.factory.createStringLiteral(locale, true);
  const className = ts.factory.createIdentifier('FluentBundle');
  const constructorCall = ts.factory.createNewExpression(
    className,
    [],
    [content],
  );
  const variableDeclaration = ts.factory.createVariableDeclaration(
    'bundle',
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
 * Create the code for the bundle.addResource call.
 *
 * @example
 * ```
 * bundle.addResource(resource);
 * ```
 */
export function createBundleResourceRegistration() {
  const bundleIdentifier = ts.factory.createIdentifier('bundle');
  const resourceIdentifier = ts.factory.createIdentifier('resource');
  const callExpression = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(bundleIdentifier, 'addResource'),
    [],
    [resourceIdentifier],
  );
  return ts.factory.createExpressionStatement(callExpression);
}
