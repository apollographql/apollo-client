import { newInvariantError } from "../globals/index.js";

import type {
  DirectiveNode,
  FieldNode,
  IntValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  ObjectValueNode,
  ListValueNode,
  EnumValueNode,
  NullValueNode,
  VariableNode,
  InlineFragmentNode,
  ValueNode,
  SelectionNode,
  NameNode,
  SelectionSetNode,
  DocumentNode,
  FragmentSpreadNode,
} from "graphql";

import { isNonNullObject } from "../common/objects.js";
import type { FragmentMap } from "./fragments.js";
import { getFragmentFromSelection } from "./fragments.js";
import { canonicalStringify } from "../common/canonicalStringify.js";

export interface Reference {
  readonly __ref: string;
}

export function makeReference(id: string): Reference {
  return { __ref: String(id) };
}

export function isReference(obj: any): obj is Reference {
  return Boolean(
    obj && typeof obj === "object" && typeof obj.__ref === "string"
  );
}

export type StoreValue =
  | number
  | string
  | string[]
  | Reference
  | Reference[]
  | null
  | undefined
  | void
  | Object;

export interface StoreObject {
  __typename?: string;
  [storeFieldName: string]: StoreValue;
}

/**
 * Workaround for a TypeScript quirk:
 * types per default have an implicit index signature that makes them
 * assignable to `StoreObject`.
 * interfaces do not have that implicit index signature, so they cannot
 * be assigned to `StoreObject`.
 * This type just maps over a type or interface that is passed in,
 * implicitly adding the index signature.
 * That way, the result can be assigned to `StoreObject`.
 *
 * This is important if some user-defined interface is used e.g.
 * in cache.modify, where the `toReference` method expects a
 * `StoreObject` as input.
 */
export type AsStoreObject<T extends { __typename?: string }> = {
  [K in keyof T]: T[K];
};

export function isDocumentNode(value: any): value is DocumentNode {
  return (
    isNonNullObject(value) &&
    (value as DocumentNode).kind === "Document" &&
    Array.isArray((value as DocumentNode).definitions)
  );
}

function isStringValue(value: ValueNode): value is StringValueNode {
  return value.kind === "StringValue";
}

function isBooleanValue(value: ValueNode): value is BooleanValueNode {
  return value.kind === "BooleanValue";
}

function isIntValue(value: ValueNode): value is IntValueNode {
  return value.kind === "IntValue";
}

function isFloatValue(value: ValueNode): value is FloatValueNode {
  return value.kind === "FloatValue";
}

function isVariable(value: ValueNode): value is VariableNode {
  return value.kind === "Variable";
}

function isObjectValue(value: ValueNode): value is ObjectValueNode {
  return value.kind === "ObjectValue";
}

function isListValue(value: ValueNode): value is ListValueNode {
  return value.kind === "ListValue";
}

function isEnumValue(value: ValueNode): value is EnumValueNode {
  return value.kind === "EnumValue";
}

function isNullValue(value: ValueNode): value is NullValueNode {
  return value.kind === "NullValue";
}

export function valueToObjectRepresentation(
  argObj: any,
  name: NameNode,
  value: ValueNode,
  variables?: Object
) {
  if (isIntValue(value) || isFloatValue(value)) {
    argObj[name.value] = Number(value.value);
  } else if (isBooleanValue(value) || isStringValue(value)) {
    argObj[name.value] = value.value;
  } else if (isObjectValue(value)) {
    const nestedArgObj = {};
    value.fields.map((obj) =>
      valueToObjectRepresentation(nestedArgObj, obj.name, obj.value, variables)
    );
    argObj[name.value] = nestedArgObj;
  } else if (isVariable(value)) {
    const variableValue = (variables || ({} as any))[value.name.value];
    argObj[name.value] = variableValue;
  } else if (isListValue(value)) {
    argObj[name.value] = value.values.map((listValue) => {
      const nestedArgArrayObj = {};
      valueToObjectRepresentation(
        nestedArgArrayObj,
        name,
        listValue,
        variables
      );
      return (nestedArgArrayObj as any)[name.value];
    });
  } else if (isEnumValue(value)) {
    argObj[name.value] = (value as EnumValueNode).value;
  } else if (isNullValue(value)) {
    argObj[name.value] = null;
  } else {
    throw newInvariantError(
      `The inline argument "%s" of kind "%s"` +
        "is not supported. Use variables instead of inline arguments to " +
        "overcome this limitation.",
      name.value,
      (value as any).kind
    );
  }
}

