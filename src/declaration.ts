import {
  Identifier,
  Message,
  type Pattern,
  Placeable,
  type Resource,
  SelectExpression,
  VariableReference,
  parse,
} from '@fluent/syntax';
import * as ts from 'typescript';

/**
 * Generate the code for the TypeScript declaration file that will be generated
 * for the .ftl file.
 */
export function generateFluentDeclaration(fluent: string): ts.SourceFile {
  const tree = parse(fluent, { withSpans: true });
  const fluentImport = createFluentTypeImport();
  const resourceDeclaration = createResourceDeclarationExport();
  const messageSetTypeDeclaration = createMessageSetTypeDeclaration(tree);
  const messageIdTypeDeclaration = createMessageIdTypeDeclaration();
  const formatMessageFunctionDeclaration =
    createFormatMessageFunctionDeclaration();
  return ts.factory.createSourceFile(
    [
      fluentImport,
      resourceDeclaration,
      messageSetTypeDeclaration,
      messageIdTypeDeclaration,
      formatMessageFunctionDeclaration,
    ],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
}

export function createFluentTypeImport() {
  const fluentResource = ts.factory.createIdentifier('FluentResource');
  const fluentBundle = ts.factory.createIdentifier('FluentBundle');
  const fluentVariable = ts.factory.createIdentifier('FluentVariable');
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
  const fluentVariableImportSpecifier = ts.factory.createImportSpecifier(
    false,
    undefined,
    fluentVariable,
  );
  const namedImports = ts.factory.createNamedImports([
    fluentResourceImportSpecifier,
    fluentBundleImportSpecifier,
    fluentVariableImportSpecifier,
  ]);
  const importClause = ts.factory.createImportClause(
    true,
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
 * Create the export statement for the `FluentResource` class.
 *
 * @example
 * ```
 * export declare const resource: FluentResource
 * ```
 */
export function createResourceDeclarationExport() {
  const resource = ts.factory.createIdentifier('resource');
  const resourceType = ts.factory.createTypeReferenceNode(
    'FluentResource',
    undefined,
  );
  const variableDeclaration = ts.factory.createVariableDeclaration(
    resource,
    undefined,
    resourceType,
    undefined,
  );
  const variableDeclarationList = ts.factory.createVariableDeclarationList(
    [variableDeclaration],
    ts.NodeFlags.Const,
  );
  return ts.factory.createVariableStatement(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    variableDeclarationList,
  );
}

/**
 * Create the type map for the messages in this .ftl file
 *
 * @example
 * ```
 * export declare type MessageSet = {
 *   hello: { name: string }
 * }
 * ```
 */
export function createMessageSetTypeDeclaration(resource: Resource) {
  const messages = resource.body.filter((entry) => entry instanceof Message);
  const messageTypes = messages
    .map(createMessageType)
    .filter((message) => message !== null);
  const mappedType = ts.factory.createTypeLiteralNode(messageTypes);
  return ts.factory.createTypeAliasDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    'MessageSet',
    [],
    mappedType,
  );
}

/**
 * Create the parameter type for a single message entry.
 */
export function createMessageType(
  message: Message,
): ts.PropertySignature | null {
  if (message.value === null) {
    return null;
  }
  const patternVariables = getPatternVariables(message.value);
  const properties = patternVariables
    .entries()
    .map(([name, type]) => {
      return ts.factory.createPropertySignature(
        [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        name,
        undefined,
        type,
      );
    })
    .toArray();
  const argumentType = ts.factory.createTypeLiteralNode(properties);
  return ts.factory.createPropertySignature(
    [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
    message.id.name,
    undefined,
    argumentType,
  );
}

function getPatternVariables(pattern: Pattern): Map<string, ts.TypeNode> {
  const placeables = pattern.elements.filter(
    (node) => node instanceof Placeable,
  );
  const variables = new Map<string, ts.TypeNode>();
  for (const placeable of placeables) {
    const expression = placeable.expression;
    // If this is a select expression, we are only interested if the select
    // value is a variable reference.
    if (
      expression instanceof SelectExpression &&
      expression.selector instanceof VariableReference
    ) {
      const { type, patterns } = getSelectExpressionOptions(expression);
      const name = expression.selector.id.name;
      // TODO: Evaluate what to do with duplicate keys
      variables.set(name, type);
      // Flatten down the child patterns into a single map
      for (const [key, value] of patterns) {
        if (!variables.has(key)) {
          variables.set(key, value);
        }
      }
    } else if (expression instanceof VariableReference) {
      const name = expression.id.name;
      const type = ts.factory.createTypeReferenceNode('FluentVariable');
      variables.set(name, type);
    }
  }
  return variables;
}

function getSelectExpressionOptions(expression: SelectExpression) {
  const options = expression.variants.map((variant) => {
    const type = ts.factory.createLiteralTypeNode(
      variant.key instanceof Identifier
        ? ts.factory.createStringLiteral(variant.key.name)
        : ts.factory.createNumericLiteral(variant.key.value),
    );
    const patterns = getPatternVariables(variant.value);
    return { type, patterns };
  });
  // Compute a literal type union for the expression
  const type = ts.factory.createUnionTypeNode(
    options.map((option) => option.type),
  );
  // Flatten down the child patterns into a single map
  const patterns = new Map<string, ts.TypeNode>();
  for (const option of options) {
    for (const [key, value] of option.patterns) {
      // TODO: Consider what to do with duplicate keys
      if (!patterns.has(key)) {
        patterns.set(key, value);
      }
    }
  }
  return { type, patterns };
}

/**
 * Create the type for the message id.
 *
 * @example
 * ```
 * export declare type MessageId = keyof MessageSet
 * ```
 */
export function createMessageIdTypeDeclaration() {
  const messageSetReference = ts.factory.createTypeReferenceNode(
    'MessageSet',
    [],
  );
  const keyType = ts.factory.createTypeOperatorNode(
    ts.SyntaxKind.KeyOfKeyword,
    messageSetReference,
  );
  return ts.factory.createTypeAliasDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    'MessageId',
    [],
    keyType,
  );
}

/**
 * Create the function declaration for the `formatMessage` function.
 *
 * @example
 * ```
 * export declare function formatMessage<K extends MessageId>(
 *  bundle: FluentBundle,
 *  id: K,
 *  args: MessageSet[K],
 *  errors?: null | Error[],
 * ): string
 * ```
 */
export function createFormatMessageFunctionDeclaration() {
  // Generate the type parameter
  const constraint = ts.factory.createTypeReferenceNode('MessageId', []);
  const typeParameter = ts.factory.createTypeParameterDeclaration(
    undefined,
    'K',
    constraint,
  );
  // Generate all the parameters
  const bundleIdentifier = ts.factory.createIdentifier('bundle');
  const bundleType = ts.factory.createTypeReferenceNode('FluentBundle', []);
  const idIdentifier = ts.factory.createIdentifier('id');
  const idType = ts.factory.createTypeReferenceNode('K', []);
  const argsIdentifier = ts.factory.createIdentifier('args');
  const argsType = ts.factory.createIndexedAccessTypeNode(
    ts.factory.createTypeReferenceNode('MessageSet', []),
    ts.factory.createTypeReferenceNode('K', []),
  );
  const errorIdentifier = ts.factory.createIdentifier('error');
  const nullLiteralType = ts.factory.createLiteralTypeNode(
    ts.factory.createNull(),
  );
  const errorConstructorType = ts.factory.createTypeReferenceNode('Error', []);
  const errorArrayType = ts.factory.createArrayTypeNode(errorConstructorType);
  const errorType = ts.factory.createUnionTypeNode([
    nullLiteralType,
    errorArrayType,
  ]);
  const bundleParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    bundleIdentifier,
    undefined,
    bundleType,
  );
  const idParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    idIdentifier,
    undefined,
    idType,
  );
  const argsParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    argsIdentifier,
    undefined,
    argsType,
  );
  const errorParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    errorIdentifier,
    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
    errorType,
  );
  // Create the function itself
  return ts.factory.createFunctionDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    undefined,
    'formatMessage',
    [typeParameter],
    [bundleParameter, idParameter, argsParameter, errorParameter],
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    undefined,
  );
}
