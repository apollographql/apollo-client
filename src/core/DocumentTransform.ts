import { canUseWeakMap, checkDocument } from '../utilities';
import type { DocumentNode } from 'graphql';

type TransformFn = (document: DocumentNode) => DocumentNode;

interface DocumentTransformOptions {
  cache?: boolean;
}

export class DocumentTransform {
  private readonly transform: TransformFn;
  private readonly documentCache?:
    | WeakMap<DocumentNode, DocumentNode>
    | Map<DocumentNode, DocumentNode>;

  static identity() {
    return new DocumentTransform((document) => document);
  }

  static split(
    predicate: (document: DocumentNode) => boolean,
    left: DocumentTransform,
    right: DocumentTransform = DocumentTransform.identity()
  ) {
    return new DocumentTransform(
      (document) => {
        if (predicate(document)) {
          return left.transformDocument(document);
        }

        return right.transformDocument(document);
      },
      // Allow for runtime conditionals to determine which transform to use and
      // rely on each transform to determine its own caching behavior
      { cache: false }
    );
  }

  constructor(
    transform: TransformFn,
    options: DocumentTransformOptions = Object.create(null)
  ) {
    this.transform = transform;

    if (options.cache ?? true) {
      this.documentCache = canUseWeakMap
        ? new WeakMap<DocumentNode, DocumentNode>()
        : new Map<DocumentNode, DocumentNode>();
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
      // Allow each transform to determine its own cache behavior without
      // filling up another `Map` for this new transform.
      { cache: false }
    );
  }

  invalidateDocument(document: DocumentNode) {
    this.documentCache?.delete(document);
  }
}
