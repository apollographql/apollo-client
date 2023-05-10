import { Trie } from '@wry/trie';
import { wrap } from 'optimism';
import { DocumentNode, Kind, TypeNode, visit } from 'graphql';
import { ApolloLink } from '../core';
import { canUseWeakMap, stripTypename } from '../../utilities';

interface ScalarPathConfig {
  [key: string]: ScalarPathConfig | (string | ScalarPathConfig)[];
}

interface ScalarConfig {
  scalar: string;
  paths?: ScalarPathConfig;
}

interface RemoveTypenameOptions {
  excludeScalars?: (string | ScalarConfig)[];
}

export function removeTypenameFromVariables(
  options: RemoveTypenameOptions = Object.create(null)
) {
  const { excludeScalars } = options;

  const trie = new Trie<typeof stripTypename.BREAK>(
    canUseWeakMap,
    () => stripTypename.BREAK
  );

  if (excludeScalars) {
    excludeScalars.forEach((scalarConfig) => {
      const scalar =
        typeof scalarConfig === 'string' ? scalarConfig : scalarConfig.scalar;

      // Use `lookupArray` to store the path in the `trie` ahead of time. We use
      // `peekArray` when actually checking if a path is configured in the trie
      // to avoid creating additional lookup paths in the trie.
      trie.lookupArray([scalar]);

      if (typeof scalarConfig === 'object' && scalarConfig.paths) {
        Object.entries(scalarConfig.paths).forEach(([typename, config]) => {
          collectPaths(typename, config, (path) => trie.lookupArray(path));
        });
      }
    });
  }

  return new ApolloLink((operation, forward) => {
    const { query, variables } = operation;

    if (!variables) {
      return forward(operation);
    }

    if (!excludeScalars) {
      return forward({ ...operation, variables: stripTypename(variables) });
    }

    const variableDefinitions = getVariableDefinitions(query);

    return forward({
      ...operation,
      variables: stripTypename(variables, {
        keep: (variablePath) => {
          const typename = variableDefinitions[variablePath[0]];

          // The scalar path configurations do not include array indexes, so we
          // omit them when checking the `trie` for a configured path
          const withoutArrayIndexes = variablePath.filter(
            (segment) => typeof segment === 'string'
          );

          // Our scalar path configurations configure paths using the typename
          // so we need to replace the first segment in the variable path
          // with the typename instead of the top-level variable name.
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
  typename: string,
  scalarPathConfig: ScalarPathConfig[string],
  register: (path: string[]) => void,
  path: string[] = [typename]
) {
  if (Array.isArray(scalarPathConfig)) {
    return scalarPathConfig.forEach((item) => {
      if (typeof item === 'string') {
        return register([...path, item]);
      }

      collectPaths(typename, item, register, path);
    });
  }

  Object.entries(scalarPathConfig).forEach(([key, config]) => {
    collectPaths(typename, config, register, path.concat(key));
  });
}
