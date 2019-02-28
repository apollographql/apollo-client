import ApolloClient from '..';

declare type CollectionItem<TCacheShape> = {
  id: number;
  name: string | undefined;
  client: ApolloClient<TCacheShape>;
};

export class DevToolsConnector<TCacheShape> {
  private beacon: number = 0;
  private listeners: Array<Function> = [];
  private collection: Array<CollectionItem<TCacheShape>> = [];

  constructor() {
    this.collection = [];
  }

  public register(name: string | undefined, client: ApolloClient<TCacheShape>) {
    this.beacon += 1;
    this.collection.push({ id: this.beacon, name, client });

    this.triggerAllListeners();
  }

  public triggerAllListeners() {
    this.listeners.forEach(callback => {
      callback(this.getClients());
    });
  }

  public attachUpdateListener(callback: Function) {
    this.listeners.push(callback);
  }

  public getById(id: number) {
    const item = this.collection.find(item => item.id === id);
    return item ? item.client : null;
  }

  public getClients() {
    return this.collection;
  }
}

const api = new DevToolsConnector();

(window as any).__APOLLO_CLIENTS_FOR_DEVTOOLS__ = api;

export default api;
