const assert = require("node:assert");
const path = require("node:path");
const { findPackageJSON } = require("node:module");
const test = require("node:test");
const { realpathSync } = require("node:fs");

const { ApolloClient } = require("@apollo/client");
const { useQuery } = require("@apollo/client/react");
const { HttpLink } = require("@apollo/client/link/http");

assert(process.features.require_module === true);

test.suite("Node with ESM require", () => {
  test("import from entry point", async () => {
    assert.equal(ApolloClient.name, "ApolloClient");
    assert.equal(useQuery.name, "useQuery");
    assert.equal(HttpLink.name, "HttpLink");
  });

  test("module resolution", () => {
    const basedir = path
      .dirname(realpathSync(findPackageJSON("@apollo/client", __filename)))
      .split(path.sep)
      .join(path.posix.sep);

    assert.equal(
      require.resolve("@apollo/client"),
      path.posix.join(basedir, "/core/index.js")
    );
    assert.equal(
      require.resolve("@apollo/client/core"),
      path.posix.join(basedir, "/core/index.js")
    );
    assert.equal(
      require.resolve("@apollo/client/react"),
      path.posix.join(basedir, "/react/index.js")
    );
    assert.equal(
      require.resolve("@apollo/client/link/http"),
      path.posix.join(basedir, "/link/http/index.js")
    );
  });
});
