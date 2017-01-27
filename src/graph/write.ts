import { SelectionSetNode, FragmentDefinitionNode } from 'graphql';
import { assign } from '../util/assign';
import { GraphQLData, GraphQLObjectData, GraphQLArrayData } from '../graphql/types';
import { GraphData, GraphDataNode, GraphReference, GetDataIDFn } from './types';
import { ID_KEY, getFieldKey } from './common';

/**
 * Writes GraphQL tree data to a true graph format. Returns a new data object
 * which represents what was written to the store.
 *
 * Starts writing the tree to the provided id. If no id was provided then no
 * data will be written until we can find an id using `getDataID`.
 *
 * Nodes in the data graph cannot be correctly identified without a `getDataID`
 * function. By default a new node will be created for every object, but the id
 * will be the path to that data in the tree. `getDataID` should properly
 * identify nodes wherever they are in the tree.
 */
export function writeToGraph ({
  graph,
  id,
  data,
  selectionSet,
  fragments = {},
  variables = {},
  getDataID = () => null,
}: {
  graph: GraphData,
  id: string | null,
  data: GraphQLObjectData,
  selectionSet: SelectionSetNode,
  fragments?: { [fragmentName: string]: FragmentDefinitionNode },
  variables?: { [variableName: string]: GraphQLData },
  getDataID?: GetDataIDFn,
}): {
  data: GraphQLObjectData,
} {
  let node: GraphDataNode | undefined;
  const nextData: GraphQLObjectData = {};

  // Define the store id property on our data object. This property is
  // non-enumerable so that users can not see it without trying real hard.
  if (typeof id === 'string') {
    Object.defineProperty(nextData, ID_KEY, { value: id });
  }

  // If the id is not null then we need to get the node for our `id`. If a node
  // with the given id already exists in the graph then we use that. Otherwise
  // we create a new node and add it to the graph.
  if (id !== null) {
    if (graph[id]) {
      node = graph[id];
    } else {
      node = graph[id] = {
        scalars: {},
        references: {},
      };
    }
  }

  selectionSet.selections.forEach(selection => {
    // For fields we want to directly write the data into our store.
    if (selection.kind === 'Field') {
      const field = selection;
      const fieldSelectionSet = field.selectionSet;
      const fieldName = field.alias ? field.alias.value : field.name.value;
      const fieldKey = getFieldKey(field, variables);
      const fieldData = data[fieldName];

      // If we have no data for this field then throw an error. This error
      // may be caught if we are currently writing data for a fragment.
      if (typeof fieldData === 'undefined') {
        const error = new Error(`No data found for field '${fieldName}'.`);
        (error as any)._partialWrite = true;
        throw error;
      }
      // If there is no selection set for this field then it is a scalar!
      else if (!fieldSelectionSet) {
        nextData[fieldName] = fieldData;
        if (node) {
          node.scalars[fieldKey] = fieldData;
        }
      }
      // If the data is null and this is not a scalar then we need to set our
      // reference to null.
      else if (fieldData === null) {
        nextData[fieldName] = null;
        if (node) {
          node.references[fieldKey] = null;
        }
      }
      // If by this point the field data is not an object (like we expect)
      // then throw an error.
      else if (typeof fieldData !== 'object') {
        throw new Error(`Expected composite data for field '${fieldName}' to be null or an object. Not '${typeof fieldData}'`);
      }
      // If the field data is an array then we need to defer to our
      // `writeArrayToStore` function.
      else if (Array.isArray(fieldData)) {
        const {
          reference: fieldReference,
          data: nextFieldData,
        } = writeArrayToStore({
          graph,
          id: id && `${id}.${fieldKey}`,
          data: fieldData,
          selectionSet: fieldSelectionSet,
          fragments,
          variables,
          getDataID,
        });
        nextData[fieldName] = nextFieldData;
        if (node) {
          node.references[fieldKey] = fieldReference;
        }
      }
      // Otherwise do the write thing.
      else {
        const fieldDataID = getDataID(fieldData);
        const fieldID = typeof fieldDataID === 'string' ? `(${fieldDataID})` : id && maybeAddTypeName(`${id}.${fieldKey}`, fieldData);

        // Add the field id to our store item’s references.
        if (node) {
          node.references[fieldKey] = fieldID;
        }

        // Write the data in this field to the store.
        const { data: nextFieldData } = writeToGraph({
          graph,
          id: fieldID,
          data: fieldData,
          selectionSet: fieldSelectionSet,
          fragments,
          variables,
          getDataID,
        });

        nextData[fieldName] = nextFieldData;
      }
    }
    // For fragments we want to try writing the fragment, and if a partial write
    // is thrown then we want to silently discard the fragment.
    else if (selection.kind === 'FragmentSpread' || selection.kind === 'InlineFragment') {
      let fragmentSelectionSet: SelectionSetNode;

      // Get the fragment from our fragment map if this is a fragment spread.
      // Otherwise use the selection set in the selection itself.
      if (selection.kind === 'FragmentSpread') {
        const fragmentName = selection.name.value;
        const fragment = fragments[fragmentName];
        if (typeof fragment === 'undefined') {
          throw new Error(`Could not find fragment named '${fragmentName}'.`);
        }
        fragmentSelectionSet = fragment.selectionSet;
      }
      else {
        fragmentSelectionSet = selection.selectionSet;
      }

      try {
        const { data: fragmentData } = writeToGraph({
          graph,
          id,
          data,
          selectionSet: fragmentSelectionSet,
          fragments,
          variables,
          getDataID,
        });
        assign(nextData, fragmentData);
      } catch (error) {
        // If the error is not a partial write error then make sure it is
        // correctly propogated. Otherwise we can ignore the error and this
        // fragment data will not be written to the store.
        if (!error._partialWrite) {
          throw error;
        }
      }
    }
    else {
      throw new Error(`Unrecognized selection '${(selection as any).kind}'`);
    }
  });

  return { data: nextData };
}

