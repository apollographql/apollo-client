import { Observable, Subscription } from "rxjs";

import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
  ObservableQuery,
  TypedDocumentNode,
} from "@apollo/client/core";

import { ObservableStream } from "../testing/internal/index.js";

describe("client.refetchQueries", () => {
  it("is public and callable", async () => {
    expect.assertions(6);
    const client = new ApolloClient({
      cache: new InMemoryCache(),
    });
    expect(typeof client.refetchQueries).toBe("function");
    const onQueryUpdated = jest.fn();

    const result = client.refetchQueries({
      updateCache(cache) {
        expect(cache).toBe(client.cache);
        expect(cache.extract()).toEqual({});
      },
      onQueryUpdated,
    });

    expect(result.queries).toEqual([]);
    expect(result.results).toEqual([]);

    await result;

    expect(onQueryUpdated).not.toHaveBeenCalled();
  });

  const aQuery: TypedDocumentNode<{ a: string }> = gql`
    query A {
      a
    }
  `;
  const bQuery: TypedDocumentNode<{ b: string }> = gql`
    query B {
      b
    }
  `;
  const abQuery: TypedDocumentNode<{
    a: string;
    b: string;
  }> = gql`
    query AB {
      a
      b
    }
  `;

  function makeClient() {
    return new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const data: Record<string, string> = {};
            operation.operationName.split("").forEach((letter) => {
              data[letter.toLowerCase()] = letter.toUpperCase();
            });
            function finish(delay: number) {
              // We need to add a delay here since RxJS emits synchronously.
              // Some tests fail if this value is emitted synchronously.
              // TODO: Determine root cause
              setTimeout(() => {
                observer.next({ data });
                observer.complete();
              }, delay);
            }
            if (typeof operation.variables.delay === "number") {
              finish(operation.variables.delay);
            } else finish(0);
          })
      ),
    });
  }

  const subs: Subscription[] = [];
  function unsubscribe() {
    subs.splice(0).forEach((sub) => sub.unsubscribe());
  }

  function setup(client = makeClient()) {
    function watch<T>(query: TypedDocumentNode<T>) {
      const obsQuery = client.watchQuery({ query });
      return new Promise<ObservableQuery<T>>((resolve, reject) => {
        subs.push(
          obsQuery.subscribe({
            error: reject,
            next(result) {
              expect(result.loading).toBe(false);
              resolve(obsQuery);
            },
          })
        );
      });
    }

    return Promise.all([watch(aQuery), watch(bQuery), watch(abQuery)]);
  }

  // Not a great way to sort objects, but it will give us stable orderings in
  // these specific tests (especially since the keys are all "a" and/or "b").
  function sortObjects<T extends object[]>(array: T) {
    array.sort((a, b) => {
      const aKey = Object.keys(a).join(",");
      const bKey = Object.keys(b).join(",");
      if (aKey < bKey) return -1;
      if (bKey < aKey) return 1;
      return 0;
    });
  }

  it("includes watched queries affected by updateCache", async () => {
    expect.assertions(9);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const ayyResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: aQuery,
          data: {
            a: "Ayy",
          },
        });
      },

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "Ayy" });
        } else if (obs === bObs) {
          throw new Error("bQuery should not have been updated");
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(ayyResults);

    expect(ayyResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "B" },
      // Note that no bQuery result is included here.
    ]);

    const beeResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: bQuery,
          data: {
            b: "Bee",
          },
        });
      },

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          throw new Error("aQuery should not have been updated");
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "Bee" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "Bee" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return diff.result;
      },
    });

    sortObjects(beeResults);

    expect(beeResults).toEqual([
      // Note that no aQuery result is included here.
      { a: "Ayy", b: "Bee" },
      { b: "Bee" },
    ]);

    unsubscribe();
  });

  it("includes watched queries named in options.include", async () => {
    expect.assertions(11);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const ayyResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: aQuery,
          data: {
            a: "Ayy",
          },
        });
      },

      // This is the options.include array mentioned in the test description.
      include: ["B"],

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "Ayy" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(ayyResults);

    expect(ayyResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "B" },
      // Included this time!
      { b: "B" },
    ]);

    const beeResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: bQuery,
          data: {
            b: "Bee",
          },
        });
      },

      // The "A" here causes aObs to be included, but the "AB" should be
      // redundant because that query is already included.
      include: ["A", "AB"],

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "Ayy" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "Bee" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "Bee" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return diff.result;
      },
    });

    sortObjects(beeResults);

    expect(beeResults).toEqual([
      { a: "Ayy" }, // Included this time!
      { a: "Ayy", b: "Bee" },
      { b: "Bee" },
    ]);

    unsubscribe();
  });

  it("includes query DocumentNode objects specified in options.include", async () => {
    expect.assertions(11);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const ayyResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: aQuery,
          data: {
            a: "Ayy",
          },
        });
      },

      // Note that we're passing query DocumentNode objects instead of query
      // name strings, in this test.
      include: [bQuery, abQuery],

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "Ayy" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(ayyResults);

    expect(ayyResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "B" },
      // Included this time!
      { b: "B" },
    ]);

    const beeResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: bQuery,
          data: {
            b: "Bee",
          },
        });
      },

      // The abQuery and "AB" should be redundant, but the aQuery here is
      // important for aObs to be included.
      include: [abQuery, "AB", aQuery],

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "Ayy" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "Bee" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "Bee" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return diff.result;
      },
    });

    sortObjects(beeResults);

    expect(beeResults).toEqual([
      { a: "Ayy" }, // Included this time!
      { a: "Ayy", b: "Bee" },
      { b: "Bee" },
    ]);

    unsubscribe();
  });

  it('includes all queries when options.include === "all"', async () => {
    expect.assertions(11);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const ayyResults = await client.refetchQueries({
      include: "all",

      updateCache(cache) {
        cache.writeQuery({
          query: aQuery,
          data: {
            a: "Ayy",
          },
        });
      },

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "Ayy" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(ayyResults);

    expect(ayyResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "B" },
      { b: "B" },
    ]);

    const beeResults = await client.refetchQueries({
      include: "all",

      updateCache(cache) {
        cache.writeQuery({
          query: bQuery,
          data: {
            b: "Bee",
          },
        });
      },

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "Ayy" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "Bee" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "Bee" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return diff.result;
      },
    });

    sortObjects(beeResults);

    expect(beeResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "Bee" },
      { b: "Bee" },
    ]);

    unsubscribe();
  });

  it('includes all active queries when options.include === "active"', async () => {
    expect.assertions(15);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const extraObs = client.watchQuery({ query: abQuery });
    expect(extraObs.hasObservers()).toBe(false);

    const activeResults = await client.refetchQueries({
      include: "active",

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "A" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "A", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(activeResults);

    expect(activeResults).toEqual([{ a: "A" }, { a: "A", b: "B" }, { b: "B" }]);

    subs.push(
      extraObs.subscribe({
        next(result) {
          expect(result).toEqual({ a: "A", b: "B" });
        },
      })
    );
    expect(extraObs.hasObservers()).toBe(true);

    const resultsAfterSubscribe = await client.refetchQueries({
      include: "active",

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "A" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "A", b: "B" });
        } else if (obs === extraObs) {
          expect(diff.result).toEqual({ a: "A", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(resultsAfterSubscribe);

    expect(resultsAfterSubscribe).toEqual([
      { a: "A" },
      { a: "A", b: "B" },
      // Included thanks to extraObs this time.
      { a: "A", b: "B" },
      // Sorted last by sortObjects.
      { b: "B" },
    ]);

    unsubscribe();
  });

  it("includes queries named in refetchQueries even if they have no observers", async () => {
    expect.assertions(13);
    const client = makeClient();

    const aObs = client.watchQuery({ query: aQuery });
    const bObs = client.watchQuery({ query: bQuery });
    const abObs = client.watchQuery({ query: abQuery });

    // These ObservableQuery objects have no observers yet, but should
    // nevertheless be refetched if identified explicitly in an options.include
    // array passed to client.refetchQueries.
    expect(aObs.hasObservers()).toBe(false);
    expect(bObs.hasObservers()).toBe(false);
    expect(abObs.hasObservers()).toBe(false);

    const activeResults = await client.refetchQueries({
      include: ["A", abQuery],

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.complete).toBe(false);
          expect(diff.result).toEqual(null);
        } else if (obs === abObs) {
          expect(diff.complete).toBe(false);
          expect(diff.result).toEqual(null);
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    expect(activeResults).toEqual([null, null]);

    const stream = new ObservableStream(abObs);
    subs.push(stream as unknown as Subscription);
    expect(abObs.hasObservers()).toBe(true);

    await expect(stream).toEmitMatchedValue({ data: { a: "A", b: "B" } });

    const resultsAfterSubscribe = await client.refetchQueries({
      include: [aQuery, "B"],

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "A" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(resultsAfterSubscribe);
    expect(resultsAfterSubscribe).toEqual([{ a: "A" }, { b: "B" }]);

    unsubscribe();
  });

  it("should not include unwatched single queries", async () => {
    expect.assertions(18);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const delayedQuery = gql`
      query DELAYED {
        d
        e
        l
        a
        y
        e
        d
      }
    `;

    void client.query({
      query: delayedQuery,
      variables: {
        // Delay this query by 10 seconds so it stays in-flight.
        delay: 10000,
      },
    });

    const queries = client["queryManager"]["queries"];
    expect(queries.size).toBe(4);

    queries.forEach((queryInfo, queryId) => {
      if (queryId === "1" || queryId === "2" || queryId === "3") {
        expect(queryInfo.observableQuery).toBeInstanceOf(ObservableQuery);
      } else if (queryId === "4") {
        // One-off client.query-style queries never get an ObservableQuery, so
        // they should not be included by include: "active".
        expect(queryInfo.observableQuery).toBe(null);
        expect(queryInfo.document).toBe(delayedQuery);
      }
    });

    const activeResults = await client.refetchQueries({
      include: "active",

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "A" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "A", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(activeResults);

    expect(activeResults).toEqual([{ a: "A" }, { a: "A", b: "B" }, { b: "B" }]);

    const allResults = await client.refetchQueries({
      include: "all",

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "A" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "A", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return Promise.resolve(diff.result);
      },
    });

    sortObjects(allResults);

    expect(allResults).toEqual([{ a: "A" }, { a: "A", b: "B" }, { b: "B" }]);

    unsubscribe();
    client.stop();

    expect(queries.size).toBe(0);
  });

  it("refetches watched queries if onQueryUpdated not provided", async () => {
    expect.assertions(7);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const aSpy = jest.spyOn(aObs, "refetch");
    const bSpy = jest.spyOn(bObs, "refetch");
    const abSpy = jest.spyOn(abObs, "refetch");

    const ayyResults = (
      await client.refetchQueries({
        include: ["B"],
        updateCache(cache) {
          cache.writeQuery({
            query: aQuery,
            data: {
              a: "Ayy",
            },
          });
        },
      })
    ).map((result) => result.data as object);

    sortObjects(ayyResults);

    // These results have reverted back to what the ApolloLink returns ("A"
    // rather than "Ayy"), because we let them be refetched (by not providing
    // an onQueryUpdated function).
    expect(ayyResults).toEqual([{ a: "A" }, { a: "A", b: "B" }, { b: "B" }]);

    expect(aSpy).toHaveBeenCalledTimes(1);
    expect(bSpy).toHaveBeenCalledTimes(1);
    expect(abSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("can run updateQuery function against optimistic cache layer", async () => {
    expect.assertions(12);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    client.cache.watch({
      query: abQuery,
      optimistic: false,
      callback(diff) {
        throw new Error("should not have notified non-optimistic watcher");
      },
    });

    expect(client.cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        a: "A",
        b: "B",
      },
    });

    const results = await client.refetchQueries({
      // This causes the update to run against a temporary optimistic layer.
      optimistic: true,

      updateCache(cache) {
        const modified = cache.modify({
          fields: {
            a(value, { DELETE }) {
              expect(value).toEqual("A");
              return DELETE;
            },
          },
        });
        expect(modified).toBe(true);
      },

      onQueryUpdated(obs, diff) {
        expect(diff.complete).toBe(true);

        // Even though we evicted the Query.a field in the updateCache function,
        // that optimistic layer was discarded before broadcasting results, so
        // we're back to the original (non-optimistic) data.
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "A" });
        } else if (obs === bObs) {
          throw new Error("bQuery should not have been updated");
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "A", b: "B" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }

        return diff.result;
      },
    });

    sortObjects(results);

    expect(results).toEqual([{ a: "A" }, { a: "A", b: "B" }]);

    expect(client.cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        a: "A",
        b: "B",
      },
    });
  });

  it("can return true from onQueryUpdated to choose default refetching behavior", async () => {
    expect.assertions(14);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const refetchResult = client.refetchQueries({
      include: ["A", "B"],
      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "A" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          throw new Error("abQuery should not have been updated");
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        return true;
      },
    });

    expect(refetchResult.results.length).toBe(2);
    refetchResult.results.forEach((result) => {
      expect(result).toBeInstanceOf(Promise);
    });

    expect(
      refetchResult.queries
        .map((obs) => {
          expect(obs).toBeInstanceOf(ObservableQuery);
          return obs.queryName;
        })
        .sort()
    ).toEqual(["A", "B"]);

    const results = (await refetchResult).map((result) => {
      // These results are ApolloQueryResult<any>, as inferred by TypeScript.
      expect(Object.keys(result).sort()).toEqual([
        "data",
        "loading",
        "networkStatus",
        "partial",
      ]);
      return result.data;
    });

    sortObjects(results);

    expect(results).toEqual([{ a: "A" }, { b: "B" }]);
  });

  it("can return true from onQueryUpdated when using options.updateCache", async () => {
    expect.assertions(17);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const refetchResult = client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: bQuery,
          data: {
            b: "Beetlejuice",
          },
        });
      },

      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          throw new Error("aQuery should not have been updated");
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "Beetlejuice" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "A", b: "Beetlejuice" });
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }

        expect(client.cache.extract()).toEqual({
          ROOT_QUERY: {
            __typename: "Query",
            a: "A",
            b: "Beetlejuice",
          },
        });

        return true;
      },
    });

    expect(refetchResult.results.length).toBe(2);
    refetchResult.results.forEach((result) => {
      expect(result).toBeInstanceOf(Promise);
    });

    expect(
      refetchResult.queries
        .map((obs) => {
          expect(obs).toBeInstanceOf(ObservableQuery);
          return obs.queryName;
        })
        .sort()
    ).toEqual(["AB", "B"]);

    const results = (await refetchResult).map((result) => {
      // These results are ApolloQueryResult<any>, as inferred by TypeScript.
      expect(Object.keys(result).sort()).toEqual([
        "data",
        "loading",
        "networkStatus",
        "partial",
      ]);
      return result.data;
    });

    sortObjects(results);

    expect(results).toEqual([
      // Since we returned true from onQueryUpdated, the results were refetched,
      // replacing "Beetlejuice" with "B" again.
      { a: "A", b: "B" },
      { b: "B" },
    ]);

    expect(client.cache.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        a: "A",
        b: "B",
      },
    });
  });

  it("can return false from onQueryUpdated to skip/ignore a query", async () => {
    expect.assertions(11);
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const refetchResult = client.refetchQueries({
      include: ["A", "B"],
      onQueryUpdated(obs, diff) {
        if (obs === aObs) {
          expect(diff.result).toEqual({ a: "A" });
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "B" });
        } else if (obs === abObs) {
          throw new Error("abQuery should not have been updated");
        } else {
          throw new Error(
            `unexpected ObservableQuery ${obs.queryId} with name ${obs.queryName}`
          );
        }
        // Skip refetching all but the B query.
        return obs.queryName === "B";
      },
    });

    expect(refetchResult.results.length).toBe(1);
    refetchResult.results.forEach((result) => {
      expect(result).toBeInstanceOf(Promise);
    });

    expect(
      refetchResult.queries
        .map((obs) => {
          expect(obs).toBeInstanceOf(ObservableQuery);
          return obs.queryName;
        })
        .sort()
    ).toEqual(["B"]);

    const results = (await refetchResult).map((result) => {
      // These results are ApolloQueryResult<any>, as inferred by TypeScript.
      expect(Object.keys(result).sort()).toEqual([
        "data",
        "loading",
        "networkStatus",
        "partial",
      ]);
      return result.data;
    });

    sortObjects(results);

    expect(results).toEqual([{ b: "B" }]);
  });

  it("can refetch no-cache queries", () => {
    // TODO The options.updateCache function won't work for these queries, but
    // the options.include array should work, at least.
  });
});
