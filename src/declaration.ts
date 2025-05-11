import { type Message, type Resource, parse } from '@fluent/syntax';
import * as ts from 'typescript';
import { createFluentImport } from './transform.js';

/**
 * Generate the code for the TypeScript declaration file that will be generated
 * for the .ftl file.
 */
export function generateFluentDeclaration(fluent: string): ts.SourceFile {
  const tree = parse(fluent, { withSpans: true });
  const fluentImport = createFluentImport(true);
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
  const messages = resource.body.filter((entry) => entry.type === 'Message');
  const messageTypes = messages.map(createMessageType);
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
export function createMessageType(message: Message) {
  const argumentType = ts.factory.createTypeLiteralNode([]);
  return ts.factory.createPropertySignature(
    [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
    message.id.name,
    undefined,
    argumentType,
  );
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
