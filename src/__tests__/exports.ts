import * as client from "..";
import * as core from "../core";
import * as react from "../react";
import * as cache from "../cache";
import * as utilities from "../utilities";
import * as ssr from "../react/ssr";
import * as components from "../react/components";
import * as hoc from "../react/hoc";
import * as batch from "../link/batch";
import * as batchHttp from "../link/batch-http";
import * as context from "../link/context";
import * as error from "../link/error";
import * as retry from "../link/retry";
import * as schema from "../link/schema";
import * as ws from "../link/ws";
import * as http from "../link/http";

type Namespace = object;

describe('exports of public entry points', () => {
  function check(id: string, ns: Namespace) {
    it(id, () => {
      expect(Object.keys(ns).sort()).toMatchSnapshot();
    });
  }

  check("@apollo/client", client);
  check("@apollo/client/cache", cache);
  check("@apollo/client/core", core);
  check("@apollo/client/link/batch", batch);
  check("@apollo/client/link/batch-http", batchHttp);
  check("@apollo/client/link/context", context);
  check("@apollo/client/link/error", error);
  check("@apollo/client/link/http", http);
  check("@apollo/client/link/retry", retry);
  check("@apollo/client/link/schema", schema);
  check("@apollo/client/link/ws", ws);
  check("@apollo/client/react", react);
  check("@apollo/client/react/components", components);
  check("@apollo/client/react/hoc", hoc);
  check("@apollo/client/react/ssr", ssr);
  check("@apollo/client/utilities", utilities);
});
