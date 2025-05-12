import * as fs from 'node:fs/promises';
import {
  type Attribute,
  Identifier,
  Message,
  type Resource,
  type SelectExpression,
  VariableReference,
  Visitor,
  parse,
} from '@fluent/syntax';
import * as ts from 'typescript';

const prelude = await fs.readFile(
  new URL('./runtime/prelude.d.ts', import.meta.url),
  'utf-8',
);

/**
 * Generate the code for the TypeScript declaration file that will be generated
 * for the .ftl file.
 */
export function generateFluentDeclaration(fluent: string): ts.SourceFile {
  const tree = parse(fluent, { withSpans: true });
  const inlinePrelude = createInlinePrelude();
  const resourceDeclaration = createResourceDeclarationExport();
  const resourceMessageArgsType = createResourceMessageArgsType(tree);
  const formatMessageType = createFormatMessageType();
  const formatMessageExport = createFormatMessageExport();
  return ts.factory.createSourceFile(
    [
      ...inlinePrelude,
      resourceDeclaration,
      resourceMessageArgsType,
      formatMessageType,
      formatMessageExport,
    ],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
}

export function createInlinePrelude() {
  const preludeSource = ts.createSourceFile(
    'prelude.d.ts',
    prelude,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  return preludeSource.statements;
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
export function createResourceMessageArgsType(resource: Resource) {
  const messages = resource.body.filter((entry) => entry instanceof Message);
  const overloads: ts.PropertySignature[] = [];
  for (const message of messages) {
    const messageOverload = createFormatMessageOverload(
      message.id.name,
      message,
    );
    if (messageOverload !== null) {
      overloads.push(messageOverload);
    }
    const attributeOverloads = message.attributes
      .map((attribute) => {
        const name = `${message.id.name}.${attribute.id.name}`;
        return createFormatMessageOverload(name, attribute);
      })
      .filter((overload) => overload !== null);
    overloads.push(...attributeOverloads);
  }
  const type = ts.factory.createTypeLiteralNode(overloads);
  return ts.factory.createTypeAliasDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    ts.factory.createIdentifier('ResourceMessageArgs'),
    undefined,
    type,
  );
}

/**
 * Create the parameter type for a single message entry.
 */
export function createFormatMessageOverload(
  name: string,
  object: Message | Attribute,
): ts.PropertySignature | null {
  if (object.value === null) {
    return null;
  }
  const variables = new Map<string, ts.TypeNode>();
  const visitor = new ExpressionVisitor(variables);
  visitor.visit(object.value);
  // If there are no arguments, we can early return
  if (variables.size === 0) {
    return createResourceMessageArgOverload(name, null);
  }
  // Otherwise, map out each variable to a property, and build the object
  const properties = variables
    .entries()
    .map(([name, type]) => {
      return ts.factory.createPropertySignature(
        [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        ts.factory.createStringLiteral(name),
        undefined,
        type,
      );
    })
    .toArray();
  const argumentType = ts.factory.createTypeLiteralNode(properties);
  return createResourceMessageArgOverload(name, argumentType);
}

type TypeMetadata = {
  isDiscoveredSelect: boolean;
};

class ExpressionVisitor extends Visitor {
  private readonly metadata: Map<string, TypeMetadata> = new Map();
  public constructor(private readonly variables: Map<string, ts.TypeNode>) {
    super();
  }
  visitVariableReference(node: VariableReference) {
    const type = ts.factory.createTypeReferenceNode('FluentVariable');
    const name = node.id.name;
    if (!this.variables.has(name)) {
      this.variables.set(name, type);
      this.metadata.set(name, { isDiscoveredSelect: false });
    }
  }
  visitSelectExpression(node: SelectExpression) {
    // If this value is guided by a variable, we create a union type of all the possible values
    if (node.selector instanceof VariableReference) {
      const unionMembers = node.variants.map((variant) =>
        ts.factory.createLiteralTypeNode(
          variant.key instanceof Identifier
            ? ts.factory.createStringLiteral(variant.key.name)
            : ts.factory.createNumericLiteral(variant.key.value),
        ),
      );
      const union = ts.factory.createUnionTypeNode(unionMembers);
      const name = node.selector.id.name;

      const existing = this.variables.get(name);
      const existingMetadata = this.metadata.get(name);
      if (existing === undefined && existingMetadata === undefined) {
        this.variables.set(name, union);
      } else if (existingMetadata?.isDiscoveredSelect === false) {
        // If this has been explored before, we now know that this is a select expression,
        // and we now override the type to be a union of all the possible values
        this.variables.set(name, union);
      }

      this.metadata.set(name, { isDiscoveredSelect: true });
    }

    // Traverse into the children of the select expression
    super.visit(node.selector);
    for (const variant of node.variants) {
      super.visit(variant.value);
    }
  }
}

export function createResourceMessageArgOverload(
  name: string,
  type: ts.TypeNode | null,
): ts.PropertySignature {
  // Create the function itself
  return ts.factory.createPropertySignature(
    [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
    ts.factory.createStringLiteral(name),
    undefined,
    type ?? ts.factory.createTypeReferenceNode('never'),
  );
}

/**
 * Create the FormatMessage type alias.
 *
 * @example
 * ```
 * export declare type FormatMessage = InferFormatterType<ResourceMessageArgs>;
 * ```
 */
export function createFormatMessageType() {
  const type = ts.factory.createTypeReferenceNode('InferFormatterType', [
    ts.factory.createTypeReferenceNode('ResourceMessageArgs'),
  ]);
  return ts.factory.createTypeAliasDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    ts.factory.createIdentifier('FormatMessage'),
    undefined,
    type,
  );
}

export function createFormatMessageExport() {
  const formatMessage = ts.factory.createIdentifier('formatMessage');
  const type = ts.factory.createTypeReferenceNode('FormatMessage', []);
  const variableDeclaration = ts.factory.createVariableDeclaration(
    formatMessage,
    undefined,
    type,
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
