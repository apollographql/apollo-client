import {
  DocumentNode,
  SelectionNode,
  SelectionSetNode,
  DefinitionNode,
  OperationDefinitionNode,
  FieldNode,
  DirectiveNode,
  FragmentDefinitionNode,
} from 'graphql';

import { cloneDeep } from './util/cloneDeep';

import {
  checkDocument,
  getOperationDefinitionOrDie,
  getFragmentDefinitions,
  createFragmentMap,
  FragmentMap,
} from './getFromAST';

const TYPENAME_FIELD: FieldNode = {
  kind: 'Field',
  name: {
    kind: 'Name',
    value: '__typename',
  },
};

function isNotEmpty(
  op: OperationDefinitionNode | FragmentDefinitionNode,
  fragments: FragmentMap,
): Boolean {
  // keep selections that are still valid
  return (
    op.selectionSet.selections.filter(
      selectionSet =>
        // anything that doesn't match the compound filter is okay
        !// not an empty array
        (
          selectionSet &&
          // look into fragments to verify they should stay
          selectionSet.kind === 'FragmentSpread' &&
          // see if the fragment in the map is valid (recursively)
          !isNotEmpty(fragments[selectionSet.name.value], fragments)
        ),
    ).length > 0
  );
}

function getDirectiveMatcher(
  directives: (RemoveDirectiveConfig | GetDirectiveConfig)[],
) {
  return function directiveMatcher(directive: DirectiveNode): Boolean {
    return directives.some(
      (dir: RemoveDirectiveConfig | GetDirectiveConfig) => {
        if (dir.name && dir.name === directive.name.value) return true;
        if (dir.test && dir.test(directive)) return true;
        return false;
      },
    );
  };
}

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
  remove?: boolean;
};

function removeDirectivesFromSelectionSet(
  directives: RemoveDirectiveConfig[],
  selectionSet: SelectionSetNode,
): SelectionSetNode {
  if (!selectionSet.selections) return selectionSet;
  // if any of the directives are set to remove this selectionSet, remove it
  const agressiveRemove = directives.some(
    (dir: RemoveDirectiveConfig) => dir.remove,
  );

  selectionSet.selections = selectionSet.selections
    .map(selection => {
      if (
        selection.kind !== 'Field' ||
        !(selection as FieldNode) ||
        !selection.directives
      )
        return selection;
      const directiveMatcher = getDirectiveMatcher(directives);
      let remove: boolean;
      selection.directives = selection.directives.filter(directive => {
        const shouldKeep = !directiveMatcher(directive);

        if (!remove && !shouldKeep && agressiveRemove) remove = true;

        return shouldKeep;
      });

      return remove ? null : selection;
    })
    .filter(x => !!x);

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
): DocumentNode | null {
  const docClone = cloneDeep(doc);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    removeDirectivesFromSelectionSet(
      directives,
      (definition as OperationDefinitionNode).selectionSet,
    );
  });
  const operation = getOperationDefinitionOrDie(docClone);
  const fragments = createFragmentMap(getFragmentDefinitions(docClone));
  return isNotEmpty(operation, fragments) ? docClone : null;
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

export type GetDirectiveConfig = {
  name?: string;
  test?: (directive: DirectiveNode) => boolean;
};

function hasDirectivesInSelectionSet(
  directives: GetDirectiveConfig[],
  selectionSet: SelectionSetNode,
  nestedCheck = true,
): boolean {
  if (!(selectionSet && selectionSet.selections)) {
    return false;
  }
  const matchedSelections = selectionSet.selections.filter(selection => {
    return hasDirectivesInSelection(directives, selection, nestedCheck);
  });
  return matchedSelections.length > 0;
}

function hasDirectivesInSelection(
  directives: GetDirectiveConfig[],
  selection: SelectionNode,
  nestedCheck = true,
): boolean {
  if (selection.kind !== 'Field' || !(selection as FieldNode)) {
    return true;
  }

  if (!selection.directives) {
    return false;
  }
  const directiveMatcher = getDirectiveMatcher(directives);
  const matchedDirectives = selection.directives.filter(directiveMatcher);
  return (
    matchedDirectives.length > 0 ||
    (nestedCheck &&
      hasDirectivesInSelectionSet(
        directives,
        selection.selectionSet,
        nestedCheck,
      ))
  );
}

function getDirectivesFromSelectionSet(
  directives: GetDirectiveConfig[],
  selectionSet: SelectionSetNode,
) {
  selectionSet.selections = selectionSet.selections
    .filter(selection => {
      return hasDirectivesInSelection(directives, selection, true);
    })
    .map(selection => {
      if (hasDirectivesInSelection(directives, selection, false)) {
        return selection;
      }
      if (
        (selection.kind === 'Field' || selection.kind === 'InlineFragment') &&
        selection.selectionSet
      ) {
        selection.selectionSet = getDirectivesFromSelectionSet(
          directives,
          selection.selectionSet,
        );
      }
      return selection;
    });
  return selectionSet;
}

export function getDirectivesFromDocument(
  directives: GetDirectiveConfig[],
  doc: DocumentNode,
  includeAllFragments = false,
): DocumentNode | null {
  checkDocument(doc);
  const docClone = cloneDeep(doc);
  docClone.definitions = docClone.definitions.map(definition => {
    if (
      (definition.kind === 'OperationDefinition' ||
        (definition.kind === 'FragmentDefinition' && !includeAllFragments)) &&
      definition.selectionSet
    ) {
      definition.selectionSet = getDirectivesFromSelectionSet(
        directives,
        definition.selectionSet,
      );
    }
    return definition;
  });

  const operation = getOperationDefinitionOrDie(docClone);
  const fragments = createFragmentMap(getFragmentDefinitions(docClone));
  return isNotEmpty(operation, fragments) ? docClone : null;
}
