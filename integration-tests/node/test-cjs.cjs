const assert = require("node:assert");
const path = require("node:path");
const { findPackageJSON } = require("node:module");
const { realpathSync } = require("node:fs");

const test = require("node:test");

const { ApolloClient } = require("@apollo/client");
const { useQuery } = require("@apollo/client/react");
const { HttpLink } = require("@apollo/client/link/http");

assert(process.features.require_module === false);

test.suite("Node with CJS require", () => {
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
      path.posix.join(basedir, "/__cjs/core/index.cjs")
    );
    assert.equal(
      require.resolve("@apollo/client/core"),
      path.posix.join(basedir, "/__cjs/core/index.cjs")
    );
    assert.equal(
      require.resolve("@apollo/client/react"),
      path.posix.join(basedir, "/__cjs/react/index.cjs")
    );
    assert.equal(
      require.resolve("@apollo/client/link/http"),
      path.posix.join(basedir, "/__cjs/link/http/index.cjs")
    );
  });
});
