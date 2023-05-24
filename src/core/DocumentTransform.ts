import { Trie } from '@wry/trie';
import { canUseWeakMap, canUseWeakSet, checkDocument } from '../utilities';
import { invariant } from '../utilities/globals';
import type { DocumentNode } from 'graphql';

export type DocumentTransformCacheKey = ReadonlyArray<unknown>;

type TransformFn = (document: DocumentNode) => DocumentNode;

interface DocumentTransformOptions {
  cache?: boolean;
  getCacheKey?: (document: DocumentNode) => DocumentTransformCacheKey;
}

function identity(document: DocumentNode) {
  return document;
}

export class DocumentTransform {
  private readonly transform: TransformFn;
  private readonly documentCache?:
    | WeakMap<DocumentTransformCacheKey, DocumentNode>
    | Map<DocumentTransformCacheKey, DocumentNode>;

  private readonly resultCache = canUseWeakSet
    ? new WeakSet<DocumentNode>()
    : new Set<DocumentNode>();

  private readonly stableCacheKeys = new Trie<DocumentTransformCacheKey>(
    canUseWeakMap,
    (cacheKey) => cacheKey
  );

  private getCacheKey?: (document: DocumentNode) => DocumentTransformCacheKey;

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
    const transform = new DocumentTransform(
      (document) => {
        const documentTransform = predicate(document) ? left : right;

        return documentTransform.transformDocument(document);
      },
      // Reasonably assume both `left` and `right` transforms are cached
      { cache: false }
    );

    return transform;
  }

  constructor(
    transform: TransformFn,
    options: DocumentTransformOptions = Object.create(null)
  ) {
    this.transform = transform;
    this.getCacheKey = options.getCacheKey;

    if (options.cache ?? true) {
      this.documentCache = canUseWeakMap ? new WeakMap() : new Map();
    }
  }

  transformDocument(document: DocumentNode) {
    // If a user passes an already transformed result back to this function,
    // immediately return it.
    if (this.resultCache.has(document)) {
      return document;
    }

    const cacheKey = this.getStableCacheKey(document);

    if (this.documentCache?.has(cacheKey)) {
      return this.documentCache.get(cacheKey)!;
    }

    checkDocument(document);

    const transformedDocument = this.transform(document);

    this.resultCache.add(transformedDocument);

    if (this.documentCache) {
      this.documentCache.set(cacheKey, transformedDocument);
    }

    return transformedDocument;
  }

  concat(otherTransform: DocumentTransform) {
    return new DocumentTransform(
      (document) => {
        return otherTransform.transformDocument(
          this.transformDocument(document)
        );
      },
      // Reasonably assume both transforms are cached
      { cache: false }
    );
  }

  getStableCacheKey(document: DocumentNode) {
    const cacheKey = this.getCacheKey?.(document) ?? [document];

    invariant(Array.isArray(cacheKey), '`getCacheKey` must return an array');

    return this.stableCacheKeys.lookupArray(cacheKey);
  }
}
