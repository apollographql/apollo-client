import { ApolloClient, ObservableQuery } from "@apollo/client";
import { isPlainObject } from "@apollo/client/utilities/internal";

function isKnownClassInstance(value: unknown) {
  return [ApolloClient, ObservableQuery].some((c) => value instanceof c);
}

export function getSerializableProperties(
  obj: unknown,
  {
    includeKnownClassInstances = false,
  }: { includeKnownClassInstances?: boolean } = {}
): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => getSerializableProperties(item));
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

        return { ...memo, [key]: value };
      },
      {} as Record<string, any>
    );
  }

  return obj;
}
