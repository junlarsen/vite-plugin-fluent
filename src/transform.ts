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
export function transformFluentFile(fluent: string): ts.SourceFile {
  const importDeclaration = createFluentImport();
  const resourceExport = createResourceExport(fluent);
  const formatMessageExport = createFormatMessageExport();

  return ts.factory.createSourceFile(
    [importDeclaration, resourceExport, formatMessageExport],
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
export function createFluentImport(isTypeOnly = false) {
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
    isTypeOnly,
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
 * Generate the code for the formatMessage type-safe function.
 *
 * @example
 * ```
 * export function formatMessage(bundle, id, args, error) {
 *   return bundle.formatPattern(bundle.getMessage(id), args, error);
 * }
 * ```
 */
export function createFormatMessageExport() {
  const bundleIdentifier = ts.factory.createIdentifier('bundle');
  const idIdentifier = ts.factory.createIdentifier('id');
  const argsIdentifier = ts.factory.createIdentifier('args');
  const errorIdentifier = ts.factory.createIdentifier('error');
  const bundleParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    bundleIdentifier,
  );
  const idParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    idIdentifier,
  );
  const argsParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    argsIdentifier,
  );
  const errorParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    errorIdentifier,
  );
  // Create the inner function call
  const innerCallee = ts.factory.createPropertyAccessExpression(
    bundleIdentifier,
    'getMessage',
  );
  const innerCall = ts.factory.createCallExpression(
    innerCallee,
    [],
    [idIdentifier],
  );
  const valueOfInnerCall = ts.factory.createPropertyAccessExpression(
    innerCall,
    'value',
  );
  // Create the outer function call
  const outerCallee = ts.factory.createPropertyAccessExpression(
    bundleIdentifier,
    'formatPattern',
  );
  const outerCall = ts.factory.createCallExpression(
    outerCallee,
    [],
    [valueOfInnerCall, argsIdentifier, errorIdentifier],
  );
  // Create the return statement
  const returnStatement = ts.factory.createReturnStatement(outerCall);
  const block = ts.factory.createBlock([returnStatement], true);
  const functionName = ts.factory.createIdentifier('formatMessage');
  return ts.factory.createFunctionDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    undefined,
    functionName,
    [],
    [bundleParameter, idParameter, argsParameter, errorParameter],
    undefined,
    block,
  );
}
