const assert = require("assert");
const {
  ApolloClient,
  InMemoryCache,
  gql,
  makeVar,
} = require("@apollo/client/core");

describe("garbage collection", () => {
  it("should collect client.cache after client.stop() called", done => {
    let timeout;
    (function pollGC() {
      gc(); // enabled by --expose-gc
      timeout = setTimeout(pollGC, 100);
    })();

    const registry = new FinalizationRegistry(key => {
      clearTimeout(timeout);
      assert.strictEqual(key, "client.cache");
      done();
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
