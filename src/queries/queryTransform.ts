import {
  DocumentNode,
  SelectionSetNode,
  SelectionNode,
  DefinitionNode,
  OperationDefinitionNode,
  NamedTypeNode,
  FieldNode,
  InlineFragmentNode,
} from 'graphql';

import {
  checkDocument,
} from './getFromAST';

import { cloneDeep } from '../util/cloneDeep';

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
    if (! isRoot) {
      const alreadyHasThisField = selectionSet.selections.some((selection) => {
        return selection.kind === 'Field' && (selection as FieldNode).name.value === '__typename';
      });

      if (! alreadyHasThisField) {
        selectionSet.selections.push(TYPENAME_FIELD);
      }
    }

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === 'Field' || selection.kind === 'InlineFragment') {
        if (selection.selectionSet) {
          addTypenameToSelectionSet(selection.selectionSet);
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
    addTypenameToSelectionSet((definition as OperationDefinitionNode).selectionSet, isRoot);
  });

  return docClone;
}

function createIntrospectionForFragment(fragmentName: string) {
  const field: FieldNode = {
    kind: 'Field',
    name: {
      kind: 'Name',
      value: '__type',
    },
    alias: {
      kind: 'Name',
      value: `__${fragmentName}`,
    },
    arguments: [{
      kind: 'Argument',
      name: {
        kind: 'Name',
        value: 'name',
      },
      value: {
        kind: 'StringValue',
        value: fragmentName,
      },
    }],
    selectionSet: {
      kind: 'SelectionSet',
      selections: [{
        kind: 'Field',
        name: {
          kind: 'Name',
          value: 'possibleTypes',
        },
        selectionSet: {
          kind: 'SelectionSet',
          selections: [{
            kind: 'Field',
            name: {
              kind: 'Name',
              value: 'name',
            },
          }],
        },
      }],
    },
  };

  return field;
}

function fragmentIntrospectionExists(
  selections: Array<SelectionNode>,
  typeCondition: NamedTypeNode,
) {
  return selections.some((selection) => {
    if (selection.kind === 'Field' && selection.name.value === '__type') {
      if (selection.alias && selection.alias.value === `__${typeCondition.name.value}`) {
        return true;
      }
    }

    return false;
  });
}

function addIntrospectionToSelectionSet(
  rootSelections: Array<SelectionNode>,
  currentSelectionSet: SelectionSetNode,
) {
  if (!currentSelectionSet.selections) {
    return;
  }

  currentSelectionSet.selections.forEach((currentSelection) => {
    if (currentSelection.kind === 'InlineFragment') {
      const typeCondition = (currentSelection as InlineFragmentNode).typeCondition;

      if (typeCondition && !fragmentIntrospectionExists(rootSelections, typeCondition)) {
        // We haven't seen this type condition before. Add it to our list.
        rootSelections.push(createIntrospectionForFragment(typeCondition.name.value));
      }
    }

    if ((currentSelection.kind === 'InlineFragment' || currentSelection.kind === 'Field') && currentSelection.selectionSet) {
      addIntrospectionToSelectionSet(rootSelections, currentSelection.selectionSet);
    }
  });
}

export function addIntrospectionToDocument(doc: DocumentNode) {
  checkDocument(doc);
  const docClone = cloneDeep(doc);

  // Find the operation that we want to add the introspection fields to.
  const operation = docClone.definitions.find(
    (definition) => definition.kind === 'OperationDefinition' && definition.operation === 'query',
  );

  if (!operation) {
    // Bail out early if we didn't find a query operation.
    return docClone;
  }

  // Add the introspection fields to the root selection set of the query.
  const rootSelections = (operation as OperationDefinitionNode).selectionSet.selections;
  doc.definitions.forEach((definition: DefinitionNode) => {
    if (definition.kind === 'FragmentDefinition') {
      if (!fragmentIntrospectionExists(rootSelections, definition.typeCondition)) {
        // We haven't seen this type condition before. Add it to our list.
        const introspection = createIntrospectionForFragment(definition.typeCondition.name.value);
        rootSelections.push(introspection);
      }
    }

    if (definition.kind === 'FragmentDefinition' || definition.kind === 'OperationDefinition') {
      addIntrospectionToSelectionSet(rootSelections, definition.selectionSet);
    }
  });

  return docClone;
}
