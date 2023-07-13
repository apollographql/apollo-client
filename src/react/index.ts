import '../utilities/globals/index.js';

export {
  ApolloProvider,
  ApolloConsumer,
  getApolloContext,
  resetApolloContext,
  ApolloContextValue
} from './context/index.js';

export * from './hooks/index.js';
// TODO: remove export with release 3.8
export class SuspenseCache {
  constructor(){
    // throwing an error here instead of using invariant - we do not want this error
    // message to be link-ified, but to directly show up as bold as possible
    throw new Error(
      'It is no longer necessary to create a `SuspenseCache` instance and pass it into the `ApolloProvider`.\n' + 
      'Please remove this code from your application. \n\n' + 
      'This export will be removed with the final 3.8 release.'
    )
  }
}

export {
  DocumentType,
  IDocumentDefinition,
  operationName,
  parser
} from './parser/index.js';

export * from './types/types.js';
