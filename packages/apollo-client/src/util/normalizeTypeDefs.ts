import { DocumentNode, print } from 'graphql';

export function normalizeTypeDefs(
  typeDefs: string | string[] | DocumentNode | DocumentNode[],
) {
  const defs = Array.isArray(typeDefs) ? typeDefs : [typeDefs];

  return defs
    .map(typeDef => (typeof typeDef === 'string' ? typeDef : print(typeDef)))
    .map(str => str.trim())
    .join('\n');
}
