import type {
  FieldNode,
  InlineFragmentNode,
  SelectionNode,
  VariableNode,
} from "graphql";

import { getStoreKeyName } from "@apollo/client/utilities/internal";

import { valueToObjectRepresentation } from "../internal/valueToObjectRepresentation.js";

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

export function resultKeyNameFromField(field: FieldNode): string {
  return field.alias ? field.alias.value : field.name.value;
}

export function isInlineFragment(
  selection: SelectionNode
): selection is InlineFragmentNode {
  return selection.kind === "InlineFragment";
}

export type VariableValue = (node: VariableNode) => any;
