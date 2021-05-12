import { Subscription } from "zen-observable-ts";

import { itAsync } from '../utilities/testing/itAsync';
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  gql,
  Observable,
  TypedDocumentNode,
  ObservableQuery,
} from "../core";

describe("client.refetchQueries", () => {
  itAsync("is public and callable", (resolve, reject) => {
    const client = new ApolloClient({
      cache: new InMemoryCache,
    });
    expect(typeof client.refetchQueries).toBe("function");

    const result = client.refetchQueries({
      updateCache(cache) {
        expect(cache).toBe(client.cache);
        expect(cache.extract()).toEqual({});
      },
      onQueryUpdated() {
        reject("should not have called onQueryUpdated");
        return false;
      },
    });

    expect(result.queries).toEqual([]);
    expect(result.results).toEqual([]);

    result.then(resolve, reject);
  });

  const aQuery: TypedDocumentNode<{ a: string }> = gql`query A { a }`;
  const bQuery: TypedDocumentNode<{ b: string }> = gql`query B { b }`;
  const abQuery: TypedDocumentNode<{
    a: string;
    b: string;
  }> = gql`query AB { a b }`;

  function makeClient() {
    return new ApolloClient({
      cache: new InMemoryCache,
      link: new ApolloLink(operation => new Observable(observer => {
        const data: Record<string, string> = {};
        operation.operationName.split("").forEach(letter => {
          data[letter.toLowerCase()] = letter.toUpperCase();
        });
        observer.next({ data });
        observer.complete();
      })),
    });
  }

  const subs: Subscription[] = [];
  function unsubscribe() {
    subs.splice(0).forEach(sub => sub.unsubscribe());
  }

  function setup(client = makeClient()) {
    function watch<T>(query: TypedDocumentNode<T>) {
      const obsQuery = client.watchQuery({ query });
      return new Promise<ObservableQuery<T>>((resolve, reject) => {
        subs.push(obsQuery.subscribe({
          error: reject,
          next(result) {
            expect(result.loading).toBe(false);
            resolve(obsQuery);
          },
        }));
      });
    }

    return Promise.all([
      watch(aQuery),
      watch(bQuery),
      watch(abQuery),
    ]);
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

  itAsync("includes watched queries affected by updateCache", async (resolve, reject) => {
    const client = makeClient();
    const [
      aObs,
      bObs,
      abObs,
    ] = await setup(client);

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
          reject("bQuery should not have been updated");
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "B" });
        } else {
          reject("unexpected ObservableQuery");
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
          reject("aQuery should not have been updated");
        } else if (obs === bObs) {
          expect(diff.result).toEqual({ b: "Bee" });
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "Ayy", b: "Bee" });
        } else {
          reject("unexpected ObservableQuery");
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
    resolve();
  });

  itAsync("includes watched queries named in options.include", async (resolve, reject) => {
    const client = makeClient();
    const [
      aObs,
      bObs,
      abObs,
    ] = await setup(client);

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
          reject("unexpected ObservableQuery");
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
          reject("unexpected ObservableQuery");
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
    resolve();
  });

  itAsync("refetches watched queries if onQueryUpdated not provided", async (resolve, reject) => {
    const client = makeClient();
    const [
      aObs,
      bObs,
      abObs,
    ] = await setup(client);

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
    ).map(result => result.data as object);

    sortObjects(ayyResults);

    // These results have reverted back to what the ApolloLink returns ("A"
    // rather than "Ayy"), because we let them be refetched (by not providing
    // an onQueryUpdated function).
    expect(ayyResults).toEqual([
      { a: "A" },
      { a: "A", b: "B" },
      { b: "B" },
    ]);

    expect(aSpy).toHaveBeenCalledTimes(1);
    expect(bSpy).toHaveBeenCalledTimes(1);
    expect(abSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
    resolve();
  });

  itAsync("can run updateQuery function against optimistic cache layer", async (resolve, reject) => {
    const client = makeClient();
    const [
      aObs,
      bObs,
      abObs,
    ] = await setup(client);

    client.cache.watch({
      query: abQuery,
      optimistic: false,
      callback(diff) {
        reject("should not have notified non-optimistic watcher");
      },
    });

    expect(client.cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        "a": "A",
        "b": "B",
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
          reject("bQuery should not have been updated");
        } else if (obs === abObs) {
          expect(diff.result).toEqual({ a: "A", b: "B" });
        } else {
          reject("unexpected ObservableQuery");
        }

        return diff.result;
      },
    });

    sortObjects(results);

    expect(results).toEqual([
      { a: "A" },
      { a: "A", b: "B" },
    ]);

    expect(client.cache.extract(true)).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        "a": "A",
        "b": "B",
      },
    });

    resolve();
  });

  it("can return true from onQueryUpdated to choose default refetching behavior", () => {
    // TODO
  });

  it("can return false from onQueryUpdated to skip the updated query", () => {
    // TODO
  });

  it("can refetch no-cache queries", () => {
    // TODO
  });
});
