import { QueryKeyMaker } from '../queryKeyMaker';
import { CacheKeyNode } from '../optimism';
import gql from 'graphql-tag';
import { DocumentNode } from 'graphql';

describe('QueryKeyMaker', () => {
  const cacheKeyRoot = new CacheKeyNode();
  const queryKeyMaker = new QueryKeyMaker(cacheKeyRoot);

  it('should work', () => {
    const query1: DocumentNode = gql`
      query {
        foo
        bar
      }
    `;

    const query2: DocumentNode = gql`
      query {
        # comment
        foo
        bar
      }
    `;

    const keyMaker1 = queryKeyMaker.forQuery(query1);
    const keyMaker2 = queryKeyMaker.forQuery(query2);

    expect(keyMaker1.lookupQuery(query2)).toBe(keyMaker2.lookupQuery(query1));

    expect(keyMaker1.lookupQuery(query1)).toBe(keyMaker2.lookupQuery(query2));

    let checkCount = 0;
    query1.definitions.forEach((def1, i) => {
      const def2 = query2.definitions[i];
      expect(def1).not.toBe(def2);
      if (
        def1.kind === 'OperationDefinition' &&
        def2.kind === 'OperationDefinition'
      ) {
        expect(def1.selectionSet).not.toBe(def2.selectionSet);
        expect(keyMaker1.lookupSelectionSet(def1.selectionSet)).toBe(
          keyMaker2.lookupSelectionSet(def2.selectionSet),
        );
        ++checkCount;
      }
    });

    expect(checkCount).toBe(1);
  });
});
