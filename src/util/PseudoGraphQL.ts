/* tslint:disable:variable-name */

export class GraphQLScalarType {
  private typeName: string;

  constructor(type: string) {
    this.typeName = type;
  }

  public toString(): string {
    return this.typeName;
  }
};

export class GraphQLNonNull {
  public ofType: GraphQLScalarType;

  constructor(type: GraphQLScalarType) {
    this.ofType = type;
  }

  public toString(): string {
    return this.ofType.toString() + '!';
  }
}

export const GraphQLString = new GraphQLScalarType('String');
export const GraphQLBoolean = new GraphQLScalarType('Boolean');

export interface GraphQLArgument {
  name: string;
  type: GraphQLScalarType|GraphQLNonNull;
  description?: string;
}

export interface GraphQLDirective {
  name: string;
  description?: string;
  locations: string[];
  args: GraphQLArgument[];
}
