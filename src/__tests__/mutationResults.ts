import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import { cloneDeep } from "lodash";
import { Observable, Subscription } from "rxjs";

import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient, FetchResult } from "@apollo/client/core";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link/core";
import { MockedResponse, mockSingleLink } from "@apollo/client/testing";

import { ObservableStream, spyOnConsole } from "../testing/internal/index.js";

describe("mutation results", () => {
  const query = gql`
    query todoList {
      todoList(id: 5) {
        id
        todos {
          id
          text
          completed
        }
        filteredTodos: todos(completed: true) {
          id
          text
          completed
        }
      }
      noIdList: todoList(id: 6) {
        id
        todos {
          text
          completed
        }
      }
    }
  `;

  const queryWithTypename = gql`
    query todoList {
      todoList(id: 5) {
        id
        todos {
          id
          text
          completed
          __typename
        }
        filteredTodos: todos(completed: true) {
          id
          text
          completed
          __typename
        }
        __typename
      }
      noIdList: todoList(id: 6) {
        id
        todos {
          text
          completed
          __typename
        }
        __typename
      }
    }
  `;

  const result: any = {
    data: {
      __typename: "Query",
      todoList: {
        __typename: "TodoList",
        id: "5",
        todos: [
          {
            __typename: "Todo",
            id: "3",
            text: "Hello world",
            completed: false,
          },
          {
            __typename: "Todo",
            id: "6",
            text: "Second task",
            completed: false,
          },
          {
            __typename: "Todo",
            id: "12",
            text: "Do other stuff",
            completed: false,
          },
        ],
        filteredTodos: [],
      },
      noIdList: {
        __typename: "TodoList",
        id: "7",
        todos: [
          {
            __typename: "Todo",
            text: "Hello world",
            completed: false,
          },
          {
            __typename: "Todo",
            text: "Second task",
            completed: false,
          },
          {
            __typename: "Todo",
            text: "Do other stuff",
            completed: false,
          },
        ],
      },
    },
  };

  function setupObsQuery(...mockedResponses: MockedResponse[]) {
    const client = new ApolloClient({
      link: mockSingleLink(
        {
          request: { query: queryWithTypename } as any,
          result,
        },
        ...mockedResponses
      ),
      cache: new InMemoryCache({
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
        // Passing an empty map enables warnings about missing fields:
        possibleTypes: {},
      }),
    });

    return {
      client,
      obsQuery: client.watchQuery({
        query,
        notifyOnNetworkStatusChange: false,
      }),
    };
  }

  function setupDelayObsQuery(delay: number, ...mockedResponses: any[]) {
    const client = new ApolloClient({
      link: mockSingleLink(
        {
          request: { query: queryWithTypename } as any,
          result,
          delay,
        },
        ...mockedResponses
      ).setOnError((error) => {
        throw error;
      }),
      cache: new InMemoryCache({
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
        // Passing an empty map enables warnings about missing fields:
        possibleTypes: {},
      }),
    });

    return {
      client,
      obsQuery: client.watchQuery({
        query,
        notifyOnNetworkStatusChange: false,
      }),
    };
  }

  it("correctly primes cache for tests", async () => {
    const { client, obsQuery } = setupObsQuery();

    await obsQuery.result().then(() => client.query({ query }));
  });

  it("correctly integrates field changes by default", async () => {
    const mutation = gql`
      mutation setCompleted {
        setCompleted(todoId: "3") {
          id
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: "Mutation",
        setCompleted: {
          __typename: "Todo",
          id: "3",
          completed: true,
        },
      },
    };

    const { client, obsQuery } = setupObsQuery({
      request: { query: mutation },
      result: mutationResult,
    });

    await obsQuery.result();
    await client.mutate({ mutation });
    const newResult = await client.query({ query });
    expect(newResult.data.todoList.todos[0].completed).toBe(true);
  });

  it("correctly integrates field changes by default with variables", async () => {
    const query = gql`
      query getMini($id: ID!) {
        mini(id: $id) {
          id
          cover(maxWidth: 600, maxHeight: 400)
          __typename
        }
      }
    `;
    const mutation = gql`
      mutation upload($signature: String!) {
        mini: submitMiniCoverS3DirectUpload(signature: $signature) {
          id
          cover(maxWidth: 600, maxHeight: 400)
          __typename
        }
      }
    `;

    const link = mockSingleLink(
      {
        request: {
          query,
          variables: { id: 1 },
        } as any,
        delay: 100,
        result: {
          data: { mini: { id: 1, cover: "image", __typename: "Mini" } },
        },
      },
      {
        request: {
          query: mutation,
          variables: { signature: "1234" },
        } as any,
        delay: 150,
        result: {
          data: { mini: { id: 1, cover: "image2", __typename: "Mini" } },
        },
      }
    );

    interface Data {
      mini: { id: number; cover: string; __typename: string };
    }
    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
      }),
    });

    const obs = client.watchQuery<Data>({
      query,
      variables: { id: 1 },
      notifyOnNetworkStatusChange: false,
    });

    const stream = new ObservableStream(obs);
    {
      const result = await stream.takeNext();
      expect(result.data!.mini.cover).toBe("image");
    }
    await client.mutate({ mutation, variables: { signature: "1234" } });
    {
      const result = await stream.takeNext();
      expect(result.data!.mini.cover).toBe("image2");
    }
  });

  it("should write results to cache according to errorPolicy", async () => {
    const expectedFakeError = new GraphQLError("expected/fake error");

    const client = new ApolloClient({
      cache: new InMemoryCache({
        typePolicies: {
          Person: {
            keyFields: ["name"],
          },
        },
      }),

      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            observer.next({
              errors: [expectedFakeError],
              data: {
                newPerson: {
                  __typename: "Person",
                  name: operation.variables.newName,
                },
              },
            });
            observer.complete();
          })
      ),
    });

    const mutation = gql`
      mutation AddNewPerson($newName: String!) {
        newPerson(name: $newName) {
          name
        }
      }
    `;

    await client
      .mutate({
        mutation,
        variables: {
          newName: "Hugh Willson",
        },
      })
      .then(
        () => {
          throw new Error("should have thrown for default errorPolicy");
        },
        (error) => {
          expect(error).toEqual(new CombinedGraphQLErrors([expectedFakeError]));
        }
      );

    expect(client.cache.extract()).toMatchSnapshot();

    const ignoreErrorsResult = await client.mutate({
      mutation,
      errorPolicy: "ignore",
      variables: {
        newName: "Jenn Creighton",
      },
    });

    expect(ignoreErrorsResult).toEqual({
      data: {
        newPerson: {
          __typename: "Person",
          name: "Jenn Creighton",
        },
      },
    });

    expect(client.cache.extract()).toMatchSnapshot();

    const allErrorsResult = await client.mutate({
      mutation,
      errorPolicy: "all",
      variables: {
        newName: "Ellen Shapiro",
      },
    });

    expect(allErrorsResult).toEqual({
      data: {
        newPerson: {
          __typename: "Person",
          name: "Ellen Shapiro",
        },
      },
      errors: [expectedFakeError],
    });

    expect(client.cache.extract()).toMatchSnapshot();
  });

  it("should warn when the result fields don't match the query fields", async () => {
    using _consoleSpies = spyOnConsole.takeSnapshots("error");
    await new Promise((resolve, reject) => {
      let handle: any;
      let subscriptionHandle: Subscription;

      const queryTodos = gql`
        query todos {
          todos {
            id
            name
            description
            __typename
          }
        }
      `;

      const queryTodosResult = {
        data: {
          todos: [
            {
              id: "1",
              name: "Todo 1",
              description: "Description 1",
              __typename: "todos",
            },
          ],
        },
      };

      const mutationTodo = gql`
        mutation createTodo {
          createTodo {
            id
            name
            # missing field: description
            __typename
          }
        }
      `;

      const mutationTodoResult = {
        data: {
          createTodo: {
            id: "2",
            name: "Todo 2",
            __typename: "createTodo",
          },
        },
      };

      const { client, obsQuery } = setupObsQuery(
        {
          request: { query: queryTodos },
          result: queryTodosResult,
        },
        {
          request: { query: mutationTodo },
          result: mutationTodoResult,
        }
      );

      return obsQuery
        .result()
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise((resolve) => {
            handle = client.watchQuery({ query: queryTodos });
            subscriptionHandle = handle.subscribe({
              next(res: any) {
                resolve(res);
              },
            });
          });
        })
        .then(() =>
          client.mutate({
            mutation: mutationTodo,
            updateQueries: {
              todos: (prev, { mutationResult }) => {
                const newTodo = (mutationResult as any).data.createTodo;
                const newResults = {
                  todos: [...(prev as any).todos, newTodo],
                };
                return newResults;
              },
            },
          })
        )
        .finally(() => subscriptionHandle.unsubscribe())
        .then((result) => {
          expect(result).toEqual(mutationTodoResult);
        })
        .then(resolve, reject);
    });
  });

  describe("InMemoryCache type/field policies", () => {
    const startTime = Date.now();
    const link = new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          observer.next({
            data: {
              __typename: "Mutation",
              doSomething: {
                __typename: "MutationPayload",
                time: startTime,
              },
            },
          });
          observer.complete();
        })
    );

    const mutation = gql`
      mutation DoSomething {
        doSomething {
          time
        }
      }
    `;

    it("mutation update function receives result from cache", () => {
      let timeReadCount = 0;
      let timeMergeCount = 0;

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            MutationPayload: {
              fields: {
                time: {
                  read(ms: number = Date.now()) {
                    ++timeReadCount;
                    return new Date(ms);
                  },
                  merge(existing, incoming: number) {
                    ++timeMergeCount;
                    expect(existing).toBeUndefined();
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      return client
        .mutate({
          mutation,
          update(
            cache,
            {
              data: {
                doSomething: { __typename, time },
              },
            }
          ) {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
            expect(timeReadCount).toBe(1);
            expect(timeMergeCount).toBe(1);
            expect(cache.extract()).toEqual({
              ROOT_MUTATION: {
                __typename: "Mutation",
                doSomething: {
                  __typename: "MutationPayload",
                  time: startTime,
                },
              },
            });
          },
        })
        .then(
          ({
            data: {
              doSomething: { __typename, time },
            },
          }) => {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
            expect(timeReadCount).toBe(1);
            expect(timeMergeCount).toBe(1);

            // The contents of the ROOT_MUTATION object exist only briefly, for the
            // duration of the mutation update, and are removed after the mutation
            // write is finished.
            expect(client.cache.extract()).toEqual({
              ROOT_MUTATION: {
                __typename: "Mutation",
              },
            });
          }
        );
    });

    it("mutations can preserve ROOT_MUTATION cache data with keepRootFields: true", () => {
      let timeReadCount = 0;
      let timeMergeCount = 0;

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            MutationPayload: {
              fields: {
                time: {
                  read(ms: number = Date.now()) {
                    ++timeReadCount;
                    return new Date(ms);
                  },
                  merge(existing, incoming: number) {
                    ++timeMergeCount;
                    expect(existing).toBeUndefined();
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      return client
        .mutate({
          mutation,
          keepRootFields: true,
          update(
            cache,
            {
              data: {
                doSomething: { __typename, time },
              },
            }
          ) {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
            expect(timeReadCount).toBe(1);
            expect(timeMergeCount).toBe(1);
            expect(cache.extract()).toEqual({
              ROOT_MUTATION: {
                __typename: "Mutation",
                doSomething: {
                  __typename: "MutationPayload",
                  time: startTime,
                },
              },
            });
          },
        })
        .then(
          ({
            data: {
              doSomething: { __typename, time },
            },
          }) => {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
            expect(timeReadCount).toBe(1);
            expect(timeMergeCount).toBe(1);

            expect(client.cache.extract()).toEqual({
              ROOT_MUTATION: {
                __typename: "Mutation",
                doSomething: {
                  __typename: "MutationPayload",
                  time: startTime,
                },
              },
            });
          }
        );
    });

    it('mutation update function runs even when fetchPolicy is "no-cache"', async () => {
      let timeReadCount = 0;
      let timeMergeCount = 0;
      let mutationUpdateCount = 0;

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            MutationPayload: {
              fields: {
                time: {
                  read(ms: number = Date.now()) {
                    ++timeReadCount;
                    return new Date(ms);
                  },
                  merge(existing, incoming: number) {
                    ++timeMergeCount;
                    expect(existing).toBeUndefined();
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      return client
        .mutate({
          mutation,
          fetchPolicy: "no-cache",
          update(
            cache,
            {
              data: {
                doSomething: { __typename, time },
              },
            }
          ) {
            expect(++mutationUpdateCount).toBe(1);
            expect(__typename).toBe("MutationPayload");
            expect(time).not.toBeInstanceOf(Date);
            expect(time).toBe(startTime);
            expect(timeReadCount).toBe(0);
            expect(timeMergeCount).toBe(0);
            expect(cache.extract()).toEqual({});
          },
        })
        .then(
          ({
            data: {
              doSomething: { __typename, time },
            },
          }) => {
            expect(__typename).toBe("MutationPayload");
            expect(time).not.toBeInstanceOf(Date);
            expect(time).toBe(+startTime);
            expect(timeReadCount).toBe(0);
            expect(timeMergeCount).toBe(0);
            expect(mutationUpdateCount).toBe(1);
            expect(client.cache.extract()).toEqual({});
          }
        );
    });
  });

  describe("updateQueries", () => {
    const mutation = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          id
          text
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: "Mutation",
        createTodo: {
          id: "99",
          __typename: "Todo",
          text: "This one was created with a mutation.",
          completed: true,
        },
      },
    };

    it("analogous of ARRAY_INSERT", async () => {
      let subscriptionHandle: Subscription;
      const { client, obsQuery } = setupObsQuery({
        request: { query: mutation },
        result: mutationResult,
      });

      await obsQuery
        .result()
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise((resolve) => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) {
                resolve(res);
              },
            });
          });
        })
        .then(() =>
          client.mutate({
            mutation,
            updateQueries: {
              todoList: (prev, options) => {
                const mResult = options.mutationResult as any;
                expect(mResult.data.createTodo.id).toBe("99");
                expect(mResult.data.createTodo.text).toBe(
                  "This one was created with a mutation."
                );
                const state = cloneDeep(prev) as any;
                state.todoList.todos.unshift(mResult.data.createTodo);
                return state;
              },
            },
          })
        )
        .then(() => client.query({ query }))
        .then((newResult: any) => {
          subscriptionHandle.unsubscribe();

          // There should be one more todo item than before
          expect(newResult.data.todoList.todos.length).toBe(4);

          // Since we used `prepend` it should be at the front
          expect(newResult.data.todoList.todos[0].text).toBe(
            "This one was created with a mutation."
          );
        });
    });

    it("does not fail if optional query variables are not supplied", async () => {
      const mutationWithVars = gql`
        mutation createTodo($requiredVar: String!, $optionalVar: String) {
          createTodo(requiredVar: $requiredVar, optionalVar: $optionalVar) {
            id
            text
            completed
            __typename
          }
          __typename
        }
      `;

      // the test will pass if optionalVar is uncommented
      const variables = {
        requiredVar: "x",
        // optionalVar: 'y',
      };
      const { client, obsQuery } = setupObsQuery({
        request: {
          query: mutationWithVars,
          variables,
        },
        result: mutationResult,
      });

      await obsQuery.result();

      // we have to actually subscribe to the query to be able to update it

      const handle = client.watchQuery({
        query,
        variables,
      });
      const stream = new ObservableStream(handle);
      await stream.takeNext();

      await client.mutate({
        mutation: mutationWithVars,
        variables,
        updateQueries: {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;
            expect(mResult.data.createTodo.id).toBe("99");
            expect(mResult.data.createTodo.text).toBe(
              "This one was created with a mutation."
            );
            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        },
      });
      const newResult = await client.query({ query });

      // There should be one more todo item than before
      expect(newResult.data.todoList.todos.length).toBe(4);

      // Since we used `prepend` it should be at the front
      expect(newResult.data.todoList.todos[0].text).toBe(
        "This one was created with a mutation."
      );
    });

    it("does not fail if the query did not complete correctly", async () => {
      const { client, obsQuery } = setupObsQuery({
        request: { query: mutation },
        result: mutationResult,
      });
      const subs = obsQuery.subscribe({
        next: () => null,
      });
      // Cancel the query right away!
      subs.unsubscribe();

      await client.mutate({
        mutation,
        updateQueries: {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;
            expect(mResult.data.createTodo.id).toBe("99");
            expect(mResult.data.createTodo.text).toBe(
              "This one was created with a mutation."
            );

            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        },
      });
    });

    it("does not fail if the query did not finish loading", async () => {
      const { client, obsQuery } = setupDelayObsQuery(15, {
        request: { query: mutation },
        result: mutationResult,
      });
      obsQuery.subscribe({
        next: () => null,
      });
      await client.mutate({
        mutation,
        updateQueries: {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;
            expect(mResult.data.createTodo.id).toBe("99");
            expect(mResult.data.createTodo.text).toBe(
              "This one was created with a mutation."
            );

            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        },
      });
    });

    it("does not make next queries fail if a mutation fails", async () => {
      const { client, obsQuery } = setupObsQuery(
        {
          request: { query: mutation },
          result: { errors: [new Error("mock error")] },
        },
        {
          request: { query: queryWithTypename },
          result,
        }
      );
      const stream = new ObservableStream(obsQuery);
      await stream.takeNext();

      await expect(() =>
        client.mutate({
          mutation,
          updateQueries: {
            todoList: (prev, options) => {
              const mResult = options.mutationResult as any;
              const state = cloneDeep(prev) as any;
              // It's unfortunate that this function is called at all, but we are removing
              // the updateQueries API soon so it won't matter.
              state.todoList.todos.unshift(
                mResult.data && mResult.data.createTodo
              );
              return state;
            },
          },
        })
      ).rejects.toThrow();

      await expect(() =>
        client.mutate({
          mutation,
          updateQueries: {
            todoList: (prev, options) => {
              const mResult = options.mutationResult as any;
              const state = cloneDeep(prev) as any;
              state.todoList.todos.unshift(mResult.data.createTodo);
              return state;
            },
          },
        })
      ).rejects.toThrow();
      await obsQuery.refetch();
    });

    it("error handling in reducer functions", async () => {
      const { client, obsQuery } = setupObsQuery({
        request: { query: mutation },
        result: mutationResult,
      });

      await obsQuery.result();

      // we have to actually subscribe to the query to be able to update it

      const handle = client.watchQuery({ query });
      const stream = new ObservableStream(handle);
      await stream.takeNext();

      await expect(() =>
        client.mutate({
          mutation,
          updateQueries: {
            todoList: () => {
              throw new Error(`Hello... It's me.`);
            },
          },
        })
      ).rejects.toThrow(Error(`Hello... It's me.`));
    });
  });

  it("does not fail if one of the previous queries did not complete correctly", async () => {
    const variableQuery = gql`
      query Echo($message: String) {
        echo(message: $message)
      }
    `;

    const variables1 = {
      message: "a",
    };

    const result1 = {
      data: {
        echo: "a",
      },
    };

    const variables2 = {
      message: "b",
    };

    const result2 = {
      data: {
        echo: "b",
      },
    };

    const resetMutation = gql`
      mutation Reset {
        reset {
          echo
        }
      }
    `;

    const resetMutationResult = {
      data: {
        reset: {
          echo: "0",
        },
      },
    };

    const client = new ApolloClient({
      link: mockSingleLink(
        {
          request: { query: variableQuery, variables: variables1 } as any,
          result: result1,
        },
        {
          request: { query: variableQuery, variables: variables2 } as any,
          result: result2,
        },
        {
          request: { query: resetMutation } as any,
          result: resetMutationResult,
        }
      ),
      cache: new InMemoryCache(),
    });

    const watchedQuery = client.watchQuery({
      query: variableQuery,
      variables: variables1,
    });

    const firstSubs = watchedQuery.subscribe({
      next: () => null,
      error: (error) => {
        throw error;
      },
    });

    // Cancel the query right away!
    firstSubs.unsubscribe();

    const stream = new ObservableStream(watchedQuery);

    await watchedQuery.refetch(variables2);

    {
      const result = await stream.takeNext();

      expect(result.data).toEqual({ echo: "b" });
    }

    await client.mutate({
      mutation: resetMutation,
      updateQueries: {
        Echo: () => {
          return { echo: "0" };
        },
      },
    });

    {
      const result = await stream.takeNext();

      expect(result.data).toEqual({ echo: "0" });
    }
  });

  it("allows mutations with optional arguments", async () => {
    let count = 0;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([
        ({ variables }: any) =>
          new Observable((observer) => {
            switch (count++) {
              case 0:
                expect(variables).toEqual({ a: 1, b: 2 });
                observer.next({ data: { result: "hello" } });
                observer.complete();
                return;
              case 1:
                expect(variables).toEqual({ a: 1, c: 3 });
                observer.next({ data: { result: "world" } });
                observer.complete();
                return;
              case 2:
                expect(variables).toEqual({
                  a: undefined,
                  b: 2,
                  c: 3,
                });
                observer.next({ data: { result: "goodbye" } });
                observer.complete();
                return;
              case 3:
                expect(variables).toEqual({});
                observer.next({ data: { result: "moon" } });
                observer.complete();
                return;
              default:
                observer.error(new Error("Too many network calls."));
                return;
            }
          }),
      ] as any),
    });

    const mutation = gql`
      mutation ($a: Int!, $b: Int, $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    const results = await Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: 2 },
      }),
      client.mutate({
        mutation,
        variables: { a: 1, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { a: undefined, b: 2, c: 3 },
      }),
      client.mutate({
        mutation,
      }),
    ]);
    expect(client.cache.extract()).toEqual({
      ROOT_MUTATION: {
        __typename: "Mutation",
      },
    });
    expect(results).toEqual([
      { data: { result: "hello" } },
      { data: { result: "world" } },
      { data: { result: "goodbye" } },
      { data: { result: "moon" } },
    ]);
  });

  it("allows mutations with default values", async () => {
    let count = 0;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([
        ({ variables }: any) =>
          new Observable((observer) => {
            switch (count++) {
              case 0:
                expect(variables).toEqual({
                  a: 1,
                  b: "water",
                });
                observer.next({ data: { result: "hello" } });
                observer.complete();
                return;
              case 1:
                expect(variables).toEqual({
                  a: 2,
                  b: "cheese",
                  c: 3,
                });
                observer.next({ data: { result: "world" } });
                observer.complete();
                return;
              case 2:
                expect(variables).toEqual({
                  a: 1,
                  b: "cheese",
                  c: 3,
                });
                observer.next({ data: { result: "goodbye" } });
                observer.complete();
                return;
              default:
                observer.error(new Error("Too many network calls."));
                return;
            }
          }),
      ] as any),
    });

    const mutation = gql`
      mutation ($a: Int = 1, $b: String = "cheese", $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    const results = await Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: "water" },
      }),
      client.mutate({
        mutation,
        variables: { a: 2, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { c: 3 },
      }),
    ]);
    expect(client.cache.extract()).toEqual({
      ROOT_MUTATION: {
        __typename: "Mutation",
      },
    });
    expect(results).toEqual([
      { data: { result: "hello" } },
      { data: { result: "world" } },
      { data: { result: "goodbye" } },
    ]);
  });

  it("will pass null to the network interface when provided", async () => {
    let count = 0;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([
        ({ variables }: any) =>
          new Observable((observer) => {
            switch (count++) {
              case 0:
                expect(variables).toEqual({
                  a: 1,
                  b: 2,
                  c: null,
                });
                observer.next({ data: { result: "hello" } });
                observer.complete();
                return;
              case 1:
                expect(variables).toEqual({
                  a: 1,
                  b: null,
                  c: 3,
                });
                observer.next({ data: { result: "world" } });
                observer.complete();
                return;
              case 2:
                expect(variables).toEqual({
                  a: null,
                  b: null,
                  c: null,
                });
                observer.next({ data: { result: "moon" } });
                observer.complete();
                return;
              default:
                observer.error(new Error("Too many network calls."));
                return;
            }
          }),
      ] as any),
    });

    const mutation = gql`
      mutation ($a: Int!, $b: Int, $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    const results = await Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: 2, c: null },
      }),
      client.mutate({
        mutation,
        variables: { a: 1, b: null, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { a: null, b: null, c: null },
      }),
    ]);
    expect(client.cache.extract()).toEqual({
      ROOT_MUTATION: {
        __typename: "Mutation",
      },
    });
    expect(results).toEqual([
      { data: { result: "hello" } },
      { data: { result: "world" } },
      { data: { result: "moon" } },
    ]);
  });

  describe("store transaction updater", () => {
    const mutation = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          id
          text
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: "Mutation",
        createTodo: {
          id: "99",
          __typename: "Todo",
          text: "This one was created with a mutation.",
          completed: true,
        },
      },
    };

    it("analogous of ARRAY_INSERT", async () => {
      const { client, obsQuery } = setupObsQuery({
        request: { query: mutation },
        result: mutationResult,
      });

      await obsQuery.result();

      // we have to actually subscribe to the query to be able to update it

      const handle = client.watchQuery({ query });
      const stream = new ObservableStream(handle);
      await stream.takeNext();
      await client.mutate({
        mutation,
        update: (proxy, mResult: any) => {
          expect(mResult.data.createTodo.id).toBe("99");
          expect(mResult.data.createTodo.text).toBe(
            "This one was created with a mutation."
          );

          const id = "TodoList5";
          const fragment = gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `;

          const data: any = proxy.readFragment({ id, fragment });

          proxy.writeFragment({
            data: {
              ...data,
              todos: [mResult.data.createTodo, ...data.todos],
            },
            id,
            fragment,
          });
        },
      });

      const newResult = await client.query({ query });

      // There should be one more todo item than before
      expect(newResult.data.todoList.todos.length).toBe(4);

      // Since we used `prepend` it should be at the front
      expect(newResult.data.todoList.todos[0].text).toBe(
        "This one was created with a mutation."
      );
    });

    it("does not fail if optional query variables are not supplied", async () => {
      const mutationWithVars = gql`
        mutation createTodo($requiredVar: String!, $optionalVar: String) {
          createTodo(requiredVar: $requiredVar, optionalVar: $optionalVar) {
            id
            text
            completed
            __typename
          }
          __typename
        }
      `;

      // the test will pass if optionalVar is uncommented
      const variables = {
        requiredVar: "x",
        // optionalVar: 'y',
      };

      const { client, obsQuery } = setupObsQuery({
        request: {
          query: mutationWithVars,
          variables,
        },
        result: mutationResult,
      });

      await obsQuery.result();

      // we have to actually subscribe to the query to be able to update it

      const handle = client.watchQuery({
        query,
        variables,
      });
      const stream = new ObservableStream(handle);
      await stream.takeNext();

      await client.mutate({
        mutation: mutationWithVars,
        variables,
        update: (proxy, mResult: any) => {
          expect(mResult.data.createTodo.id).toBe("99");
          expect(mResult.data.createTodo.text).toBe(
            "This one was created with a mutation."
          );

          const id = "TodoList5";
          const fragment = gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `;

          const data: any = proxy.readFragment({ id, fragment });

          proxy.writeFragment({
            data: {
              ...data,
              todos: [mResult.data.createTodo, ...data.todos],
            },
            id,
            fragment,
          });
        },
      });
      const newResult = await client.query({ query });

      // There should be one more todo item than before
      expect(newResult.data.todoList.todos.length).toBe(4);

      // Since we used `prepend` it should be at the front
      expect(newResult.data.todoList.todos[0].text).toBe(
        "This one was created with a mutation."
      );
    });

    it("does not make next queries fail if a mutation fails", async () => {
      const { client, obsQuery } = setupObsQuery(
        {
          request: { query: mutation },
          result: { errors: [new Error("mock error")] },
        },
        {
          request: { query: queryWithTypename },
          result,
        }
      );

      const stream = new ObservableStream(obsQuery);
      await stream.takeNext();

      await expect(
        client.mutate({
          mutation,
          update: (proxy, mResult: any) => {
            expect(mResult.data.createTodo.id).toBe("99");
            expect(mResult.data.createTodo.text).toBe(
              "This one was created with a mutation."
            );

            const id = "TodoList5";
            const fragment = gql`
              fragment todoList on TodoList {
                todos {
                  id
                  text
                  completed
                  __typename
                }
              }
            `;

            const data: any = proxy.readFragment({ id, fragment });

            proxy.writeFragment({
              data: {
                ...data,
                todos: [mResult.data.createTodo, ...data.todos],
              },
              id,
              fragment,
            });
          },
        })
      ).rejects.toThrow();
      await expect(
        client.mutate({
          mutation,
          update: (proxy, mResult: any) => {
            expect(mResult.data.createTodo.id).toBe("99");
            expect(mResult.data.createTodo.text).toBe(
              "This one was created with a mutation."
            );

            const id = "TodoList5";
            const fragment = gql`
              fragment todoList on TodoList {
                todos {
                  id
                  text
                  completed
                  __typename
                }
              }
            `;

            const data: any = proxy.readFragment({ id, fragment });

            proxy.writeFragment({
              data: {
                ...data,
                todos: [mResult.data.createTodo, ...data.todos],
              },
              id,
              fragment,
            });
          },
        })
      ).rejects.toThrow();
      await obsQuery.refetch();
    });

    it("error handling in reducer functions", async () => {
      const { client, obsQuery } = setupObsQuery({
        request: { query: mutation },
        result: mutationResult,
      });

      await obsQuery.result();
      // we have to actually subscribe to the query to be able to update it

      const handle = client.watchQuery({ query });
      const stream = new ObservableStream(handle);
      await stream.takeNext();

      await expect(
        client.mutate({
          mutation,
          update: () => {
            throw new Error(`Hello... It's me.`);
          },
        })
      ).rejects.toThrow(Error(`Hello... It's me.`));
    });

    it("mutate<MyType>() data should never be `undefined` in case of success", async () => {
      const mutation = gql`
        mutation Foo {
          foo {
            bar
          }
        }
      `;

      const result1 = {
        data: {
          foo: {
            bar: "a",
          },
        },
      };

      const client = new ApolloClient({
        link: mockSingleLink({
          request: { query: mutation } as any,
          result: result1,
        }),
        cache: new InMemoryCache(),
      });

      const result = await client.mutate<{ foo: { bar: string } }>({
        mutation: mutation,
      });
      // This next line should **not** raise "TS2533: Object is possibly 'null' or 'undefined'.", even without `!` operator
      if (!result.data?.foo.bar) {
        throw new Error("data was unexpectedly undefined");
      }
    });

    it("data might be undefined in case of failure with errorPolicy = ignore", async () => {
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          () =>
            new Observable<FetchResult<{ foo: string }>>((observer) => {
              observer.next({
                errors: [new GraphQLError("Oops")],
              });
              observer.complete();
            })
        ),
      });

      const ignoreErrorsResult = await client.mutate({
        mutation: gql`
          mutation Foo {
            foo
          }
        `,
        fetchPolicy: "no-cache",
        errorPolicy: "ignore",
      });

      expect(ignoreErrorsResult).toEqual({
        data: undefined,
        errors: undefined,
      });
    });
  });
});
