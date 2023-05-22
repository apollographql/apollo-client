import { canUseWeakMap, checkDocument } from '../utilities';
import type { DocumentNode } from 'graphql';

type TransformFn = (document: DocumentNode) => DocumentNode;

interface DocumentTransformOptions {
  cache?: boolean;
}

export class DocumentTransform {
  private readonly transform: TransformFn;
  private readonly cacheOutput: boolean;
  private readonly documentCache = canUseWeakMap
    ? new WeakMap<DocumentNode, DocumentNode>()
    : new Map<DocumentNode, DocumentNode>();

  constructor(
    transform: TransformFn,
    options: DocumentTransformOptions = Object.create(null)
  ) {
    this.transform = transform;
    this.cacheOutput = options.cache ?? true;
  }

  transformDocument(document: DocumentNode) {
    checkDocument(document);

    if (this.cacheOutput && this.documentCache.has(document)) {
      return this.documentCache.get(document)!;
    }

    const transformedDocument = this.transform(document);

    if (this.cacheOutput) {
      this.documentCache.set(document, transformedDocument);
    }

    return transformedDocument;
  }

  filter(predicate: (document: DocumentNode) => boolean) {
    return new DocumentTransform(
      (document) => {
        if (predicate(document)) {
          return this.transformDocument(document);
        }

        return document;
      },
      { cache: this.cacheOutput }
    );
  }

  concat(otherTransform: DocumentTransform) {
    return new DocumentTransform(
      (document) => {
        return otherTransform.transformDocument(
          this.transformDocument(document)
        );
      },
      { cache: this.cacheOutput && otherTransform.cacheOutput }
    );
  }

  invalidateDocument(document: DocumentNode) {
    this.documentCache.delete(document);
  }
}
