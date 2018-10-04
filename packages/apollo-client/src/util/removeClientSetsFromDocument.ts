import { DocumentNode, DirectiveNode } from 'graphql';
import { checkDocument, removeDirectivesFromDocument } from 'apollo-utilities';

const removed = new Map();
export function removeClientSetsFromDocument(
  query: DocumentNode,
): DocumentNode | null {
  const cached = removed.get(query);
  if (cached) return cached;

  checkDocument(query);

  const docClone = removeDirectivesFromDocument(
    [
      {
        test: (directive: DirectiveNode) => directive.name.value === 'client',
        remove: true,
      },
    ],
    query,
  );

  removed.set(query, docClone);
  return docClone;
}
