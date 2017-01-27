import { SelectionSetNode, FragmentDefinitionNode } from 'graphql';
import { assign } from '../util/assign';
import { GraphQLData, GraphQLObjectData, GraphQLArrayData } from '../graphql/types';
import { GraphData, GraphDataNode, GraphReference, GetDataIDFn } from './types';
import { ID_KEY, getFieldKey } from './common';

export function writeToStore (
  getDataID: GetDataIDFn,
  graph: GraphData,
  selectionSet: SelectionSetNode,
  fragments: { [fragmentName: string]: FragmentDefinitionNode },
  variables: { [variableName: string]: GraphQLData },
  id: string | null,
  data: GraphQLObjectData,
): {
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
    switch (selection.kind) {
      case 'Field':
        const field = selection;
        const fieldSelectionSet = field.selectionSet;
        const fieldName = field.alias ? field.alias.value : field.name.value;
        const fieldData = data[fieldName];
        const fieldKey = getFieldKey(field, variables);

        // tslint:disable one-line
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
          } = writeArrayToStore(
            getDataID,
            graph,
            selectionSet,
            fragments,
            variables,
            id && `${id}.${fieldKey}`,
            fieldData,
          );
          nextData[fieldName] = nextFieldData;
          if (node) {
            node.references[fieldKey] = fieldReference;
          }
        }
        // Otherwise do the write thing.
        else {
          const fieldDataID = getDataID(fieldData);
          let fieldID = typeof fieldDataID === 'string' ? `(${fieldDataID})` : id && `${id}.${fieldKey}`;

          // If we have a type name add it to the end of our id.
          const typeName = fieldData['__typename'];
          if (fieldID && typeName != null) {
            fieldID += `:${typeName}`;
          }

          // Add the field id to our store item’s references.
          if (node) {
            node.references[fieldKey] = fieldID;
          }

          // Write the data in this field to the store.
          const { data: nextFieldData } = writeToStore(
            getDataID,
            graph,
            fieldSelectionSet,
            fragments,
            variables,
            fieldID,
            fieldData,
          );

          nextData[fieldName] = nextFieldData;
        }
        // tslint:enable one-line
        break;
      // For fragment spreads, find the fragment in our dictionary and then
      // try writing its selection set to the store. If the write fails because
      // some fields were missing, then we don’t write any data for this
      // fragment to the store.
      case 'FragmentSpread':
        const fragmentName = selection.name.value;
        const fragment = fragments[fragmentName];
        if (typeof fragment === 'undefined') {
          throw new Error(`Could not find fragment named '${fragmentName}'.`);
        }
        try {
          const { data: fragmentData } = writeToStore(
            getDataID,
            graph,
            fragment.selectionSet,
            fragments,
            variables,
            id,
            data,
          );
          assign(nextData, fragmentData);
        } catch (error) {
          // If the error is not a partial write error then make sure it is
          // correctly propogated. Otherwise we can ignore the error and this
          // fragment data will not be written to the store.
          if (!error._partialWrite) {
            throw error;
          }
        }
        break;
      // For inline fragment spreads try writing its selection set to the store.
      // If the write fails because some fields were missing, then we don’t
      // write any data for this fragment to the store.
      case 'InlineFragment':
        try {
          const { data: fragmentData } = writeToStore(
            getDataID,
            graph,
            fragment.selectionSet,
            fragments,
            variables,
            id,
            data,
          );
          assign(nextData, fragmentData);
        } catch (error) {
          // If the error is not a partial write error then make sure it is
          // correctly propogated. Otherwise we can ignore the error and this
          // fragment data will not be written to the store.
          if (!error._partialWrite) {
            throw error;
          }
        }
        break;
      default:
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
function writeArrayToStore (
  getDataID: GetDataIDFn,
  graph: GraphData,
  selectionSet: SelectionSetNode,
  fragments: { [fragmentName: string]: FragmentDefinitionNode },
  variables: { [variableName: string]: GraphQLData },
  id: string | null,
  data: GraphQLArrayData,
): {
  reference: GraphReference,
  data: GraphQLArrayData,
} {
  const reference: GraphReference = [];
  const nextData: GraphQLArrayData = [];

  data.forEach((itemData, i) => {
    // tslint:disable one-line
    // If the item data is an array then we want to recurse.
    if (Array.isArray(itemData)) {
      const {
        reference: itemReference,
        data: nextItemData,
      } = writeArrayToStore(
        getDataID,
        graph,
        selectionSet,
        fragments,
        variables,
        id && `${id}[${i}]`,
        itemData,
      );
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
      let itemID = typeof itemDataID !== 'string' ? `(${itemDataID})` : id && `${id}[${i}]`;

      // If we have a type name add it to the end of our id.
      const typeName = itemData['__typename'];
      if (itemID && typeName != null) {
        itemID += `:${typeName}`;
      }

      reference.push(itemID);
      const { data: nextItemData } = writeToStore(
        getDataID,
        graph,
        selectionSet,
        fragments,
        variables,
        itemID,
        itemData,
      );
      nextData.push(nextItemData);
    }
    // tslint:enable one-line
  });

  return { reference, data: nextData };
}
