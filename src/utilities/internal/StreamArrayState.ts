import { dep } from "optimism";

import type { Incremental } from "@apollo/client/incremental";

export class StreamArrayState {
  private _streamPosition = 0;
  private _truncate = false;

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
      this.dirty();
    }
  }

  get truncate() {
    return this._truncate;
  }

  set truncate(value) {
    if (value !== this._truncate) {
      this._truncate = value;
      this.dirty();
    }
  }

  private dirty() {
    this.dep.dirty(this.path);
  }
}
