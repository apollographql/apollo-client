import { FieldFunctionOptions, InMemoryCache, isReference, makeReference, StoreObject } from '../../../cache';
import { relayStylePagination, TRelayPageInfo } from '../pagination';

describe('relayStylePagination', () => {
  const policy = relayStylePagination();

  describe('read', () => {
    const fakeEdges = [
      { node: { __ref: "A" }, cursor: "cursorA" },
      { node: { __ref: "B" }, cursor: "cursorB" },
      { node: { __ref: "C" }, cursor: "cursorC" },
    ];

    const fakeReadOptions = {
      canRead() { return true },
      readField(key: string, obj: StoreObject) {
        return obj && obj[key];
      },
    } as any as FieldFunctionOptions;

    it("should prefer existing.pageInfo.startCursor", () => {
      const resultWithStartCursor = policy.read!({
        edges: fakeEdges,
        pageInfo: {
          startCursor: "preferredStartCursor",
          hasPreviousPage: false,
          hasNextPage: true,
        } as TRelayPageInfo,
      }, fakeReadOptions);

      expect(
        resultWithStartCursor &&
        resultWithStartCursor.pageInfo
      ).toEqual({
        startCursor: "preferredStartCursor",
        endCursor: "cursorC",
        hasPreviousPage: false,
        hasNextPage: true,
      });
    });

    it("should prefer existing.pageInfo.endCursor", () => {
      const resultWithEndCursor = policy.read!({
        edges: fakeEdges,
        pageInfo: {
          endCursor: "preferredEndCursor",
          hasPreviousPage: false,
          hasNextPage: true,
        } as TRelayPageInfo,
      }, fakeReadOptions);

      expect(
        resultWithEndCursor &&
        resultWithEndCursor.pageInfo
      ).toEqual({
        startCursor: "cursorA",
        endCursor: "preferredEndCursor",
        hasPreviousPage: false,
        hasNextPage: true,
      });
    });

    it("should prefer existing.pageInfo.{start,end}Cursor", () => {
      const resultWithEndCursor = policy.read!({
        edges: fakeEdges,
        pageInfo: {
          startCursor: "preferredStartCursor",
          endCursor: "preferredEndCursor",
          hasPreviousPage: false,
          hasNextPage: true,
        },
      }, fakeReadOptions);

      expect(
        resultWithEndCursor &&
        resultWithEndCursor.pageInfo
      ).toEqual({
        startCursor: "preferredStartCursor",
        endCursor: "preferredEndCursor",
        hasPreviousPage: false,
        hasNextPage: true,
      });
    });

    it("should override pageInfo.{start,end}Cursor if empty strings", () => {
      const resultWithEndCursor = policy.read!({
        edges: [
          { node: { __ref: "A" }, cursor: "" },
          { node: { __ref: "B" }, cursor: "cursorB" },
          { node: { __ref: "C" }, cursor: "" },
          { node: { __ref: "D" }, cursor: "cursorD" },
          { node: { __ref: "E" } },
        ],
        pageInfo: {
          startCursor: "",
          endCursor: "",
          hasPreviousPage: false,
          hasNextPage: true,
        },
      }, fakeReadOptions);

      expect(
        resultWithEndCursor &&
        resultWithEndCursor.pageInfo
      ).toEqual({
        startCursor: "cursorB",
        endCursor: "cursorD",
        hasPreviousPage: false,
        hasNextPage: true,
      });
    });

    it("should not return empty edges if none existing", () => {
      const resultWithTotalCount = policy.read!({
        totalCount: 10
      }, fakeReadOptions);

      expect(
        resultWithTotalCount,
      ).toEqual({
        totalCount: 10,
      });
    });
  });


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

    it('should preserve existing if incoming is null', () => {
      const existingEdges = [
        { cursor: 'alpha', node: makeReference("fakeAlpha") },
      ];

      const fakeExisting = {
        edges: existingEdges,
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: true,
          startCursor: 'alpha',
          endCursor: 'alpha'
        },
      };

      const fakeIncoming = null;

      const fakeOptions = {
        ...options,
        args: {
          after: 'alpha',
        },
      };

      const result = merge(
        fakeExisting,
        fakeIncoming,
        fakeOptions,
      );

      expect(result).toEqual(fakeExisting);
    })

    describe('when incoming has no edges', () => {
      it('should not replace existing null with empty edges', () => {
        const fakeExisting = null;

        const fakeIncoming = {
          totalCount: 10
        };

        const fakeOptions = {
          ...options,
        };

        const result = merge(
          fakeExisting,
          fakeIncoming,
          fakeOptions,
        );

        expect(result).toEqual({
          totalCount: 10
        });
      })

      it('should not merge existing with empty edges', () => {
        const fakeExisting = {
          totalCount: 10
        };

        const fakeIncoming = {
          totalCount: 11
        };

        const fakeOptions = {
          ...options,
          args: {
            after: 'alpha',
          },
        };

        const result = merge(
          fakeExisting,
          fakeIncoming,
          fakeOptions,
        );

        expect(result).toEqual({
          totalCount: 11
        });
      })
    })

    describe('when existing has no edges', () => {
      it('should add incoming edges', () => {
        const fakeExisting = {
          totalCount: 10
        };

        const incomingEdges = [
          { cursor: 'alpha', node: makeReference("fakeAlpha") },
        ];
        const incoming = {
          edges: incomingEdges,
          pageInfo: {
            hasPreviousPage: false,
            hasNextPage: true,
            startCursor: 'alpha',
            endCursor: 'alpha'
          },
        };
        const fakeOptions = {
          ...options,
        };

        const result = merge(
          fakeExisting,
          incoming,
          fakeOptions,
        );

        expect(result).toEqual({
          ...incoming,
          totalCount: 10
        });
      })
    })

    it('should replace existing null with incoming', () => {
      const incomingEdges = [
        { cursor: 'alpha', node: makeReference("fakeAlpha") },
      ];
      const incoming = {
        edges: incomingEdges,
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: true,
          startCursor: 'alpha',
          endCursor: 'alpha'
        },
      };
      const result = merge(
        null,
        incoming,
        {
          ...options,
          args: {
            after: 'alpha',
          },
        },
      );

      expect(result).toEqual(incoming);
    })

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