export function storeKeyNameFromField(
  field: FieldNode,
  variables?: Object
): string {
  let directivesObj: any = null;
  if (field.directives) {
    directivesObj = {};
    field.directives.forEach((directive) => {
      directivesObj[directive.name.value] = {};

      if (directive.arguments) {
        directive.arguments.forEach(({ name, value }) =>
          valueToObjectRepresentation(
            directivesObj[directive.name.value],
            name,
            value,
            variables
          )
        );
      }
    });
  }

  let argObj: any = null;
  if (field.arguments && field.arguments.length) {
    argObj = {};
    field.arguments.forEach(({ name, value }) =>
      valueToObjectRepresentation(argObj, name, value, variables)
    );
  }

  return getStoreKeyName(field.name.value, argObj, directivesObj);
}

export type Directives = {
  [directiveName: string]: {
    [argName: string]: any;
  };
};

const KNOWN_DIRECTIVES: string[] = [
  "connection",
  "include",
  "skip",
  "client",
  "rest",
  "export",
  "nonreactive",
];

// Default stable JSON.stringify implementation used by getStoreKeyName. Can be
// updated/replaced with something better by calling
// getStoreKeyName.setStringify(newStringifyFunction).
let storeKeyNameStringify: (value: any) => string = canonicalStringify;

export const getStoreKeyName = Object.assign(
  function (
    fieldName: string,
    args?: Record<string, any> | null,
    directives?: Directives
  ): string {
    if (
      args &&
      directives &&
      directives["connection"] &&
      directives["connection"]["key"]
    ) {
      if (
        directives["connection"]["filter"] &&
        (directives["connection"]["filter"] as string[]).length > 0
      ) {
        const filterKeys =
          directives["connection"]["filter"] ?
            (directives["connection"]["filter"] as string[])
          : [];
        filterKeys.sort();

        const filteredArgs = {} as { [key: string]: any };
        filterKeys.forEach((key) => {
          filteredArgs[key] = args[key];
        });

        return `${directives["connection"]["key"]}(${storeKeyNameStringify(
          filteredArgs
        )})`;
      } else {
        return directives["connection"]["key"];
      }
    }

    let completeFieldName: string = fieldName;

    if (args) {
      // We can't use `JSON.stringify` here since it's non-deterministic,
      // and can lead to different store key names being created even though
      // the `args` object used during creation has the same properties/values.
      const stringifiedArgs: string = storeKeyNameStringify(args);
      completeFieldName += `(${stringifiedArgs})`;
    }

    if (directives) {
      Object.keys(directives).forEach((key) => {
        if (KNOWN_DIRECTIVES.indexOf(key) !== -1) return;
        if (directives[key] && Object.keys(directives[key]).length) {
          completeFieldName += `@${key}(${storeKeyNameStringify(
            directives[key]
          )})`;
        } else {
          completeFieldName += `@${key}`;
        }
      });
    }

    return completeFieldName;
  },
  {
    setStringify(s: typeof storeKeyNameStringify) {
      const previous = storeKeyNameStringify;
      storeKeyNameStringify = s;
      return previous;
    },
  }
);

export function argumentsObjectFromField(
  field: FieldNode | DirectiveNode,
  variables?: Record<string, any>
): Object | null {
  if (field.arguments && field.arguments.length) {
    const argObj: Object = {};
    field.arguments.forEach(({ name, value }) =>
      valueToObjectRepresentation(argObj, name, value, variables)
    );
    return argObj;
  }
  return null;
}

export function resultKeyNameFromField(field: FieldNode): string {
  return field.alias ? field.alias.value : field.name.value;
}

export function getTypenameFromResult(
  result: Record<string, any>,
  selectionSet: SelectionSetNode,
  fragmentMap?: FragmentMap
): string | undefined {
  let fragments: undefined | Array<InlineFragmentNode | FragmentSpreadNode>;
  for (const selection of selectionSet.selections) {
    if (isField(selection)) {
      if (selection.name.value === "__typename") {
        return result[resultKeyNameFromField(selection)];
      }
    } else if (fragments) {
      fragments.push(selection);
    } else {
      fragments = [selection];
    }
  }
  if (typeof result.__typename === "string") {
    return result.__typename;
  }
  if (fragments) {
    for (const selection of fragments) {
      const typename = getTypenameFromResult(
        result,
        getFragmentFromSelection(selection, fragmentMap)!.selectionSet,
        fragmentMap
      );
      if (typeof typename === "string") {
        return typename;
      }
    }
  }
}

export function isField(selection: SelectionNode): selection is FieldNode {
  return selection.kind === "Field";
}

export function isInlineFragment(
  selection: SelectionNode
): selection is InlineFragmentNode {
  return selection.kind === "InlineFragment";
}

export type VariableValue = (node: VariableNode) => any;
