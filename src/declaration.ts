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

/**
 * Generate the code for the TypeScript declaration file that will be generated
 * for the .ftl file.
 */
export function generateFluentDeclaration(fluent: string): ts.SourceFile {
  const tree = parse(fluent, { withSpans: true });
  const fluentImport = createFluentTypeImport();
  const resourceDeclaration = createResourceDeclarationExport();
  const formatMessageFunctionOverloadList =
    createFormatMessageFunctionOverloadList(tree);
  return ts.factory.createSourceFile(
    [fluentImport, resourceDeclaration, ...formatMessageFunctionOverloadList],
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
export function createFormatMessageFunctionOverloadList(resource: Resource) {
  const messages = resource.body.filter((entry) => entry instanceof Message);
  const overloads: ts.FunctionDeclaration[] = [];
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
  return overloads;
}

/**
 * Create the parameter type for a single message entry.
 */
export function createFormatMessageOverload(
  name: string,
  object: Message | Attribute,
) {
  if (object.value === null) {
    return null;
  }
  const variables = new Map<string, ts.TypeNode>();
  const visitor = new ExpressionVisitor(variables);
  visitor.visit(object.value);
  // If there are no arguments, we can early return
  if (variables.size === 0) {
    return createFormatMessageFunctionDeclaration(name, null);
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
  return createFormatMessageFunctionDeclaration(name, argumentType);
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

/**
 * Create the function declaration for the `formatMessage` function.
 *
 * @example
 * ```
 * export declare function formatMessage(
 *  bundle: FluentBundle,
 *  id: <name>,
 *  args: <type>,
 *  errors?: null | Error[],
 * ): string
 * ```
 */
export function createFormatMessageFunctionDeclaration(
  name: string,
  type: ts.TypeNode | null,
): ts.FunctionDeclaration {
  // Generate all the parameters
  const bundleIdentifier = ts.factory.createIdentifier('bundle');
  const bundleType = ts.factory.createTypeReferenceNode('FluentBundle', []);
  const idIdentifier = ts.factory.createIdentifier('id');
  const idType = ts.factory.createLiteralTypeNode(
    ts.factory.createStringLiteral(name),
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
  const errorParameter = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    errorIdentifier,
    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
    errorType,
  );
  // If the type is not null, we inject the args parameter.
  const parameters = [bundleParameter, idParameter];
  if (type !== null) {
    const argsIdentifier = ts.factory.createIdentifier('args');
    const argsParameter = ts.factory.createParameterDeclaration(
      undefined,
      undefined,
      argsIdentifier,
      undefined,
      type,
    );
    parameters.push(argsParameter);
  }
  parameters.push(errorParameter);

  // Create the function itself
  return ts.factory.createFunctionDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    undefined,
    'formatMessage',
    [],
    parameters,
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    undefined,
  );
}
