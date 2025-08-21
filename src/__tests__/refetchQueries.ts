import type { Subscription } from "rxjs";
import { Observable, Subject } from "rxjs";

import type { OnQueryUpdated, TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
  NetworkStatus,
  ObservableQuery,
} from "@apollo/client";
import { ObservableStream } from "@apollo/client/testing/internal";

describe("client.refetchQueries", () => {
  it("is public and callable", async () => {
    expect.assertions(6);
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
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
            operation.operationName!.split("").forEach((letter) => {
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
      const obsQuery = client.watchQuery({
        query,
        notifyOnNetworkStatusChange: false,
      });
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

  function obsUpdatedCheck(cb: OnQueryUpdated<any>) {
    const subject = new Subject<Parameters<OnQueryUpdated<unknown>>>();
    const stream = new ObservableStream(subject);
    const onQueryUpdated = (...args: Parameters<OnQueryUpdated<any>>) => {
      subject.next(args);
      return cb(...args);
    };
    const check = async (
      expectations: [obs: ObservableQuery<any>, result: unknown][]
    ) => {
      for (const [obs, result] of expectations) {
        const [obsResult, diff] = await stream.takeNext();
        expect(obsResult).toBe(obs);
        expect(diff.result).toEqual(result);
      }

      await expect(stream).not.toEmitAnything();
    };
    return { onQueryUpdated, check, stream };
  }

  it("includes watched queries affected by updateCache", async () => {
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const ayyCheck = obsUpdatedCheck((obs, diff) =>
      Promise.resolve(diff.result)
    );

    const ayyResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: aQuery,
          data: {
            a: "Ayy",
          },
        });
      },

      onQueryUpdated: ayyCheck.onQueryUpdated,
    });

    await ayyCheck.check([
      [aObs, { a: "Ayy" }],
      [abObs, { a: "Ayy", b: "B" }],
    ]);

    sortObjects(ayyResults);

    expect(ayyResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "B" },
      // Note that no bQuery result is included here.
    ]);

    const beeOQU = obsUpdatedCheck((obs, diff) => diff.result);

    const beeResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: bQuery,
          data: {
            b: "Bee",
          },
        });
      },

      onQueryUpdated: beeOQU.onQueryUpdated,
    });

    await beeOQU.check([
      [bObs, { b: "Bee" }],
      [abObs, { a: "Ayy", b: "Bee" }],
    ]);

    sortObjects(beeResults);

    expect(beeResults).toEqual([
      // Note that no aQuery result is included here.
      { a: "Ayy", b: "Bee" },
      { b: "Bee" },
    ]);

    unsubscribe();
  });

  it("includes watched queries named in options.include", async () => {
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const ayyOQU = obsUpdatedCheck((obs, diff) => Promise.resolve(diff.result));
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

      onQueryUpdated: ayyOQU.onQueryUpdated,
    });

    await ayyOQU.check([
      [aObs, { a: "Ayy" }],
      [abObs, { a: "Ayy", b: "B" }],
      [bObs, { b: "B" }],
    ]);

    sortObjects(ayyResults);

    expect(ayyResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "B" },
      // Included this time!
      { b: "B" },
    ]);

    const beeOQU = obsUpdatedCheck((obs, diff) => diff.result);
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

      onQueryUpdated: beeOQU.onQueryUpdated,
    });

    await beeOQU.check([
      [bObs, { b: "Bee" }],
      [abObs, { a: "Ayy", b: "Bee" }],
      [aObs, { a: "Ayy" }],
    ]);

    sortObjects(beeResults);

    expect(beeResults).toEqual([
      { a: "Ayy" }, // Included this time!
      { a: "Ayy", b: "Bee" },
      { b: "Bee" },
    ]);

    unsubscribe();
  });

  it("includes query DocumentNode objects specified in options.include", async () => {
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const ayyOQU = obsUpdatedCheck((obs, diff) => Promise.resolve(diff.result));
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

      onQueryUpdated: ayyOQU.onQueryUpdated,
    });

    await ayyOQU.check([
      [aObs, { a: "Ayy" }],
      [abObs, { a: "Ayy", b: "B" }],
      [bObs, { b: "B" }],
    ]);

    sortObjects(ayyResults);

    expect(ayyResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "B" },
      // Included this time!
      { b: "B" },
    ]);

    const beeOQU = obsUpdatedCheck((obs, diff) => diff.result);
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

      onQueryUpdated: beeOQU.onQueryUpdated,
    });

    await beeOQU.check([
      [bObs, { b: "Bee" }],
      [abObs, { a: "Ayy", b: "Bee" }],
      [aObs, { a: "Ayy" }],
    ]);

    sortObjects(beeResults);

    expect(beeResults).toEqual([
      { a: "Ayy" }, // Included this time!
      { a: "Ayy", b: "Bee" },
      { b: "Bee" },
    ]);

    unsubscribe();
  });

  it('includes all queries when options.include === "all"', async () => {
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const ayyOQU = obsUpdatedCheck((obs, diff) => Promise.resolve(diff.result));
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

      onQueryUpdated: ayyOQU.onQueryUpdated,
    });

    await ayyOQU.check([
      [aObs, { a: "Ayy" }],
      [abObs, { a: "Ayy", b: "B" }],
      [bObs, { b: "B" }],
    ]);

    sortObjects(ayyResults);

    expect(ayyResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "B" },
      { b: "B" },
    ]);

    const beeOQU = obsUpdatedCheck((obs, diff) => diff.result);
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

      onQueryUpdated: beeOQU.onQueryUpdated,
    });

    await beeOQU.check([
      [bObs, { b: "Bee" }],
      [abObs, { a: "Ayy", b: "Bee" }],
      [aObs, { a: "Ayy" }],
    ]);

    sortObjects(beeResults);

    expect(beeResults).toEqual([
      { a: "Ayy" },
      { a: "Ayy", b: "Bee" },
      { b: "Bee" },
    ]);

    unsubscribe();
  });

  it('includes all active queries when options.include === "active"', async () => {
    const client = makeClient();
    const [aObs, bObs, abObs] = await setup(client);

    const extraObs = client.watchQuery({ query: abQuery });
    expect(extraObs.hasObservers()).toBe(false);

    const activeOQU = obsUpdatedCheck((obs, diff) =>
      Promise.resolve(diff.result)
    );
    const activeResults = await client.refetchQueries({
      include: "active",

      onQueryUpdated: activeOQU.onQueryUpdated,
    });

    await activeOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
      [abObs, { a: "A", b: "B" }],
    ]);

    sortObjects(activeResults);

    expect(activeResults).toEqual([{ a: "A" }, { a: "A", b: "B" }, { b: "B" }]);

    subs.push(
      extraObs.subscribe({
        next(result) {
          expect(result).toStrictEqualTyped({
            data: { a: "A", b: "B" },
            dataState: "complete",
            loading: false,
            networkStatus: NetworkStatus.ready,
            partial: false,
          });
        },
      })
    );
    expect(extraObs.hasObservers()).toBe(true);

    const afterSubscribeOQU = obsUpdatedCheck((obs, diff) =>
      Promise.resolve(diff.result)
    );
    const resultsAfterSubscribe = await client.refetchQueries({
      include: "active",

      onQueryUpdated: afterSubscribeOQU.onQueryUpdated,
    });

    await afterSubscribeOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
      [abObs, { a: "A", b: "B" }],
      [extraObs, { a: "A", b: "B" }],
    ]);

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

  it('does not include cache-only queries when options.include === "active"', async () => {
    const cQuery = gql`
      query {
        c
      }
    `;
    const client = makeClient();
    client.writeQuery({ query: cQuery, data: { c: "C" } });

    const [aObs, bObs, abObs] = await setup(client);

    const cObs = client.watchQuery({
      query: cQuery,
      fetchPolicy: "cache-only",
    });

    const cStream = new ObservableStream(cObs);

    await expect(cStream).toEmitTypedValue({
      data: { c: "C" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    const activeOQU = obsUpdatedCheck(() => true);
    const activeResults = await client.refetchQueries({
      include: "active",
      onQueryUpdated: activeOQU.onQueryUpdated,
    });

    await activeOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
      [abObs, { a: "A", b: "B" }],
    ]);

    sortObjects(activeResults);

    expect(activeResults).toEqual([
      { data: { a: "A" } },
      { data: { b: "B" } },
      { data: { a: "A", b: "B" } },
    ]);

    unsubscribe();
  });

  it('does not include cache-only queries when options.include === "all"', async () => {
    const cQuery = gql`
      query {
        c
      }
    `;
    const client = makeClient();
    client.writeQuery({ query: cQuery, data: { c: "C" } });

    const [aObs, bObs, abObs] = await setup(client);

    const cObs = client.watchQuery({
      query: cQuery,
      fetchPolicy: "cache-only",
    });

    const cStream = new ObservableStream(cObs);

    await expect(cStream).toEmitTypedValue({
      data: { c: "C" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    const activeOQU = obsUpdatedCheck(() => true);
    const activeResults = await client.refetchQueries({
      include: "all",
      onQueryUpdated: activeOQU.onQueryUpdated,
    });

    await activeOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
      [abObs, { a: "A", b: "B" }],
    ]);

    sortObjects(activeResults);

    expect(activeResults).toEqual([
      { data: { a: "A" } },
      { data: { b: "B" } },
      { data: { a: "A", b: "B" } },
    ]);

    unsubscribe();
  });

  it("does not include cache-only queries when affected by updateCache", async () => {
    const cQuery = gql`
      query {
        c
      }
    `;
    const client = makeClient();
    client.writeQuery({ query: cQuery, data: { c: "C" } });

    await setup(client);

    const cObs = client.watchQuery({
      query: cQuery,
      fetchPolicy: "cache-only",
    });

    const cStream = new ObservableStream(cObs);

    await expect(cStream).toEmitTypedValue({
      data: { c: "C" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    const activeResults = await client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: cQuery,
          data: { c: "See" },
        });
      },
    });

    sortObjects(activeResults);

    expect(activeResults).toEqual([]);

    await expect(cStream).toEmitTypedValue({
      data: { c: "See" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    unsubscribe();
  });

  it("includes queries named in refetchQueries even if they have `standby` fetchPolicy", async () => {
    const client = makeClient();

    const aObs = client.watchQuery({ query: aQuery, fetchPolicy: "standby" });
    using aStream = new ObservableStream(aObs);
    const bObs = client.watchQuery({ query: bQuery, fetchPolicy: "standby" });
    using bStream = new ObservableStream(bObs);
    const abObs = client.watchQuery({ query: abQuery, fetchPolicy: "standby" });
    using abStream = new ObservableStream(abObs);

    // These ObservableQuery objects fetchPolicy standby, but should
    // nevertheless be refetched if identified explicitly in an options.include
    // array passed to client.refetchQueries.

    const activeOQU = obsUpdatedCheck(() => true);
    using OQUStream = activeOQU.stream;

    await Promise.all([
      expect(aStream).not.toEmitAnything(),
      expect(bStream).not.toEmitAnything(),
      expect(abStream).not.toEmitAnything(),
    ]);

    const activeResults = await client.refetchQueries({
      include: ["A", abQuery],
      onQueryUpdated: activeOQU.onQueryUpdated,
    });

    {
      const [observable, diff] = await OQUStream.takeNext();
      expect(observable).toBe(aObs);
      expect(diff.complete).toBe(false);
      expect(diff.result).toEqual(null);
    }
    {
      const [observable, diff] = await OQUStream.takeNext();
      expect(observable).toBe(abObs);
      expect(diff.complete).toBe(false);
      expect(diff.result).toEqual(null);
    }
    await expect(OQUStream).not.toEmitAnything();

    expect(activeResults).toEqual([
      {
        data: {
          a: "A",
        },
      },
      {
        data: {
          a: "A",
          b: "B",
        },
      },
    ]);

    const afterSubscribeOQU = obsUpdatedCheck((obs, diff) =>
      Promise.resolve(diff.result)
    );
    const resultsAfterSubscribe = await client.refetchQueries({
      include: [aQuery, "B"],

      onQueryUpdated: afterSubscribeOQU.onQueryUpdated,
    });

    await afterSubscribeOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
    ]);

    sortObjects(resultsAfterSubscribe);
    expect(resultsAfterSubscribe).toEqual([{ a: "A" }, { b: "B" }]);

    unsubscribe();
  });

  it("does not include named cache-only queries in refetchQueries", async () => {
    const cQuery = gql`
      query C {
        c
      }
    `;
    const client = makeClient();
    client.writeQuery({ query: cQuery, data: { c: "C" } });

    const aObs = client.watchQuery({
      query: aQuery,
      notifyOnNetworkStatusChange: false,
    });

    using aStream = new ObservableStream(aObs);

    await expect(aStream).toEmitTypedValue({
      data: { a: "A" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    const cObs = client.watchQuery({
      query: cQuery,
      fetchPolicy: "cache-only",
    });

    using cStream = new ObservableStream(cObs);

    await expect(cStream).toEmitTypedValue({
      data: { c: "C" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    const activeOQU = obsUpdatedCheck(() => true);
    await expect(
      client.refetchQueries({
        include: [aQuery, cQuery],
        onQueryUpdated: activeOQU.onQueryUpdated,
      })
    ).resolves.toEqual([{ data: { a: "A" } }]);

    await activeOQU.check([[aObs, { a: "A" }]]);

    await expect(aStream).toEmitTypedValue({
      data: { a: "A" },
      dataState: "complete",
      loading: false,
      networkStatus: NetworkStatus.ready,
      partial: false,
    });

    await expect(aStream).not.toEmitAnything();
    await expect(cStream).not.toEmitAnything();
  });

  it("should not include unwatched single queries", async () => {
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

    void client
      .query({
        query: delayedQuery,
        variables: {
          // Delay this query by 10 seconds so it stays in-flight.
          delay: 10000,
        },
      })
      .catch(() => {
        // swallow error when QueryManager is stopped later
      });

    const queries = client["queryManager"]["obsQueries"];
    expect(queries.size).toBe(3);

    const activeOQU = obsUpdatedCheck((obs, diff) =>
      Promise.resolve(diff.result)
    );
    const activeResults = await client.refetchQueries({
      include: "active",

      onQueryUpdated: activeOQU.onQueryUpdated,
    });
    await activeOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
      [abObs, { a: "A", b: "B" }],
    ]);

    sortObjects(activeResults);

    expect(activeResults).toEqual([{ a: "A" }, { a: "A", b: "B" }, { b: "B" }]);

    const allOQU = obsUpdatedCheck((obs, diff) => Promise.resolve(diff.result));
    const allResults = await client.refetchQueries({
      include: "all",

      onQueryUpdated: allOQU.onQueryUpdated,
    });
    await allOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
      [abObs, { a: "A", b: "B" }],
    ]);

    sortObjects(allResults);

    expect(allResults).toEqual([{ a: "A" }, { a: "A", b: "B" }, { b: "B" }]);

    unsubscribe();
    client.stop();

    expect(queries.size).toBe(0);
  });

  it("refetches watched queries if onQueryUpdated not provided", async () => {
    expect.assertions(10);
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
    const client = makeClient();
    const [aObs, _bObs, abObs] = await setup(client);

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

    const OQU = obsUpdatedCheck((obs, diff) => diff.result);
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

      onQueryUpdated: OQU.onQueryUpdated,
    });

    await OQU.check([
      [aObs, { a: "A" }],
      [abObs, { a: "A", b: "B" }],
    ]);

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
    const client = makeClient();
    const [aObs, bObs, _abObs] = await setup(client);

    const refetchOQU = obsUpdatedCheck((obs, diff) => true);
    const refetchResult = client.refetchQueries({
      include: ["A", "B"],
      onQueryUpdated: refetchOQU.onQueryUpdated,
    });
    await refetchOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
    ]);

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
      expect(Object.keys(result).sort()).toEqual(["data"]);
      return result.data;
    });

    sortObjects(results);

    expect(results).toEqual([{ a: "A" }, { b: "B" }]);
  });

  it("can return true from onQueryUpdated when using options.updateCache", async () => {
    const client = makeClient();
    const [_aObs, bObs, abObs] = await setup(client);

    const refetchOQU = obsUpdatedCheck((obs, diff) => true);
    const refetchResult = client.refetchQueries({
      updateCache(cache) {
        cache.writeQuery({
          query: bQuery,
          data: {
            b: "Beetlejuice",
          },
        });
      },

      onQueryUpdated: (obs, diff, lastDiff) => {
        expect(client.cache.extract()).toEqual({
          ROOT_QUERY: {
            __typename: "Query",
            a: "A",
            b: "Beetlejuice",
          },
        });
        return refetchOQU.onQueryUpdated(obs, diff, lastDiff);
      },
    });

    await refetchOQU.check([
      [bObs, { b: "Beetlejuice" }],
      [abObs, { a: "A", b: "Beetlejuice" }],
    ]);

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
      // These results are QueryResult<any>, as inferred by TypeScript.
      expect(Object.keys(result).sort()).toEqual(["data"]);
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
    const client = makeClient();
    const [aObs, bObs, _abObs] = await setup(client);

    const refetchOQU = obsUpdatedCheck((obs, diff) => obs.queryName === "B");
    const refetchResult = client.refetchQueries({
      include: ["A", "B"],
      onQueryUpdated: refetchOQU.onQueryUpdated,
    });
    await refetchOQU.check([
      [aObs, { a: "A" }],
      [bObs, { b: "B" }],
    ]);

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
      expect(Object.keys(result).sort()).toEqual(["data"]);
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
