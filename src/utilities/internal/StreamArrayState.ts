import { dep } from "optimism";

import type { Incremental } from "@apollo/client/incremental";

export declare namespace StreamArrayState {
  export interface Options {
    defaultTruncate?: boolean;
  }
}

export class StreamArrayState {
  truncate = false;

  private _streamPosition = 0;
  private path: Incremental.Path;
  private dep = dep<Incremental.Path>();

  constructor(
    path: Incremental.Path,
    { defaultTruncate = false }: StreamArrayState.Options = {}
  ) {
    this.path = path;
    this.truncate = defaultTruncate;
  }

  depend() {
    this.dep(this.path);
  }

  get streamPosition() {
    return this._streamPosition;
  }

  set streamPosition(value) {
    if (value !== this._streamPosition) {
      this._streamPosition = value;
      this.dirty();
    }
  }

  private dirty() {
    this.dep.dirty(this.path);
  }
}
