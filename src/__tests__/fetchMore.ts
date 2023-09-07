import { assign, cloneDeep } from "lodash";
import gql from "graphql-tag";

import {
  ApolloClient,
  ApolloLink,
  NetworkStatus,
  ObservableQuery,
  TypedDocumentNode,
} from "../core";

import {
  Observable,
  offsetLimitPagination,
  concatPagination,
} from "../utilities";

import {
  ApolloCache,
  InMemoryCache,
  InMemoryCacheConfig,
  FieldMergeFunction,
} from "../cache";

import { itAsync, mockSingleLink, subscribeAndCount } from "../testing";

describe("updateQuery on a simple query", () => {
  const query = gql`
    query thing {
      entry {
        value
        __typename
      }
      __typename
    }
  `;
  const result = {
    data: {
      __typename: "Query",
      entry: {
        __typename: "Entry",
        value: 1,
      },
    },
  };

  itAsync("triggers new result from updateQuery", (resolve, reject) => {
    let latestResult: any = null;
    const link = mockSingleLink({
      request: { query },
      result,
    }).setOnError(reject);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obsHandle = client.watchQuery({
      query,
    });
    const sub = obsHandle.subscribe({
      next(queryResult: any) {
        // do nothing
        latestResult = queryResult;
      },
    });

    return new Promise((resolve) => setTimeout(resolve, 5))
      .then(() => obsHandle)
      .then((watchedQuery: ObservableQuery<any>) => {
        expect(latestResult.data.entry.value).toBe(1);
        watchedQuery.updateQuery((prevResult: any) => {
          const res = cloneDeep(prevResult);
          res.entry.value = 2;
          return res;
        });
      })
      .then(() => expect(latestResult.data.entry.value).toBe(2))
      .then(() => sub.unsubscribe())
      .then(resolve, reject);
  });
});

