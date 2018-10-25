import { DocumentNode, DirectiveNode } from 'graphql';
import { checkDocument, removeDirectivesFromDocument } from 'apollo-utilities';

export function removeClientSetsFromDocument(
  query: DocumentNode,
): DocumentNode | null {
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

  return docClone;
}
