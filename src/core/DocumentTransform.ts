import { canUseWeakMap, checkDocument } from '../utilities';
import type { DocumentNode } from 'graphql';

type TransformFn = (document: DocumentNode) => DocumentNode;
type InvalidateFn = (
  document: DocumentNode,
  next: (document: DocumentNode) => void
) => DocumentNode | void;

interface DocumentTransformOptions {
  cache?: boolean;
  invalidate?: InvalidateFn;
}

const noop = () => {};

export class DocumentTransform {
  private readonly transform: TransformFn;
  private readonly documentCache?:
    | WeakMap<DocumentNode, DocumentNode>
    | Map<DocumentNode, DocumentNode>;

  private readonly invalidate: InvalidateFn;

  static identity() {
    // No need to cache this transform since it just returns the document
    // unchanged. This should save a bit of memory that would otherwise be
    // needed to populate the `documentCache` of this transform.
    return new DocumentTransform((document) => document, { cache: false });
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
      {
        // Allow for runtime conditionals to determine which transform to use
        // and rely on each transform to determine its own caching behavior.
        cache: false,
        invalidate: (document, next) => {
          left.invalidate(document, next);
          right.invalidate(document, next);
        },
      }
    );

    return transform;
  }

  constructor(
    transform: TransformFn,
    options: DocumentTransformOptions = Object.create(null)
  ) {
    this.transform = transform;
    this.invalidate = options.invalidate || noop;

    if (options.cache ?? true) {
      this.documentCache = canUseWeakMap
        ? new WeakMap<DocumentNode, DocumentNode>()
        : new Map<DocumentNode, DocumentNode>();

      // Always use our own cache invalidation function when using the cache
      this.invalidate = this.removeFromCache;
    }
  }

  transformDocument(document: DocumentNode) {
    if (this.documentCache?.has(document)) {
      return this.documentCache.get(document)!;
    }

    checkDocument(document);

    const transformedDocument = this.transform(document);

    if (this.documentCache) {
      this.documentCache.set(document, transformedDocument);
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
      {
        // Allow each transform to determine its own cache behavior without
        // filling up another `Map` for this new transform.
        cache: false,
        invalidate: (document, next) => {
          return this.invalidate(document, (transformedDocument) => {
            otherTransform.invalidate(transformedDocument, next);
          });
        },
      }
    );
  }

  invalidateDocument(document: DocumentNode) {
    // This is the terminating invalidator so we pass a `noop`.
    return this.invalidate(document, noop);
  }

  private removeFromCache(
    document: DocumentNode,
    next: (document: DocumentNode) => void
  ) {
    const transformedDocument = this.documentCache?.get(document);
    this.documentCache?.delete(document);

    if (transformedDocument) {
      next(transformedDocument);
    }

    return transformedDocument;
  }
}
