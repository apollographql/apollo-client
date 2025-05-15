import { ApolloClient, ObservableQuery } from "@apollo/client";
import { isPlainObject } from "@apollo/client/utilities/internal";

function isKnownClassInstance(value: unknown) {
  return [ApolloClient, ObservableQuery].some((c) => value instanceof c);
}

export function getSerializableProperties(
  obj: unknown,

  {
    includeKnownClassInstances = false,
    skipUnknownInstances = false,
  }: {
    includeKnownClassInstances?: boolean;
    skipUnknownInstances?: boolean;
  } = {}
): any {
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      getSerializableProperties(item, {
        includeKnownClassInstances,
        skipUnknownInstances,
      })
    );
  }

  if (isPlainObject(obj)) {
    return Object.entries(obj).reduce(
      (memo, [key, value]) => {
        if (
          typeof value === "function" ||
          (!includeKnownClassInstances && isKnownClassInstance(value))
        ) {
          return memo;
        }

        if (skipUnknownInstances) {
          return {
            ...memo,
            [key]: getSerializableProperties(value, {
              includeKnownClassInstances,
              skipUnknownInstances,
            }),
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