describe("updateQuery on a query with required and optional variables", () => {
  const query = gql`
    query thing($requiredVar: String!, $optionalVar: String) {
      entry(requiredVar: $requiredVar, optionalVar: $optionalVar) {
        value
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
  const result = {
    data: {
      __typename: "Query",
      entry: {
        __typename: "Entry",
        value: 1,
      },
    },
  };

  itAsync("triggers new result from updateQuery", (resolve, reject) => {
    let latestResult: any = null;
    const link = mockSingleLink({
      request: {
        query,
        variables,
      },
      result,
    }).setOnError(reject);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const obsHandle = client.watchQuery({
      query,
      variables,
    });
    const sub = obsHandle.subscribe({
      next(queryResult: any) {
        // do nothing
        latestResult = queryResult;
      },
    });

    return new Promise((resolve) => setTimeout(resolve, 5))
      .then(() => obsHandle)
      .then((watchedQuery: ObservableQuery<any, any>) => {
        expect(latestResult.data.entry.value).toBe(1);
        watchedQuery.updateQuery((prevResult: any) => {
          const res = cloneDeep(prevResult);
          res.entry.value = 2;
          return res;
        });
      })
      .then(() => expect(latestResult.data.entry.value).toBe(2))
      .then(() => sub.unsubscribe())
      .then(resolve, reject);
  });
});

describe("fetchMore on an observable query", () => {
  type TCommentData = {
    entry: {
      __typename: string;
      comments: Array<{
        __typename: string;
        text: string;
      }>;
    };
  };

  type TCommentVars = {
    repoName: string;
    start: number;
    limit: number;
  };

  const query: TypedDocumentNode<TCommentData, TCommentVars> = gql`
    query Comment($repoName: String!, $start: Int!, $limit: Int!) {
      entry(repoFullName: $repoName) {
        comments(start: $start, limit: $limit) {
          text
          __typename
        }
        __typename
      }
    }
  `;
  const query2: TypedDocumentNode<
    TCommentData["entry"],
    Omit<TCommentVars, "repoName">
  > = gql`
    query NewComments($start: Int!, $limit: Int!) {
      comments(start: $start, limit: $limit) {
        text
        __typename
      }
      __typename
    }
  `;
  const variables = {
    repoName: "org/repo",
    start: 0,
    limit: 10,
  };
  const variablesMore = assign({}, variables, { start: 10, limit: 10 });
  const variables2 = {
    start: 10,
    limit: 20,
  };

  const result: any = {
    data: {
      __typename: "Query",
      entry: {
        __typename: "Entry",
        comments: [],
      },
    },
  };
  const resultMore = cloneDeep(result);
  const result2: any = {
    data: {
      __typename: "Query",
      comments: [],
    },
  };
  for (let i = 1; i <= 10; i++) {
    result.data.entry.comments.push({
      text: `comment ${i}`,
      __typename: "Comment",
    });
  }
  for (let i = 11; i <= 20; i++) {
    resultMore.data.entry.comments.push({
      text: `comment ${i}`,
      __typename: "Comment",
    });
    result2.data.comments.push({
      text: `new comment ${i}`,
      __typename: "Comment",
    });
  }

  function setup(reject: (reason: any) => any, ...mockedResponses: any[]) {
    const link = mockSingleLink(
      {
        request: {
          query,
          variables,
        },
        result,
      },
      ...mockedResponses
    ).setOnError(reject);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              entry: {
                merge: false,
              },
            },
          },
        },
      }),
    });

    return client.watchQuery({
      query,
      variables,
    });
  }

  function setupWithCacheConfig(
    reject: (reason: any) => any,
    cacheConfig: InMemoryCacheConfig,
    ...mockedResponses: any[]
  ) {
    const client = new ApolloClient({
      link: mockSingleLink(
        {
          request: {
            query,
            variables,
          },
          result,
        },
        ...mockedResponses
      ).setOnError(reject),
      cache: new InMemoryCache(cacheConfig),
    });

    return client.watchQuery({
      query,
      variables,
    });
  }

  describe("triggers new result with async new variables", () => {
    itAsync("updateQuery", (resolve, reject) => {
      const observable = setup(reject, {
        request: {
          query,
          variables: variablesMore,
        },
        result: resultMore,
      });

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result.loading).toBe(false);
          expect(result.data.entry.comments).toHaveLength(10);

          return observable
            .fetchMore({
              // Rely on the fact that the original variables had limit: 10
              variables: { start: 10 },
              updateQuery: (prev, options) => {
                expect(options.variables).toEqual(variablesMore);

                const state = cloneDeep(prev) as any;
                state.entry.comments = [
                  ...state.entry.comments,
                  ...options.fetchMoreResult.entry.comments,
                ];
                return state;
              },
            })
            .then((fetchMoreResult) => {
              // This is the server result
              expect(fetchMoreResult.loading).toBe(false);
              expect(fetchMoreResult.data.entry.comments).toHaveLength(10);
            });
        } else if (count === 2) {
          const combinedComments = result.data.entry.comments;
          expect(combinedComments).toHaveLength(20);
          for (let i = 1; i <= 20; i++) {
            expect(combinedComments[i - 1].text).toEqual(`comment ${i}`);
          }

          setTimeout(resolve, 10);
        } else {
          reject(`Too many results (${JSON.stringify({ count, result })})`);
        }
      });
    });

    itAsync("field policy", (resolve, reject) => {
      const observable = setupWithCacheConfig(
        reject,
        {
          typePolicies: {
            Entry: {
              fields: {
                comments: concatPagination(),
              },
            },
          },
        },
        {
          request: { query, variables: variablesMore },
          result: resultMore,
        }
      );

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result.loading).toBe(false);
          expect(result.data.entry.comments).toHaveLength(10);

          return observable
            .fetchMore({
              // Rely on the fact that the original variables had limit: 10
              variables: { start: 10 },
            })
            .then((fetchMoreResult) => {
              // This is the server result
              expect(fetchMoreResult.loading).toBe(false);
              expect(fetchMoreResult.data.entry.comments).toHaveLength(10);
            })
            .catch(reject);
        } else if (count === 2) {
          expect(result.loading).toBe(false);
          const combinedComments = result.data.entry.comments;
          expect(combinedComments).toHaveLength(20);
          combinedComments.forEach((comment, i) => {
            expect(comment.text).toEqual(`comment ${i + 1}`);
          });

          setTimeout(resolve, 10);
        } else {
          reject(`Too many results (${JSON.stringify({ count, result })})`);
        }
      });
    });
  });

  describe("basic fetchMore results merging", () => {
    itAsync("updateQuery", (resolve, reject) => {
      const observable = setup(reject, {
        request: {
          query,
          variables: variablesMore,
        },
        result: resultMore,
      });

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result.loading).toBe(false);
          expect(result.data.entry.comments).toHaveLength(10);

          return observable
            .fetchMore({
              variables: { start: 10 }, // rely on the fact that the original variables had limit: 10
              updateQuery: (prev, options) => {
                expect(options.variables).toEqual(variablesMore);
                const state = cloneDeep(prev) as any;
                state.entry.comments = [
                  ...state.entry.comments,
                  ...options.fetchMoreResult.entry.comments,
                ];
                return state;
              },
            })
            .then((fetchMoreResult) => {
              expect(fetchMoreResult.loading).toBe(false);
              const fetchMoreComments = fetchMoreResult.data.entry.comments;
              expect(fetchMoreComments).toHaveLength(10);
              fetchMoreComments.forEach((comment, i) => {
                expect(comment.text).toEqual(`comment ${i + 11}`);
              });
            });
        } else if (count === 2) {
          expect(result.loading).toBe(false);
          const combinedComments = result.data.entry.comments;
          expect(combinedComments).toHaveLength(20);

          combinedComments.forEach((comment, i) => {
            expect(comment.text).toEqual(`comment ${i + 1}`);
          });

          setTimeout(resolve, 10);
        } else {
          reject(`Too many results (${JSON.stringify({ count, result })})`);
        }
      });
    });

    itAsync("field policy", (resolve, reject) => {
      const observable = setupWithCacheConfig(
        reject,
        {
          typePolicies: {
            Entry: {
              fields: {
                comments: concatPagination(),
              },
            },
          },
        },
        {
          request: {
            query,
            variables: variablesMore,
          },
          result: resultMore,
        }
      );

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result.loading).toBe(false);
          expect(result.data.entry.comments).toHaveLength(10);

          return observable
            .fetchMore({
              // rely on the fact that the original variables had limit: 10
              variables: { start: 10 },
            })
            .then((fetchMoreResult) => {
              expect(fetchMoreResult.loading).toBe(false);
              expect(fetchMoreResult.data.entry.comments).toHaveLength(10); // this is the server result
            })
            .catch(reject);
        } else if (count === 2) {
          expect(result.loading).toBe(false);
          const combinedComments = result.data.entry.comments;
          expect(combinedComments).toHaveLength(20);
          combinedComments.forEach((comment, i) => {
            expect(comment.text).toEqual(`comment ${i + 1}`);
          });

          setTimeout(resolve, 10);
        } else {
          reject(`Too many results (${JSON.stringify({ count, result })})`);
        }
      });
    });
  });

  describe("fetchMore interaction with network fetch policies", () => {
    const tasks = [
      { __typename: "Task", id: 1, text: "first task" },
      { __typename: "Task", id: 2, text: "second task" },
      { __typename: "Task", id: 3, text: "third task" },
      { __typename: "Task", id: 4, text: "fourth task" },
      { __typename: "Task", id: 5, text: "fifth task" },
      { __typename: "Task", id: 6, text: "sixth task" },
      { __typename: "Task", id: 7, text: "seventh task" },
      { __typename: "Task", id: 8, text: "eighth task" },
    ];

    const query = gql`
      query GetTODOs {
        TODO {
          id
          text
        }
      }
    `;

    function makeClient(): {
      client: ApolloClient<any>;
      linkRequests: Array<{
        operationName: string;
        offset: number;
        limit: number;
      }>;
    } {
      const linkRequests: Array<{
        operationName: string;
        offset: number;
        limit: number;
      }> = [];

      const client = new ApolloClient({
        link: new ApolloLink(
          (operation) =>
            new Observable((observer) => {
              const {
                variables: { offset = 0, limit = 2 },
              } = operation;

              linkRequests.push({
                operationName: operation.operationName,
                offset,
                limit,
              });

              observer.next({
                data: {
                  TODO: tasks.slice(offset, offset + limit),
                },
              });

              observer.complete();
            })
        ),

        cache: new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                TODO: concatPagination(),
              },
            },
          },
        }),
      });

      return {
        client,
        linkRequests,
      };
    }

    function checkCacheExtract1234678(cache: ApolloCache<any>) {
      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          TODO: [
            { __ref: "Task:1" },
            { __ref: "Task:2" },
            { __ref: "Task:3" },
            { __ref: "Task:4" },
            { __ref: "Task:6" },
            { __ref: "Task:7" },
            { __ref: "Task:8" },
          ],
        },
        "Task:1": tasks[0],
        "Task:2": tasks[1],
        "Task:3": tasks[2],
        "Task:4": tasks[3],
        "Task:6": tasks[5],
        "Task:7": tasks[6],
        "Task:8": tasks[7],
      });
    }

    itAsync("cache-and-network", (resolve, reject) => {
      const { client, linkRequests } = makeClient();

      const observable = client.watchQuery({
        query,
        fetchPolicy: "cache-and-network",
        variables: {
          offset: 0,
          limit: 2,
        },
      });

      expect(linkRequests.length).toBe(0);

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              TODO: tasks.slice(0, 2),
            },
          });

          expect(linkRequests).toEqual([
            { operationName: "GetTODOs", offset: 0, limit: 2 },
          ]);

          observable
            .fetchMore({
              variables: {
                offset: 2,
              },
            })
            .then((fetchMoreResult) => {
              expect(fetchMoreResult).toEqual({
                loading: false,
                networkStatus: NetworkStatus.ready,
                data: {
                  TODO: tasks.slice(2, 4),
                },
              });
            })
            .catch(reject);
        } else if (count === 2) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              TODO: tasks.slice(0, 4),
            },
          });

          expect(linkRequests).toEqual([
            { operationName: "GetTODOs", offset: 0, limit: 2 },
            { operationName: "GetTODOs", offset: 2, limit: 2 },
          ]);

          return observable
            .fetchMore({
              variables: {
                offset: 5,
                limit: 3,
              },
            })
            .then((fetchMoreResult) => {
              expect(fetchMoreResult).toEqual({
                loading: false,
                networkStatus: NetworkStatus.ready,
                data: {
                  TODO: tasks.slice(5, 8),
                },
              });
            });
        } else if (count === 3) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              TODO: [...tasks.slice(0, 4), ...tasks.slice(5, 8)],
            },
          });

          expect(linkRequests).toEqual([
            { operationName: "GetTODOs", offset: 0, limit: 2 },
            { operationName: "GetTODOs", offset: 2, limit: 2 },
            { operationName: "GetTODOs", offset: 5, limit: 3 },
          ]);

          checkCacheExtract1234678(client.cache);

          // Wait 20ms to allow unexpected results to be delivered, failing in
          // the else block below.
          setTimeout(resolve, 20);
        } else {
          reject(`too many results (${count})`);
        }
      });
    });

    itAsync(
      "cache-and-network with notifyOnNetworkStatusChange: true",
      (resolve, reject) => {
        const { client, linkRequests } = makeClient();

        const observable = client.watchQuery({
          query,
          fetchPolicy: "cache-and-network",
          notifyOnNetworkStatusChange: true,
          variables: {
            offset: 0,
            limit: 2,
          },
        });

        expect(linkRequests.length).toBe(0);

        subscribeAndCount(reject, observable, (count, result) => {
          if (count === 1) {
            expect(result).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: {
                TODO: tasks.slice(0, 2),
              },
            });

            expect(linkRequests).toEqual([
              { operationName: "GetTODOs", offset: 0, limit: 2 },
            ]);

            observable
              .fetchMore({
                variables: {
                  offset: 2,
                },
              })
              .then((fetchMoreResult) => {
                expect(fetchMoreResult).toEqual({
                  loading: false,
                  networkStatus: NetworkStatus.ready,
                  data: {
                    TODO: tasks.slice(2, 4),
                  },
                });
              })
              .catch(reject);
          } else if (count === 2) {
            expect(result).toEqual({
              loading: true,
              networkStatus: NetworkStatus.fetchMore,
              data: {
                TODO: tasks.slice(0, 2),
              },
            });
          } else if (count === 3) {
            expect(result).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: {
                TODO: tasks.slice(0, 4),
              },
            });

            expect(linkRequests).toEqual([
              { operationName: "GetTODOs", offset: 0, limit: 2 },
              { operationName: "GetTODOs", offset: 2, limit: 2 },
            ]);

            return observable
              .fetchMore({
                variables: {
                  offset: 5,
                  limit: 3,
                },
              })
              .then((fetchMoreResult) => {
                expect(fetchMoreResult).toEqual({
                  loading: false,
                  networkStatus: NetworkStatus.ready,
                  data: {
                    TODO: tasks.slice(5, 8),
                  },
                });
              });
          } else if (count === 4) {
            expect(result).toEqual({
              loading: true,
              networkStatus: NetworkStatus.fetchMore,
              data: {
                TODO: tasks.slice(0, 4),
              },
            });
          } else if (count === 5) {
            expect(result).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: {
                TODO: [...tasks.slice(0, 4), ...tasks.slice(5, 8)],
              },
            });

            expect(linkRequests).toEqual([
              { operationName: "GetTODOs", offset: 0, limit: 2 },
              { operationName: "GetTODOs", offset: 2, limit: 2 },
              { operationName: "GetTODOs", offset: 5, limit: 3 },
            ]);

            checkCacheExtract1234678(client.cache);

            // Wait 20ms to allow unexpected results to be delivered, failing in
            // the else block below.
            setTimeout(resolve, 20);
          } else {
            reject(`too many results (${count})`);
          }
        });
      }
    );

    itAsync("network-only", (resolve, reject) => {
      const { client, linkRequests } = makeClient();

      const observable = client.watchQuery({
        query,
        fetchPolicy: "network-only",
        variables: {
          offset: 0,
          limit: 2,
        },
      });

      expect(linkRequests.length).toBe(0);

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              TODO: tasks.slice(0, 2),
            },
          });

          expect(linkRequests).toEqual([
            { operationName: "GetTODOs", offset: 0, limit: 2 },
          ]);

          observable
            .fetchMore({
              variables: {
                offset: 2,
              },
            })
            .then((fetchMoreResult) => {
              expect(fetchMoreResult).toEqual({
                loading: false,
                networkStatus: NetworkStatus.ready,
                data: {
                  TODO: tasks.slice(2, 4),
                },
              });
            })
            .catch(reject);
        } else if (count === 2) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              TODO: tasks.slice(0, 4),
            },
          });

          expect(linkRequests).toEqual([
            { operationName: "GetTODOs", offset: 0, limit: 2 },
            { operationName: "GetTODOs", offset: 2, limit: 2 },
          ]);

          return observable
            .fetchMore({
              variables: {
                offset: 5,
                limit: 3,
              },
            })
            .then((fetchMoreResult) => {
              expect(fetchMoreResult).toEqual({
                loading: false,
                networkStatus: NetworkStatus.ready,
                data: {
                  TODO: tasks.slice(5, 8),
                },
              });
            });
        } else if (count === 3) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              TODO: [...tasks.slice(0, 4), ...tasks.slice(5, 8)],
            },
          });

          expect(linkRequests).toEqual([
            { operationName: "GetTODOs", offset: 0, limit: 2 },
            { operationName: "GetTODOs", offset: 2, limit: 2 },
            { operationName: "GetTODOs", offset: 5, limit: 3 },
          ]);

          checkCacheExtract1234678(client.cache);

          // Wait 20ms to allow unexpected results to be delivered, failing in
          // the else block below.
          setTimeout(resolve, 20);
        } else {
          reject(`too many results (${count})`);
        }
      });
    });

    itAsync(
      "network-only with notifyOnNetworkStatusChange: true",
      (resolve, reject) => {
        const { client, linkRequests } = makeClient();

        const observable = client.watchQuery({
          query,
          fetchPolicy: "network-only",
          notifyOnNetworkStatusChange: true,
          variables: {
            offset: 0,
            limit: 2,
          },
        });

        expect(linkRequests.length).toBe(0);

        subscribeAndCount(reject, observable, (count, result) => {
          if (count === 1) {
            expect(result).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: {
                TODO: tasks.slice(0, 2),
              },
            });

            expect(linkRequests).toEqual([
              { operationName: "GetTODOs", offset: 0, limit: 2 },
            ]);

            observable
              .fetchMore({
                variables: {
                  offset: 2,
                },
              })
              .then((fetchMoreResult) => {
                expect(fetchMoreResult).toEqual({
                  loading: false,
                  networkStatus: NetworkStatus.ready,
                  data: {
                    TODO: tasks.slice(2, 4),
                  },
                });
              })
              .catch(reject);
          } else if (count === 2) {
            expect(result).toEqual({
              loading: true,
              networkStatus: NetworkStatus.fetchMore,
              data: {
                TODO: tasks.slice(0, 2),
              },
            });
          } else if (count === 3) {
            expect(result).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: {
                TODO: tasks.slice(0, 4),
              },
            });

            expect(linkRequests).toEqual([
              { operationName: "GetTODOs", offset: 0, limit: 2 },
              { operationName: "GetTODOs", offset: 2, limit: 2 },
            ]);

            return observable
              .fetchMore({
                variables: {
                  offset: 5,
                  limit: 3,
                },
              })
              .then((fetchMoreResult) => {
                expect(fetchMoreResult).toEqual({
                  loading: false,
                  networkStatus: NetworkStatus.ready,
                  data: {
                    TODO: tasks.slice(5, 8),
                  },
                });
              });
          } else if (count === 4) {
            expect(result).toEqual({
              loading: true,
              networkStatus: NetworkStatus.fetchMore,
              data: {
                TODO: tasks.slice(0, 4),
              },
            });
          } else if (count === 5) {
            expect(result).toEqual({
              loading: false,
              networkStatus: NetworkStatus.ready,
              data: {
                TODO: [...tasks.slice(0, 4), ...tasks.slice(5, 8)],
              },
            });

            expect(linkRequests).toEqual([
              { operationName: "GetTODOs", offset: 0, limit: 2 },
              { operationName: "GetTODOs", offset: 2, limit: 2 },
              { operationName: "GetTODOs", offset: 5, limit: 3 },
            ]);

            checkCacheExtract1234678(client.cache);

            // Wait 20ms to allow unexpected results to be delivered, failing in
            // the else block below.
            setTimeout(resolve, 20);
          } else {
            reject(`too many results (${count})`);
          }
        });
      }
    );

    // itAsync("no-cache", (resolve, reject) => {
    //   const client = makeClient();
    //   resolve();
    // });
  });

  itAsync(
    "fetchMore passes new args to field merge function",
    (resolve, reject) => {
      const mergeArgsHistory: (Record<string, any> | null)[] = [];
      const groceriesFieldPolicy = offsetLimitPagination();
      const { merge } = groceriesFieldPolicy;
      groceriesFieldPolicy.merge = function (existing, incoming, options) {
        mergeArgsHistory.push(options.args);
        return (merge as FieldMergeFunction<any>).call(
          this,
          existing,
          incoming,
          options
        );
      };

      const cache = new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              groceries: groceriesFieldPolicy,
            },
          },
        },
      });

      const query = gql`
        query GroceryList($offset: Int!, $limit: Int!) {
          groceries(offset: $offset, limit: $limit) {
            id
            item
            found
          }
        }
      `;

      const initialVars = {
        offset: 0,
        limit: 2,
      };

      const initialGroceries = [
        {
          __typename: "GroceryItem",
          id: 1,
          item: "organic whole milk",
          found: false,
        },
        {
          __typename: "GroceryItem",
          id: 2,
          item: "beer that we both like",
          found: false,
        },
      ];

      const additionalVars = {
        offset: 2,
        limit: 3,
      };

      const additionalGroceries = [
        {
          __typename: "GroceryItem",
          id: 3,
          item: "gluten-free pasta",
          found: false,
        },
        {
          __typename: "GroceryItem",
          id: 4,
          item: "goat cheese",
          found: false,
        },
        {
          __typename: "GroceryItem",
          id: 5,
          item: "paper towels",
          found: false,
        },
      ];

      const finalGroceries = [...initialGroceries, ...additionalGroceries];

      const client = new ApolloClient({
        cache,
        link: mockSingleLink(
          {
            request: {
              query,
              variables: initialVars,
            },
            result: {
              data: {
                groceries: initialGroceries,
              },
            },
          },
          {
            request: {
              query,
              variables: additionalVars,
            },
            result: {
              data: {
                groceries: additionalGroceries,
              },
            },
          }
        ).setOnError(reject),
      });

      const observable = client.watchQuery({
        query,
        variables: initialVars,
      });

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              groceries: initialGroceries,
            },
          });

          expect(mergeArgsHistory).toEqual([{ offset: 0, limit: 2 }]);

          observable
            .fetchMore({
              variables: {
                offset: 2,
                limit: 3,
              },
            })
            .then((result) => {
              expect(result).toEqual({
                loading: false,
                networkStatus: NetworkStatus.ready,
                data: {
                  groceries: additionalGroceries,
                },
              });

              expect(observable.options.fetchPolicy).toBe("cache-first");
            });
        } else if (count === 2) {
          // This result comes entirely from the cache, without updating the
          // original variables for the ObservableQuery, because the
          // offsetLimitPagination field policy has keyArgs:false.
          expect(result).toEqual({
            loading: false,
            networkStatus: NetworkStatus.ready,
            data: {
              groceries: finalGroceries,
            },
          });

          expect(mergeArgsHistory).toEqual([
            { offset: 0, limit: 2 },
            { offset: 2, limit: 3 },
          ]);

          resolve();
        }
      });
    }
  );

  itAsync("fetching more with a different query", (resolve, reject) => {
    const observable = setup(reject, {
      request: {
        query: query2,
        variables: variables2,
      },
      result: result2,
    });

    subscribeAndCount(reject, observable, (count, result) => {
      if (count === 1) {
        expect(result.loading).toBe(false);
        expect(result.data.entry.comments).toHaveLength(10);

        return observable
          .fetchMore({
            query: query2,
            variables: variables2,
            updateQuery: (prev, options) => {
              const state = cloneDeep(prev) as any;
              state.entry.comments = [
                ...state.entry.comments,
                ...options.fetchMoreResult.comments,
              ];
              return state;
            },
          })
          .then((fetchMoreResult) => {
            expect(fetchMoreResult.loading).toBe(false);
            expect(fetchMoreResult.data.comments).toHaveLength(10);
          });
      } else if (count === 2) {
        expect(result.loading).toBe(false);
        const combinedComments = result.data.entry.comments;
        expect(combinedComments).toHaveLength(20);

        for (let i = 1; i <= 10; i++) {
          expect(combinedComments[i - 1].text).toEqual(`comment ${i}`);
        }
        for (let i = 11; i <= 20; i++) {
          expect(combinedComments[i - 1].text).toEqual(`new comment ${i}`);
        }

        setTimeout(resolve, 10);
      } else {
        reject(`Too many results (${JSON.stringify({ count, result })})`);
      }
    });
  });

  describe("will not get an error from `fetchMore` if thrown", () => {
    itAsync("updateQuery", (resolve, reject) => {
      const fetchMoreError = new Error("Uh, oh!");
      const link = mockSingleLink(
        {
          request: { query, variables },
          result,
          delay: 5,
        },
        {
          request: { query, variables: variablesMore },
          error: fetchMoreError,
          delay: 5,
        }
      );

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      let count = 0;
      observable.subscribe({
        next: ({ data, networkStatus }) => {
          switch (++count) {
            case 1:
              expect(networkStatus).toBe(NetworkStatus.ready);
              expect((data as any).entry.comments.length).toBe(10);
              observable
                .fetchMore({
                  variables: { start: 10 },
                  updateQuery: (prev) => {
                    reject(new Error("should not have called updateQuery"));
                    return prev;
                  },
                })
                .catch((e) => {
                  expect(e.networkError).toBe(fetchMoreError);
                  resolve();
                });
              break;
          }
        },
        error: () => {
          reject(new Error("`error` called when it wasn’t supposed to be."));
        },
        complete: () => {
          reject(new Error("`complete` called when it wasn’t supposed to be."));
        },
      });
    });

    itAsync("field policy", (resolve, reject) => {
      const fetchMoreError = new Error("Uh, oh!");
      const link = mockSingleLink(
        {
          request: { query, variables },
          result,
          delay: 5,
        },
        {
          request: { query, variables: variablesMore },
          error: fetchMoreError,
          delay: 5,
        }
      );

      let calledFetchMore = false;

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            Entry: {
              fields: {
                comments: {
                  keyArgs: false,
                  merge(_, incoming) {
                    if (calledFetchMore) {
                      reject(new Error("should not have called merge"));
                    }
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      let count = 0;
      observable.subscribe({
        next: ({ data, networkStatus }) => {
          switch (++count) {
            case 1:
              expect(networkStatus).toBe(NetworkStatus.ready);
              expect((data as any).entry.comments.length).toBe(10);
              calledFetchMore = true;
              observable
                .fetchMore({
                  variables: { start: 10 },
                })
                .catch((e) => {
                  expect(e.networkError).toBe(fetchMoreError);
                  resolve();
                });
              break;
          }
        },
        error: () => {
          reject(new Error("`error` called when it wasn’t supposed to be."));
        },
        complete: () => {
          reject(new Error("`complete` called when it wasn’t supposed to be."));
        },
      });
    });
  });

  itAsync("will not leak fetchMore query", (resolve, reject) => {
    const observable = setup(reject, {
      request: {
        query,
        variables: variablesMore,
      },
      result: resultMore,
    });

    function count(): number {
      return (observable as any).queryManager.queries.size;
    }

    const beforeQueryCount = count();

    observable
      .fetchMore({
        variables: { start: 10 }, // rely on the fact that the original variables had limit: 10
      })
      .then(() => {
        expect(count()).toBe(beforeQueryCount);
      })
      .then(resolve, reject);
  });

  itAsync(
    "delivers all loading states even if data unchanged",
    (resolve, reject) => {
      type TEmptyItems = {
        emptyItems: Array<{
          text: string;
        }>;
      };

      const query: TypedDocumentNode<TEmptyItems> = gql`
        query GetNothing {
          emptyItems {
            text
          }
        }
      `;

      const variables = {};

      const emptyItemsMock = {
        request: {
          query,
          variables,
        },
        result: {
          data: {
            emptyItems: [],
          },
        },
      };

      const link = mockSingleLink(
        emptyItemsMock,
        emptyItemsMock,
        emptyItemsMock
      ).setOnError(reject);

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result.loading).toBe(false);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          expect(result.data.emptyItems).toHaveLength(0);

          return observable
            .fetchMore({
              variables,
            })
            .then((fetchMoreResult) => {
              expect(fetchMoreResult.loading).toBe(false);
              expect(fetchMoreResult.networkStatus).toBe(NetworkStatus.ready);
              expect(fetchMoreResult.data.emptyItems).toHaveLength(0);
            });
        } else if (count === 2) {
          expect(result.loading).toBe(true);
          expect(result.networkStatus).toBe(NetworkStatus.fetchMore);
          expect(result.data.emptyItems).toHaveLength(0);
        } else if (count === 3) {
          expect(result.loading).toBe(false);
          expect(result.networkStatus).toBe(NetworkStatus.ready);
          expect(result.data.emptyItems).toHaveLength(0);

          setTimeout(resolve, 10);
        } else {
          reject(`Too many results (${JSON.stringify({ count, result })})`);
        }
      });
    }
  );
});

describe("fetchMore on an observable query with connection", () => {
  type TEntryComments = {
    entry: {
      comments: Array<{
        text: string;
        __typename?: string;
      }>;
      __typename?: string;
    };
  };

  type TEntryVars = {
    repoName: string;
    start: number;
    limit: number;
  };

  const query: TypedDocumentNode<TEntryComments, TEntryVars> = gql`
    query Comment($repoName: String!, $start: Int!, $limit: Int!) {
      entry(repoFullName: $repoName, start: $start, limit: $limit)
        @connection(key: "repoName") {
        comments {
          text
        }
      }
    }
  `;
  const transformedQuery: TypedDocumentNode<TEntryComments, TEntryVars> = gql`
    query Comment($repoName: String!, $start: Int!, $limit: Int!) {
      entry(repoFullName: $repoName, start: $start, limit: $limit) {
        comments {
          text
          __typename
        }
        __typename
      }
    }
  `;

  const variables = {
    repoName: "org/repo",
    start: 0,
    limit: 10,
  };
  const variablesMore = assign({}, variables, { start: 10, limit: 10 });

  const result: any = {
    data: {
      __typename: "Query",
      entry: {
        __typename: "Entry",
        comments: [],
      },
    },
  };
  const resultMore = cloneDeep(result);

  for (let i = 1; i <= 10; i++) {
    result.data.entry.comments.push({
      text: `comment ${i}`,
      __typename: "Comment",
    });
  }
  for (let i = 11; i <= 20; i++) {
    resultMore.data.entry.comments.push({
      text: `comment ${i}`,
      __typename: "Comment",
    });
  }

  function setup(reject: (reason: any) => any, ...mockedResponses: any[]) {
    const link = mockSingleLink(
      {
        request: {
          query: transformedQuery,
          variables,
        },
        result,
      },
      ...mockedResponses
    ).setOnError(reject);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              entry: {
                merge: false,
              },
            },
          },
        },
      }),
    });

    return client.watchQuery({
      query,
      variables,
    });
  }

  function setupWithCacheConfig(
    reject: (reason: any) => any,
    cacheConfig: InMemoryCacheConfig,
    ...mockedResponses: any[]
  ) {
    const client = new ApolloClient({
      link: mockSingleLink(
        {
          request: {
            query: transformedQuery,
            variables,
          },
          result,
        },
        ...mockedResponses
      ).setOnError(reject),
      cache: new InMemoryCache(cacheConfig),
    });

    return client.watchQuery({
      query,
      variables,
    });
  }

  describe("fetchMore with connection results merging", () => {
    itAsync("updateQuery", (resolve, reject) => {
      const observable = setup(reject, {
        request: {
          query: transformedQuery,
          variables: variablesMore,
        },
        result: resultMore,
      });

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result.loading).toBe(false);
          expect(result.data.entry.comments).toHaveLength(10);

          return observable
            .fetchMore({
              variables: { start: 10 }, // rely on the fact that the original variables had limit: 10
              updateQuery: (prev, options) => {
                const state = cloneDeep(prev) as any;
                state.entry.comments = [
                  ...state.entry.comments,
                  ...options.fetchMoreResult.entry.comments,
                ];
                return state;
              },
            })
            .then((fetchMoreResult) => {
              expect(fetchMoreResult.data.entry.comments).toHaveLength(10);
              expect(fetchMoreResult.loading).toBe(false);
            });
        } else if (count === 2) {
          const combinedComments = result.data.entry.comments;
          expect(combinedComments).toHaveLength(20);
          combinedComments.forEach((comment, i) => {
            expect(comment.text).toBe(`comment ${i + 1}`);
          });

          setTimeout(resolve, 10);
        } else {
          reject(`Too many results (${JSON.stringify({ count, result })})`);
        }
      });
    });

    itAsync("field policy", (resolve, reject) => {
      const observable = setupWithCacheConfig(
        reject,
        {
          typePolicies: {
            Entry: {
              fields: {
                comments: concatPagination(),
              },
            },
          },
        },
        {
          request: {
            query: transformedQuery,
            variables: variablesMore,
          },
          result: resultMore,
        }
      );

      subscribeAndCount(reject, observable, (count, result) => {
        if (count === 1) {
          expect(result.loading).toBe(false);
          expect(result.data.entry.comments).toHaveLength(10);

          return observable
            .fetchMore({
              // rely on the fact that the original variables had limit: 10
              variables: { start: 10 },
            })
            .then((fetchMoreResult) => {
              // this is the server result
              expect(fetchMoreResult.loading).toBe(false);
              expect(fetchMoreResult.data.entry.comments).toHaveLength(10);
            });
        } else if (count === 2) {
          const combinedComments = result.data.entry.comments;
          expect(combinedComments).toHaveLength(20);
          combinedComments.forEach((comment, i) => {
            expect(comment.text).toBe(`comment ${i + 1}`);
          });

          setTimeout(resolve, 10);
        } else {
          reject(`Too many results (${JSON.stringify({ count, result })})`);
        }
      });
    });
  });

  describe("will set the network status to `fetchMore`", () => {
    itAsync("updateQuery", (resolve, reject) => {
      const link = mockSingleLink(
        {
          request: { query: transformedQuery, variables },
          result,
          delay: 5,
        },
        {
          request: { query: transformedQuery, variables: variablesMore },
          result: resultMore,
          delay: 5,
        }
      ).setOnError(reject);

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      let count = 0;
      observable.subscribe({
        next: ({ data, networkStatus }) => {
          switch (count++) {
            case 0:
              expect(networkStatus).toBe(NetworkStatus.ready);
              expect((data as any).entry.comments.length).toBe(10);
              observable.fetchMore({
                variables: { start: 10 },
                updateQuery: (prev: any, options: any) => {
                  const state = cloneDeep(prev) as any;
                  state.entry.comments = [
                    ...state.entry.comments,
                    ...options.fetchMoreResult.entry.comments,
                  ];
                  return state;
                },
              });
              break;
            case 1:
              expect(networkStatus).toBe(NetworkStatus.fetchMore);
              expect((data as any).entry.comments.length).toBe(10);
              break;
            case 2:
              expect(networkStatus).toBe(NetworkStatus.ready);
              expect((data as any).entry.comments.length).toBe(20);
              setTimeout(resolve, 10);
              break;
            default:
              reject(new Error("`next` called too many times"));
          }
        },
        error: (error: any) => reject(error),
        complete: () => reject(new Error("Should not have completed")),
      });
    });

    itAsync("field policy", (resolve, reject) => {
      const link = mockSingleLink(
        {
          request: { query: transformedQuery, variables },
          result,
          delay: 5,
        },
        {
          request: { query: transformedQuery, variables: variablesMore },
          result: resultMore,
          delay: 5,
        }
      ).setOnError(reject);

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            Entry: {
              fields: {
                comments: concatPagination(),
              },
            },
          },
        }),
      });

      const observable = client.watchQuery({
        query,
        variables,
        notifyOnNetworkStatusChange: true,
      });

      let count = 0;
      observable.subscribe({
        next: ({ data, networkStatus }) => {
          switch (count++) {
            case 0:
              expect(networkStatus).toBe(NetworkStatus.ready);
              expect((data as any).entry.comments.length).toBe(10);
              observable.fetchMore({
                variables: { start: 10 },
              });
              break;
            case 1:
              expect(networkStatus).toBe(NetworkStatus.fetchMore);
              expect((data as any).entry.comments.length).toBe(10);
              break;
            case 2:
              expect(networkStatus).toBe(NetworkStatus.ready);
              expect((data as any).entry.comments.length).toBe(20);
              setTimeout(resolve, 10);
              break;
            default:
              reject(new Error("`next` called too many times"));
          }
        },
        error: (error: any) => reject(error),
        complete: () => reject(new Error("Should not have completed")),
      });
    });
  });
});
