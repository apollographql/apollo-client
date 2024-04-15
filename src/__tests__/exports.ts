/** @jest-environment node */
// We run this in a node environment because:
// A) JSDOM doesn't yet support the TextEncoder/TextDecoder globals added in node 11, meaning certain imports (e.g. reactSSR) will fail (See https://github.com/jsdom/jsdom/issues/2524)
// B) We're just testing imports/exports, so no reason not to use Node for slightly better performance.

import * as cache from "../cache";
import * as client from "..";
import * as core from "../core";
import * as dev from "../dev";
import * as errors from "../errors";
import * as linkBatch from "../link/batch";
import * as linkBatchHTTP from "../link/batch-http";
import * as linkContext from "../link/context";
import * as linkCore from "../link/core";
import * as linkError from "../link/error";
import * as linkHTTP from "../link/http";
import * as linkPersistedQueries from "../link/persisted-queries";
import * as linkRetry from "../link/retry";
import * as linkRemoveTypename from "../link/remove-typename";
import * as linkSchema from "../link/schema";
import * as linkSubscriptions from "../link/subscriptions";
import * as linkUtils from "../link/utils";
import * as linkWS from "../link/ws";
import * as react from "../react";
import * as reactComponents from "../react/components";
import * as reactContext from "../react/context";
import * as reactHOC from "../react/hoc";
import * as reactHooks from "../react/hooks";
import * as reactInternal from "../react/internal";
import * as reactParser from "../react/parser";
import * as reactSSR from "../react/ssr";
import * as testing from "../testing";
import * as testingCore from "../testing/core";
import * as testingExperimental from "../testing/experimental";
import * as utilities from "../utilities";
import * as utilitiesGlobals from "../utilities/globals";
import * as urqlUtilities from "../utilities/subscriptions/urql";

const entryPoints = require("../../config/entryPoints.js");

type Namespace = object;

describe("exports of public entry points", () => {
  const testedIds = new Set<string>();

  function check(id: string, ns: Namespace) {
    it(id, () => {
      testedIds.add(id);
      expect(Object.keys(ns).sort()).toMatchSnapshot();
    });
  }

  check("@apollo/client", client);
  check("@apollo/client/cache", cache);
  check("@apollo/client/core", core);
  check("@apollo/client/dev", dev);
  check("@apollo/client/errors", errors);
  check("@apollo/client/link/batch", linkBatch);
  check("@apollo/client/link/batch-http", linkBatchHTTP);
  check("@apollo/client/link/context", linkContext);
  check("@apollo/client/link/core", linkCore);
  check("@apollo/client/link/error", linkError);
  check("@apollo/client/link/http", linkHTTP);
  check("@apollo/client/link/persisted-queries", linkPersistedQueries);
  check("@apollo/client/link/remove-typename", linkRemoveTypename);
  check("@apollo/client/link/retry", linkRetry);
  check("@apollo/client/link/schema", linkSchema);
  check("@apollo/client/link/subscriptions", linkSubscriptions);
  check("@apollo/client/link/utils", linkUtils);
  check("@apollo/client/link/ws", linkWS);
  check("@apollo/client/react", react);
  check("@apollo/client/react/components", reactComponents);
  check("@apollo/client/react/context", reactContext);
  check("@apollo/client/react/hoc", reactHOC);
  check("@apollo/client/react/hooks", reactHooks);
  check("@apollo/client/react/internal", reactInternal);
  check("@apollo/client/react/parser", reactParser);
  check("@apollo/client/react/ssr", reactSSR);
  check("@apollo/client/testing", testing);
  check("@apollo/client/testing/core", testingCore);
  check("@apollo/client/testing/experimental", testingExperimental);
  check("@apollo/client/utilities", utilities);
  check("@apollo/client/utilities/globals", utilitiesGlobals);
  check("@apollo/client/utilities/subscriptions/urql", urqlUtilities);

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
