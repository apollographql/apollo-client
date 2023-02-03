import { DocumentNode } from '../../core';
import { DocumentTransform } from './types';

interface DocumentTransformerConfig {
  transforms?: DocumentTransform[];
}

export class DocumentTransformer {
  private transforms: DocumentTransform[] = [];

  constructor(config?: DocumentTransformerConfig) {
    if (config?.transforms) {
      this.add(...config.transforms);
    }
  }

  public add(...transforms: DocumentTransform[]) {
    this.transforms.push(...transforms);

    return this;
  }

  public transform(document: Readonly<DocumentNode>): DocumentNode {
    return this.transforms.reduce((document, transform) => {
      return transform(document);
    }, document);
  }
}
