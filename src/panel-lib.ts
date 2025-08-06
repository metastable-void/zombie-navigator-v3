// vim: ts=2 sw=2 et ai
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import browser from 'webextension-polyfill';
import { GetDomResponse } from './command';
import { ResolvablePromise } from './promise';

declare global {
  // eslint-disable-next-line no-var
  var zombie: typeof gZombie;
}

interface ZombieScrapingResult<T> {
  url: string;
  fetchedAt: number; // UNIX timestamp in seconds
  result: T;
}

let gCookieStoreId = '';
let gWindowId = 0;

const ready = new Promise<void>((res) => {
  Promise.all([browser.tabs.getCurrent()]).then(([tab]) => {
    const { cookieStoreId, windowId } = tab;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userContextId = parseInt(cookieStoreId!.split('-').slice(-1)[0]!, 10);
    document.title = `#${userContextId}`;

    gCookieStoreId = cookieStoreId ?? '';
    gWindowId = windowId ?? 0;
    res();
  });
});

const putCache = async (url: string, data: string) => {
  await browser.runtime.sendMessage({
    cmd: 'cache_put',
    url,
    doc: data,
  });
};

const getCache = async (url: string): Promise<string | null> => {
  const doc = await browser.runtime.sendMessage({
    cmd: 'cache_get',
    url,
  });
  return doc as string | null;
};

const clearCache = async () => {
  await browser.runtime.sendMessage({
    cmd: 'cache_clear',
    url: '',
  });
};

const downloadString = (str: string, fileName: string) => {
  const blob = new Blob([str], {
    type: 'application/octet-stream',
  });
  const a = document.createElement('a');
  a.download = fileName;
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
};

const captureDom = async (url: string) => {
  if (!url) {
    throw new Error('Empty URL');
  }
  await ready;

  let cachedDoc = await getCache(url);
  if (cachedDoc == null) {
    const windowId = gWindowId;
    const cookieStoreId = gCookieStoreId;
    const tab = await browser.tabs.create({
      windowId,
      cookieStoreId,
      url,
      active: false,
    });

    const tabId = tab.id ?? 0;
    let closed = false;
    const res = await Promise.race([
        new Promise<GetDomResponse>((resolve, reject) => {
        const handler = (_tabId: number, _changeInfo: browser.Tabs.OnUpdatedChangeInfoType, tab: browser.Tabs.Tab) => {
          if (tabId != tab.id) return;
          if (tab.status != 'complete') return;
          if (tab.url == 'about:blank') return;
          browser.tabs.onUpdated.removeListener(handler);
          browser.tabs.onRemoved.removeListener(closedHandler);

          browser.tabs.sendMessage(tabId, {
            messageType: 'request',
            commandType: 'getDom',
            requestId: Math.random().toString(),
            payload: {},
          }).then((res) => {
            if (res && 'object' == typeof res) {
              resolve(res as GetDomResponse);
            } else {
              console.error(res);
            }
          }).catch((e) => {
            reject(e);
          });
        };
        const closedHandler = (closedId: number) => {
          if (tabId != closedId) return;
          closed = true;
          reject('Tab closed');
        };
        browser.tabs.onRemoved.addListener(closedHandler);
        browser.tabs.onUpdated.addListener(handler, {
          properties: ['status'],
        });
      }),
      new Promise<never>((_res, rej) => setTimeout(() => rej('timeout'), 60000)),
    ]).catch<never>((e) => {
      if (closed) throw e;
      browser.tabs.remove(tabId).catch((e) => {
        console.error(e);
      });
      throw e;
    });

    await browser.tabs.remove(tabId);
    cachedDoc = res.serializedDocument;
    await putCache(url, cachedDoc);
  }

  const doc = (new DOMParser).parseFromString(cachedDoc, 'text/html');
  const base = doc.createElement('base');
  base.href = url;
  doc.head.append(base);
  return doc;
};


class CaptureDomRequest {
  static readonly MAX_TABS = 3;
  static #openTabs = 0;
  static readonly #waitingQueue: CaptureDomRequest[] = [];

  readonly #url: string;
  readonly #promise: ResolvablePromise<Document>;
  readonly promise: Promise<Document>;

  public constructor(url: string) {
    this.#url = url;
    this.#promise = new ResolvablePromise;
    this.promise = this.#promise.then(a => a);

    CaptureDomRequest.#waitingQueue.push(this);
    CaptureDomRequest.#runQueue();
  }

