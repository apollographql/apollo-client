import { dep } from "optimism";

import type { Incremental } from "@apollo/client/incremental";

export class StreamArrayState {
  truncate = false;

  private _streamPosition = 0;
  private path: Incremental.Path;
  private dep = dep<Incremental.Path>();

  constructor(path: Incremental.Path) {
    this.path = path;
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
      this.dep.dirty(this.path);
    }
  }
}
