import type { DocumentNode } from '../../core';

interface ApolloCustomMatchers<R = void> {
  /**
   * Used to determine if two GraphQL query documents are equal to each other by
   * comparing their printed values. The document must be parsed by `gql`.
   */
  toMatchDocument(document: DocumentNode): R;
}

declare global {
  namespace jest {
    interface Matchers<R = void> extends ApolloCustomMatchers<R> {}
  }
}
