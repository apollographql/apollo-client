import type {
  GraphQLFieldResolver,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLSchema,
} from "graphql";

import {
  GraphQLInterfaceType,
  GraphQLString,
  GraphQLUnionType,
  defaultFieldResolver,
  getNullableType,
  isAbstractType,
  isEnumType,
  isInterfaceType,
  isListType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";

import { isNonNullObject } from "../../../utilities/index.js";
import { MapperKind, mapSchema, getRootTypeNames } from "@graphql-tools/utils";

// Taken from @graphql-tools/mock:
// https://github.com/ardatan/graphql-tools/blob/4b56b04d69b02919f6c5fa4f97d33da63f36e8c8/packages/mock/src/utils.ts#L20
const takeRandom = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/**
 * A function that accepts a static `schema` and a `mocks` object for specifying
 * default scalar mocks and returns a `GraphQLSchema`.
 *
 * @param staticSchema - A static `GraphQLSchema`.
 * @param mocks - An object containing scalar mocks.
 * @returns A `GraphQLSchema` with scalar mocks.
 *
 * @example
 * ```js
 * const mockedSchema = createMockSchema(schema, {
     ID: () => "1",
     Int: () => 42,
     String: () => "String",
     Date: () => new Date("January 1, 2024 01:00:00").toJSON().split("T")[0],
  });
 * ```
 * @since 3.10.0
 * @alpha
 */
const createMockSchema = (
  staticSchema: GraphQLSchema,
  mocks: { [key: string]: any }
) => {
  // Taken from @graphql-tools/mock:
  // https://github.com/ardatan/graphql-tools/blob/5ed60e44f94868f976cd28fe1b6a764fb146bbe9/packages/mock/src/MockStore.ts#L613
  const getType = (typeName: string) => {
    const type = staticSchema.getType(typeName);

    if (!type || !(isObjectType(type) || isInterfaceType(type))) {
      throw new Error(
        `${typeName} does not exist on schema or is not an object or interface`
      );
    }

    return type;
  };

  // Taken from @graphql-tools/mock:
  // https://github.com/ardatan/graphql-tools/blob/5ed60e44f94868f976cd28fe1b6a764fb146bbe9/packages/mock/src/MockStore.ts#L597
  const getFieldType = (typeName: string, fieldName: string) => {
    if (fieldName === "__typename") {
      return GraphQLString;
    }

    const type = getType(typeName);

    const field = type.getFields()[fieldName];

    if (!field) {
      throw new Error(`${fieldName} does not exist on type ${typeName}`);
    }

    return field.type;
  };

  // Taken from @graphql-tools/mock:
  // https://github.com/ardatan/graphql-tools/blob/5ed60e44f94868f976cd28fe1b6a764fb146bbe9/packages/mock/src/MockStore.ts#L527
  const generateValueFromType = (fieldType: GraphQLOutputType): unknown => {
    const nullableType = getNullableType(fieldType);

    if (isScalarType(nullableType)) {
      const mockFn = mocks[nullableType.name];

      if (typeof mockFn !== "function") {
        throw new Error(`No mock defined for type "${nullableType.name}"`);
      }

      return mockFn();
    } else if (isEnumType(nullableType)) {
      const mockFn = mocks[nullableType.name];

      if (typeof mockFn === "function") return mockFn();

      const values = nullableType.getValues().map((v) => v.value);

      return takeRandom(values);
    } else if (isObjectType(nullableType)) {
      return {};
    } else if (isListType(nullableType)) {
      return [...new Array(2)].map(() =>
        generateValueFromType(nullableType.ofType)
      );
    } else if (isAbstractType(nullableType)) {
      const mock = mocks[nullableType.name];

      let typeName: string;

      let values: { [key: string]: unknown } = {};

      if (!mock) {
        typeName = takeRandom(
          staticSchema.getPossibleTypes(nullableType).map((t) => t.name)
        );
      } else if (typeof mock === "function") {
        const mockRes = mock();

        if (mockRes === null) return null;

        if (!isNonNullObject(mockRes)) {
          throw new Error(
            `Value returned by the mock for ${nullableType.name} is not an object or null`
          );
        }

        values = mockRes;

        if (typeof values["__typename"] !== "string") {
          throw new Error(
            `Please return a __typename in "${nullableType.name}"`
          );
        }

        typeName = values["__typename"];
      } else if (
        isNonNullObject(mock) &&
        typeof mock["__typename"] === "function"
      ) {
        const mockRes = mock["__typename"]();

        if (typeof mockRes !== "string") {
          throw new Error(
            `'__typename' returned by the mock for abstract type ${nullableType.name} is not a string`
          );
        }

        typeName = mockRes;
      } else {
        throw new Error(`Please return a __typename in "${nullableType.name}"`);
      }

      return typeName;
    } else {
      throw new Error(`${nullableType} not implemented`);
    }
  };

  // Taken from @graphql-tools/mock:
  // https://github.com/ardatan/graphql-tools/blob/5ed60e44f94868f976cd28fe1b6a764fb146bbe9/packages/mock/src/utils.ts#L53
  const isRootType = (type: GraphQLObjectType, schema: GraphQLSchema) => {
    const rootTypeNames = getRootTypeNames(schema);

    return rootTypeNames.has(type.name);
  };

  // Taken from @graphql-tools/mock:
  // https://github.com/ardatan/graphql-tools/blob/5ed60e44f94868f976cd28fe1b6a764fb146bbe9/packages/mock/src/addMocksToSchema.ts#L123
  const mockResolver: GraphQLFieldResolver<any, any> = (
    source,
    args,
    contex,
    info
  ) => {
    const defaultResolvedValue = defaultFieldResolver(
      source,
      args,
      contex,
      info
    );

    // priority to default resolved value
    if (defaultResolvedValue !== undefined) return defaultResolvedValue;

    // we have to handle the root mutation, root query and root subscription types
    // differently, because no resolver is called at the root
    if (isRootType(info.parentType, info.schema)) {
      return {
        typeName: info.parentType.name,
        key: "ROOT",
        fieldName: info.fieldName,
        fieldArgs: args,
      };
    }

    if (defaultResolvedValue === undefined) {
      const fieldType = getFieldType(info.parentType.name, info.fieldName);

      return generateValueFromType(fieldType);
    }

    return undefined;
  };

  // Taken from @graphql-tools/mock:
  // https://github.com/ardatan/graphql-tools/blob/5ed60e44f94868f976cd28fe1b6a764fb146bbe9/packages/mock/src/addMocksToSchema.ts#L176
  return mapSchema(staticSchema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const newFieldConfig = { ...fieldConfig };

      const oldResolver = fieldConfig.resolve;

      if (!oldResolver) {
        newFieldConfig.resolve = mockResolver;
      }
      return newFieldConfig;
    },

    [MapperKind.ABSTRACT_TYPE]: (type) => {
      if (type.resolveType != null && type.resolveType.length) {
        return;
      }

      const typeResolver = (typename: string) => {
        return typename;
      };

      if (isUnionType(type)) {
        return new GraphQLUnionType({
          ...type.toConfig(),
          resolveType: typeResolver,
        });
      } else {
        return new GraphQLInterfaceType({
          ...type.toConfig(),
          resolveType: typeResolver,
        });
      }
    },
  });
};

export { createMockSchema };
