import { ApolloClient, ObservableQuery } from "@apollo/client";
import { isPlainObject } from "@apollo/client/utilities/internal";

function isKnownClassInstance(value: unknown) {
  return [ApolloClient, ObservableQuery].some((c) => value instanceof c);
}

export function getSerializableProperties(
  obj: unknown,
  {
    includeKnownClassInstances = false,
  }: {
    includeKnownClassInstances?: boolean;
  } = {}
): any {
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      getSerializableProperties(item, {
        includeKnownClassInstances,
      })
    );
  }

  if (isPlainObject(obj)) {
    return [...Object.keys(obj), ...Object.getOwnPropertySymbols(obj)].reduce(
      (memo, key) => {
        const value = obj[key as any];
        if (
          typeof value === "function" ||
          (!includeKnownClassInstances && isKnownClassInstance(value))
        ) {
          return memo;
        }

        // Recurse if we have a nested object/array
        if (isPlainObject(value) || Array.isArray(value)) {
          return {
            ...memo,
            [key]: getSerializableProperties(value, {
              includeKnownClassInstances,
            }),
          };
        }
        return { ...memo, [key]: value };
      },
      {} as Record<string, any>
    );
  }

  return obj;
}
