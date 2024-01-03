import type {
  ASTNode,
  ASTVisitor,
  ASTVisitorKeyMap,
  SelectionNode,
} from "graphql";
import type { Maybe } from "graphql/jsutils/Maybe";
import type { ASTReducer, ASTVisitFn } from "graphql/language/visitor";

/**
 * @internal
 */
export const QueryDocumentKeys: {
  [NodeT in ASTNode as NodeT["kind"]]: ReadonlyArray<keyof NodeT>;
} = {
  Name: [],

  Document: ["definitions"],
  OperationDefinition: [
    "name",
    "variableDefinitions",
    "directives",
    "selectionSet",
  ],
  VariableDefinition: ["variable", "type", "defaultValue", "directives"],
  Variable: ["name"],
  SelectionSet: ["selections"],
  Field: ["alias", "name", "arguments", "directives", "selectionSet"],
  Argument: ["name", "value"],

  FragmentSpread: ["name", "directives"],
  InlineFragment: ["typeCondition", "directives", "selectionSet"],
  FragmentDefinition: [
    "name",
    // Note: fragment variable definitions are deprecated and will removed in v17.0.0
    "variableDefinitions",
    "typeCondition",
    "directives",
    "selectionSet",
  ],

  IntValue: [],
  FloatValue: [],
  StringValue: [],
  BooleanValue: [],
  NullValue: [],
  EnumValue: [],
  ListValue: ["values"],
  ObjectValue: ["fields"],
  ObjectField: ["name", "value"],

  Directive: ["name", "arguments"],

  NamedType: ["name"],
  ListType: ["type"],
  NonNullType: ["type"],

  SchemaDefinition: ["description", "directives", "operationTypes"],
  OperationTypeDefinition: ["type"],

  ScalarTypeDefinition: ["description", "name", "directives"],
  ObjectTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields",
  ],
  FieldDefinition: ["description", "name", "arguments", "type", "directives"],
  InputValueDefinition: [
    "description",
    "name",
    "type",
    "defaultValue",
    "directives",
  ],
  InterfaceTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields",
  ],
  UnionTypeDefinition: ["description", "name", "directives", "types"],
  EnumTypeDefinition: ["description", "name", "directives", "values"],
  EnumValueDefinition: ["description", "name", "directives"],
  InputObjectTypeDefinition: ["description", "name", "directives", "fields"],

  DirectiveDefinition: ["description", "name", "arguments", "locations"],

  SchemaExtension: ["directives", "operationTypes"],

  ScalarTypeExtension: ["name", "directives"],
  ObjectTypeExtension: ["name", "interfaces", "directives", "fields"],
  InterfaceTypeExtension: ["name", "interfaces", "directives", "fields"],
  UnionTypeExtension: ["name", "directives", "types"],
  EnumTypeExtension: ["name", "directives", "values"],
  InputObjectTypeExtension: ["name", "directives", "fields"],
};

interface EnterLeaveVisitor<TVisitedNode extends ASTNode> {
  readonly enter?: ASTVisitFn<TVisitedNode>;
  readonly leave?: ASTVisitFn<TVisitedNode>;
}

