import { gql } from '../../../core';
import { InMemoryCache, createFragmentRegistry } from '../../index';
import { DocumentNode, print } from 'graphql';
import { removeDirectivesFromDocument } from '../../../utilities';

describe('documentTransforms', () => {
  it('defines a default document transform that adds __typename', () => {
    const cache = new InMemoryCache({ addTypename: true });
    const query = gql`
      query {
        greeting {
          hello
        }
      }
    `;

    const expected = gql`
      query {
        greeting {
          hello
          __typename
        }
      }
    `;

    const result = cache.transformDocument(query);

    expect(print(result)).toEqual(print(expected));
  });

  it('allows custom document transforms to be registered', () => {
    const transformDocument = (document: DocumentNode) => {
      const transformed = removeDirectivesFromDocument(
        [{ test: (directive) => directive.name.value === 'persistent' }],
        document
      );

      return transformed || document;
    };

    const cache = new InMemoryCache({
      documentTransforms: [transformDocument],
    });

    const query = gql`
      query {
        field @persistent
      }
    `;

    const expected = gql`
      query {
        field
      }
    `;

    const result = cache.transformDocument(query);

    expect(print(result)).toEqual(print(expected));
  });

  it('allows custom document transforms to be registered dynamically', () => {
    const transformDocument = (document: DocumentNode) => {
      const transformed = removeDirectivesFromDocument(
        [{ test: (directive) => directive.name.value === 'persistent' }],
        document
      );

      return transformed || document;
    };

    const cache = new InMemoryCache();
    cache.documentTransforms.add(transformDocument);

    const query = gql`
      query {
        field @persistent
      }
    `;

    const expected = gql`
      query {
        field
      }
    `;

    const result = cache.transformDocument(query);

    expect(print(result)).toEqual(print(expected));
  });
});

describe('documentTransformsForLink', () => {
  it('defines a default link document transform that adds fragments from the fragment registry', () => {
    const cache = new InMemoryCache({
      fragments: createFragmentRegistry(gql`
        fragment BasicFragment on Query {
          basic
        }
      `),
    });

    const query = gql`
      query {
        ...BasicFragment
      }
    `;

    const expected = gql`
      query {
        ...BasicFragment
      }

      fragment BasicFragment on Query {
        basic
      }
    `;

    const result = cache.transformForLink(query);

    expect(print(result)).toEqual(print(expected));
  });

  it('allows custom link document transforms to be defined', () => {
    const transformDocument = (document: DocumentNode) => {
      const transformed = removeDirectivesFromDocument(
        [{ test: (directive) => directive.name.value === 'persistent' }],
        document
      );

      return transformed || document;
    };

    const cache = new InMemoryCache({
      documentTransformsForLink: [transformDocument],
    });

    const query = gql`
      query {
        field @persistent
      }
    `;

    const expected = gql`
      query {
        field
      }
    `;

    const result = cache.transformForLink(query);

    expect(print(result)).toEqual(print(expected));
  });

  it('allows custom link document transforms to be registered dynamically', () => {
    const transformDocument = (document: DocumentNode) => {
      const transformed = removeDirectivesFromDocument(
        [{ test: (directive) => directive.name.value === 'persistent' }],
        document
      );

      return transformed || document;
    };

    const cache = new InMemoryCache();
    cache.documentTransformsForLink.add(transformDocument);

    const query = gql`
      query {
        field @persistent
      }
    `;

    const expected = gql`
      query {
        field
      }
    `;

    const result = cache.transformForLink(query);

    expect(print(result)).toEqual(print(expected));
  });
});
