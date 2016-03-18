import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLInputObjectType,
} from 'graphql';

import {
  mapValues,
  mapKeys,
} from 'lodash';

import {
  schema
} from './swapi.js';

import rp from 'request-promise';

import DataLoader from 'dataloader';

// Generate a GraphQL object type for every entry in the schema
const graphQLObjectTypes = mapValues(schema, (jsonSchema) => {
  return new GraphQLObjectType({
    name: jsonSchema.title,
    description: jsonSchema.description,
    fields: () => {
      return mapValues(jsonSchema.properties, (propertySchema, propertyName) => {
        const value = {
          description: propertySchema.description,
          type: jsonSchemaTypeToGraphQL(propertySchema.type, propertyName)
        };

        // All of the arrays in the schema happen to be references to other types
        if(propertySchema.type === 'array') {
          value.resolve = (root, args) => {
            const arrayOfUrls = root[propertyName];
            const arrayOfResults = arrayOfUrls.map(restLoader.load.bind(restLoader));
            return arrayOfResults;
          }
        }

        return value;
      });
    }
  })
});

// Convert the JSON Schema types to the actual GraphQL types in our schema
function jsonSchemaTypeToGraphQL(jsonSchemaType, schemaName) {
  if (jsonSchemaType === "array") {
    if (graphQLObjectTypes[schemaName]) {
      return new GraphQLList(graphQLObjectTypes[schemaName]);
    } else {
      const translated = {
        pilots: "people",
        characters: "people",
        residents: "people"
      }[schemaName];

      if (! translated) {
        throw new Error(`no type ${schemaName}`);
      }

      const type = graphQLObjectTypes[translated];

      if (! type) {
        throw new Error(`no GraphQL type ${schemaName}`);
      }

      return new GraphQLList(type);
    }
  }

  return {
    string: GraphQLString,
    date: GraphQLString,
    integer: GraphQLInt,
  }[jsonSchemaType];
}

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => {
    // For each type, make a query to get a page of that type
    const plural = mapValues(graphQLObjectTypes, (type, typePluralName) => {
      return {
        type: new GraphQLList(type),
        description: `All ${typePluralName}.`,
        args: {
          page: { type: GraphQLInt }
        },
        resolve: (_, { page }) => {
          // Simple pagination, where you just pass the page number through to the REST API
          return fetchPageOfType(typePluralName, page);
        },
      };
    });


    // For each type, also make a query to get just one object of that type
    const singular = mapValues(mapKeys(graphQLObjectTypes, (value, key) => {
      // Name the query people_one vehicles_one etc. not sure what the standard should be
      // here. We could also adopt the Relay node spec
      return key + "_one";
    }), (type, typeQueryName) => {
      const restName = typeQueryName.split('_')[0];

      return {
        type: type,
        description: `One ${restName}.`,
        args: {
          id: { type: GraphQLString }
        },
        resolve: (_, { id }) => {
          return fetchOne(restName, id);
        },
      }
    });

    return {
      ...plural,
      ...singular
    };
  },
});

// A helper to unwrap the paginated object from SWAPI
function fetchPageOfType(typePluralName, pageNumber) {
  let url = `http://swapi.co/api/${typePluralName}/`;
  if (pageNumber) {
    url += `?page=${pageNumber}`;
  };

  return restLoader.load(url).then((data) => {
    // Paginated results have a different shape
    return data.results;
  });
}

// Constructs a URL from the endpoint name and object ID
function fetchOne(restName, id) {
  return restLoader.load(`http://swapi.co/api/${restName}/${id}`);
}

// Use dataloader to batch URL requests for each layer of the query
const restLoader = new DataLoader((urls) => {
  return Promise.all(urls.map((url) => {
    return rp({
      uri: url,
      json: true
    });
  }));
});

// This schema has no mutations because you can't really write to the Star Wars API.
export const Schema = new GraphQLSchema({
  query: queryType,
});