export function visit<N extends ASTNode>(
  root: N,
  visitor: ASTVisitor,
  visitorKeys?: ASTVisitorKeyMap
): N;
export function visit<R>(
  root: ASTNode,
  visitor: ASTReducer<R>,
  visitorKeys?: ASTVisitorKeyMap
): R;
export function visit(
  root: ASTNode,
  visitor: ASTVisitor | ASTReducer<any>,
  visitorKeys: ASTVisitorKeyMap = QueryDocumentKeys
): any {
  const enterLeaveMap = new Map<Kind, EnterLeaveVisitor<ASTNode>>();
  for (const kind of Object.values(Kind)) {
    enterLeaveMap.set(kind, getEnterLeaveForKind(visitor, kind));
  }

  /* eslint-disable no-undef-init */
  let stack: any = undefined;
  let inArray = Array.isArray(root);
  let keys: any = [root];
  let index = -1;
  let edits = [];
  let node: any = root;
  let key: any = undefined;
  let parent: any = undefined;
  const path: any = [];
  const ancestors = [];
  /* eslint-enable no-undef-init */

  do {
    index++;
    const isLeaving = index === keys.length;
    const isEdited = isLeaving && edits.length !== 0;
    if (isLeaving) {
      key = ancestors.length === 0 ? undefined : path[path.length - 1];
      node = parent;
      parent = ancestors.pop();
      if (isEdited) {
        if (inArray) {
          node = node.slice();

          let editOffset = 0;
          for (const [editKey, editValue] of edits) {
            const arrayKey = editKey - editOffset;
            if (editValue === null) {
              node.splice(arrayKey, 1);
              editOffset++;
            } else {
              node[arrayKey] = editValue;
            }
          }
        } else {
          node = Object.defineProperties(
            {},
            Object.getOwnPropertyDescriptors(node)
          );
          for (const [editKey, editValue] of edits) {
            node[editKey] = editValue;
          }
        }
      }
      index = stack.index;
      keys = stack.keys;
      edits = stack.edits;
      inArray = stack.inArray;
      stack = stack.prev;
    } else if (parent) {
      key = inArray ? index : keys[index];
      node = parent[key];
      if (node === null || node === undefined) {
        continue;
      }
      path.push(key);
    }

    let result;
    if (!Array.isArray(node)) {
      // devAssert(isNode(node), `Invalid AST Node: ${inspect(node)}.`);

      const visitFn =
        isLeaving ?
          enterLeaveMap.get(node.kind)?.leave
        : enterLeaveMap.get(node.kind)?.enter;

      result = visitFn?.call(visitor, node, key, parent, path, ancestors);

      if (result === BREAK) {
        break;
      }

      if (result === false) {
        if (!isLeaving) {
          path.pop();
          continue;
        }
      } else if (result !== undefined) {
        edits.push([key, result]);
        if (!isLeaving) {
          if (isNode(result)) {
            node = result;
          } else {
            path.pop();
            continue;
          }
        }
      }
    }

    if (result === undefined && isEdited) {
      edits.push([key, node]);
    }

    if (isLeaving) {
      path.pop();
    } else {
      stack = { inArray, index, keys, edits, prev: stack };
      inArray = Array.isArray(node);
      keys = inArray ? node : (visitorKeys as any)[node.kind] ?? [];
      index = -1;
      edits = [];
      if (parent) {
        ancestors.push(parent);
      }
      parent = node;
    }
  } while (stack !== undefined);

  if (edits.length !== 0) {
    // New root
    return edits[edits.length - 1][1];
  }

  return root;
}

/**
 * Given a visitor instance and a node kind, return EnterLeaveVisitor for that kind.
 */
export function getEnterLeaveForKind(
  visitor: ASTVisitor,
  kind: Kind
): EnterLeaveVisitor<ASTNode> {
  const kindVisitor:
    | ASTVisitFn<ASTNode>
    | EnterLeaveVisitor<ASTNode>
    | undefined = (visitor as any)[kind];

  if (typeof kindVisitor === "object") {
    // { Kind: { enter() {}, leave() {} } }
    return kindVisitor;
  } else if (typeof kindVisitor === "function") {
    // { Kind() {} }
    return { enter: kindVisitor, leave: undefined };
  }

  // { enter() {}, leave() {} }
  return { enter: (visitor as any).enter, leave: (visitor as any).leave };
}

const kindValues = new Set<string>(Object.keys(QueryDocumentKeys));
/**
 * @internal
 */
function isNode(maybeNode: any): maybeNode is ASTNode {
  const maybeKind = maybeNode?.kind;
  return typeof maybeKind === "string" && kindValues.has(maybeKind);
}

export const BREAK: unknown = Object.freeze({});

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */
export function print(ast: ASTNode): string {
  return visit(ast, printDocASTReducer);
}

