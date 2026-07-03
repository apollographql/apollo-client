export interface ScalarTypePoliciesPluginConfig {
  /**
   * List of scalars that should be ignored when creating the type policies
   * object. This can reduce the size of the object by omitting fields with
   * scalars that won't have an associated scalar transform.
   *
   * When combined with `includeScalars`, this option takes precedence.
   */
  ignoreScalars?: string[];

  /**
   * Allowed list of scalars that should be included in the type policies
   * object. This can reduce the size of the object by omitting fields with
   * scalars that won't have an associated scalar transform.
   *
   * When combined with `ignoreScalars`, `ignoreScalars` takes precedence.
   */
  includeScalars?: string[];

  /**
   * Determines whether to filter the type policies object to include only
   * fields used by GraphQL operations.
   *
   * @defaultValue true
   */
  filterByDocuments?: boolean;
}
