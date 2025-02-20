/** @jest-environment node */
// We run this in a node environment because:
// A) JSDOM doesn't yet support the TextEncoder/TextDecoder globals added in node 11, meaning certain imports (e.g. reactSSR) will fail (See https://github.com/jsdom/jsdom/issues/2524)
// B) We're just testing imports/exports, so no reason not to use Node for slightly better performance.

import * as cache from "../cache/index.js";
import * as client from "../index.js";
import * as core from "../core/index.js";
import * as dev from "../dev/index.js";
import * as errors from "../errors/index.js";
import * as linkBatch from "../link/batch/index.js";
import * as linkBatchHTTP from "../link/batch-http/index.js";
import * as linkContext from "../link/context/index.js";
import * as linkCore from "../link/core/index.js";
import * as linkError from "../link/error/index.js";
import * as linkHTTP from "../link/http/index.js";
import * as linkPersistedQueries from "../link/persisted-queries/index.js";
import * as linkRetry from "../link/retry/index.js";
import * as linkRemoveTypename from "../link/remove-typename/index.js";
import * as linkSchema from "../link/schema/index.js";
import * as linkSubscriptions from "../link/subscriptions/index.js";
import * as linkUtils from "../link/utils/index.js";
import * as linkWS from "../link/ws/index.js";
import * as masking from "../masking/index.js";
import * as react from "../react/index.js";
import * as reactContext from "../react/context/index.js";
import * as reactHooks from "../react/hooks/index.js";
import * as reactInternal from "../react/internal/index.js";
import * as reactParser from "../react/parser/index.js";
import * as reactSSR from "../react/ssr/index.js";
import * as testing from "../testing/index.js";
import * as testingCore from "../testing/core/index.js";
import * as testingExperimental from "../testing/experimental/index.js";
import * as testingReact from "../testing/react/index.js";
import * as utilities from "../utilities/index.js";
import * as utilitiesGlobals from "../utilities/globals/index.js";
import * as urqlUtilities from "../utilities/subscriptions/urql/index.js";
import * as utilitiesGlobalsEnvironment from "../utilities/globals/environment/index.js";

// @ts-ignore
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
  check("@apollo/client/masking", masking);
  check("@apollo/client/react", react);
  check("@apollo/client/react/context", reactContext);
  check("@apollo/client/react/hooks", reactHooks);
  check("@apollo/client/react/internal", reactInternal);
  check("@apollo/client/react/parser", reactParser);
  check("@apollo/client/react/ssr", reactSSR);
  check("@apollo/client/testing", testing);
  check("@apollo/client/testing/core", testingCore);
  check("@apollo/client/testing/experimental", testingExperimental);
  check("@apollo/client/testing/react", testingReact);
  check("@apollo/client/utilities", utilities);
  check("@apollo/client/utilities/globals", utilitiesGlobals);
  check("@apollo/client/utilities/subscriptions/urql", urqlUtilities);
  check(
    "@apollo/client/utilities/globals/environment",
    utilitiesGlobalsEnvironment
  );

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
