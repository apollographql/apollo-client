// eslint-disable-next-line no-restricted-syntax
export * from "./index.js";

function unsupported() {
  throw new Error("only supported in development mode");
}
export const getApolloCacheMemoryInternals =
    unsupported as typeof import("./getMemoryInternals.js").getApolloCacheMemoryInternals,
  getApolloClientMemoryInternals =
    unsupported as typeof import("./getMemoryInternals.js").getApolloClientMemoryInternals,
  getInMemoryCacheMemoryInternals =
    unsupported as typeof import("./getMemoryInternals.js").getInMemoryCacheMemoryInternals;
