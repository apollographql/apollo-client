import assert from "node:assert";
import path from "node:path";
import { findPackageJSON } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { realpathSync } from "node:fs";

test.suite("Node with ESM imports", () => {
  test("import from `.../index.js`", async () => {
    const { ApolloClient } = await import("@apollo/client/index.js");
    const { useQuery } = await import("@apollo/client/react/index.js");
    const { HttpLink } = await import("@apollo/client/link/http/index.js");
    assert.equal(ApolloClient.name, "ApolloClient");
    assert.equal(useQuery.name, "useQuery");
    assert.equal(HttpLink.name, "HttpLink");
  });

  test("import from entry point", async () => {
    const { ApolloClient } = await import("@apollo/client");
    const { useQuery } = await import("@apollo/client/react");
    const { HttpLink } = await import("@apollo/client/link/http");
    assert.equal(ApolloClient.name, "ApolloClient");
    assert.equal(useQuery.name, "useQuery");
    assert.equal(HttpLink.name, "HttpLink");
  });

  test("equality between `.../index.js` and entry point", async () => {
    assert.equal(
      await import("@apollo/client/index.js").ApolloClient,
      await import("@apollo/client").ApolloClient
    );
    assert.equal(
      await import("@apollo/client/react/index.js").useQuery,
      await import("@apollo/client/react").useQuery
    );
    assert.equal(
      await import("@apollo/client/link/http/index.js").HttpLink,
      await import("@apollo/client/link/http").HttpLink
    );
  });

  const basedir = path
    .dirname(realpathSync(findPackageJSON("@apollo/client", import.meta.url)))
    .split(path.sep)
    .join(path.posix.sep);

  test("module resolution (direct import)", () => {
    assert.equal(
      fileURLToPath(import.meta.resolve("@apollo/client/index.js")),
      path.posix.join(basedir, "/legacyEntryPoints/index.js")
    );
    assert.equal(
      fileURLToPath(import.meta.resolve("@apollo/client/core/index.js")),
      path.posix.join(basedir, "/legacyEntryPoints/core/index.js")
    );
    assert.equal(
      fileURLToPath(import.meta.resolve("@apollo/client/react/index.js")),
      path.posix.join(basedir, "/legacyEntryPoints/react/index.js")
    );
    assert.equal(
      fileURLToPath(import.meta.resolve("@apollo/client/link/http/index.js")),
      path.posix.join(basedir, "/legacyEntryPoints/link/http/index.js")
    );
  });

  test("module resolution", () => {
    assert.equal(
      fileURLToPath(import.meta.resolve("@apollo/client")),
      path.posix.join(basedir, "/core/index.js")
    );
    assert.equal(
      fileURLToPath(import.meta.resolve("@apollo/client/core")),
      path.posix.join(basedir, "/core/index.js")
    );
    assert.equal(
      fileURLToPath(import.meta.resolve("@apollo/client/react")),
      path.posix.join(basedir, "/react/index.js")
    );
    assert.equal(
      fileURLToPath(import.meta.resolve("@apollo/client/link/http")),
      path.posix.join(basedir, "/link/http/index.js")
    );
  });
});
