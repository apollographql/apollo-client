import { invariant } from "../../utilities/globals";
import { Trie } from "@wry/trie";

import {
  argumentsObjectFromField,
  canUseWeakMap,
  DeepMerger,
  getFragmentFromSelection,
  isField,
  isNonEmptyArray,
  isNonNullObject,
  resultKeyNameFromField,
} from "../../utilities";

import {
  KeySpecifier,
  KeyFieldsFunction,
  KeyFieldsContext,
  KeyArgsFunction,
} from "./policies";
import { hasOwn } from "./helpers";

type AliasMap = {
  aliases: {
    // Any given schemaKey (the actual field name, according to the schema) maps
    // to one or more result field names (typically schemaKey itself, and
    // possibly additional resultKeys that are !== schemaKey, due to aliases).
    [schemaKey: string]: {
      // If the aliased field has a selection set of its own, the AliasMap for
      // that selection set will be collected here.
      [resultKey: string]: AliasMap | null;
    };
  };
  // Map from resultKey to schemaKey strings for this selection set.
  actuals: Record<string, string>;
};

function makeEmptyAliasMap(): AliasMap {
  return {
    aliases: Object.create(null),
    actuals: Object.create(null),
  };
}

export class KeyExtractor {
  private aliasMapTrie = new Trie<{
    aliasMap?: AliasMap;
  }>(canUseWeakMap);

  private getAliasMap(
    selectionSet: KeyFieldsContext["selectionSet"],
    fragmentMap: KeyFieldsContext["fragmentMap"],
  ): AliasMap {
    if (!selectionSet || !fragmentMap) {
      return makeEmptyAliasMap();
    }

    const info = this.aliasMapTrie.lookup(selectionSet, fragmentMap);
    if (!info.aliasMap) {
      const aliasMap: AliasMap = info.aliasMap = makeEmptyAliasMap();
      const workQueue = new Set([selectionSet]);
      const merger = new DeepMerger;
      workQueue.forEach(selectionSet => {
        selectionSet.selections.forEach(selection => {
          if (isField(selection)) {
            const schemaKey = selection.name.value;
            const resultKey = resultKeyNameFromField(selection);
            const aliases = aliasMap.aliases[schemaKey] ||
              (aliasMap.aliases[schemaKey] = Object.create(null));
            // TODO Make sure nulls are merged correctly.
            aliases[resultKey] = selection.selectionSet ? merger.merge(
              aliases[resultKey] || Object.create(null),
              this.getAliasMap(selection.selectionSet, fragmentMap),
            ) : aliases[resultKey] || null;
            if (resultKey !== schemaKey) {
              aliasMap.actuals[resultKey] = schemaKey;
            }
          } else {
            const fragment = getFragmentFromSelection(selection, fragmentMap);
            if (fragment) {
              workQueue.add(fragment.selectionSet);
            }
          }
        });
      });
    }

    return info.aliasMap!;
  }

  public keyFieldsFnFromSpecifier(specifier: KeySpecifier): KeyFieldsFunction {
    return (object, context) => {
      const aliasMap = this.getAliasMap(
        context.selectionSet,
        context.fragmentMap,
      );

      context.keyObject = collectSpecifierPaths(
        specifier,
        schemaKeyPath => extractKeyPath(object, schemaKeyPath, aliasMap),
      );

      return `${context.typename}:${JSON.stringify(context.keyObject)}`;
    };
  }

