import { GraphQLData } from '../../src/graphql/data';
import { GraphReference } from '../../src/graph/common';
import { GraphWritePrimitives, GraphNodeWritePrimitives } from '../../src/graph/write';
import { GraphReadPrimitives, GraphNodeReadPrimitives } from '../../src/graph/read';

export type GraphData = {
  [id: string]: GraphNodeData,
};

export type GraphNodeData = {
  scalars: { [scalarName: string]: GraphQLData },
  references: { [referenceName: string]: GraphReference },
};

export function createMockGraphPrimitives (data: GraphData = {}): GraphPrimitives {
  return new GraphPrimitives(data);
}

export class GraphPrimitives implements GraphWritePrimitives, GraphReadPrimitives {
  public readonly data: GraphData;

  constructor (data: GraphData) {
    this.data = data;
  }

  public getOrCreateNode (id: string): GraphNodePrimitives {
    return new GraphNodePrimitives(this.data[id] || (this.data[id] = {
      scalars: {},
      references: {},
    }));
  }

  public getNode (id: string): GraphNodePrimitives | undefined {
    const nodeData = this.data[id];
    return nodeData && new GraphNodePrimitives(nodeData);
  }
}

export class GraphNodePrimitives implements GraphNodeWritePrimitives, GraphNodeReadPrimitives {
  public readonly data: GraphNodeData;

  constructor (data: GraphNodeData) {
    this.data = data;
  }

  public setScalar (key: string, data: GraphQLData) {
    this.data.scalars[key] = data;
  }

  public setReference (key: string, reference: GraphReference) {
    this.data.references[key] = reference;
  }

  public getScalar (key: string): GraphQLData | undefined {
    return this.data.scalars[key];
  }

  public getReference (key: string): GraphReference | undefined {
    return this.data.references[key];
  }
}
