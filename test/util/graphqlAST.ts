import { parse, SelectionSetNode, FragmentDefinitionNode } from 'graphql/language';

export function parseSelectionSet (source: string): SelectionSetNode {
  const document = parse(source);
  if (document.definitions.length !== 1) {
    throw new Error('There should only be one definition.');
  }
  const definition = document.definitions[0];
  if (definition.kind !== 'OperationDefinition' || definition.operation !== 'query' || definition.name) {
    throw new Error('The single definition must be a nameless query operation definition.');
  }
  return definition.selectionSet;
}

export function parseFragmentDefinitionMap (source: string): { [fragmentName: string]: FragmentDefinitionNode } {
  const document = parse(source);
  const fragments: { [fragmentName: string]: FragmentDefinitionNode } = {};

  document.definitions.forEach(definition => {
    if (definition.kind !== 'FragmentDefinition') {
      throw new Error('Only fragment definitions are allowed.');
    }
    fragments[definition.name.value] = definition;
  });

  return fragments;
}
