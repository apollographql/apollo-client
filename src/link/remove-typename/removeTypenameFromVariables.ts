import { Trie } from '@wry/trie';
import { wrap } from 'optimism';
import type { DocumentNode, TypeNode } from 'graphql';
import { Kind, visit } from 'graphql';
import { ApolloLink } from '../core';
import { canUseWeakMap, stripTypename } from '../../utilities';

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
  const { except } = options;

  const trie = new Trie<typeof stripTypename.BREAK>(
    canUseWeakMap,
    () => stripTypename.BREAK
  );

  if (except) {
    // Use `lookupArray` to store the path in the `trie` ahead of time. We use
    // `peekArray` when actually checking if a path is configured in the trie
    // to avoid creating additional lookup paths in the trie.
    collectPaths(except, (path) => trie.lookupArray(path));
  }

  return new ApolloLink((operation, forward) => {
    const { query, variables } = operation;

    if (!variables) {
      return forward(operation);
    }

    if (!except) {
      return forward({ ...operation, variables: stripTypename(variables) });
    }

    const variableDefinitions = getVariableDefinitions(query);

    return forward({
      ...operation,
      variables: stripTypename(variables, {
        keep: (variablePath) => {
          const typename = variableDefinitions[variablePath[0]];

          // The path configurations do not include array indexes, so we
          // omit them when checking the `trie` for a configured path
          const withoutArrayIndexes = variablePath.filter(
            (segment) => typeof segment === 'string'
          );

          // Our path configurations use the typename as the root so we need to
          // replace the first segment in the variable path with the typename
          // instead of the top-level variable name.
          return trie.peekArray([typename, ...withoutArrayIndexes.slice(1)]);
        },
      }),
    });
  });
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

function collectPaths(
  config: KeepTypenameConfig,
  register: (path: string[]) => void,
  path: string[] = []
) {
  Object.entries(config).forEach(([key, value]) => {
    if (value === KEEP) {
      return register([...path, key]);
    }

    collectPaths(value, register, path.concat(key));
  });
}
