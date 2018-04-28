export class MutationStore {
  private store: { [mutationId: string]: MutationStoreValue } = {};

  public getStore(): { [mutationId: string]: MutationStoreValue } {
    return this.store;
  }

  public get(mutationId: string): MutationStoreValue {
    return this.store[mutationId];
  }

  /**
   * KAMIL: It receives a mutation ID, query as a string and variables
   * it stores those values and sets loading:true and error:null
   * so we keep the status of that mutation here
   */
  public initMutation(
    mutationId: string,
    mutationString: string,
    variables: Object | undefined,
  ) {
    // M02
    // KAMIL: it saves the mutation
    this.store[mutationId] = {
      mutationString: mutationString,
      variables: variables || {},
      loading: true,
      error: null,
    };
  }

  public markMutationError(mutationId: string, error: Error) {
    const mutation = this.store[mutationId];

    if (!mutation) {
      return;
    }

    mutation.loading = false;
    mutation.error = error;
  }

  /**
   * KAMIL: we set loading to false and error to null, that's it.
   */
  public markMutationResult(mutationId: string) {
    const mutation = this.store[mutationId];

    if (!mutation) {
      return;
    }

    mutation.loading = false;
    mutation.error = null;
  }

  public reset() {
    this.store = {};
  }
}

export interface MutationStoreValue {
  mutationString: string;
  variables: Object;
  loading: boolean;
  error: Error | null;
}
