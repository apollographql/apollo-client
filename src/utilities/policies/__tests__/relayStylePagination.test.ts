import { FieldFunctionOptions, InMemoryCache, isReference } from '../../../core';
import { relayStylePagination } from '../pagination';

describe('relayStylePagination', () => {
  const policy = relayStylePagination();

  describe('merge', () => {

    const merge = policy.merge;
    // The merge function should exist, make TS aware
    if (typeof merge !== 'function') {
      throw new Error('Expecting merge function');
    }

    const options: FieldFunctionOptions = {
      args: null,
      fieldName: 'fake',
      storeFieldName: 'fake',
      field: null,
      isReference: isReference,
      toReference: () => undefined,
      storage: {},
      cache: new InMemoryCache(),
      readField: () => undefined,
      canRead: () => false,
      mergeObjects: (existing, _incoming) => existing,
    };
    it('should maintain endCursor and startCursor with empty edges', () => {
      const incoming: Parameters<typeof merge>[1] = {
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: true,
          startCursor: 'abc',
          endCursor: 'xyz',
        }
      };
      const result = merge(undefined, incoming, options);
      expect(result).toEqual({
        edges: [],
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: true,
          startCursor: 'abc',
          endCursor: 'xyz'
        }
      });
    });
  })
});
