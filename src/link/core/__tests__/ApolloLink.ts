import type { FormattedExecutionResult } from "graphql";
import { OperationTypeNode, print } from "graphql";
import { gql } from "graphql-tag";
import { EMPTY, map, Observable, of } from "rxjs";

import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloLink, execute } from "@apollo/client/link";
import {
  ObservableStream,
  spyOnConsole,
} from "@apollo/client/testing/internal";

class SetContextLink extends ApolloLink {
  constructor(
    private setContext: (
      context: Record<string, any>
    ) => Record<string, any> = (c) => c
  ) {
    super();
  }

  public request(
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ): Observable<ApolloLink.Result> {
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
  client: new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  }),
};

describe("ApolloLink", () => {
  test("warns if the link provided to execute calls forward", async () => {
    using _ = spyOnConsole("warn");

    const link = new ApolloLink((operation, forward) => {
      return forward(operation);
    });

    const stream = new ObservableStream(
      execute(link, { query: sampleQuery }, defaultExecuteContext)
    );

    await expect(stream).toComplete();

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "The terminating link provided to `ApolloLink.execute`"
      )
    );
  });

  describe("context", () => {
    it("merges context", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock = new ApolloLink((op, forward) => {
        op.setContext({ add: 3 });
        op.setContext({ subtract: 1 });

        return forward(op);
      });
      const link = returnOne.concat(mock).concat(
        new ApolloLink((op) => {
          expect(op.getContext()).toEqual({
            add: 3,
            subtract: 1,
          });
          return of({ data: { count: op.getContext().add } });
        })
      );
      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 3 } });
      await expect(stream).toComplete();
    });
  });

  describe("concat", () => {
    it("concats a Link", async () => {
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

    it("concats multiple links when chaining concat calls", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock1 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 2,
        });
        return forward(operation);
      });
      const mock2 = new ApolloLink((op) =>
        of({ data: { count: op.getContext().add } })
      );

      const link = returnOne.concat(mock1).concat(mock2);

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      await expect(stream).toEmitTypedValue({ data: { count: 3 } });
      await expect(stream).toComplete();
    });

    it("returns a link that can be concat'd multiple times", async () => {
      const returnOne = new SetContextLink(setContext);
      const mock1 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 2,
        });
        return forward(operation);
      });
      const mock2 = new ApolloLink((op) =>
        of({ data: { count: op.getContext().add + 2 } })
      );
      const mock3 = new ApolloLink((op) =>
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

    it("can provide multiple links to concat", async () => {
      const add1 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 1,
        });
        return forward(operation);
      });
      const add2 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 2,
        });
        return forward(operation);
      });
      const add3 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 3,
        });
        return forward(operation);
      });

      const calculate = new ApolloLink((operation) =>
        of({ data: { count: operation.getContext().add } })
      );

      const link = add1.concat(add2, add3, calculate);

      const stream = new ObservableStream(
        execute(
          link,
          { query: sampleQuery, context: { add: 0 } },
          defaultExecuteContext
        )
      );

      await expect(stream).toEmitTypedValue({ data: { count: 6 } });
      await expect(stream).toComplete();
    });

    it("can provide multiple links to static concat", async () => {
      const add1 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 1,
        });
        return forward(operation);
      });
      const add2 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 2,
        });
        return forward(operation);
      });
      const add3 = new ApolloLink((operation, forward) => {
        operation.setContext({
          add: operation.getContext().add + 3,
        });
        return forward(operation);
      });

      const calculate = new ApolloLink((operation) =>
        of({ data: { count: operation.getContext().add } })
      );

      const link = ApolloLink.concat(add1, add2, add3, calculate);

      const stream = new ObservableStream(
        execute(
          link,
          { query: sampleQuery, context: { add: 0 } },
          defaultExecuteContext
        )
      );

      await expect(stream).toEmitTypedValue({ data: { count: 6 } });
      await expect(stream).toComplete();
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
    it("transforms an operation with context into something serlizable", async () => {
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
            query: print(operation.query),
            variables: { id: 1 },
            extensions: { cache: true },
            operationType: OperationTypeNode.QUERY,
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

      it("should set a default context, variable, and query on a copy of operation", async () => {
        const operation = {
          query: gql`
            {
              id
            }
          `,
        };
        const link = new ApolloLink((op: ApolloLink.Operation) => {
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
    const uniqueOperation: ApolloLink.Request = {
      query: sampleQuery,
      context: { name: "uniqueName" },
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
      const data: ApolloLink.Result = {
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

      expect(stub).toHaveBeenCalledWith(
        {
          query: sampleQuery,
          operationName: "SampleQuery",
          operationType: OperationTypeNode.QUERY,
          variables: {},
          extensions: {},
        },
        expect.any(Function)
      );
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
          expect(op).toStrictEqualTyped({
            extensions: {},
            operationName: "SampleQuery",
            operationType: OperationTypeNode.QUERY,
            query: sampleQuery,
            variables: {},
          });

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
      const data: ApolloLink.Result = {
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
      const data: ApolloLink.Result = {
        data: {
          hello: "world",
        },
      };

      const chain = ApolloLink.from([
        new ApolloLink((op, forward) => {
          const observable = forward(
            op
          ) as Observable<FormattedExecutionResult>;

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
      const add1 = new ApolloLink(
        (
          operation: ApolloLink.Operation,
          forward: ApolloLink.ForwardFunction
        ) => {
          operation.setContext((context: { num: number }) => ({
            num: context.num + 1,
          }));
          return forward(operation);
        }
      );
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
    it("conditionally routes request to the proper link", async () => {
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

    it("allows concat after split to be joined", async () => {
      const context = { test: true, add: 1 };
      const start = new SetContextLink(() => ({ ...context }));
      const link = start
        .split(
          (operation) => operation.getContext().test,
          new ApolloLink((operation, forward) => {
            operation.setContext((context: { add: number }) => ({
              add: context.add + 1,
            }));
            return forward(operation);
          }),
          new ApolloLink((operation, forward) => {
            operation.setContext((context: { add: number }) => ({
              add: context.add + 2,
            }));
            return forward(operation);
          })
        )
        .concat(
          new ApolloLink((operation) =>
            of({ data: { count: operation.getContext().add } })
          )
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
      // Silence warning about `right` link calling forward
      using _ = spyOnConsole("warn");
      let context = { test: true };
      const start = new SetContextLink(() => context);
      const link = start.split(
        (operation) => operation.getContext().test,
        new ApolloLink(() =>
          of({
            data: {
              count: 1,
            },
          })
        )
      );
      const concat = link.concat(
        new ApolloLink(() =>
          of({
            data: {
              count: 2,
            },
          })
        )
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
      // Silence warning about `right` link calling forward
      using _ = spyOnConsole("warn");
      const link = ApolloLink.split(
        (operation) => operation.getContext().test,
        new ApolloLink(() => of({ data: { count: 1 } }))
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

    it("should split two Links", async () => {
      const link = ApolloLink.split(
        (operation) => operation.getContext().test,
        new ApolloLink(() => of({ data: { count: 1 } })),
        new ApolloLink(() => of({ data: { count: 2 } }))
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
        new ApolloLink((operation, forward) =>
          (
            forward(operation) as Observable<FormattedExecutionResult<any>>
          ).pipe(
            map((data) => ({
              data: { count: data.data!.count + 1 },
            }))
          )
        )
      ).concat(new ApolloLink(() => of({ data: { count: 1 } })));

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
        new ApolloLink(() => of({ data: { count: 2 } }))
      ).concat(new ApolloLink(() => of({ data: { count: 1 } })));

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

    test("warns when `split` test function returns non-boolean value", async () => {
      using consoleSpy = spyOnConsole("warn");

      const empty = new ApolloLink(() => of());

      [undefined, "truthy", 0].forEach((value) => {
        consoleSpy.warn.mockClear();
        const link = ApolloLink.split(() => value as any, empty, empty);

        execute(link, { query: sampleQuery }, defaultExecuteContext);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          "[ApolloLink.split]: The test function returned a non-boolean value which could result in subtle bugs (e.g. such as using an `async` function which always returns a truthy value). Got `%o`.",
          value
        );
      });
    });

    test("warns when `split` test function uses async function", async () => {
      using _ = spyOnConsole("warn");

      const left = new ApolloLink(() => of({ data: { link: "left" } }));
      const right = new ApolloLink(() => of({ data: { link: "right" } }));
      const link = ApolloLink.split((async () => false) as any, left, right);

      const stream = new ObservableStream(
        execute(link, { query: sampleQuery }, defaultExecuteContext)
      );

      // This demonstrates that the "left" link is used because of the async
      // function even though it seems like it should use the "right" link
      await expect(stream).toEmitTypedValue({ data: { link: "left" } });
      await expect(stream).toComplete();

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        "[ApolloLink.split]: The test function returned a non-boolean value which could result in subtle bugs (e.g. such as using an `async` function which always returns a truthy value). Got `%o`.",
        expect.anything()
      );
    });
  });
});
