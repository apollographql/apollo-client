const assert = require("assert");
const {
  ApolloClient,
  InMemoryCache,
  gql,
  makeVar,
} = require("@apollo/client/core");

function itAsync(message, testFn) {
  const start = Date.now();
  let timeout;
  (function pollGC() {
    gc(); // enabled by --expose-gc
    // Passing --exit to mocha should cause the process to exit after
    // tests pass/fail/timeout, but (in case that fails) we also set a
    // hard limit of 10 seconds for GC polling.
    if (Date.now() < start + 10000) {
      timeout = setTimeout(pollGC, 100);
    }
  })();
  return it(message, () => new Promise(testFn).finally(() => {
    clearTimeout(timeout);
  }));
}

const registries = [];
function makeRegistry(callback, reject) {
  assert.strictEqual(typeof callback, "function");
  assert.strictEqual(typeof reject, "function");

  const registry = new FinalizationRegistry(key => {
    try {
      callback(key);
    } catch (error) {
      // Exceptions thrown in FinalizationRegistry callbacks can be tricky
      // for test frameworks to catch, without some help.
      reject(error);
    }
  });

  // If the registry object itself gets garbage collected before the
  // callback fires, the callback might never be called:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry#notes_on_cleanup_callbacks
  registries.push(registry);

  return registry;
}

describe("garbage collection", () => {
  itAsync("should collect client.cache after client.stop()", (resolve, reject) => {
    const expectedKeys = new Set([
      "client.cache",
      "ObservableQuery",
    ]);

    const registry = makeRegistry(key => {
      if (expectedKeys.delete(key) && !expectedKeys.size) {
        resolve();
      }
    }, reject);

    const localVar = makeVar(123);

    (function (client) {
      registry.register(client.cache, "client.cache");

      const obsQuery = client.watchQuery({
        query: gql`query { local }`,
      });

      registry.register(obsQuery, "ObservableQuery");

      obsQuery.subscribe({
        next(result) {
          assert.deepStrictEqual(result.data, {
            local: 123,
          });

          client.stop();
        },
      });

    })(new ApolloClient({
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              local() {
                return localVar();
              },
            },
          },
        },
      }),
    }));
  });

  itAsync("should collect ObservableQuery after tear-down", (resolve, reject) => {
    const expectedKeys = new Set([
      "ObservableQuery",
    ]);

    const registry = makeRegistry(key => {
      // Referring to client here should keep the client itself alive
      // until after the ObservableQuery is (or should have been)
      // collected. Collecting the ObservableQuery just because the whole
      // client instance was collected is not interesting.
      assert.strictEqual(client instanceof ApolloClient, true);

      if (expectedKeys.delete(key) && !expectedKeys.size) {
        resolve();
      }
    }, reject);

    const localVar = makeVar(123);

    const client = new ApolloClient({
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              local() {
                return localVar();
              },
            },
          },
        },
      }),
    });

    (function () {
      const obsQuery = client.watchQuery({
        query: gql`query { local }`,
      });

      registry.register(obsQuery, "ObservableQuery");

      const sub = obsQuery.subscribe({
        next(result) {
          assert.deepStrictEqual(result.data, {
            local: 123,
          });
          sub.unsubscribe();
        },
      });
    })();
  });
});