  #run() {
    CaptureDomRequest.#openTabs += 1;
    captureDom(this.#url).then((doc) => {
      this.#promise.resolve(doc);
    }).catch((e) => {
      this.#promise.reject(e);
    }).finally(() => {
      CaptureDomRequest.#openTabs -= 1;

      CaptureDomRequest.#runQueue();
    });
  }

  static #runQueue() {
    while (CaptureDomRequest.#openTabs < CaptureDomRequest.MAX_TABS && CaptureDomRequest.#waitingQueue.length > 0) {
      const req = CaptureDomRequest.#waitingQueue.shift();
      if (req == null) break;
      req.#run();
    }
  }
}

const captureDomQueued = (url: string) => {
  const req = new CaptureDomRequest(url);
  return req.promise;
};

const scrapeUrl = async <T>(url: string, callback: (doc: Document) => T): Promise<ZombieScrapingResult<T>> => {
  const doc = await captureDomQueued(url);
  const value = callback(doc);
  const result: ZombieScrapingResult<T> = {
    url,
    fetchedAt: Math.trunc(Date.now() / 1000),
    result: value,
  };
  return result;
};

class Button {
  readonly #element: HTMLButtonElement;
  readonly #onClickCallback: (self: Button) => void;

  public constructor(onClickedCallack: (self: Button) => void) {
    this.#onClickCallback = onClickedCallack;

    const element = document.createElement('button');
    document.body.append(element);
    this.#element = element;
    element.onclick = () => {
      this.#onClickCallback(this);
    };
  }

  public set text(text: string) {
    this.#element.textContent = text;
  }

  public get text() {
    return this.#element.textContent ?? '';
  }

  public set disabled(disabled: boolean) {
    this.#element.disabled = disabled;
  }

  public get disabled() {
    return this.#element.disabled;
  }
}

class DateInput {
  readonly #element: HTMLInputElement;
  readonly #onChangedCallback: (self: DateInput) => void;

  public constructor(onChangedCallback: (self: DateInput) => void) {
    this.#onChangedCallback = onChangedCallback;

    const element = document.createElement('input');
    element.type = 'date';
    document.body.append(element);
    this.#element = element;
    element.onchange = () => {
      this.#onChangedCallback(this);
    };

    const date = new Date;
    element.value = `${
      date.getFullYear().toString(10)
    }-${
      (1 + date.getMonth()).toString(10).padStart(2, '0')
    }-${
      date.getDate().toString(10).padStart(2, '0')
    }`;
  }

  public set value(text: string) {
    this.#element.value = text;
  }

  public get value() {
    return this.#element.value ?? '';
  }
}

class Select {
  readonly #element: HTMLSelectElement;
  readonly #onChangedCallback: (self: Select) => void;
  #options: Record<string, string> = {};

  public constructor(onChangedCallback: (self: Select) => void) {
    this.#onChangedCallback = onChangedCallback;

    const element = document.createElement('select');
    document.body.append(element);
    this.#element = element;
    element.onchange = () => {
      this.#onChangedCallback(this);
    };
  }

  public set options(value: Record<string, string>) {
    this.#element.textContent = '';
    this.#options = value;
    for (const key in value) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = value[key] ?? key;
      this.#element.append(option);
    }
  }

  public get options() {
    return this.#options;
  }

  public get value() {
    return this.#element.value;
  }
}

class List {
  readonly #element: HTMLUListElement;
  #items: string[] = [];

  public constructor() {
    const element = document.createElement('ul');
    document.body.append(element);
    this.#element = element;
  }

  public set items(items: string[]) {
    this.#element.textContent = '';
    this.#items = items;
    for (const item of items) {
      const element = document.createElement('li');
      element.textContent = item;
      this.#element.append(element);
    }
  }

  public get items() {
    return this.#items;
  }
}

class Paragraph {
  readonly #element: HTMLParagraphElement;
  #text = '';

  public constructor() {
    const element = document.createElement('p');
    document.body.append(element);
    this.#element = element;
  }

  public set text(text: string) {
    this.#element.textContent = text;
  }

  public get text() {
    return this.#element.textContent ?? '';
  }
}

class Progress {
  readonly #element: HTMLProgressElement;

  public constructor() {
    const element = document.createElement('progress');
    document.body.append(element);
    this.#element = element;
  }

  public set value(value: number) {
    if (!isFinite(value)) {
      value = 0;
    }
    this.#element.value = Math.max(0, Math.min(1, value));
  }

  public get value() {
    return this.#element.value ?? 0;
  }
}

const addHorizontalLine = () => {
  document.body.append(document.createElement('hr'));
};

const gZombie = {
  ready,
  scrapeUrl,
  Button,
  Select,
  DateInput,
  List,
  Paragraph,
  Progress,
  addHorizontalLine,
  downloadString,
  clearCache,
};

globalThis.zombie = gZombie;

export {};
