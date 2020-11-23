import { FieldFunctionOptions, InMemoryCache, isReference, makeReference } from '../../../core';
import { relayStylePagination, TRelayPageInfo } from '../pagination';

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

    it('should maintain existing PageInfo when adding a page', () => {
      const existingEdges = [
        { cursor: 'alpha', node: makeReference("fakeAlpha") },
      ];

      const incomingEdges = [
        { cursor: 'omega', node: makeReference("fakeOmega") },
      ];

      const result = merge(
        {
          edges: existingEdges,
          pageInfo: {
            hasPreviousPage: false,
            hasNextPage: true,
            startCursor: 'alpha',
            endCursor: 'alpha'
          },
        },
        {
          edges: incomingEdges,
          pageInfo: {
            hasPreviousPage: true,
            hasNextPage: true,
            startCursor: incomingEdges[0].cursor,
            endCursor: incomingEdges[incomingEdges.length - 1].cursor,
          },
        },
        {
          ...options,
          args: {
            after: 'alpha',
          },
        },
      );

      expect(result).toEqual({
        edges: [
          ...existingEdges,
          ...incomingEdges,
        ],
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: true,
          startCursor: 'alpha',
          endCursor: 'omega',
        }
      });
    });

    it('should maintain extra PageInfo properties', () => {
      const existingEdges = [
        { cursor: 'alpha', node: makeReference("fakeAlpha") },
      ];

      const incomingEdges = [
        { cursor: 'omega', node: makeReference("fakeOmega") },
      ];

      const result = merge(
        {
          edges: existingEdges,
          pageInfo: {
            hasPreviousPage: false,
            hasNextPage: true,
            startCursor: 'alpha',
            endCursor: 'alpha',
            extra: "existing.pageInfo.extra",
          } as TRelayPageInfo,
        },
        {
          edges: incomingEdges,
          pageInfo: {
            hasPreviousPage: true,
            hasNextPage: true,
            startCursor: incomingEdges[0].cursor,
            endCursor: incomingEdges[incomingEdges.length - 1].cursor,
            extra: "incoming.pageInfo.extra",
          } as TRelayPageInfo,
        },
        {
          ...options,
          args: {
            after: 'alpha',
          },
        },
      );

      expect(result).toEqual({
        edges: [
          ...existingEdges,
          ...incomingEdges,
        ],
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: true,
          startCursor: 'alpha',
          endCursor: 'omega',
          // This is the most important line in this test, since it proves
          // incoming.pageInfo.extra was not lost.
          extra: "incoming.pageInfo.extra",
        }
      });
    });
  })
});
