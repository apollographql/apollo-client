/** @jest-environment node */
// We run this in a node environment because:
// A) JSDOM doesn't yet support the TextEncoder/TextDecoder globals added in node 11, meaning certain imports (e.g. reactSSR) will fail (See https://github.com/jsdom/jsdom/issues/2524)
// B) We're just testing imports/exports, so no reason not to use Node for slightly better performance.

import { resolve } from "node:path";

import { $ } from "zx";

// eslint-disable-next-line import/no-duplicates
import * as client from "@apollo/client";
import * as cache from "@apollo/client/cache";
// eslint-disable-next-line import/no-duplicates
import * as core from "@apollo/client/core";
import * as dev from "@apollo/client/dev";
import * as errors from "@apollo/client/errors";
import * as incremental from "@apollo/client/incremental";
import * as linkCore from "@apollo/client/link";
import * as linkBatch from "@apollo/client/link/batch";
import * as linkBatchHTTP from "@apollo/client/link/batch-http";
import * as linkClientAwareness from "@apollo/client/link/client-awareness";
import * as linkContext from "@apollo/client/link/context";
import * as linkError from "@apollo/client/link/error";
import * as linkHTTP from "@apollo/client/link/http";
import * as linkPersistedQueries from "@apollo/client/link/persisted-queries";
import * as linkRemoveTypename from "@apollo/client/link/remove-typename";
import * as linkRetry from "@apollo/client/link/retry";
import * as linkSchema from "@apollo/client/link/schema";
import * as linkSubscriptions from "@apollo/client/link/subscriptions";
import * as linkUtils from "@apollo/client/link/utils";
import * as linkWS from "@apollo/client/link/ws";
import * as localState from "@apollo/client/local-state";
import * as masking from "@apollo/client/masking";
import * as react from "@apollo/client/react";
import * as reactInternal from "@apollo/client/react/internal";
import * as compilerRuntime from "@apollo/client/react/internal/compiler-runtime";
import * as reactSSR from "@apollo/client/react/ssr";
import * as testing from "@apollo/client/testing";
import * as testingInternal from "@apollo/client/testing/internal";
import * as testingReact from "@apollo/client/testing/react";
import * as utilities from "@apollo/client/utilities";
import * as utilitiesEnvironment from "@apollo/client/utilities/environment";
import * as utilitiesInternal from "@apollo/client/utilities/internal";
import * as utilitiesInternalGlobals from "@apollo/client/utilities/internal/globals";
import * as utilitiesInvariant from "@apollo/client/utilities/invariant";
import * as v4_migration from "@apollo/client/v4-migration";

// eslint-disable-next-line local-rules/no-relative-imports
import { entryPoints } from "../../config/entryPoints.js";

type Namespace = object;

describe("exports of public entry points", () => {
  const testedIds = new Set<string>();

  function check(id: string, ns: Namespace) {
    it(id, () => {
      testedIds.add(id);
      expect(Object.keys(ns).sort()).toMatchSnapshot();
    });
  }
  function checkWithConditions(id: string, conditions: string[]) {
    test(`${id} with conditions [${conditions.join(",")}]`, async () => {
      const exports = await $({
        cwd: resolve(__dirname, "../../"),
      })`node --experimental-transform-types --no-warnings ${conditions.flatMap(
        (condition) => [`--conditions`, condition]
      )} config/listImports.ts ${id}`;
      expect(
        exports.stdout.split("\n").filter((x) => x.trim() !== "")
      ).toMatchSnapshot();
    });
  }

  check("@apollo/client", client);
  check("@apollo/client/cache", cache);
  check("@apollo/client/core", core);
  check("@apollo/client/dev", dev);
  check("@apollo/client/errors", errors);
  check("@apollo/client/incremental", incremental);
  check("@apollo/client/link/batch", linkBatch);
  check("@apollo/client/link/batch-http", linkBatchHTTP);
  check("@apollo/client/link/client-awareness", linkClientAwareness);
  check("@apollo/client/link/context", linkContext);
  check("@apollo/client/link", linkCore);
  check("@apollo/client/link/error", linkError);
  check("@apollo/client/link/http", linkHTTP);
  check("@apollo/client/link/persisted-queries", linkPersistedQueries);
  check("@apollo/client/link/remove-typename", linkRemoveTypename);
  check("@apollo/client/link/retry", linkRetry);
  check("@apollo/client/link/schema", linkSchema);
  check("@apollo/client/link/subscriptions", linkSubscriptions);
  check("@apollo/client/link/utils", linkUtils);
  check("@apollo/client/link/ws", linkWS);
  check("@apollo/client/local-state", localState);
  check("@apollo/client/masking", masking);
  check("@apollo/client/react", react);
  check("@apollo/client/react/internal", reactInternal);
  check("@apollo/client/react/internal/compiler-runtime", compilerRuntime);
  check("@apollo/client/react/ssr", reactSSR);
  check("@apollo/client/testing", testing);
  check("@apollo/client/testing/internal", testingInternal);
  check("@apollo/client/testing/react", testingReact);
  check("@apollo/client/utilities", utilities);
  check("@apollo/client/utilities/internal", utilitiesInternal);
  check("@apollo/client/utilities/internal/globals", utilitiesInternalGlobals);
  check("@apollo/client/utilities/invariant", utilitiesInvariant);
  check("@apollo/client/utilities/environment", utilitiesEnvironment);
  check("@apollo/client/v4-migration", v4_migration);

  checkWithConditions("@apollo/client/react", ["react-server"]);

  expect(client).toStrictEqual(core);

  it("completeness", () => {
    const { join } = require("path").posix;
    entryPoints.forEach((info: Record<string, any>) => {
      const id = join("@apollo/client", ...info.dirs);
      // We don't want to add a devDependency for relay-runtime,
      // and our API extractor job is already validating its public exports,
      // so we'll skip the utilities/subscriptions/relay entrypoing here
      // since it errors on the `relay-runtime` import.
      if (id === "@apollo/client/utilities/subscriptions/relay") return;
      expect(testedIds).toContain(id);
    });
  });
});
