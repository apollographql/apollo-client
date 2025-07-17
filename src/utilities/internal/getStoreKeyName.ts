// eslint-disable-next-line local-rules/import-from-inside-other-export
import { canonicalStringify } from "../shared/canonicalStringify.js";

type Directives = {
  [directiveName: string]: {
    [argName: string]: any;
  };
};

const KNOWN_DIRECTIVES: string[] = [
  "connection",
  "include",
  "skip",
  "client",
  "rest",
  "export",
  "nonreactive",
];

// Default stable JSON.stringify implementation used by getStoreKeyName. Can be
// updated/replaced with something better by calling
// getStoreKeyName.setStringify(newStringifyFunction).
let storeKeyNameStringify: (value: any) => string = canonicalStringify;

/** @internal */
export const getStoreKeyName = Object.assign(
  function (
    fieldName: string,
    args?: Record<string, any> | null,
    directives?: Directives
  ): string {
    if (
      args &&
      directives &&
      directives["connection"] &&
      directives["connection"]["key"]
    ) {
      if (
        directives["connection"]["filter"] &&
        (directives["connection"]["filter"] as string[]).length > 0
      ) {
        const filterKeys =
          directives["connection"]["filter"] ?
            (directives["connection"]["filter"] as string[])
          : [];
        filterKeys.sort();

        const filteredArgs = {} as { [key: string]: any };
        filterKeys.forEach((key) => {
          filteredArgs[key] = args[key];
        });

        const stringifiedArgs: string = storeKeyNameStringify(filteredArgs);
        if (stringifiedArgs !== "{}") {
          return `${directives["connection"]["key"]}(${stringifiedArgs})`;
        }
      }
      return directives["connection"]["key"];
    }

    let completeFieldName: string = fieldName;

    if (args) {
      // We can't use `JSON.stringify` here since it's non-deterministic,
      // and can lead to different store key names being created even though
      // the `args` object used during creation has the same properties/values.
      const stringifiedArgs: string = storeKeyNameStringify(args);
      if (stringifiedArgs !== "{}") {
        completeFieldName += `(${stringifiedArgs})`;
      }
    }

    if (directives) {
      Object.keys(directives).forEach((key) => {
        if (KNOWN_DIRECTIVES.indexOf(key) !== -1) return;
        if (directives[key] && Object.keys(directives[key]).length) {
          completeFieldName += `@${key}(${storeKeyNameStringify(
            directives[key]
          )})`;
        } else {
          completeFieldName += `@${key}`;
        }
      });
    }

    return completeFieldName;
  },
  {
    setStringify(s: typeof storeKeyNameStringify) {
      const previous = storeKeyNameStringify;
      storeKeyNameStringify = s;
      return previous;
    },
  }
);
