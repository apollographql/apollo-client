export interface InputObjectsPluginConfig {
  /**
   * List of scalars that should be ignored when creating the config object.
   * This can reduce the size of the config object by omitting input objects
   * and fields with scalars that won't have an associated scalar transform.
   */
  ignoreScalars?: string[];

  /**
   * Determines whether to filter the config object by only input objects used
   * by GraphQL operations.
   *
   * @default true
   */
  filterByDocuments?: boolean;
}
