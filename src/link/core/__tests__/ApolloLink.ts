import { print } from "graphql";
import { gql } from "graphql-tag";
import { EMPTY, map, Observable, of } from "rxjs";

import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloLink, execute } from "@apollo/client/link/core";
import { ObservableStream } from "@apollo/client/testing/internal";

import type {
  FetchResult,
  GraphQLRequest,
  NextLink,
  Operation,
} from "../types.js";

class SetContextLink extends ApolloLink {
  constructor(
    private setContext: (
      context: Record<string, any>
    ) => Record<string, any> = (c) => c
  ) {
    super();
  }

  public request(
    operation: Operation,
    forward: NextLink
  ): Observable<FetchResult> {
    operation.setContext(this.setContext(operation.getContext()));
    return forward(operation);
  }
}

const sampleQuery = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

const setContext = () => ({ add: 1 });

const defaultExecuteContext = {
  client: new ApolloClient({ cache: new InMemoryCache() }),
};

describe("ApolloClient", () => {
  describe("context", () => {
    it("should merge context when using a function", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock = new ApolloLink((op, forward) => {
        op.setContext((context: { add: number }) => ({ add: context.add + 2 }));
        op.setContext(() => ({ substract: 1 }));

        return forward(op);
      });
      const link = returnOne.concat(mock).concat((op) => {
        expect(op.getContext()).toEqual({
          add: 3,
          substract: 1,
        });
        return of({ data: { count: op.getContext().add } });
      });
      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 3 } });
      await expect(stream).toComplete();
    });

    it("should merge context when not using a function", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock = new ApolloLink((op, forward) => {
        op.setContext({ add: 3 });
        op.setContext({ substract: 1 });

        return forward(op);
      });
      const link = returnOne.concat(mock).concat((op) => {
        expect(op.getContext()).toEqual({
          add: 3,
          substract: 1,
        });
        return of({ data: { count: op.getContext().add } });
      });
      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 3 } });
      await expect(stream).toComplete();
    });
  });

  describe("concat", () => {
    it("should concat a function", async () => {
      const returnOne = new SetContextLink(setContext);
      const link = returnOne.concat((operation, forward) => {
        return of({ data: { count: operation.getContext().add } });
      });
      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 1 } });
      await expect(stream).toComplete();
    });

    it("should concat a Link", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock = new ApolloLink((op) =>
        of({ data: { count: op.getContext().add } })
      );
      const link = returnOne.concat(mock);

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 1 } });
      await expect(stream).toComplete();
    });

    it("should pass error to observable's error", async () => {
      const error = new Error("thrown");
      const returnOne = new SetContextLink(setContext);
      const mock = new ApolloLink(
        (op) =>
          new Observable((observer) => {
            observer.next({ data: { count: op.getContext().add } });
            observer.error(error);
          })
      );
      const link = returnOne.concat(mock);

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 1 } });
      await expect(stream).toEmitError(error);
    });

    it("should concat a Link and function", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock = new ApolloLink((op, forward) => {
        op.setContext((context: { add: number }) => ({ add: context.add + 2 }));
        return forward(op);
      });
      const link = returnOne.concat(mock).concat((op) => {
        return of({ data: { count: op.getContext().add } });
      });

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 3 } });
      await expect(stream).toComplete();
    });

    it("should concat a function and Link", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock = new ApolloLink((op, forward) =>
        of({ data: { count: op.getContext().add } })
      );

      const link = returnOne
        .concat((operation, forward) => {
          operation.setContext({
            add: operation.getContext().add + 2,
          });
          return forward(operation);
        })
        .concat(mock);

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 3 } });
      await expect(stream).toComplete();
    });

    it("should concat two functions", async () => {
      const returnOne = new SetContextLink(setContext);
      const link = returnOne
        .concat((operation, forward) => {
          operation.setContext({
            add: operation.getContext().add + 2,
          });
          return forward(operation);
        })
        .concat((op, forward) => of({ data: { count: op.getContext().add } }));

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 3 } });
      await expect(stream).toComplete();
    });

    it("should concat two Links", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock1 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 2,
        });
        return forward(operation);
      });
      const mock2 = new ApolloLink((op, forward) =>
        of({ data: { count: op.getContext().add } })
      );

      const link = returnOne.concat(mock1).concat(mock2);

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 3 } });
      await expect(stream).toComplete();
    });

    it("should return an link that can be concat'd multiple times", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock1 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 2,
        });
        return forward(operation);
      });
      const mock2 = new ApolloLink((op, forward) =>
        of({ data: { count: op.getContext().add + 2 } })
      );
      const mock3 = new ApolloLink((op, forward) =>
        of({ data: { count: op.getContext().add + 3 } })
      );
      const link = returnOne.concat(mock1);

      {
        const stream = new ObservableStream(
          execute(
            link.concat(mock2),
            { query: sampleQuery },
            defaultExecuteContext
          )
        );

        await expect(stream).toEmitTypedValue({ data: { count: 5 } });
        await expect(stream).toComplete();
      }

      {
        const stream = new ObservableStream(
          execute(
            link.concat(mock3),
            { query: sampleQuery },
            defaultExecuteContext
          )
        );

        await expect(stream).toEmitTypedValue({ data: { count: 6 } });
        await expect(stream).toComplete();
      }
    });
  });

  describe("empty", () => {
    it("should returns an immediately completed Observable", async () => {
      const stream = new ObservableStream(
        execute(
          ApolloLink.empty(),
          { query: sampleQuery },
          defaultExecuteContext
        )
      );

      await expect(stream).toComplete();
    });
  });

  describe("execute", () => {
    it("transforms an opearation with context into something serlizable", async () => {
      const query = gql`
        {
          id
        }
      `;
      const link = new ApolloLink((operation) => {
        const str = JSON.stringify({
          ...operation,
          query: print(operation.query),
        });

        expect(str).toBe(
          JSON.stringify({
            variables: { id: 1 },
            extensions: { cache: true },
            query: print(operation.query),
          })
        );
        return EMPTY;
      });
      const stream = new ObservableStream(
        execute(
          link,
          {
            query,
            variables: { id: 1 },
            extensions: { cache: true },
          },
          defaultExecuteContext
        )
      );

      await expect(stream).toComplete();
    });

    describe("execute", () => {
      let _warn: (message?: any, ...originalParams: any[]) => void;

      beforeEach(() => {
        _warn = console.warn;
        console.warn = jest.fn((warning) => {
          expect(warning).toBe(
            `query should either be a string or GraphQL AST`
          );
        });
      });

      afterEach(() => {
        console.warn = _warn;
      });

      it("should return an empty observable when a link returns null", async () => {
        const link = new ApolloLink();
        link.request = () => null;

        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toComplete();
      });

      it("should return an empty observable when a link is empty", async () => {
        const stream = new ObservableStream(
          execute(
            ApolloLink.empty(),
            { query: sampleQuery },
            defaultExecuteContext
          )
        );

        await expect(stream).toComplete();
      });

      it("should return an empty observable when a concat'd link returns null", async () => {
        const link = new ApolloLink((operation, forward) => {
          return forward(operation);
        }).concat(() => null);

        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toComplete();
      });

      it("should return an empty observable when a split link returns null", async () => {
        let context = { test: true };
        const link = new SetContextLink(() => context).split(
          (op) => op.getContext().test,
          () => EMPTY,
          () => null
        );

        {
          const stream = new ObservableStream(
            execute(link, { query: sampleQuery }, defaultExecuteContext)
          );

          await expect(stream).toComplete();
        }

        context.test = false;

        {
          const stream = new ObservableStream(
            execute(link, { query: sampleQuery }, defaultExecuteContext)
          );

          await expect(stream).toComplete();
        }
      });

      it("should set a default context, variable, and query on a copy of operation", async () => {
        const operation = {
          query: gql`
            {
              id
            }
          `,
        };
        const link = new ApolloLink((op: Operation) => {
          expect((operation as any)["operationName"]).toBeUndefined();
          expect((operation as any)["variables"]).toBeUndefined();
          expect((operation as any)["context"]).toBeUndefined();
          expect((operation as any)["extensions"]).toBeUndefined();
          expect(op.variables).toBeDefined();
          expect((op as any)["context"]).toBeUndefined();
          expect(op["extensions"]).toBeDefined();
          return EMPTY;
        });

        const stream = new ObservableStream(
          execute(link, operation, defaultExecuteContext)
        );

        await expect(stream).toComplete();
      });
    });
  });

  describe("from", () => {
    const uniqueOperation: GraphQLRequest = {
      query: sampleQuery,
      context: { name: "uniqueName" },
      operationName: "SampleQuery",
      extensions: {},
    };

    it("should create an observable that completes when passed an empty array", async () => {
      const observable = ApolloLink.execute(
        ApolloLink.from([]),
        { query: sampleQuery },
        defaultExecuteContext
      );
      const stream = new ObservableStream(observable);

      await expect(stream).toComplete();
    });

    it("can create chain of one", () => {
      expect(() => ApolloLink.from([new ApolloLink()])).not.toThrow();
    });

    it("can create chain of two", () => {
      expect(() =>
        ApolloLink.from([
          new ApolloLink((operation, forward) => forward(operation)),
          new ApolloLink(),
        ])
      ).not.toThrow();
    });

    it("should receive result of one link", async () => {
      const data: FetchResult = {
        data: {
          hello: "world",
        },
      };
      const chain = ApolloLink.from([new ApolloLink(() => of(data))]);
      // Smoke tests execute as a static method
      const observable = ApolloLink.execute(
        chain,
        uniqueOperation,
        defaultExecuteContext
      );
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();
    });

    it("should accept AST query and pass AST to link", () => {
      const astOperation = {
        ...uniqueOperation,
        query: sampleQuery,
      };

      const stub = jest.fn();

      const chain = ApolloLink.from([new ApolloLink(stub)]);
      ApolloLink.execute(chain, astOperation, defaultExecuteContext);

      expect(stub).toHaveBeenCalledWith({
        query: sampleQuery,
        operationName: "SampleQuery",
        variables: {},
        extensions: {},
      });
    });

    it("should pass operation from one link to next with modifications", async () => {
      const chain = ApolloLink.from([
        new ApolloLink((op, forward) =>
          forward({
            ...op,
            query: sampleQuery,
          })
        ),
        new ApolloLink((op) => {
          expect({
            extensions: {},
            operationName: "SampleQuery",
            query: sampleQuery,
            variables: {},
          }).toEqual(op);

          return new Observable((observer) => {
            observer.complete();
          });
        }),
      ]);
      const observable = ApolloLink.execute(
        chain,
        uniqueOperation,
        defaultExecuteContext
      );
      const stream = new ObservableStream(observable);

      await expect(stream).toComplete();
    });

    it("should pass result of one link to another with forward", async () => {
      const data: FetchResult = {
        data: {
          hello: "world",
        },
      };

      const chain = ApolloLink.from([
        new ApolloLink((op, forward) => {
          return forward(op);
        }),
        new ApolloLink(() => of(data)),
      ]);
      const observable = ApolloLink.execute(
        chain,
        uniqueOperation,
        defaultExecuteContext
      );
      const stream = new ObservableStream(observable);

      await expect(stream).toEmitTypedValue(data);
      await expect(stream).toComplete();
    });

    it("should receive final result of two link chain", async () => {
      const data: FetchResult = {
        data: {
          hello: "world",
        },
      };

      const chain = ApolloLink.from([
        new ApolloLink((op, forward) => {
          const observable = forward(op);

          return new Observable((observer) => {
            observable.subscribe({
              next: (actualData) => {
                expect(data).toEqual(actualData);
                observer.next({
                  data: {
                    ...actualData.data,
                    modification: "unique",
                  },
                });
              },
              error: (error) => observer.error(error),
              complete: () => observer.complete(),
            });
          });
        }),
        new ApolloLink(() => of(data)),
      ]);

      const result = ApolloLink.execute(
        chain,
        uniqueOperation,
        defaultExecuteContext
      );
      const stream = new ObservableStream(result);

      await expect(stream).toEmitTypedValue({
        data: {
          ...data.data,
          modification: "unique",
        },
      });
      await expect(stream).toComplete();
    });

    it("should chain together a function with links", async () => {
      const add1 = new ApolloLink((operation: Operation, forward: NextLink) => {
        operation.setContext((context: { num: number }) => ({
          num: context.num + 1,
        }));
        return forward(operation);
      });
      const add1Link = new ApolloLink((operation, forward) => {
        operation.setContext((context: { num: number }) => ({
          num: context.num + 1,
        }));
        return forward(operation);
      });

      const link = ApolloLink.from([
        add1,
        add1,
        add1Link,
        add1,
        add1Link,
        new ApolloLink((operation) => of({ data: operation.getContext() })),
      ]);

      const stream = new ObservableStream(
        execute(
          link,
          { query: sampleQuery, context: { num: 0 } },
          defaultExecuteContext
        )
      );

      await expect(stream).toEmitTypedValue({ data: { num: 5 } });
      await expect(stream).toComplete();
    });
  });

  describe("split", () => {
    it("should split two functions", async () => {
      const context = { add: 1 };
      const returnOne = new SetContextLink(() => context);
      const link1 = returnOne.concat((operation, forward) =>
        of({ data: { count: operation.getContext().add + 1 } })
      );
      const link2 = returnOne.concat((operation, forward) =>
        of({ data: { count: operation.getContext().add + 2 } })
      );
      const link = returnOne.split(
        (operation) => operation.getContext().add === 1,
        link1,
        link2
      );

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }

      context.add = 2;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 4 } });
        await expect(stream).toComplete();
      }
    });

    it("should split two Links", async () => {
      const context = { add: 1 };
      const returnOne = new SetContextLink(() => context);
      const link1 = returnOne.concat(
        new ApolloLink((operation, forward) =>
          of({ data: { count: operation.getContext().add + 1 } })
        )
      );
      const link2 = returnOne.concat(
        new ApolloLink((operation, forward) =>
          of({ data: { count: operation.getContext().add + 2 } })
        )
      );
      const link = returnOne.split(
        (operation) => operation.getContext().add === 1,
        link1,
        link2
      );

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }

      context.add = 2;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 4 } });
        await expect(stream).toComplete();
      }
    });

    it("should split a link and a function", async () => {
      const context = { add: 1 };
      const returnOne = new SetContextLink(() => context);
      const link1 = returnOne.concat((operation, forward) =>
        of({ data: { count: operation.getContext().add + 1 } })
      );
      const link2 = returnOne.concat(
        new ApolloLink((operation, forward) =>
          of({ data: { count: operation.getContext().add + 2 } })
        )
      );
      const link = returnOne.split(
        (operation) => operation.getContext().add === 1,
        link1,
        link2
      );

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }

      context.add = 2;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 4 } });
        await expect(stream).toComplete();
      }
    });

    it("should allow concat after split to be join", async () => {
      const context = { test: true, add: 1 };
      const start = new SetContextLink(() => ({ ...context }));
      const link = start
        .split(
          (operation) => operation.getContext().test,
          (operation, forward) => {
            operation.setContext((context: { add: number }) => ({
              add: context.add + 1,
            }));
            return forward(operation);
          },
          (operation, forward) => {
            operation.setContext((context: { add: number }) => ({
              add: context.add + 2,
            }));
            return forward(operation);
          }
        )
        .concat((operation) =>
          of({ data: { count: operation.getContext().add } })
        );

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }

      context.test = false;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 3 } });
        await expect(stream).toComplete();
      }
    });

    it("should allow default right to be empty or passthrough when forward available", async () => {
      let context = { test: true };
      const start = new SetContextLink(() => context);
      const link = start.split(
        (operation) => operation.getContext().test,
        (operation) =>
          of({
            data: {
              count: 1,
            },
          })
      );
      const concat = link.concat((operation) =>
        of({
          data: {
            count: 2,
          },
        })
      );

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 1 } });
        await expect(stream).toComplete();
      }

      context.test = false;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toComplete();
      }

      {
        const stream = new ObservableStream(
          execute(concat, { query: sampleQuery }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }
    });

    it("should create filter when single link passed in", async () => {
      const link = ApolloLink.split(
        (operation) => operation.getContext().test,
        (operation, forward) => of({ data: { count: 1 } })
      );

      let context = { test: true };

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 1 } });
        await expect(stream).toComplete();
      }

      context.test = false;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toComplete();
      }
    });

    it("should split two functions", async () => {
      const link = ApolloLink.split(
        (operation) => operation.getContext().test,
        (operation, forward) => of({ data: { count: 1 } }),
        (operation, forward) => of({ data: { count: 2 } })
      );

      let context = { test: true };

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 1 } });
        await expect(stream).toComplete();
      }

      context.test = false;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }
    });

    it("should split two Links", async () => {
      const link = ApolloLink.split(
        (operation) => operation.getContext().test,
        (operation, forward) => of({ data: { count: 1 } }),
        new ApolloLink((operation, forward) => of({ data: { count: 2 } }))
      );

      let context = { test: true };

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 1 } });
        await expect(stream).toComplete();
      }

      context.test = false;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }
    });

    it("should split a link and a function", async () => {
      const link = ApolloLink.split(
        (operation) => operation.getContext().test,
        (operation, forward) => of({ data: { count: 1 } }),
        new ApolloLink((operation, forward) => of({ data: { count: 2 } }))
      );

      let context = { test: true };

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 1 } });
        await expect(stream).toComplete();
      }

      context.test = false;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }
    });

    it("should allow concat after split to be join", async () => {
      const context = { test: true };
      const link = ApolloLink.split(
        (operation) => operation.getContext().test,
        (operation, forward) =>
          forward(operation).pipe(
            map((data) => ({
              data: { count: data.data!.count + 1 },
            }))
          )
      ).concat(() => of({ data: { count: 1 } }));

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }

      context.test = false;
      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 1 } });
        await expect(stream).toComplete();
      }
    });

    it("should allow default right to be passthrough", async () => {
      const context = { test: true };
      const link = ApolloLink.split(
        (operation) => operation.getContext().test,
        (operation) => of({ data: { count: 2 } })
      ).concat((operation) => of({ data: { count: 1 } }));

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 2 } });
        await expect(stream).toComplete();
      }

      context.test = false;

      {
        const stream = new ObservableStream(
          execute(link, { query: sampleQuery, context }, defaultExecuteContext)
        );

        await expect(stream).toEmitTypedValue({ data: { count: 1 } });
        await expect(stream).toComplete();
      }
    });
  });

  describe("Terminating links", () => {
    const _warn = console.warn;
    const warningStub = jest.fn((warning, link) => {
      expect(warning).toBe(
        `You are calling concat on a terminating link, which will have no effect %o`
      );
    });
    const data = {
      stub: "data",
    };

    beforeAll(() => {
      console.warn = warningStub;
    });

    beforeEach(() => {
      warningStub.mockClear();
    });

    afterAll(() => {
      console.warn = _warn;
    });

    describe("split", () => {
      it("should not warn if attempting to split a terminating and non-terminating Link", () => {
        const split = ApolloLink.split(
          () => true,
          (operation) => of({ data }),
          (operation, forward) => forward(operation)
        );
        split.concat((operation, forward) => forward(operation));
        expect(warningStub).not.toBeCalled();
      });

      it("should warn if attempting to concat to split two terminating links", () => {
        const split = ApolloLink.split(
          () => true,
          (operation) => of({ data }),
          (operation) => of({ data })
        );
        expect(
          split.concat((operation, forward) => forward(operation))
        ).toEqual(split);
        expect(warningStub).toHaveBeenCalledTimes(1);
      });

      it("should warn if attempting to split to split two terminating links", () => {
        const split = ApolloLink.split(
          () => true,
          (operation) => of({ data }),
          (operation) => of({ data })
        );
        expect(
          split.split(
            () => true,
            (operation, forward) => forward(operation),
            (operation, forward) => forward(operation)
          )
        ).toEqual(split);
        expect(warningStub).toHaveBeenCalledTimes(1);
      });
    });

    describe("from", () => {
      it("should not warn if attempting to form a terminating then non-terminating Link", () => {
        ApolloLink.from([
          (operation, forward) => forward(operation),
          (operation) => of({ data }),
        ]);
        expect(warningStub).not.toBeCalled();
      });

      it("should warn if attempting to add link after termination", () => {
        ApolloLink.from([
          (operation, forward) => forward(operation),
          (operation) => of({ data }),
          (operation, forward) => forward(operation),
        ]);
        expect(warningStub).toHaveBeenCalledTimes(1);
      });

      it("should warn if attempting to add link after termination", () => {
        ApolloLink.from([
          new ApolloLink((operation, forward) => forward(operation)),
          new ApolloLink((operation) => of({ data })),
          new ApolloLink((operation, forward) => forward(operation)),
        ]);
        expect(warningStub).toHaveBeenCalledTimes(1);
      });
    });

    describe("concat", () => {
      it("should warn if attempting to concat to a terminating Link from function", () => {
        const link = new ApolloLink((operation) => of({ data }));
        expect(
          ApolloLink.concat(link, (operation, forward) => forward(operation))
        ).toEqual(link);
        expect(warningStub).toHaveBeenCalledTimes(1);
        expect(warningStub.mock.calls[0][1]).toEqual(link);
      });

      it("should warn if attempting to concat to a terminating Link", () => {
        const link = new ApolloLink((operation) => EMPTY);
        expect(link.concat((operation, forward) => forward(operation))).toEqual(
          link
        );
        expect(warningStub).toHaveBeenCalledTimes(1);
        expect(warningStub.mock.calls[0][1]).toEqual(link);
      });

      it("should not warn if attempting concat a terminating Link at end", () => {
        const link = new ApolloLink((operation, forward) => forward(operation));
        link.concat((operation) => EMPTY);
        expect(warningStub).not.toBeCalled();
      });
    });

    describe("warning", () => {
      it("should include link that terminates", () => {
        const terminatingLink = new ApolloLink((operation) => of({ data }));
        ApolloLink.from([
          new ApolloLink((operation, forward) => forward(operation)),
          new ApolloLink((operation, forward) => forward(operation)),
          terminatingLink,
          new ApolloLink((operation, forward) => forward(operation)),
          new ApolloLink((operation, forward) => forward(operation)),
          new ApolloLink((operation) => of({ data })),
          new ApolloLink((operation, forward) => forward(operation)),
        ]);
        expect(warningStub).toHaveBeenCalledTimes(4);
      });
    });
  });
});
