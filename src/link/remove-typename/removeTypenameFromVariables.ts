import { WeakCache } from "@wry/caches";
import type { DocumentNode, TypeNode } from "graphql";
import { Kind, visit } from "graphql";
import { wrap } from "optimism";

import type { OperationVariables } from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import { cacheSizes, stripTypename } from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { isPlainObject } from "@apollo/client/utilities/internal";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";

export const KEEP = "__KEEP";

export declare namespace RemoveTypenameFromVariablesLink {
  export interface KeepTypenameConfig {
    [key: string]:
      | typeof KEEP
      | RemoveTypenameFromVariablesLink.KeepTypenameConfig;
  }

  export interface Options {
    except?: RemoveTypenameFromVariablesLink.KeepTypenameConfig;
  }
}

/**
 * @deprecated
 * Use `RemoveTypenameFromVariablesLink` from `@apollo/client/link/remove-typename` instead.
 */
export function removeTypenameFromVariables(
  options?: RemoveTypenameFromVariablesLink.Options
) {
  return new RemoveTypenameFromVariablesLink(options);
}

export class RemoveTypenameFromVariablesLink extends ApolloLink {
  constructor(options: RemoveTypenameFromVariablesLink.Options = {}) {
    super((operation, forward) => {
      const { except } = options;
      const { query, variables } = operation;

      if (variables) {
        operation.variables =
          except ?
            maybeStripTypenameUsingConfig(query, variables, except)
          : stripTypename(variables);
      }

      return forward(operation);
    });
    return Object.assign(
      this,
      __DEV__ ?
        {
          getMemoryInternals() {
            return {
              removeTypenameFromVariables: {
                getVariableDefinitions: getVariableDefinitions?.size ?? 0,
              },
            };
          },
        }
      : {}
    );
  }
}

function maybeStripTypenameUsingConfig(
  query: DocumentNode,
  variables: OperationVariables,
  config: RemoveTypenameFromVariablesLink.KeepTypenameConfig
) {
  const variableDefinitions = getVariableDefinitions(query);

  return Object.fromEntries(
    Object.entries(variables).map((keyVal) => {
      const [key, value] = keyVal;
      const typename = variableDefinitions[key];
      const typenameConfig = config[typename];

      keyVal[1] =
        typenameConfig ?
          maybeStripTypename(value, typenameConfig)
        : stripTypename(value);

      return keyVal;
    })
  );
}

type JSONPrimitive = string | number | null | boolean;
type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };

function maybeStripTypename(
  value: JSONValue,
  config: RemoveTypenameFromVariablesLink.KeepTypenameConfig[string]
): JSONValue {
  if (config === KEEP) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maybeStripTypename(item, config));
  }

  if (isPlainObject(value)) {
    const modified: Record<string, any> = {};

    Object.keys(value).forEach((key) => {
      const child = value[key];

      if (key === "__typename") {
        return;
      }

      const fieldConfig = config[key];

      modified[key] =
        fieldConfig ?
          maybeStripTypename(child, fieldConfig)
        : stripTypename(child);
    });

    return modified;
  }

  return value;
}

const getVariableDefinitions = wrap(
  (document: DocumentNode) => {
    const definitions: Record<string, string> = {};

    visit(document, {
      VariableDefinition(node) {
        definitions[node.variable.name.value] = unwrapType(node.type);
      },
    });

    return definitions;
  },
  {
    max:
      cacheSizes["removeTypenameFromVariables.getVariableDefinitions"] ||
      defaultCacheSizes["removeTypenameFromVariables.getVariableDefinitions"],
    cache: WeakCache,
  }
);

function unwrapType(node: TypeNode): string {
  switch (node.kind) {
    case Kind.NON_NULL_TYPE:
      return unwrapType(node.type);
    case Kind.LIST_TYPE:
      return unwrapType(node.type);
    case Kind.NAMED_TYPE:
      return node.name.value;
  }
}
