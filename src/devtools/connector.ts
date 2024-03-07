import type { ApolloClient } from "../core/index.js";
import type { Message } from "./messages.js";

interface DevToolsConnector {
  push: (client: ApolloClient<unknown>) => void;
  send: <T extends Record<string, unknown>>(message: Message<T>) => void;
}

function noop() {}

export function getDevtoolsConnector(): DevToolsConnector {
  if (typeof window === "undefined") {
    return { push: noop, send: noop };
  }

  const devtoolsSymbol = Symbol.for("apollo.devtools");
  const windowWithDevtools = window as Window & {
    [devtoolsSymbol]?: DevToolsConnector;
  };

  windowWithDevtools[devtoolsSymbol] =
    windowWithDevtools[devtoolsSymbol] || ([] as unknown as DevToolsConnector);

  const connector = windowWithDevtools[devtoolsSymbol];

  if (!connector.send) {
    // Until the devtools script connects, any messages sent will be discarded.
    // Once devtools connect, this is expected to be replaced by the actual send
    // function.
    Object.assign(connector, { send: noop });
  }

  return connector;
}
