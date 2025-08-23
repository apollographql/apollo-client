import { ApolloLink, Observable } from "@apollo/client";
import { AIAdapter } from "./AIAdapter.js";
import { BaseAIAdapter } from "./BaseAIAdapter.js";

export declare namespace AIMockLink {
  export type DefaultOptions = {};

  export interface Options {
    adapter: AIAdapter;
    showWarnings?: boolean;
    defaultOptions?: DefaultOptions;
  }
}

export class AIMockLink extends ApolloLink {
  private adapter: BaseAIAdapter;
  public showWarnings: boolean = true;

  public static defaultOptions: AIMockLink.DefaultOptions = {};

  constructor(options: AIMockLink.Options) {
    super();

    this.adapter = new BaseAIAdapter(options.adapter);
    this.showWarnings = options.showWarnings ?? true;
  }

  public request(
    operation: ApolloLink.Operation
  ): Observable<ApolloLink.Result> {
    return new Observable((observer) => {
      try {
        this.adapter.performQuery(operation).then((result) => {
          // Notify the observer with the generated response
          observer.next(result);
          observer.complete();
        });
      } catch (error) {
        observer.error(error);
        observer.complete();
      }
    });
  }
}
