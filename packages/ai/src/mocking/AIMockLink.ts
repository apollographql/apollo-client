import { ApolloLink, Observable } from "@apollo/client";
import { AIAdapter } from "./AIAdapter.js";

export declare namespace AIMockLink {
  export type DefaultOptions = {};

  export interface Options {
    adapter: AIAdapter;
    showWarnings?: boolean;
    defaultOptions?: DefaultOptions;
  }
}

export class AIMockLink extends ApolloLink {
  private adapter: AIAdapter;
  public showWarnings: boolean = true;

  public static defaultOptions: AIMockLink.DefaultOptions = {};

  constructor(options: AIMockLink.Options) {
    super();

    this.adapter = options.adapter;
    this.showWarnings = options.showWarnings ?? true;
  }

  public request(
    operation: ApolloLink.Operation
  ): Observable<ApolloLink.Result> {
    const prompt = operation.getContext().prompt;

    return new Observable((observer) => {
      try {
        this.adapter
          .generateResponseForOperation(operation, prompt)
          .then((result) => {
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