/**
 * Private function used in the implementation of `writeToStore`. This function
 * returns a potentially nested array of store ids and as a side effect writes
 * items to the store parameter.
 *
 * @private
 */
function writeArrayToStore ({
  graph,
  id,
  data,
  selectionSet,
  fragments,
  variables,
  getDataID,
}: {
  graph: GraphData,
  id: string | null,
  data: GraphQLArrayData,
  selectionSet: SelectionSetNode,
  fragments: { [fragmentName: string]: FragmentDefinitionNode },
  variables: { [variableName: string]: GraphQLData },
  getDataID: GetDataIDFn,
}): {
  reference: GraphReference,
  data: GraphQLArrayData,
} {
  const reference: GraphReference = [];
  const nextData: GraphQLArrayData = [];

  data.forEach((itemData, i) => {
    // If the item data is an array then we want to recurse.
    if (Array.isArray(itemData)) {
      const {
        reference: itemReference,
        data: nextItemData,
      } = writeArrayToStore({
        graph,
        id: id && `${id}[${i}]`,
        data: itemData,
        selectionSet,
        fragments,
        variables,
        getDataID,
      });
      reference.push(itemReference);
      nextData.push(nextItemData);
    }
    // If the item data is null then we want to add null as a reference and as
    // the next item data.
    else if (itemData === null) {
      reference.push(null);
      nextData.push(null);
    }
    // If the item data is not an object then we should throw an error because
    // we expected an object.
    else if (typeof itemData !== 'object') {
      throw new Error(`Expected composite data in array to be null or an object. Not '${typeof itemData}'`);
    }
    // Otherwise do the write thing.
    else {
      const itemDataID = getDataID(itemData);
      const itemID = typeof itemDataID === 'string' ? `(${itemDataID})` : id && maybeAddTypeName(`${id}[${i}]`, itemData);

      reference.push(itemID);
      const { data: nextItemData } = writeToGraph({
        graph,
        id: itemID,
        data: itemData,
        selectionSet,
        fragments,
        variables,
        getDataID,
      });
      nextData.push(nextItemData);
    }
  });

  return { reference, data: nextData };
}

/**
 * Adds a type name to the `id` if the `data` object has a `__typename`
 * property.
 */
function maybeAddTypeName (id: string, data: GraphQLObjectData): string {
  return typeof data['__typename'] === 'string' ? `${id}:${data['__typename']}` : id;
}
