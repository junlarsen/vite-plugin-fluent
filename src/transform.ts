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
 * Generate the code for the formatMessage type-safe function.
 *
 * @example
 * ```
 * export function formatMessage(bundle, id, args, error) {
 *   const attrIndex = id.indexOf('.');
 *   const isAttribute = attrIndex > -1;
 *   const messageId = isAttribute ? id.slice(0, attrIndex) : id;
 *   const message = bundle.getMessage(id);
 *   const pattern = isAttribute
 *     ? message.attributes[id.slice(attrIndex + 1)]
 *     : message.value;
 *   if (args === null || Array.isArray(args))
 *     return bundle.formatPattern(pattern, {}, args);
 *   return bundle.formatPattern(pattern, args, error);
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
  // Create the attrIndex variable
  const attrIndexIdentifier = ts.factory.createIdentifier('attrIndex');
  const attrIndexCallee = ts.factory.createPropertyAccessExpression(
    idIdentifier,
    'indexOf',
  );
  const attrIndexCall = ts.factory.createCallExpression(
    attrIndexCallee,
    [],
    [ts.factory.createStringLiteral('.')],
  );
  const attrIndexDeclaration = ts.factory.createVariableDeclaration(
    'attrIndex',
    undefined,
    undefined,
    attrIndexCall,
  );
  const attrIndexVariableStatement = ts.factory.createVariableStatement(
    [],
    ts.factory.createVariableDeclarationList(
      [attrIndexDeclaration],
      ts.NodeFlags.Const,
    ),
  );
  // Create the isAttribute variable
  const isAttributeIdentifier = ts.factory.createIdentifier('isAttribute');
  const isAttributeCall = ts.factory.createBinaryExpression(
    attrIndexIdentifier,
    ts.SyntaxKind.GreaterThanToken,
    ts.factory.createPrefixMinus(ts.factory.createNumericLiteral(1)),
  );
  const isAttributeDeclaration = ts.factory.createVariableDeclaration(
    isAttributeIdentifier,
    undefined,
    undefined,
    isAttributeCall,
  );
  const isAttributeVariableStatement = ts.factory.createVariableStatement(
    [],
    ts.factory.createVariableDeclarationList(
      [isAttributeDeclaration],
      ts.NodeFlags.Const,
    ),
  );
  // Create the messageId variable
  const messageIdIdentifier = ts.factory.createIdentifier('messageId');
  const messageIdCallee = ts.factory.createPropertyAccessExpression(
    idIdentifier,
    'slice',
  );
  const messageIdCall = ts.factory.createCallExpression(
    messageIdCallee,
    [],
    [ts.factory.createNumericLiteral(0), attrIndexIdentifier],
  );
  const messageIdDeclaration = ts.factory.createVariableDeclaration(
    messageIdIdentifier,
    undefined,
    undefined,
    ts.factory.createConditionalExpression(
      isAttributeIdentifier,
      ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      messageIdCall,
      ts.factory.createToken(ts.SyntaxKind.ColonToken),
      idIdentifier,
    ),
  );
  const messageIdVariableStatement = ts.factory.createVariableStatement(
    [],
    ts.factory.createVariableDeclarationList(
      [messageIdDeclaration],
      ts.NodeFlags.Const,
    ),
  );
  // Create the message variable
  const messageIdentifier = ts.factory.createIdentifier('message');
  const messageCallee = ts.factory.createPropertyAccessExpression(
    bundleIdentifier,
    'getMessage',
  );
  const messageCall = ts.factory.createCallExpression(
    messageCallee,
    [],
    [messageIdIdentifier],
  );
  const messageDeclaration = ts.factory.createVariableDeclaration(
    messageIdentifier,
    undefined,
    undefined,
    messageCall,
  );
  const messageVariableStatement = ts.factory.createVariableStatement(
    [],
    ts.factory.createVariableDeclarationList(
      [messageDeclaration],
      ts.NodeFlags.Const,
    ),
  );
  // Create the indexOf check
  const attrIndexPlusOne = ts.factory.createBinaryExpression(
    attrIndexIdentifier,
    ts.SyntaxKind.PlusToken,
    ts.factory.createNumericLiteral(1),
  );
  const attrSlice = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(idIdentifier, 'slice'),
    [],
    [attrIndexPlusOne],
  );
  const patternIdentifier = ts.factory.createIdentifier('pattern');
  const attrValue = ts.factory.createConditionalExpression(
    isAttributeIdentifier,
    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
    ts.factory.createElementAccessExpression(
      ts.factory.createPropertyAccessExpression(
        messageIdentifier,
        'attributes',
      ),
      attrSlice,
    ),
    ts.factory.createToken(ts.SyntaxKind.ColonToken),
    ts.factory.createPropertyAccessExpression(messageIdentifier, 'value'),
  );
  const attrDeclaration = ts.factory.createVariableDeclaration(
    patternIdentifier,
    undefined,
    undefined,
    attrValue,
  );
  const patternVariableStatement = ts.factory.createVariableStatement(
    [],
    ts.factory.createVariableDeclarationList(
      [attrDeclaration],
      ts.NodeFlags.Const,
    ),
  );
  // Create the outer function call
  const outerCallee = ts.factory.createPropertyAccessExpression(
    bundleIdentifier,
    'formatPattern',
  );
  const outerCall = ts.factory.createCallExpression(
    outerCallee,
    [],
    [patternIdentifier, argsIdentifier, errorIdentifier],
  );
  // Create the if statement
  const argsIsNull = ts.factory.createStrictEquality(
    argsIdentifier,
    ts.factory.createNull(),
  );
  const argsIsArray = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier('Array'),
      'isArray',
    ),
    [],
    [argsIdentifier],
  );
  const argsIsNullOrArray = ts.factory.createBinaryExpression(
    argsIsNull,
    ts.SyntaxKind.BarBarToken,
    argsIsArray,
  );
  const noArgsButErrorCall = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      bundleIdentifier,
      'formatPattern',
    ),
    [],
    [
      patternIdentifier,
      ts.factory.createObjectLiteralExpression(),
      argsIdentifier,
    ],
  );
  const thenStatement = ts.factory.createReturnStatement(noArgsButErrorCall);
  const ifStatement = ts.factory.createIfStatement(
    argsIsNullOrArray,
    thenStatement,
    undefined,
  );
  // Create the return statement
  const returnStatement = ts.factory.createReturnStatement(outerCall);
  const block = ts.factory.createBlock(
    [
      attrIndexVariableStatement,
      isAttributeVariableStatement,
      messageIdVariableStatement,
      messageVariableStatement,
      patternVariableStatement,
      ifStatement,
      returnStatement,
    ],
    true,
  );
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
