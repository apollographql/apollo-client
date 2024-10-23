type DevtoolsMessage = {
  type: "toggleConnectorsDebugging";
  enabled: boolean;
};

export interface DevtoolsActor {
  on: <TName extends DevtoolsMessage["type"]>(
    name: TName,
    callback: Extract<DevtoolsMessage, { type: TName }> extends infer Message ?
      (message: Message) => void
    : never
  ) => () => void;
  send: (message: DevtoolsMessage) => void;
}

export function createDevtoolsActor(): DevtoolsActor {
  let removeListener: (() => void) | null = null;
  const messageListeners = new Map<
    DevtoolsMessage["type"],
    Set<(message: DevtoolsMessage) => void>
  >();

  function handleMessage(event: MessageEvent) {
    const message = event.data;
    if (!isDevtoolsMessage(message)) {
      return;
    }

    const listeners = messageListeners.get(message.message.type);

    if (listeners) {
      listeners.forEach((listener) => {
        listener(message.message);
      });
    }
  }

  function startListening() {
    if (!removeListener) {
      window.addEventListener("message", handleMessage);
      removeListener = () => {
        window.removeEventListener("message", handleMessage);
      };
    }
  }

  function stopListening() {
    if (removeListener) {
      removeListener();
      removeListener = null;
    }
  }

  const on: DevtoolsActor["on"] = (name, callback, options = {}) => {
    let listeners = messageListeners.get(name) as Set<typeof callback>;

    if (!listeners) {
      listeners = new Set();
      messageListeners.set(name, listeners);
    }

    listeners.add(callback);
    startListening();

    const cleanup = () => {
      listeners!.delete(callback);

      if (listeners.size === 0) {
        messageListeners.delete(name);
      }

      if (messageListeners.size === 0) {
        stopListening();
      }
    };
    return cleanup;
  };

  return {
    on,
    send: (message) => {
      window.postMessage({
        id: createId(),
        source: "apollo-client",
        type: "actor",
        message,
      });
    },
  };
}

export type ApolloClientDevtoolsMessage = {
  id: string;
  source: "apollo-client-devtools";
  type: "actor";
  message: DevtoolsMessage;
};

function isDevtoolsMessage(
  message: unknown
): message is ApolloClientDevtoolsMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "source" in message &&
    "type" in message &&
    message.source === "apollo-client-devtools" &&
    message.type === "actor"
  );
}
export function createId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  return new Array(10)
    .fill(null)
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
}
