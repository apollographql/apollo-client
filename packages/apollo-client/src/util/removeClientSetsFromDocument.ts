import {
  DocumentNode,
  DirectiveNode,
  ExecutableDefinitionNode,
  FieldNode,
} from 'graphql';
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

  // After a fragment definition has had its @client related document
  // sets removed, if the only field it has left is a __typename field,
  // remove the entire fragment operation to prevent it from being fired
  // on the server.
  if (docClone) {
    const nonClientDefinitions: ExecutableDefinitionNode[] = [];
    docClone.definitions.forEach((definition: ExecutableDefinitionNode) => {
      const isTypenameOnly = definition.selectionSet.selections.every(
        selection => {
          return (
            selection.kind === 'Field' &&
            (selection as FieldNode).name.value === '__typename'
          );
        },
      );
      if (!isTypenameOnly) {
        nonClientDefinitions.push(definition);
      }
    });
    docClone.definitions = nonClientDefinitions;
  }

  return docClone;
}
