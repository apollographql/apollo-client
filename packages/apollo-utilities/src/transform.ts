import {
  DocumentNode,
  SelectionSetNode,
  DefinitionNode,
  OperationDefinitionNode,
  FieldNode,
} from 'graphql';

import { cloneDeep } from './util/cloneDeep';

import { checkDocument } from './getFromAST';

const TYPENAME_FIELD: FieldNode = {
  kind: 'Field',
  name: {
    kind: 'Name',
    value: '__typename',
  },
};

function addTypenameToSelectionSet(
  selectionSet: SelectionSetNode,
  isRoot = false,
) {
  if (selectionSet.selections) {
    if (!isRoot) {
      const alreadyHasThisField = selectionSet.selections.some(selection => {
        return (
          selection.kind === 'Field' &&
          (selection as FieldNode).name.value === '__typename'
        );
      });

      if (!alreadyHasThisField) {
        selectionSet.selections.push(TYPENAME_FIELD);
      }
    }

    selectionSet.selections.forEach(selection => {
      // Must not add __typename if we're inside an introspection query
      if (selection.kind === 'Field') {
        if (
          selection.name.value.lastIndexOf('__', 0) !== 0 &&
          selection.selectionSet
        ) {
          addTypenameToSelectionSet(selection.selectionSet);
        }
      } else if (selection.kind === 'InlineFragment') {
        if (selection.selectionSet) {
          addTypenameToSelectionSet(selection.selectionSet);
        }
      }
    });
  }
}

function removeConnectionDirectiveFromSelectionSet(
  selectionSet: SelectionSetNode,
) {
  if (selectionSet.selections) {
    selectionSet.selections.forEach(selection => {
      if (
        selection.kind === 'Field' &&
        (selection as FieldNode) &&
        selection.directives
      ) {
        selection.directives = selection.directives.filter(directive => {
          const willRemove = directive.name.value === 'connection';
          if (willRemove) {
            if (
              !directive.arguments ||
              !directive.arguments.some(arg => arg.name.value === 'key')
            ) {
              console.warn(
                'Removing an @connection directive even though it does not have a key. ' +
                  'You may want to use the key parameter to specify a store key.',
              );
            }
          }

          return !willRemove;
        });
      }
    });

    selectionSet.selections.forEach(selection => {
      if (selection.kind === 'Field') {
        if (selection.selectionSet) {
          removeConnectionDirectiveFromSelectionSet(selection.selectionSet);
        }
      } else if (selection.kind === 'InlineFragment') {
        if (selection.selectionSet) {
          removeConnectionDirectiveFromSelectionSet(selection.selectionSet);
        }
      }
    });
  }
}

export function addTypenameToDocument(doc: DocumentNode) {
  checkDocument(doc);
  const docClone = cloneDeep(doc);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    const isRoot = definition.kind === 'OperationDefinition';
    addTypenameToSelectionSet(
      (definition as OperationDefinitionNode).selectionSet,
      isRoot,
    );
  });

  return docClone;
}

export function removeConnectionDirectiveFromDocument(doc: DocumentNode) {
  checkDocument(doc);
  const docClone = cloneDeep(doc);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    removeConnectionDirectiveFromSelectionSet(
      (definition as OperationDefinitionNode).selectionSet,
    );
  });

  return docClone;
}
