import {
  DocumentNode,
  SelectionSetNode,
  DefinitionNode,
  OperationDefinitionNode,
  FieldNode,
  DirectiveNode,
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

export type RemoveDirectiveConfig = {
  name?: string;
  test?: (directive: DirectiveNode) => boolean;
};

function removeDirectivesFromSelectionSet(
  directives: RemoveDirectiveConfig[],
  selectionSet: SelectionSetNode,
): SelectionSetNode {
  if (!selectionSet.selections) return selectionSet;
  selectionSet.selections.forEach(selection => {
    if (
      selection.kind !== 'Field' ||
      !(selection as FieldNode) ||
      !selection.directives
    )
      return;
    selection.directives = selection.directives.filter(
      directive =>
        !directives.some((dir: RemoveDirectiveConfig) => {
          if (dir.name && dir.name === directive.name.value) return true;
          if (dir.test && dir.test(directive)) return true;
          return false;
        }),
    );
  });

  selectionSet.selections.forEach(selection => {
    if (
      (selection.kind === 'Field' || selection.kind === 'InlineFragment') &&
      selection.selectionSet
    ) {
      removeDirectivesFromSelectionSet(directives, selection.selectionSet);
    }
  });
  return selectionSet;
}

export function removeDirectivesFromDocument(
  directives: RemoveDirectiveConfig[],
  doc: DocumentNode,
): DocumentNode {
  const docClone = cloneDeep(doc);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    removeDirectivesFromSelectionSet(
      directives,
      (definition as OperationDefinitionNode).selectionSet,
    );
  });

  return docClone;
}

const added = new Map();
export function addTypenameToDocument(doc: DocumentNode) {
  checkDocument(doc);
  const cached = added.get(doc);
  if (cached) return cached;

  const docClone = cloneDeep(doc);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    const isRoot = definition.kind === 'OperationDefinition';
    addTypenameToSelectionSet(
      (definition as OperationDefinitionNode).selectionSet,
      isRoot,
    );
  });

  added.set(doc, docClone);
  return docClone;
}

const connectionRemoveConfig = {
  test: (directive: DirectiveNode) => {
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

    return willRemove;
  },
};
const removed = new Map();
export function removeConnectionDirectiveFromDocument(doc: DocumentNode) {
  checkDocument(doc);
  const cached = removed.get(doc);
  if (cached) return cached;
  const docClone = removeDirectivesFromDocument([connectionRemoveConfig], doc);
  removed.set(doc, docClone);
  return docClone;
}
