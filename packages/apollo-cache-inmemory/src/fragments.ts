import { InlineFragmentNode, FragmentDefinitionNode } from 'graphql';
import { PossibleTypesMap } from './types';

export function fragmentMatches(
  fragment: InlineFragmentNode | FragmentDefinitionNode,
  typename: string,
  possibleTypes?: PossibleTypesMap,
) {
  if (!fragment.typeCondition) {
    return true;
  }

  const typeCondition = fragment.typeCondition.name.value;
  if (typename === typeCondition) {
    return true;
  }

  if (possibleTypes) {
    const subtypes = possibleTypes[typeCondition];
    return !!subtypes && subtypes.indexOf(typename) >= 0;
  }

  return 'heuristic';
}
