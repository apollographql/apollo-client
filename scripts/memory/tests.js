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
    const registry = makeRegistry(key => {
      assert.strictEqual(key, "client.cache");
      resolve();
    }, reject);

    const localVar = makeVar(123);

    (function (client) {
      registry.register(client.cache, "client.cache");

      client.watchQuery({
        query: gql`query { local }`,
      }).subscribe({
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
});
