import {
  DocumentNode,
  SelectionNode,
  SelectionSetNode,
  DefinitionNode,
  OperationDefinitionNode,
  FieldNode,
  DirectiveNode,
  FragmentDefinitionNode,
  ArgumentNode,
  FragmentSpreadNode,
  VariableDefinitionNode,
  VariableNode,
} from 'graphql';

import { cloneDeep } from './util/cloneDeep';

import {
  checkDocument,
  getOperationDefinitionOrDie,
  getFragmentDefinitions,
  createFragmentMap,
  FragmentMap,
} from './getFromAST';

export type RemoveNodeConfig<N> = {
  name?: string;
  test?: (node: N) => boolean;
  remove?: boolean;
};

export type GetNodeConfig<N> = {
  name?: string;
  test?: (node: N) => boolean;
};

export type RemoveDirectiveConfig = RemoveNodeConfig<DirectiveNode>;
export type GetDirectiveConfig = GetNodeConfig<DirectiveNode>;
export type RemoveArgumentsConfig = RemoveNodeConfig<ArgumentNode>;
export type GetFragmentSpreadConfig = GetNodeConfig<FragmentSpreadNode>;
export type RemoveFragmentSpreadConfig = RemoveNodeConfig<FragmentSpreadNode>;
export type RemoveFragmentDefinitionConfig = RemoveNodeConfig<
  FragmentDefinitionNode
>;
export type RemoveVariableDefinitionConfig = RemoveNodeConfig<
  VariableDefinitionNode
>;

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

function getSelectionsMatchingDirectiveFromSelectionSet(
  directives: GetDirectiveConfig[],
  selectionSet: SelectionSetNode,
  invert: boolean = false,
  fieldsOnly: boolean = false,
): SelectionNode[] {
  return selectionSet.selections
    .map(selection => {
      if (
        selection.kind !== 'Field' ||
        !(selection as FieldNode) ||
        !selection.directives
      ) {
        return fieldsOnly ? null : selection;
      }

      let isMatch: boolean;
      const directiveMatcher = getDirectiveMatcher(directives);
      selection.directives = selection.directives.filter(directive => {
        const shouldKeep = !directiveMatcher(directive);

        if (!isMatch && !shouldKeep) {
          isMatch = true;
        }

        return shouldKeep;
      });

      return isMatch && invert ? null : selection;
    })
    .filter(s => !!s);
}

function removeDirectivesFromSelectionSet(
  directives: RemoveDirectiveConfig[],
  selectionSet: SelectionSetNode,
): SelectionSetNode {
  if (!selectionSet.selections) return selectionSet;
  // if any of the directives are set to remove this selectionSet, remove it
  const agressiveRemove = directives.some(
    (dir: RemoveDirectiveConfig) => dir.remove,
  );

  selectionSet.selections = getSelectionsMatchingDirectiveFromSelectionSet(
    directives,
    selectionSet,
    agressiveRemove,
  );

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
  let docClone = cloneDeep(doc);
  let removedArguments: RemoveArgumentsConfig[] = [];
  let removedFragments: RemoveFragmentSpreadConfig[] = [];
  const aggressiveRemove = directives.some(directive => directive.remove);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    const operationDefinition = definition as OperationDefinitionNode;
    const originalSelectionSet = cloneDeep(operationDefinition.selectionSet);

    const newSelectionSet = removeDirectivesFromSelectionSet(
      directives,
      operationDefinition.selectionSet,
    );

    if (aggressiveRemove && !!docClone) {
      const matchingSelections = getSelectionsMatchingDirectiveFromSelectionSet(
        directives.map(config => ({
          name: config.name,
          test: config.test,
        })),
        originalSelectionSet,
      );

      const remainingArguments = getAllArgumentsFromSelectionSet(
        newSelectionSet,
      );

      removedArguments = [
        ...removedArguments,
        ...matchingSelections
          .map(getAllArgumentsFromSelection)
          .reduce(
            (allArguments, selectionArguments) => [
              ...allArguments,
              ...selectionArguments,
            ],
            [],
          )
          .filter(
            removedArg =>
              !remainingArguments.some(remainingArg => {
                if (
                  remainingArg.value.kind !== 'Variable' ||
                  !(remainingArg.value as VariableNode)
                )
                  return false;
                if (
                  removedArg.value.kind !== 'Variable' ||
                  !(removedArg.value as VariableNode)
                )
                  return false;
                return (
                  remainingArg.value.name.value === removedArg.value.name.value
                );
              }),
          )
          .map(argument => {
            if (
              argument.value.kind !== 'Variable' ||
              !(argument.value as VariableNode)
            )
              return null;
            return {
              name: argument.value.name.value,
              remove: aggressiveRemove,
            };
          })
          .filter(node => !!node),
      ];

      const remainingFragmentSpreads = getAllFragmentSpreadsFromSelectionSet(
        newSelectionSet,
      );

      removedFragments = [
        ...removedFragments,
        ...matchingSelections
          .map(getAllFragmentSpreadsFromSelection)
          .reduce(
            (allFragments, selectionFragments) => [
              ...allFragments,
              ...selectionFragments,
            ],
            [],
          )
          .filter(
            removedFragment =>
              !remainingFragmentSpreads.some(
                remainingFragment =>
                  remainingFragment.name.value === removedFragment.name.value,
              ),
          )
          .map(fragment => ({
            name: fragment.name.value,
            remove: aggressiveRemove,
          })),
      ];
    }
  });

  if (!docClone) {
    return null;
  }

  if (removedFragments.length > 0) {
    docClone = removeFragmentSpreadFromDocument(removedFragments, docClone);
    if (!docClone) {
      return null;
    }
  }

  if (removedArguments.length > 0) {
    docClone = removeArgumentsFromDocument(removedArguments, docClone);
    if (!docClone) {
      return null;
    }
  }

  const operation = getOperationDefinitionOrDie(docClone);
  const fragments = createFragmentMap(getFragmentDefinitions(docClone));

  return isNotEmpty(operation, fragments) ? docClone : null;
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

