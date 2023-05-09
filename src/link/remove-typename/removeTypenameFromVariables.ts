import { Trie } from '@wry/trie';
import { wrap } from 'optimism';
import { DocumentNode, Kind, TypeNode, visit } from 'graphql';
import { ApolloLink } from '../core';
import { canUseWeakMap, isPlainObject, stripTypename } from '../../utilities';

interface PathConfig {
  [key: string]: PathConfig | (string | PathConfig)[];
}

interface RemoveTypenameOptions {
  excludeScalars?: string[];
  excludeScalarPaths?: PathConfig;
}

export function removeTypenameFromVariables(
  options: RemoveTypenameOptions = Object.create(null)
) {
  const { excludeScalars, excludeScalarPaths } = options;

  const trie = new Trie<typeof stripTypename.BREAK>(
    canUseWeakMap,
    () => stripTypename.BREAK
  );

  function collectPaths(
    typename: string,
    pathConfig: PathConfig[string],
    path: string[] = [],
    paths: string[][] = []
  ) {
    if (Array.isArray(pathConfig)) {
      pathConfig.forEach((item) => {
        if (typeof item === 'string') {
          return paths.push([typename, ...path, item]);
        } else if (isPlainObject(item)) {
          collectPaths(typename, item, path, paths);
        }
      });
    } else if (isPlainObject(pathConfig)) {
      Object.keys(pathConfig).forEach((key) => {
        collectPaths(typename, pathConfig[key], path.concat(key), paths);
      });
    }

    return paths;
  }

  if (excludeScalarPaths) {
    Object.keys(excludeScalarPaths).forEach((typename) => {
      const paths = collectPaths(typename, excludeScalarPaths[typename]);

      paths.forEach((path) => {
        trie.lookupArray(path);
      });
    });
  }

  return new ApolloLink((operation, forward) => {
    const { query, variables } = operation;

    if (!variables) {
      return forward(operation);
    }

    if (!excludeScalars && !excludeScalarPaths) {
      return forward({ ...operation, variables: stripTypename(variables) });
    }

    const variableDefinitions = getVariableDefinitions(query);

    return forward({
      ...operation,
      variables: stripTypename(variables, {
        keep: (path) => {
          const typename = variableDefinitions[path[0]];

          if (excludeScalars?.includes(typename)) {
            return stripTypename.BREAK;
          }

          const keysOnly = path.filter(
            (segment) => typeof segment === 'string'
          );

          return trie.peekArray([typename, ...keysOnly.slice(1)]);
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
