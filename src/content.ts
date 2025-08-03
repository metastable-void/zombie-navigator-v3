// vim: ts=2 sw=2 et ai
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import browser from 'webextension-polyfill';
import { AnyRequest, AnyResponse, CommandMap } from './command';

const sendResponse = <K extends keyof CommandMap>(
  command: K, requestId: string, response: CommandMap[K]['response'],
) => {
  const msg: AnyResponse<K> = {
    messageType: 'response',
    commandType: command,
    requestId,
    payload: response,
  };
  browser.runtime.sendMessage(msg);
};

browser.runtime.onMessage.addListener((msg: unknown) => {
  const message = (msg ?? {}) as AnyRequest;
  if (message.messageType != 'request') return;
  if (message.commandType == 'getDom') {
    const msg = message as AnyRequest<'getDom'>;
    let doc = '';
    try {
      doc = (new XMLSerializer).serializeToString(document);
    } catch (e) {
      // ignore
    }
    const res = {
      serializedDocument: doc,
      documentUrl: location.href,
      documentOrigin: window.origin,
    };
    sendResponse('getDom', msg.requestId, res);
    if (top != window) return;
    return Promise.resolve(res);
  }
});