export function removeConnectionDirectiveFromDocument(doc: DocumentNode) {
  checkDocument(doc);
  return removeDirectivesFromDocument([connectionRemoveConfig], doc);
}

function hasDirectivesInSelectionSet(
  directives: GetDirectiveConfig[],
  selectionSet: SelectionSetNode,
  nestedCheck = true,
): boolean {
  return filterSelectionSet(selectionSet, selection =>
    hasDirectivesInSelection(directives, selection, nestedCheck),
  );
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
  const hasMatches = matchedDirectives.length > 0;

  return (
    hasMatches ||
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

function getArgumentMatcher(config: RemoveArgumentsConfig[]) {
  return (argument: ArgumentNode): Boolean => {
    return config.some((aConfig: RemoveArgumentsConfig) => {
      if (
        argument.value.kind !== 'Variable' ||
        !(argument.value as VariableNode)
      )
        return false;
      if (!argument.value.name) return false;
      if (aConfig.name === argument.value.name.value) return true;
      if (aConfig.test && aConfig.test(argument)) return true;
      return false;
    });
  };
}

function hasArgumentsInSelectionSet(
  config: RemoveArgumentsConfig[],
  selectionSet: SelectionSetNode,
  nestedCheck: boolean = false,
): boolean {
  return filterSelectionSet(selectionSet, selection =>
    hasArgumentsInSelection(config, selection, nestedCheck),
  );
}

function hasArgumentsInSelection(
  config: RemoveArgumentsConfig[],
  selection: SelectionNode,
  nestedCheck: boolean = false,
): boolean {
  // Selection is a FragmentSpread or InlineFragment, ignore (include it)...
  if (selection.kind !== 'Field' || !(selection as FieldNode)) {
    return true;
  }

  if (!selection.arguments) {
    return false;
  }
  const matcher = getArgumentMatcher(config);
  const matchedArguments = selection.arguments.filter(matcher);
  return (
    matchedArguments.length > 0 ||
    (nestedCheck &&
      hasArgumentsInSelectionSet(config, selection.selectionSet, nestedCheck))
  );
}

function getAllArgumentsFromSelectionSet(
  selectionSet: SelectionSetNode,
): ArgumentNode[] {
  return selectionSet.selections
    .map(getAllArgumentsFromSelection)
    .reduce((allArguments, selectionArguments) => {
      return [...allArguments, ...selectionArguments];
    }, []);
}

function getAllArgumentsFromSelection(
  selection: SelectionNode,
): ArgumentNode[] {
  if (selection.kind !== 'Field' || !(selection as FieldNode)) {
    return [];
  }

  return selection.arguments || [];
}

export function removeArgumentsFromDocument(
  config: RemoveArgumentsConfig[],
  query: DocumentNode,
): DocumentNode | null {
  const docClone = cloneDeep(query);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    const operationDefinition = definition as OperationDefinitionNode;
    const removeVariableConfig = config
      .filter(aConfig => !!aConfig.name)
      .map(aConfig => ({
        name: aConfig.name,
        remove: aConfig.remove,
      }));

    removeArgumentsFromSelectionSet(config, operationDefinition.selectionSet);
    removeArgumentsFromOperationDefinition(
      removeVariableConfig,
      operationDefinition,
    );
  });

  const operation = getOperationDefinitionOrDie(docClone);
  const fragments = createFragmentMap(getFragmentDefinitions(docClone));
  return isNotEmpty(operation, fragments) ? docClone : null;
}

function removeArgumentsFromOperationDefinition(
  config: RemoveVariableDefinitionConfig[],
  definition: OperationDefinitionNode,
): OperationDefinitionNode {
  if (!definition.variableDefinitions) return definition;
  // if any of the config is set to remove this argument, remove it
  const aggressiveRemove = config.some(
    (aConfig: RemoveVariableDefinitionConfig) => aConfig.remove,
  );

  let remove: boolean;
  definition.variableDefinitions = definition.variableDefinitions.filter(
    aDefinition => {
      const shouldKeep = !config.some(aConfig => {
        if (aConfig.name === aDefinition.variable.name.value) return true;
        if (aConfig.test && aConfig.test(aDefinition)) return true;
        return false;
      });

      if (!remove && !shouldKeep && aggressiveRemove) {
        remove = true;
      }

      return shouldKeep;
    },
  );

  return definition;
}

