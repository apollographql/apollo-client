export interface CustomScalarsPluginConfig {
  /**
   * List of scalars that should be ignored when generating the config objects.
   * This can reduce the size of the config objects by omitting fields with
   * scalars that won't have an associated scalar transform.
   *
   * @remarks
   * This option is mutually exclusive with `includeScalars` and throws when
   * both options are set.
   */
  ignoreScalars?: string[];

  /**
   * Allowed list of scalars that should be included in the config objects.
   * This can reduce the size of the config objects by omitting fields with
   * scalars that won't have an associated scalar transform.
   *
   * @remarks
   * This option is mutually exclusive with `ignoreScalars` and throws when
   * both options are set.
   */
  includeScalars?: string[];

  /**
   * Determines whether to filter the config objects by scalars only used in
   * GraphQL operations.
   *
   * @defaultValue true
   */
  filterByDocuments?: boolean;
}