const MAX_LINE_LENGTH = 80;

const printDocASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Variable: { leave: (node) => "$" + node.name },

  // Document

  Document: {
    leave: (node) => join(node.definitions, "\n\n"),
  },

  OperationDefinition: {
    leave(node) {
      const varDefs = wrap("(", join(node.variableDefinitions, ", "), ")");
      const prefix = join(
        [
          node.operation,
          join([node.name, varDefs]),
          join(node.directives, " "),
        ],
        " "
      );

      // Anonymous queries with no directives or variable definitions can use
      // the query short form.
      return (prefix === "query" ? "" : prefix + " ") + node.selectionSet;
    },
  },

  VariableDefinition: {
    leave: ({ variable, type, defaultValue, directives }) =>
      variable +
      ": " +
      type +
      wrap(" = ", defaultValue) +
      wrap(" ", join(directives, " ")),
  },
  SelectionSet: { leave: ({ selections }) => block(selections) },

  Field: {
    leave({ alias, name, arguments: args, directives, selectionSet }) {
      const prefix = wrap("", alias, ": ") + name;
      let argsLine = prefix + wrap("(", join(args, ", "), ")");

      if (argsLine.length > MAX_LINE_LENGTH) {
        argsLine = prefix + wrap("(\n", indent(join(args, "\n")), "\n)");
      }

      return join([argsLine, join(directives, " "), selectionSet], " ");
    },
  },

  Argument: { leave: ({ name, value }) => name + ": " + value },

  // Fragments

  FragmentSpread: {
    leave: ({ name, directives }) =>
      "..." + name + wrap(" ", join(directives, " ")),
  },

  InlineFragment: {
    leave: ({ typeCondition, directives, selectionSet }) =>
      join(
        [
          "...",
          wrap("on ", typeCondition),
          join(directives, " "),
          selectionSet,
        ],
        " "
      ),
  },

  FragmentDefinition: {
    leave: ({
      name,
      typeCondition,
      variableDefinitions,
      directives,
      selectionSet,
    }) =>
      // Note: fragment variable definitions are experimental and may be changed
      // or removed in the future.
      `fragment ${name}${wrap("(", join(variableDefinitions, ", "), ")")} ` +
      `on ${typeCondition} ${wrap("", join(directives, " "), " ")}` +
      selectionSet,
  },

  // Value

  IntValue: { leave: ({ value }) => value },
  FloatValue: { leave: ({ value }) => value },
  StringValue: {
    leave: ({ value, block: isBlockString }) =>
      isBlockString ? printBlockString(value) : printString(value),
  },
  BooleanValue: { leave: ({ value }) => (value ? "true" : "false") },
  NullValue: { leave: () => "null" },
  EnumValue: { leave: ({ value }) => value },
  ListValue: { leave: ({ values }) => "[" + join(values, ", ") + "]" },
  ObjectValue: { leave: ({ fields }) => "{" + join(fields, ", ") + "}" },
  ObjectField: { leave: ({ name, value }) => name + ": " + value },

  // Directive

  Directive: {
    leave: ({ name, arguments: args }) =>
      "@" + name + wrap("(", join(args, ", "), ")"),
  },

  // Type

  NamedType: { leave: ({ name }) => name },
  ListType: { leave: ({ type }) => "[" + type + "]" },
  NonNullType: { leave: ({ type }) => type + "!" },

  // Type System Definitions

  SchemaDefinition: {
    leave: ({ description, directives, operationTypes }) =>
      wrap("", description, "\n") +
      join(["schema", join(directives, " "), block(operationTypes)], " "),
  },

  OperationTypeDefinition: {
    leave: ({ operation, type }) => operation + ": " + type,
  },

  ScalarTypeDefinition: {
    leave: ({ description, name, directives }) =>
      wrap("", description, "\n") +
      join(["scalar", name, join(directives, " ")], " "),
  },

  ObjectTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) =>
      wrap("", description, "\n") +
      join(
        [
          "type",
          name,
          wrap("implements ", join(interfaces, " & ")),
          join(directives, " "),
          block(fields),
        ],
        " "
      ),
  },

  FieldDefinition: {
    leave: ({ description, name, arguments: args, type, directives }) =>
      wrap("", description, "\n") +
      name +
      (hasMultilineItems(args) ?
        wrap("(\n", indent(join(args, "\n")), "\n)")
      : wrap("(", join(args, ", "), ")")) +
      ": " +
      type +
      wrap(" ", join(directives, " ")),
  },

  InputValueDefinition: {
    leave: ({ description, name, type, defaultValue, directives }) =>
      wrap("", description, "\n") +
      join(
        [name + ": " + type, wrap("= ", defaultValue), join(directives, " ")],
        " "
      ),
  },

  InterfaceTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) =>
      wrap("", description, "\n") +
      join(
        [
          "interface",
          name,
          wrap("implements ", join(interfaces, " & ")),
          join(directives, " "),
          block(fields),
        ],
        " "
      ),
  },

  UnionTypeDefinition: {
    leave: ({ description, name, directives, types }) =>
      wrap("", description, "\n") +
      join(
        ["union", name, join(directives, " "), wrap("= ", join(types, " | "))],
        " "
      ),
  },

  EnumTypeDefinition: {
    leave: ({ description, name, directives, values }) =>
      wrap("", description, "\n") +
      join(["enum", name, join(directives, " "), block(values)], " "),
  },

  EnumValueDefinition: {
    leave: ({ description, name, directives }) =>
      wrap("", description, "\n") + join([name, join(directives, " ")], " "),
  },

  InputObjectTypeDefinition: {
    leave: ({ description, name, directives, fields }) =>
      wrap("", description, "\n") +
      join(["input", name, join(directives, " "), block(fields)], " "),
  },

  DirectiveDefinition: {
    leave: ({ description, name, arguments: args, repeatable, locations }) =>
      wrap("", description, "\n") +
      "directive @" +
      name +
      (hasMultilineItems(args) ?
        wrap("(\n", indent(join(args, "\n")), "\n)")
      : wrap("(", join(args, ", "), ")")) +
      (repeatable ? " repeatable" : "") +
      " on " +
      join(locations, " | "),
  },

  SchemaExtension: {
    leave: ({ directives, operationTypes }) =>
      join(
        ["extend schema", join(directives, " "), block(operationTypes)],
        " "
      ),
  },

  ScalarTypeExtension: {
    leave: ({ name, directives }) =>
      join(["extend scalar", name, join(directives, " ")], " "),
  },

  ObjectTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) =>
      join(
        [
          "extend type",
          name,
          wrap("implements ", join(interfaces, " & ")),
          join(directives, " "),
          block(fields),
        ],
        " "
      ),
  },

  InterfaceTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) =>
      join(
        [
          "extend interface",
          name,
          wrap("implements ", join(interfaces, " & ")),
          join(directives, " "),
          block(fields),
        ],
        " "
      ),
  },

  UnionTypeExtension: {
    leave: ({ name, directives, types }) =>
      join(
        [
          "extend union",
          name,
          join(directives, " "),
          wrap("= ", join(types, " | ")),
        ],
        " "
      ),
  },

  EnumTypeExtension: {
    leave: ({ name, directives, values }) =>
      join(["extend enum", name, join(directives, " "), block(values)], " "),
  },

  InputObjectTypeExtension: {
    leave: ({ name, directives, fields }) =>
      join(["extend input", name, join(directives, " "), block(fields)], " "),
  },
};

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
function join(
  maybeArray: Maybe<ReadonlyArray<string | undefined>>,
  separator = ""
): string {
  return maybeArray?.filter((x) => x).join(separator) ?? "";
}

