import * as cache from "../cache";
import * as client from "..";
import * as core from "../core";
import * as errors from "../errors";
import * as linkBatch from "../link/batch";
import * as linkBatchHTTP from "../link/batch-http";
import * as linkContext from "../link/context";
import * as linkCore from "../link/core";
import * as linkError from "../link/error";
import * as linkHTTP from "../link/http";
import * as linkPersistedQueries from "../link/persisted-queries";
import * as linkRetry from "../link/retry";
import * as linkSchema from "../link/schema";
import * as linkUtils from "../link/utils";
import * as linkWS from "../link/ws";
import * as react from "../react";
import * as reactComponents from "../react/components";
import * as reactContext from "../react/context";
import * as reactData from "../react/data";
import * as reactHOC from "../react/hoc";
import * as reactHooks from "../react/hooks";
import * as reactParser from "../react/parser";
import * as reactSSR from "../react/ssr";
import * as testing from "../testing";
import * as utilities from "../utilities";

const entryPoints = require("../../config/entryPoints.js");

type Namespace = object;

describe('exports of public entry points', () => {
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
  check("@apollo/client/errors", errors);
  check("@apollo/client/link/batch", linkBatch);
  check("@apollo/client/link/batch-http", linkBatchHTTP);
  check("@apollo/client/link/context", linkContext);
  check("@apollo/client/link/core", linkCore);
  check("@apollo/client/link/error", linkError);
  check("@apollo/client/link/http", linkHTTP);
  check("@apollo/client/link/persisted-queries", linkPersistedQueries);
  check("@apollo/client/link/retry", linkRetry);
  check("@apollo/client/link/schema", linkSchema);
  check("@apollo/client/link/utils", linkUtils);
  check("@apollo/client/link/ws", linkWS);
  check("@apollo/client/react", react);
  check("@apollo/client/react/components", reactComponents);
  check("@apollo/client/react/context", reactContext);
  check("@apollo/client/react/data", reactData);
  check("@apollo/client/react/hoc", reactHOC);
  check("@apollo/client/react/hooks", reactHooks);
  check("@apollo/client/react/parser", reactParser);
  check("@apollo/client/react/ssr", reactSSR);
  check("@apollo/client/testing", testing);
  check("@apollo/client/utilities", utilities);

  it("completeness", () => {
    const { join } = require("path").posix;
    entryPoints.forEach((info: Record<string, any>) => {
      const id = join("@apollo/client", ...info.dirs);
      expect(testedIds).toContain(id);
    });
  });
});
