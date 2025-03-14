type Exported = typeof import("./index.js");
type ExportedFunctions = {
  [K in keyof Exported]: Exported[K] extends (...args: any[]) => any ? K
  : never;
}[keyof Exported];

function missingFeatureWarning(
  feature: string,
  name: ExportedFunctions
): () => never {
  return {
    [name]() {
      throw new Error(
        `The ${feature} ${name} is not supported in React Server Components, but only in Client Components.`
      );
    },
  }[name];
}

export type * from "./index.js";

export { DocumentType, operationName, parser } from "./parser/index.js";

// prettier-ignore
export const ApolloConsumer = missingFeatureWarning("component", "ApolloConsumer");
// prettier-ignore
export const ApolloProvider = missingFeatureWarning("component", "ApolloProvider");
// prettier-ignore
export const getApolloContext = missingFeatureWarning("function",  "getApolloContext");
// prettier-ignore
export const createQueryPreloader = missingFeatureWarning("function","createQueryPreloader");
// prettier-ignore
export const useApolloClient = missingFeatureWarning("hook", "useApolloClient");
// prettier-ignore
export const useBackgroundQuery = missingFeatureWarning("hook","useBackgroundQuery");
// prettier-ignore
export const useFragment = missingFeatureWarning("hook", "useFragment");
// prettier-ignore
export const useLazyQuery = missingFeatureWarning("hook", "useLazyQuery");
// prettier-ignore
export const useLoadableQuery = missingFeatureWarning("hook","useLoadableQuery");
// prettier-ignore
export const useMutation = missingFeatureWarning("hook", "useMutation");
// prettier-ignore
export const useQuery = missingFeatureWarning("hook", "useQuery");
// prettier-ignore
export const useQueryRefHandlers = missingFeatureWarning("hook","useQueryRefHandlers");
// prettier-ignore
export const useReactiveVar = missingFeatureWarning("hook", "useReactiveVar");
// prettier-ignore
export const useReadQuery = missingFeatureWarning("hook", "useReadQuery");
// prettier-ignore
export const useSubscription = missingFeatureWarning("hook", "useSubscription");
// prettier-ignore
export const useSuspenseFragment = missingFeatureWarning("hook","useSuspenseFragment");
// prettier-ignore
export const useSuspenseQuery = missingFeatureWarning("hook","useSuspenseQuery");

// We cannot warn on import of `skipToken`, and there is nothing to "execute" giving us a moment to warn,
// so we can only fully omit it from the bundle, leading to a bundling time error.
// export const skipToken = {};