function removeArgumentsFromSelectionSet(
  config: RemoveArgumentsConfig[],
  selectionSet: SelectionSetNode,
): SelectionSetNode {
  if (!selectionSet.selections) return selectionSet;
  // if any of the config is set to remove this selectionSet, remove it
  const aggressiveRemove = config.some(
    (aConfig: RemoveArgumentsConfig) => aConfig.remove,
  );

  selectionSet.selections = selectionSet.selections
    .map(selection => {
      if (
        selection.kind !== 'Field' ||
        !(selection as FieldNode) ||
        !selection.arguments
      ) {
        return selection;
      }

      let remove: boolean;
      const argumentMatcher = getArgumentMatcher(config);
      selection.arguments = selection.arguments.filter(argument => {
        const shouldKeep = !argumentMatcher(argument);
        if (!remove && !shouldKeep && aggressiveRemove) {
          remove = true;
        }

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
      removeArgumentsFromSelectionSet(config, selection.selectionSet);
    }
  });

  return selectionSet;
}

function hasFragmentSpreadInSelection(
  config: RemoveFragmentSpreadConfig[],
  selection: SelectionNode,
): boolean {
  if (
    selection.kind !== 'FragmentSpread' ||
    !(selection as FragmentSpreadNode)
  ) {
    return false;
  }

  return config.some(aConfig => {
    if (aConfig.name === selection.name.value) return true;
    if (aConfig.test && aConfig.test(selection)) return true;
    return false;
  });
}

export function removeFragmentSpreadFromDocument(
  config: RemoveFragmentSpreadConfig[],
  query: DocumentNode,
): DocumentNode | null {
  const docClone = cloneDeep(query);

  docClone.definitions.forEach((definition: DefinitionNode) => {
    removeFragmentSpreadFromSelectionSet(
      config,
      (definition as OperationDefinitionNode).selectionSet,
    );
  });

  docClone.definitions = removeFragmentSpreadFromDefinitions(
    config
      .filter(aConfig => !!aConfig.name)
      .map(aConfig => ({ name: aConfig.name })),
    docClone.definitions,
  );

  const operation = getOperationDefinitionOrDie(docClone);
  const fragments = createFragmentMap(getFragmentDefinitions(docClone));
  return isNotEmpty(operation, fragments) ? docClone : null;
}

function removeFragmentSpreadFromDefinitions(
  config: RemoveFragmentDefinitionConfig[],
  definitions: DefinitionNode[],
): DefinitionNode[] {
  return definitions.filter(definition => {
    if (
      definition.kind !== 'FragmentDefinition' ||
      !(definition as FragmentDefinitionNode)
    ) {
      return true;
    }

    return !config.some(aConfig => {
      if (aConfig.name && aConfig.name === definition.name.value) return true;
      if (aConfig.test && aConfig.test(definition)) return true;
      return false;
    });
  });
}

function removeFragmentSpreadFromSelectionSet(
  config: RemoveFragmentSpreadConfig[],
  selectionSet: SelectionSetNode,
): SelectionSetNode {
  if (!selectionSet.selections) return selectionSet;

  selectionSet.selections = selectionSet.selections.filter(
    selection => !hasFragmentSpreadInSelection(config, selection),
  );

  selectionSet.selections.forEach(selection => {
    if (
      (selection.kind === 'Field' || selection.kind === 'InlineFragment') &&
      selection.selectionSet
    ) {
      removeFragmentSpreadFromSelectionSet(config, selection.selectionSet);
    }
  });

  return selectionSet;
}

function getAllFragmentSpreadsFromSelectionSet(
  selectionSet: SelectionSetNode,
): FragmentSpreadNode[] {
  return selectionSet.selections
    .map(getAllFragmentSpreadsFromSelection)
    .reduce(
      (allFragments, selectionFragments) => [
        ...allFragments,
        ...selectionFragments,
      ],
      [],
    );
}

function getAllFragmentSpreadsFromSelection(
  selection: SelectionNode,
): FragmentSpreadNode[] {
  if (
    (selection.kind === 'Field' || selection.kind === 'InlineFragment') &&
    selection.selectionSet
  ) {
    return getAllFragmentSpreadsFromSelectionSet(selection.selectionSet);
  } else if (
    selection.kind === 'FragmentSpread' &&
    (selection as FragmentSpreadNode)
  ) {
    return [selection];
  }

  return [];
}

function filterSelectionSet(
  selectionSet: SelectionSetNode,
  filter: (node: SelectionNode) => boolean,
) {
  if (!(selectionSet && selectionSet.selections)) {
    return false;
  }

  return selectionSet.selections.filter(filter).length > 0;
}
