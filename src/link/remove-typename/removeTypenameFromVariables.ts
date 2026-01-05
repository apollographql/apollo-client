import { WeakCache } from "@wry/caches";
import type { DocumentNode, TypeNode } from "graphql";
import { Kind, visit } from "graphql";
import { wrap } from "optimism";

import type { OperationVariables } from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import { cacheSizes, stripTypename } from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { bindCacheKey, isPlainObject } from "@apollo/client/utilities/internal";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";

/**
 * Sentinel value used to indicate that `__typename` fields should be kept
 * for a specific field or input type.
 *
 * @remarks
 * Use this value in the `except` configuration to preserve `__typename`
 * fields in JSON scalar fields or other cases where you need to retain
 * the typename information.
 *
 * @example
 *
 * ```ts
 * import {
 *   RemoveTypenameFromVariablesLink,
 *   KEEP,
 * } from "@apollo/client/link/remove-typename";
 *
 * const link = new RemoveTypenameFromVariablesLink({
 *   except: {
 *     JSON: KEEP, // Keep __typename for all JSON scalar variables
 *     DashboardInput: {
 *       config: KEEP, // Keep __typename only for the config field
 *     },
 *   },
 * });
 * ```
 */
export const KEEP = "__KEEP";

export declare namespace RemoveTypenameFromVariablesLink {
  /**
   * Configuration object that specifies which input types and fields should
   * retain their `__typename` fields.
   *
   * @remarks
   * This is a recursive configuration where:
   *
   * - Keys represent GraphQL input type names or field names
   * - Values can be either the `KEEP` sentinel to preserve all `__typename`
   *   fields, or a nested `KeepTypenameConfig` to preserve `__typename` fields on
   *   a specific field name.
   *
   * @example
   *
   * ```ts
   * const config: KeepTypenameConfig = {
   *   // Keep __typename for all JSON scalar variables
   *   JSON: KEEP,
   *
   *   // For DashboardInput, only keep __typename on the config field
   *   DashboardInput: {
   *     config: KEEP,
   *   },
   *
   *   // Nested configuration for complex input types
   *   UserInput: {
   *     profile: {
   *       settings: KEEP,
   *     },
   *   },
   * };
   * ```
   */
  export interface KeepTypenameConfig {
    [key: string]:
      | typeof KEEP
      | RemoveTypenameFromVariablesLink.KeepTypenameConfig;
  }

  /**
   * Options for configuring the `RemoveTypenameFromVariablesLink`.
   */
  export interface Options {
    /**
     * Configuration that determines which input types should retain `__typename`
     * fields.
     *
     * Maps GraphQL input type names to configurations. Each configuration can
     * either be the `KEEP` sentinel, to preserve all `__typename` fields, or
     * a nested object that specifies which fields should retain `__typename`.
     *
     * @example
     *
     * ```ts
     * {
     *   except: {
     *     // Keep __typename for all JSON scalar variables
     *     JSON: KEEP,
     *
     *     // For DashboardInput, remove __typename except for config field
     *     DashboardInput: {
     *       config: KEEP,
     *     },
     *
     *     // Complex nested configuration
     *     UserProfileInput: {
     *       settings: {
     *         preferences: KEEP,
     *       },
     *     },
     *   },
     * }
     * ```
     */
    except?: RemoveTypenameFromVariablesLink.KeepTypenameConfig;
  }
}

/**
 * @deprecated
 * Use `RemoveTypenameFromVariablesLink` from `@apollo/client/link/remove-typename` instead.
 */
export function removeTypenameFromVariables(
  options?: RemoveTypenameFromVariablesLink.Options
) {
  return new RemoveTypenameFromVariablesLink(options);
}

/**
 * `RemoveTypenameFromVariablesLink` is a non-terminating link that automatically
 * removes `__typename` fields from operation variables to prevent GraphQL
 * validation errors.
 *
 * @remarks
 *
 * When reusing data from a query as input to another GraphQL operation,
 * `__typename` fields can cause server-side validation errors because input
 * types don't accept fields that start with double underscores (`__`).
 * `RemoveTypenameFromVariablesLink` automatically strips these fields from all
 * operation variables.
 *
 * @example
 *
 * ```ts
 * import { RemoveTypenameFromVariablesLink } from "@apollo/client/link/remove-typename";
 *
 * const link = new RemoveTypenameFromVariablesLink();
 * ```
 */
export class RemoveTypenameFromVariablesLink extends ApolloLink {
  constructor(options: RemoveTypenameFromVariablesLink.Options = {}) {
    super((operation, forward) => {
      const { except } = options;
      const { query, variables } = operation;

      if (variables) {
        operation.variables =
          except ?
            this.maybeStripTypenameUsingConfig(query, variables, except)
          : stripTypename(variables);
      }

      return forward(operation);
    });
    return Object.assign(
      this,
      __DEV__ ?
        {
          getMemoryInternals(this: RemoveTypenameFromVariablesLink) {
            return {
              removeTypenameFromVariables: {
                getVariableDefinitions: this.getVariableDefinitions?.size ?? 0,
              },
            };
          },
        }
      : {}
    );
  }

  private maybeStripTypenameUsingConfig(
    query: DocumentNode,
    variables: OperationVariables,
    config: RemoveTypenameFromVariablesLink.KeepTypenameConfig
  ) {
    const variableDefinitions = this.getVariableDefinitions(query);

    return Object.fromEntries(
      Object.entries(variables).map((keyVal) => {
        const [key, value] = keyVal;
        const typename = variableDefinitions[key];
        const typenameConfig = config[typename];

        keyVal[1] =
          typenameConfig ?
            this.maybeStripTypename(value, typenameConfig)
          : stripTypename(value);

        return keyVal;
      })
    );
  }

  private maybeStripTypename(
    value: JSONValue,
    config: RemoveTypenameFromVariablesLink.KeepTypenameConfig[string]
  ): JSONValue {
    if (config === KEEP) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.maybeStripTypename(item, config));
    }

    if (isPlainObject(value)) {
      const modified: Record<string, any> = {};

      Object.keys(value).forEach((key) => {
        const child = value[key];

        if (key === "__typename") {
          return;
        }

        const fieldConfig = config[key];

        modified[key] =
          fieldConfig ?
            this.maybeStripTypename(child, fieldConfig)
          : stripTypename(child);
      });

      return modified;
    }

    return value;
  }

  private getVariableDefinitions = wrap(
    (document: DocumentNode) => {
      const definitions: Record<string, string> = {};

      visit(document, {
        VariableDefinition(node) {
          definitions[node.variable.name.value] = unwrapType(node.type);
        },
      });

      return definitions;
    },
    {
      max:
        cacheSizes["removeTypenameFromVariables.getVariableDefinitions"] ||
        defaultCacheSizes["removeTypenameFromVariables.getVariableDefinitions"],
      cache: WeakCache,
      makeCacheKey: bindCacheKey(this),
    }
  );
}

type JSONPrimitive = string | number | null | boolean;
type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };

function unwrapType(node: TypeNode): string {
  switch (node.kind) {
    case Kind.NON_NULL_TYPE:
      return unwrapType(node.type);
    case Kind.LIST_TYPE:
      return unwrapType(node.type);
    case Kind.NAMED_TYPE:
      return node.name.value;
  }
}
