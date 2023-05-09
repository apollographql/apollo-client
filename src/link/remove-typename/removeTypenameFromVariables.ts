import { Trie } from '@wry/trie';
import { wrap } from 'optimism';
import { DocumentNode, Kind, TypeNode, visit } from 'graphql';
import { ApolloLink } from '../core';
import { canUseWeakMap, stripTypename } from '../../utilities';

interface RemoveTypenameOptions {
  excludeScalars?: string[];
}

export function removeTypenameFromVariables(
  options: RemoveTypenameOptions = Object.create(null)
) {
  const trie = new Trie<typeof stripTypename.BREAK>(
    canUseWeakMap,
    () => stripTypename.BREAK
  );

  return new ApolloLink((operation, forward) => {
    const { query, variables } = operation;
    const { excludeScalars } = options;

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
        keep: (path) => {
          const [root] = path;
          const typename = variableDefinitions[root];

          if (excludeScalars.includes(typename)) {
            return stripTypename.BREAK;
          }

          const keysOnly = path.filter(
            (segment) => typeof segment === 'string'
          );

          return trie.peekArray(keysOnly);
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
