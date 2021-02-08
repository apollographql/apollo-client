const assert = require("assert");
const {
  ApolloClient,
  InMemoryCache,
  gql,
  makeVar,
} = require("@apollo/client/core");

function itAsync(message, testFn) {
  let timeout;
  (function pollGC() {
    gc(); // enabled by --expose-gc
    timeout = setTimeout(pollGC, 100);
  })();
  return it(message, () => new Promise(testFn).finally(() => {
    clearTimeout(timeout);
  }));
}

describe("garbage collection", () => {
  itAsync("should collect client.cache after client.stop() called", resolve => {
    const registry = new FinalizationRegistry(key => {
      clearTimeout(timeout);
      assert.strictEqual(key, "client.cache");
      resolve();
    });

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
