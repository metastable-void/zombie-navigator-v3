// vim: ts=2 sw=2 et ai
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class ResolvablePromise<T> extends Promise<T> {
  #resolve: (a: T) => void;
  #reject: (e: unknown) => void;

  public constructor(executor?: (res: (value: T) => void, rej: (reason: unknown) => void) => void) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let resolve = (_a: T) => {/* */};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let reject = (_e: unknown) => {/* */};
    super((res, rej) => {
      resolve = res;
      reject = rej;
      executor?.(res, rej);
    });

    this.#resolve = resolve;
    this.#reject = reject;
  }

  public resolve(value: T) {
    this.#resolve(value);
  }

  public reject(reason: unknown) {
    this.#reject(reason);
  }
}
