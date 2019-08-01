import { InlineFragmentNode, FragmentDefinitionNode } from 'graphql';
type PossibleTypes = import('./inMemoryCache').InMemoryCache['possibleTypes'];

export function fragmentMatches(
  fragment: InlineFragmentNode | FragmentDefinitionNode,
  typename: string,
  possibleTypes?: PossibleTypes,
) {
  if (!fragment.typeCondition) {
    return true;
  }

  const typeCondition = fragment.typeCondition.name.value;
  if (typename === typeCondition) {
    return true;
  }

  if (possibleTypes) {
    const workQueue = [possibleTypes[typeCondition]];
    // It's important to keep evaluating workQueue.length each time through the
    // loop, because the queue can grow while we're iterating over it.
    for (let i = 0; i < workQueue.length; ++i) {
      const subtypes = workQueue[i];
      if (subtypes) {
        if (subtypes[typename] === true) return true;
        for (const subtype in subtypes) {
          const subsubtypes = possibleTypes[subtype];
          // If this subtype has subtypes of its own, and we haven't considered
          // this array of sub-subtypes before, add them the queue.
          if (subsubtypes && workQueue.indexOf(subsubtypes) < 0) {
            workQueue.push(subsubtypes);
          }
        }
      }
    }
    // When possibleTypes is defined, we always either return true from the loop
    // above or return false here (never 'heuristic' below).
    return false;
  }

  return 'heuristic';
}
