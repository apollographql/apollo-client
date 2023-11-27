import { Trie } from "@wry/trie";
import { canUseWeakMap, canUseWeakSet } from "../common/canUse.js";
import { checkDocument } from "./getFromAST.js";
import { invariant } from "../globals/index.js";
import type { DocumentNode } from "graphql";
// import { WeakCache } from "@wry/caches";
import { wrap } from "optimism";

export type DocumentTransformCacheKey = ReadonlyArray<unknown>;

type TransformFn = (document: DocumentNode) => DocumentNode;

interface DocumentTransformOptions {
  cache?: boolean;
  getCacheKey?: (
    document: DocumentNode
  ) => DocumentTransformCacheKey | undefined;
}

function identity(document: DocumentNode) {
  return document;
}

export class DocumentTransform {
  private readonly transform: TransformFn;
  private cached: boolean;

  private readonly resultCache = canUseWeakSet
    ? new WeakSet<DocumentNode>()
    : new Set<DocumentNode>();

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

  static identity() {
    // No need to cache this transform since it just returns the document
    // unchanged. This should save a bit of memory that would otherwise be
    // needed to populate the `documentCache` of this transform.
    return new DocumentTransform(identity, { cache: false });
  }

  static split(
    predicate: (document: DocumentNode) => boolean,
    left: DocumentTransform,
    right: DocumentTransform = DocumentTransform.identity()
  ) {
    return new DocumentTransform(
      (document) => {
        const documentTransform = predicate(document) ? left : right;

        return documentTransform.transformDocument(document);
      },
      // Reasonably assume both `left` and `right` transforms handle their own caching
      { cache: false }
    );
  }

  constructor(
    transform: TransformFn,
    options: DocumentTransformOptions = Object.create(null)
  ) {
    this.transform = transform;

    if (options.getCacheKey) {
      // Override default `getCacheKey` function, which returns [document].
      this.getCacheKey = options.getCacheKey;
    }
    this.cached = options.cache !== false;

    this.resetCache();
  }

  /**
   * Resets the internal cache of this transform, if it has one.
   */
  resetCache() {
    if (this.cached) {
      const stableCacheKeys = new Trie(canUseWeakMap);
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
          // max: /** TODO: decide on a maximum size (will do all max sizes in a combined separate PR) */,
          // Cache: WeakCache // TODO: waiting for an optimism release that allows this
        }
      );
    }
  }

  private performWork(document: DocumentNode) {
    checkDocument(document);
    return this.transform(document);
  }

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

  concat(otherTransform: DocumentTransform) {
    return new DocumentTransform(
      (document) => {
        return otherTransform.transformDocument(
          this.transformDocument(document)
        );
      },
      // Reasonably assume both transforms handle their own caching
      { cache: false }
    );
  }
}
