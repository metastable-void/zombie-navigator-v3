// vim: ts=2 sw=2 et ai
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import browser from 'webextension-polyfill';
import { AnyResponse } from './command';
import { db } from './db';

const debugTool = {
  async getTabs() {
    return (await browser.tabs.query({}))
    .filter((tab) => tab.discarded != true)
  },
  requestDomDump(tabId: number) {
    browser.tabs.sendMessage(tabId, {
      messageType: 'request',
      commandType: 'getDom',
      requestId: Math.random().toString(),
      payload: {},
    });
  },
  createSession() {
    return createSession();
  },
  destroySession(cookieStoreId: string) {
    return destroySession(cookieStoreId);
  },
};

browser.runtime.onMessage.addListener((msg: unknown, sender: browser.Runtime.MessageSender) => {
  const message = (msg ?? {}) as AnyResponse;
  if (message.messageType != 'response') return;
  if (message.commandType == 'getDom') {
    const msg = message as AnyResponse<'getDom'>;
    console.log('dom dump:', {... msg.payload, tabId: sender.tab?.id ?? 0, frameId: sender.frameId ?? 0, });
  }
});

declare global {
  // eslint-disable-next-line no-var
  var gDebugTool: typeof debugTool;
}

globalThis.gDebugTool = debugTool;

browser.runtime.onMessage.addListener((msg: unknown) => {
  if (!msg) return;
  if ('object' != typeof msg) return;
  if (!('cmd' in msg) || !('url' in msg)) return;
  if ('string' != typeof msg.url) return;
  switch (msg.cmd) {
    case 'cache_get': {
      const url = msg.url;
      return caches.open('dom_cache_v1').then(async (cache) => {
        const res = await cache.match(url);
        const text = await res?.text() ?? null;
        return text;
      });
    }

    case 'cache_put': {
      if (!('doc' in msg)) break;
      if ('string' != typeof msg.doc) break;
      const url = msg.url;
      const data = msg.doc;
      return caches.open('dom_cache_v1').then(async (cache) => {
        await cache.put(url, new Response(data, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        }));
      });
    }

    case 'cache_clear': {
      return caches.delete('dom_cache_v1');
    }
  }
});

const createSession = async () => {
  const ci = await browser.contextualIdentities.create({
    name: 'Zombie #nnn',
    color: 'purple',
    icon: 'chill',
  });
  const { cookieStoreId } = ci;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const userContextId = parseInt(cookieStoreId.split('-').slice(-1)[0]!, 10);
  await browser.contextualIdentities.update(cookieStoreId, {
    name: `Zombie #${userContextId.toString(10).padStart(4, '0')}`
  });
  const win = await browser.windows.create({
    cookieStoreId,
    url: browser.runtime.getURL('/panel.html'),
  });
  const tabId = win.tabs?.[0]?.id ?? 0;
  if (tabId > 0) {
    await db.sessions.add({
      cookieStoreId,
      controllerTabId: tabId,
    });
    await browser.tabs.update(tabId, {
      pinned: true,
    });
  }
};

const destroySession = async (cookieStoreId: string) => {
  try {
    const tabs = await browser.tabs.query({ cookieStoreId });
    const tabIds = tabs.map(t => t.id).filter(a => null != a) as number[];
    await browser.tabs.remove(tabIds);
  } finally {
    await db.sessions.delete(cookieStoreId);
    await browser.contextualIdentities.remove(cookieStoreId);
  }
};

browser.tabs.onRemoved.addListener(async (tabId) => {
  const session = await db.sessions.where({
    controllerTabId: tabId,
  }).first();
  if (!session) return;
  await destroySession(session.cookieStoreId);
});

browser.action.onClicked.addListener(() => {
  createSession().catch((e) => {
    console.error(e);
  });
});
