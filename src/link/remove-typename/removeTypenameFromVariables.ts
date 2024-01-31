import { wrap } from "optimism";
import type { DocumentNode, TypeNode } from "graphql";
import { Kind, visit } from "graphql";
import { ApolloLink } from "../core/index.js";
import {
  stripTypename,
  isPlainObject,
  cacheSizes,
  defaultCacheSizes,
} from "../../utilities/index.js";
import type { OperationVariables } from "../../core/index.js";
import { WeakCache } from "@wry/caches";

export const KEEP = "__KEEP";

interface KeepTypenameConfig {
  [key: string]: typeof KEEP | KeepTypenameConfig;
}

export interface RemoveTypenameFromVariablesOptions {
  except?: KeepTypenameConfig;
}

export function removeTypenameFromVariables(
  options: RemoveTypenameFromVariablesOptions = Object.create(null)
) {
  return Object.assign(
    new ApolloLink((operation, forward) => {
      const { except } = options;
      const { query, variables } = operation;

      if (variables) {
        operation.variables =
          except ?
            maybeStripTypenameUsingConfig(query, variables, except)
          : stripTypename(variables);
      }

      return forward(operation);
    }),
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

function maybeStripTypenameUsingConfig(
  query: DocumentNode,
  variables: OperationVariables,
  config: KeepTypenameConfig
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
  config: KeepTypenameConfig[string]
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
