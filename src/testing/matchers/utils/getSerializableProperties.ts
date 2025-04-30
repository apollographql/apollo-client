import { ApolloClient, ObservableQuery } from "@apollo/client";
import { isPlainObject } from "@apollo/client/utilities";

function isKnownClassInstance(value: unknown) {
  return [ApolloClient, ObservableQuery].some((c) => value instanceof c);
}

export function getSerializableProperties(
  obj: unknown,
  skipUnknownInstances = false
): any {
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      getSerializableProperties(item, skipUnknownInstances)
    );
  }

  if (isPlainObject(obj)) {
    return Object.entries(obj).reduce(
      (memo, [key, value]) => {
        if (typeof value === "function" || isKnownClassInstance(value)) {
          return memo;
        }

        if (skipUnknownInstances) {
          return {
            ...memo,
            [key]: getSerializableProperties(value, skipUnknownInstances),
          };
        }

        return { ...memo, [key]: value };
      },
      {} as Record<string, any>
    );
  }

  if (
    skipUnknownInstances &&
    typeof obj === "object" &&
    obj !== null &&
    !(obj instanceof Error)
  ) {
    return "<skipped unknown instance>";
  }

  return obj;
}
