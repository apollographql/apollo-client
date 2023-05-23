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

  private readonly linkedTransforms = new Set<DocumentTransform>();

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
      // Allow for runtime conditionals to determine which transform to use and
      // rely on each transform to determine its own caching behavior.
      { cache: false }
    );

    transform.link(left);
    transform.link(right);

    return transform;
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
    this.link(otherTransform);

    const transform = new DocumentTransform(
      (document) => {
        return otherTransform.transformDocument(
          this.transformDocument(document)
        );
      },
      // Allow each transform to determine its own cache behavior without
      // filling up another `Map` for this new transform.
      { cache: false }
    );

    transform.link(this);

    return transform;
  }

  invalidateDocument(document: DocumentNode) {
    const transformedDocument = this.documentCache?.get(document) ?? document;

    this.documentCache?.delete(document);
    this.linkedTransforms.forEach((transform) => {
      transform.invalidateDocument(transformedDocument);
    });
  }

  private link(transform: DocumentTransform) {
    this.linkedTransforms.add(transform);
  }
}
