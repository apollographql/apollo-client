export interface InputObjectsPluginConfig {
  /**
   * List of scalars that should be ignored when creating the config object.
   * This can reduce the size of the config object by omitting input objects
   * and fields with scalars that won't have an associated scalar transform.
   *
   * When combined with `includeScalars`, this option takes precedent.
   */
  ignoreScalars?: string[];

  /**
   * Allowed list of scalars that should be included in the config object.
   * This can reduce the size of the config object by omitting input objects and
   * fields with scalars that won't have an associated scalar transform.
   *
   * When combined with `ignoreScalars`, `ignoreScalars` takes precedent.
   */
  includeScalars?: string[];

  /**
   * Determines whether to filter the config object by only input objects used
   * by GraphQL operations.
   *
   * @default true
   */
  filterByDocuments?: boolean;
}