  public keyArgsFnFromSpecifier(specifier: KeySpecifier): KeyArgsFunction {
    return (args, { field, variables, fieldName }) => {
      const collected = collectSpecifierPaths(specifier, keyPath => {
        const firstKey = keyPath[0];
        const firstChar = firstKey.charAt(0);
        if (firstChar === "@") {
          if (field && isNonEmptyArray(field.directives)) {
            // TODO Cache this work somehow, a la aliasMap?
            const directiveName = firstKey.slice(1);
            // If the directive appears multiple times, only the first
            // occurrence's arguments will be used. TODO Allow repetition?
            const d = field.directives.find(d => d.name.value === directiveName);
            if (d) {
              // Fortunately argumentsObjectFromField works for DirectiveNode!
              const directiveArgs = argumentsObjectFromField(d, variables);
              return directiveArgs ? extractKeyPath(
                directiveArgs,
                keyPath.slice(1),
                null,
              ) : void 0;
            }
          }
          // If the key started with @ but there was no corresponding
          // directive, we want to omit this value from the key object, not
          // fall through to treating @whatever as a normal argument name.
          return;
        }

        if (firstChar === "$") {
          const variableName = firstKey.slice(1);
          if (variables && hasOwn.call(variables, variableName)) {
            const variableValue = variables[variableName];
            return isNonNullObject(variableValue)
              ? extractKeyPath(variableValue, keyPath.slice(1), null)
              : variableValue;
          }
          // If the key started with $ but there was no corresponding
          // variable, we want to omit this value from the key object, not
          // fall through to treating $whatever as a normal argument name.
          return;
        }

        if (args) {
          return extractKeyPath(args, keyPath, null);
        }
      });

      const suffix = JSON.stringify(collected);

      // If no arguments were passed to this field, and it didn't have any other
      // field key contributions from directives or variables, hide the empty
      // :{} suffix from the field key. However, a field passed no arguments can
      // still end up with a non-empty :{...} suffix if its key configuration
      // refers to directives or variables.
      if (args || suffix !== "{}") {
        fieldName += ":" + suffix;
      }

      return fieldName;
    };
  }
}

export function collectSpecifierPaths(
  specifier: KeySpecifier,
  extractor: (path: string[]) => any,
) {
  // For each path specified by specifier, invoke the extractor, and repeatedly
  // merge the results together, with appropriate ancestor context.
  const merger = new DeepMerger;
  return getSpecifierPaths(specifier).reduce((collected, path) => {
    let result = extractor(path);
    if (result !== void 0) {
      for (let i = path.length - 1; i >= 0; --i) {
        result = { [path[i]]: result };
      }
      return merger.merge(collected, result);
    }
    return collected;
  }, Object.create(null));
}

export function getSpecifierPaths(spec: KeySpecifier & {
  paths?: string[][];
}): string[][] {
  if (!spec.paths) {
    const paths: string[][] = spec.paths = [];
    const currentPath: string[] = [];

    spec.forEach((s, i) => {
      if (Array.isArray(s)) {
        getSpecifierPaths(s).forEach(p => paths.push(currentPath.concat(p)));
        currentPath.length = 0;
      } else {
        currentPath.push(s);
        if (!Array.isArray(spec[i + 1])) {
          paths.push(currentPath.slice(0));
          currentPath.length = 0;
        }
      }
    });
  }

  return spec.paths!;
}

export function extractKeyPath(
  object: Record<string, any>,
  path: string[],
  aliasMap: AliasMap | null,
): any {
  const extracted = path.reduce((result, schemaKey) => {
    const resultKeyMap = aliasMap && aliasMap.aliases[schemaKey];
    if (resultKeyMap && Object.keys(resultKeyMap).some(resultKey => {
      if (result && hasOwn.call(result, resultKey)) {
        aliasMap = resultKeyMap[resultKey];
        result = result[resultKey];
        return true;
      }
    })) {
      return result;
    }
    // TODO This should be in the keyFields path extraction function, not here.
    if (aliasMap) {
      invariant(
        result && hasOwn.call(result, schemaKey),
        `Missing field '${schemaKey}' while extracting keyFields from ${
          JSON.stringify(result)
        }`,
      );
    }
    aliasMap = resultKeyMap && resultKeyMap[schemaKey];
    return result = result && result[schemaKey];
  }, object);

  if (isNonNullObject(extracted) && !Array.isArray(extracted)) {
    const keys = Object.keys(extracted);

    if (aliasMap && aliasMap.actuals) {
      // Since the keys array will contain result keys rather than store keys,
      // we need to translate back to store keys before calling handleSpecifier
      // with the store key array.
      for (let i = 0, { length } = keys; i < length; ++i) {
        keys[i] = aliasMap.actuals[keys[i]] || keys[i];
      }
    }

    return collectSpecifierPaths(
      keys.sort(),
      path => extractKeyPath(extracted, path, aliasMap),
    );
  }

  return extracted;
}
