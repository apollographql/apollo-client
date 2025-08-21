import { WeakCache } from "@wry/caches";
import { Trie } from "@wry/trie";
import type { DocumentNode } from "graphql";
import { wrap } from "optimism";

import { checkDocument } from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { cacheSizes } from "../caching/sizes.js";

export type DocumentTransformCacheKey = ReadonlyArray<unknown>;

type TransformFn = (document: DocumentNode) => DocumentNode;

interface DocumentTransformOptions {
  /**
   * Determines whether to cache the transformed GraphQL document. Caching can
   * speed up repeated calls to the document transform for the same input
   * document. Set to `false` to completely disable caching for the document
   * transform. When disabled, this option takes precedence over the [`getCacheKey`](#getcachekey)
   * option.
   *
   * @defaultValue `true`
   */
  cache?: boolean;
  /**
   * Defines a custom cache key for a GraphQL document that will determine whether to re-run the document transform when given the same input GraphQL document. Returns an array that defines the cache key. Return `undefined` to disable caching for that GraphQL document.
   *
   * > [!NOTE]
   * > The items in the array can be any type, but each item needs to be
   * > referentially stable to guarantee a stable cache key.
   *
   * @defaultValue `(document) => [document]`
   */
  getCacheKey?: (
    document: DocumentNode
  ) => DocumentTransformCacheKey | undefined;
}

function identity(document: DocumentNode) {
  return document;
}

/**
 * A class for transforming GraphQL documents. See the [Document transforms
 * documentation](https://www.apollographql.com/docs/react/data/document-transforms) for more details on using them.
 *
 * @example
 *
 * ```ts
 * import { DocumentTransform } from "@apollo/client/utilities";
 * import { visit } from "graphql";
 *
 * const documentTransform = new DocumentTransform((doc) => {
 *   return visit(doc, {
 *     // ...
 *   });
 * });
 *
 * const transformedDoc = documentTransform.transformDocument(myDocument);
 * ```
 */
export class DocumentTransform {
  private readonly transform: TransformFn;
  private cached: boolean;

  private readonly resultCache = new WeakSet<DocumentNode>();

  // This default implementation of getCacheKey can be overridden by providing
  // options.getCacheKey to the DocumentTransform constructor. In general, a
  // getCacheKey function may either return an array of keys (often including
  // the document) to be used as a cache key, or undefined to indicate the
  // transform for this document should not be cached.
  private getCacheKey(
    document: DocumentNode
  ): DocumentTransformCacheKey | undefined {
    return [document];
  }

  /**
   * Creates a DocumentTransform that returns the input document unchanged.
   *
   * @returns The input document
   */
  static identity() {
    // No need to cache this transform since it just returns the document
    // unchanged. This should save a bit of memory that would otherwise be
    // needed to populate the `documentCache` of this transform.
    return new DocumentTransform(identity, { cache: false });
  }

  /**
   * Creates a DocumentTransform that conditionally applies one of two transforms.
   *
   * @param predicate - Function that determines which transform to apply
   * @param left - Transform to apply when `predicate` returns `true`
   * @param right - Transform to apply when `predicate` returns `false`. If not provided, it defaults to `DocumentTransform.identity()`.
   * @returns A DocumentTransform that conditionally applies a document transform based on the predicate
   *
   * @example
   *
   * ```ts
   * import { isQueryOperation } from "@apollo/client/utilities";
   *
   * const conditionalTransform = DocumentTransform.split(
   *   (document) => isQueryOperation(document),
   *   queryTransform,
   *   mutationTransform
   * );
   * ```
   */
  static split(
    predicate: (document: DocumentNode) => boolean,
    left: DocumentTransform,
    right: DocumentTransform = DocumentTransform.identity()
  ) {
    return Object.assign(
      new DocumentTransform(
        (document) => {
          const documentTransform = predicate(document) ? left : right;

          return documentTransform.transformDocument(document);
        },
        // Reasonably assume both `left` and `right` transforms handle their own caching
        { cache: false }
      ),
      { left, right }
    );
  }

  constructor(transform: TransformFn, options: DocumentTransformOptions = {}) {
    this.transform = transform;

    if (options.getCacheKey) {
      // Override default `getCacheKey` function, which returns [document].
      this.getCacheKey = options.getCacheKey;
    }
    this.cached = options.cache !== false;

    this.resetCache();
  }

  /**
   * Resets the internal cache of this transform, if it is cached.
   */
  resetCache() {
    if (this.cached) {
      const stableCacheKeys = new Trie<WeakKey>();
      this.performWork = wrap(
        DocumentTransform.prototype.performWork.bind(this),
        {
          makeCacheKey: (document) => {
            const cacheKeys = this.getCacheKey(document);
            if (cacheKeys) {
              invariant(
                Array.isArray(cacheKeys),
                "`getCacheKey` must return an array or undefined"
              );
              return stableCacheKeys.lookupArray(cacheKeys);
            }
          },
          max: cacheSizes["documentTransform.cache"],
          cache: WeakCache<any, any>,
        }
      );
    }
  }

  private performWork(document: DocumentNode) {
    checkDocument(document);
    return this.transform(document);
  }

  /**
   * Transforms a GraphQL document using the configured transform function.
   *
   * @remarks
   *
   * Note that `transformDocument` caches the transformed document. Calling
   * `transformDocument` again with the already-transformed document will
   * immediately return it.
   *
   * @param document - The GraphQL document to transform
   * @returns The transformed document
   *
   * @example
   *
   * ```ts
   * const document = gql`
   *   # ...
   * `;
   *
   * const documentTransform = new DocumentTransform(transformFn);
   * const transformedDocument = documentTransform.transformDocument(document);
   * ```
   */
  transformDocument(document: DocumentNode) {
    // If a user passes an already transformed result back to this function,
    // immediately return it.
    if (this.resultCache.has(document)) {
      return document;
    }

    const transformedDocument = this.performWork(document);

    this.resultCache.add(transformedDocument);

    return transformedDocument;
  }

  /**
   * Combines this document transform with another document transform. The
   * returned document transform first applies the current document transform,
   * then applies the other document transform.
   *
   * @param otherTransform - The transform to apply after this one
   * @returns A new DocumentTransform that applies both transforms in sequence
   *
   * @example
   *
   * ```ts
   * const combinedTransform = addTypenameTransform.concat(
   *   removeDirectivesTransform
   * );
   * ```
   */
  concat(otherTransform: DocumentTransform): DocumentTransform {
    return Object.assign(
      new DocumentTransform(
        (document) => {
          return otherTransform.transformDocument(
            this.transformDocument(document)
          );
        },
        // Reasonably assume both transforms handle their own caching
        { cache: false }
      ),
      {
        left: this,
        right: otherTransform,
      }
    );
  }

  /**
   * @internal
   * Used to iterate through all transforms that are concatenations or `split` links.
   */
  readonly left?: DocumentTransform;
  /**
   * @internal
   * Used to iterate through all transforms that are concatenations or `split` links.
   */
  readonly right?: DocumentTransform;
}
