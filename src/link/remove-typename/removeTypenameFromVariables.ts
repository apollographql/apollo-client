import { wrap } from 'optimism';
import type { DocumentNode, TypeNode } from 'graphql';
import { Kind, visit } from 'graphql';
import { ApolloLink } from '../core';
import { stripTypename, isPlainObject } from '../../utilities';
import type { OperationVariables } from '../../core';

export const KEEP = '__KEEP';

interface KeepTypenameConfig {
  [key: string]: typeof KEEP | KeepTypenameConfig;
}

export interface RemoveTypenameFromVariablesOptions {
  except?: KeepTypenameConfig;
}

export function removeTypenameFromVariables(
  options: RemoveTypenameFromVariablesOptions = Object.create(null)
) {
  return new ApolloLink((operation, forward) => {
    const { except } = options;
    const { query, variables } = operation;

    if (!variables) {
      return forward(operation);
    }

    return forward({
      ...operation,
      variables: except
        ? maybeStripTypenameFromConfig(query, variables, except)
        : stripTypename(variables),
    });
  });
}

function maybeStripTypenameFromConfig(
  query: DocumentNode,
  variables: OperationVariables,
  config: KeepTypenameConfig
) {
  const variableDefinitions = getVariableDefinitions(query);

  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => {
      const typename = variableDefinitions[key];
      const typenameConfig = config[typename];

      return [
        key,
        typenameConfig
          ? maybeStripTypename(value, typenameConfig)
          : stripTypename(value),
      ];
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

    Object.entries(value).forEach(([key, value]) => {
      if (key === '__typename') {
        return;
      }

      const fieldConfig = config[key];

      modified[key] = fieldConfig
        ? maybeStripTypename(value, fieldConfig)
        : stripTypename(value);
    });

    return modified;
  }

  return value;
}

const getVariableDefinitions = wrap((document: DocumentNode) => {
  const definitions: Record<string, string> = {};

  visit(document, {
    VariableDefinition(node) {
      definitions[node.variable.name.value] = unwrapType(node.type);
    },
  });

  return definitions;
});

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
