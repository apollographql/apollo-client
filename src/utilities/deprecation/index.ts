import { Slot } from "optimism";
import { invariant } from "../globals/index.js";

const slot = new Slot<string[]>();

type WithValueArgs<TResult, TArgs extends any[], TThis> = [
  callback: (this: TThis, ...args: TArgs) => TResult,
  args?: TArgs | undefined,
  thisArg?: TThis | undefined,
];

export type PossibleDeprecations = {
  "cache.readQuery": ["canonizeResults"];
  "cache.readFragment": ["canonizeResults"];
  "cache.updateQuery": ["canonizeResults"];
  "cache.updateFragment": ["canonizeResults"];
  InMemoryCache: ["addTypename", "canonizeResults"];
  "cache.read": ["canonizeResults"];
  "cache.diff": ["canonizeResults"];
  "cache.gc": ["resetResultIdentities"];
  ApolloClient: [
    "connectToDevTools",
    "uri",
    "credentials",
    "headers",
    "name",
    "version",
    "typeDefs",
  ];
  "client.watchQuery": ["canonizeResults", "partialRefetch"];
  "client.query": ["canonizeResults", "notifyOnNetworkStatusChange"];
  setOptions: ["canonizeResults"];
  useBackgroundQuery: ["canonizeResults"];
  useFragment: ["canonizeResults"];
  useLazyQuery: [
    "canonizeResults",
    "variables",
    "context",
    "onCompleted",
    "onError",
    "defaultOptions",
    "initialFetchPolicy",
    "partialRefetch",
  ];
  "useLazyQuery.execute": [
    "initialFetchPolicy",
    "onCompleted",
    "onError",
    "defaultOptions",
    "partialRefetch",
    "canonizeResults",
    "query",
    "ssr",
    "client",
    "fetchPolicy",
    "nextFetchPolicy",
    "refetchWritePolicy",
    "errorPolicy",
    "pollInterval",
    "notifyOnNetworkStatusChange",
    "returnPartialData",
    "skipPollAttempt",
  ];
  useLoadableQuery: ["canonizeResults"];
  useMutation: ["ignoreResults"];
  useQuery: [
    "canonizeResults",
    "partialRefetch",
    "defaultOptions",
    "onCompleted",
    "onError",
  ];
  useSuspenseQuery: ["canonizeResults"];
  preloadQuery: ["canonizeResults"];
  MockedProvider: ["connectToDevTools", "addTypename"];
  ObservableQuery: [
    "observableQuery.result",
    "getLastResult",
    "getLastError",
    "resetLastResults",
    "setOptions",
  ];
  HOC: [
    "graphql" | "withQuery" | "withMutation" | "withSubscription",
    "parser",
  ];
  RenderProps: ["<Query />" | "<Mutation />" | "<Subscription />"];
};

export type DeprecationName =
  | keyof PossibleDeprecations
  | NonNullable<PossibleDeprecations[keyof PossibleDeprecations]>[number];

function isMuted(name: DeprecationName) {
  return (slot.getValue() || []).includes(name);
}

export function muteDeprecations<TResult, TArgs extends any[], TThis = any>(
  name: DeprecationName | DeprecationName[],
  ...args: WithValueArgs<TResult, TArgs, TThis>
) {
  return slot.withValue(Array.isArray(name) ? name : [name], ...args);
}

export function warnRemovedOption<
  TOptions extends Record<string, any>,
  CallSite extends keyof PossibleDeprecations,
>(
  options: TOptions,
  name: keyof TOptions & PossibleDeprecations[CallSite][number],
  callSite: CallSite,
  recommendation: string = "Please remove this option."
) {
  warnDeprecated(name as DeprecationName, () => {
    if (name in options) {
      invariant.warn(
        "[%s]: `%s` is deprecated and will be removed in Apollo Client 4.0. %s",
        callSite,
        name,
        recommendation
      );
    }
  });
}

export function warnDeprecated(name: DeprecationName, cb: () => void) {
  if (!isMuted(name)) {
    cb();
  }
}
