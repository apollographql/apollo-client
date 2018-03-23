export class MutationStore {
  private store: { [mutationId: string]: MutationStoreValue } = {};

  public getStore(): { [mutationId: string]: MutationStoreValue } {
    return this.store;
  }

  public get(mutationId: string): MutationStoreValue {
    return this.store[mutationId];
  }

  public initMutation(
    mutationId: string,
    mutationString: string,
    variables: Object | undefined,
  ) {
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