/**
 * Given array, print each item on its own line, wrapped in an indented `{ }` block.
 */
function block(array: Maybe<ReadonlyArray<string | undefined>>): string {
  return wrap("{\n", indent(join(array, "\n")), "\n}");
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
 */
function wrap(
  start: string,
  maybeString: Maybe<string>,
  end: string = ""
): string {
  return maybeString != null && maybeString !== "" ?
      start + maybeString + end
    : "";
}

function indent(str: string): string {
  return wrap("  ", str.replace(/\n/g, "\n  "));
}

function hasMultilineItems(maybeArray: Maybe<ReadonlyArray<string>>): boolean {
  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  /* c8 ignore next */
  return maybeArray?.some((str) => str.includes("\n")) ?? false;
}

/**
 * Print a block string in the indented block form by adding a leading and
 * trailing blank line. However, if a block string starts with whitespace and is
 * a single-line, adding a leading blank line would strip that whitespace.
 *
 * @internal
 */
export function printBlockString(
  value: string,
  options?: { minimize?: boolean }
): string {
  const escapedValue = value.replace(/"""/g, '\\"""');

  // Expand a block string's raw value into independent lines.
  const lines = escapedValue.split(/\r\n|[\n\r]/g);
  const isSingleLine = lines.length === 1;

  // If common indentation is found we can fix some of those cases by adding leading new line
  const forceLeadingNewLine =
    lines.length > 1 &&
    lines
      .slice(1)
      .every((line) => line.length === 0 || isWhiteSpace(line.charCodeAt(0)));

  // Trailing triple quotes just looks confusing but doesn't force trailing new line
  const hasTrailingTripleQuotes = escapedValue.endsWith('\\"""');

  // Trailing quote (single or double) or slash forces trailing new line
  const hasTrailingQuote = value.endsWith('"') && !hasTrailingTripleQuotes;
  const hasTrailingSlash = value.endsWith("\\");
  const forceTrailingNewline = hasTrailingQuote || hasTrailingSlash;

  const printAsMultipleLines =
    !options?.minimize &&
    // add leading and trailing new lines only if it improves readability
    (!isSingleLine ||
      value.length > 70 ||
      forceTrailingNewline ||
      forceLeadingNewLine ||
      hasTrailingTripleQuotes);

  let result = "";

  // Format a multi-line block quote to account for leading space.
  const skipLeadingNewLine = isSingleLine && isWhiteSpace(value.charCodeAt(0));
  if ((printAsMultipleLines && !skipLeadingNewLine) || forceLeadingNewLine) {
    result += "\n";
  }

  result += escapedValue;
  if (printAsMultipleLines || forceTrailingNewline) {
    result += "\n";
  }

  return '"""' + result + '"""';
}

/**
 * ```
 * WhiteSpace ::
 *   - "Horizontal Tab (U+0009)"
 *   - "Space (U+0020)"
 * ```
 * @internal
 */
export function isWhiteSpace(code: number): boolean {
  return code === 0x0009 || code === 0x0020;
}

/**
 * Prints a string as a GraphQL StringValue literal. Replaces control characters
 * and excluded characters (" U+0022 and \\ U+005C) with escape sequences.
 */
export function printString(str: string): string {
  return `"${str.replace(escapedRegExp, escapedReplacer)}"`;
}

// eslint-disable-next-line no-control-regex
const escapedRegExp = /[\x00-\x1f\x22\x5c\x7f-\x9f]/g;

function escapedReplacer(str: string): string {
  return escapeSequences[str.charCodeAt(0)];
}

// prettier-ignore
const escapeSequences = [
  '\\u0000', '\\u0001', '\\u0002', '\\u0003', '\\u0004', '\\u0005', '\\u0006', '\\u0007',
  '\\b',     '\\t',     '\\n',     '\\u000B', '\\f',     '\\r',     '\\u000E', '\\u000F',
  '\\u0010', '\\u0011', '\\u0012', '\\u0013', '\\u0014', '\\u0015', '\\u0016', '\\u0017',
  '\\u0018', '\\u0019', '\\u001A', '\\u001B', '\\u001C', '\\u001D', '\\u001E', '\\u001F',
  '',        '',        '\\"',     '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '', // 2F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '', // 3F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '', // 4F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '\\\\',    '',        '',        '', // 5F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '', // 6F
  '',        '',        '',        '',        '',        '',        '',        '',
  '',        '',        '',        '',        '',        '',        '',        '\\u007F',
  '\\u0080', '\\u0081', '\\u0082', '\\u0083', '\\u0084', '\\u0085', '\\u0086', '\\u0087',
  '\\u0088', '\\u0089', '\\u008A', '\\u008B', '\\u008C', '\\u008D', '\\u008E', '\\u008F',
  '\\u0090', '\\u0091', '\\u0092', '\\u0093', '\\u0094', '\\u0095', '\\u0096', '\\u0097',
  '\\u0098', '\\u0099', '\\u009A', '\\u009B', '\\u009C', '\\u009D', '\\u009E', '\\u009F',
];

/**
 * The set of allowed kind values for AST nodes.
 */
enum Kind {
  /** Name */
  NAME = "Name",

  /** Document */
  DOCUMENT = "Document",
  OPERATION_DEFINITION = "OperationDefinition",
  VARIABLE_DEFINITION = "VariableDefinition",
  SELECTION_SET = "SelectionSet",
  FIELD = "Field",
  ARGUMENT = "Argument",

  /** Fragments */
  FRAGMENT_SPREAD = "FragmentSpread",
  INLINE_FRAGMENT = "InlineFragment",
  FRAGMENT_DEFINITION = "FragmentDefinition",

  /** Values */
  VARIABLE = "Variable",
  INT = "IntValue",
  FLOAT = "FloatValue",
  STRING = "StringValue",
  BOOLEAN = "BooleanValue",
  NULL = "NullValue",
  ENUM = "EnumValue",
  LIST = "ListValue",
  OBJECT = "ObjectValue",
  OBJECT_FIELD = "ObjectField",

  /** Directives */
  DIRECTIVE = "Directive",

  /** Types */
  NAMED_TYPE = "NamedType",
  LIST_TYPE = "ListType",
  NON_NULL_TYPE = "NonNullType",

  /** Type System Definitions */
  SCHEMA_DEFINITION = "SchemaDefinition",
  OPERATION_TYPE_DEFINITION = "OperationTypeDefinition",

  /** Type Definitions */
  SCALAR_TYPE_DEFINITION = "ScalarTypeDefinition",
  OBJECT_TYPE_DEFINITION = "ObjectTypeDefinition",
  FIELD_DEFINITION = "FieldDefinition",
  INPUT_VALUE_DEFINITION = "InputValueDefinition",
  INTERFACE_TYPE_DEFINITION = "InterfaceTypeDefinition",
  UNION_TYPE_DEFINITION = "UnionTypeDefinition",
  ENUM_TYPE_DEFINITION = "EnumTypeDefinition",
  ENUM_VALUE_DEFINITION = "EnumValueDefinition",
  INPUT_OBJECT_TYPE_DEFINITION = "InputObjectTypeDefinition",

  /** Directive Definitions */
  DIRECTIVE_DEFINITION = "DirectiveDefinition",

  /** Type System Extensions */
  SCHEMA_EXTENSION = "SchemaExtension",

  /** Type Extensions */
  SCALAR_TYPE_EXTENSION = "ScalarTypeExtension",
  OBJECT_TYPE_EXTENSION = "ObjectTypeExtension",
  INTERFACE_TYPE_EXTENSION = "InterfaceTypeExtension",
  UNION_TYPE_EXTENSION = "UnionTypeExtension",
  ENUM_TYPE_EXTENSION = "EnumTypeExtension",
  INPUT_OBJECT_TYPE_EXTENSION = "InputObjectTypeExtension",
}
export { Kind };

export function isSelectionNode(node: ASTNode): node is SelectionNode {
  return (
    node.kind === Kind.FIELD ||
    node.kind === Kind.FRAGMENT_SPREAD ||
    node.kind === Kind.INLINE_FRAGMENT
  );
}
