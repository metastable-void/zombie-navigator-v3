// vim: ts=2 sw=2 et ai
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface AbstractCommandMap {
  [commandType: string]: CommandDefinition<unknown, unknown>,
}

export interface CommandDefinition<Req, Res> {
  request: Req,
  response: Res,
}

export interface GenericRequest<CommandMap extends AbstractCommandMap, K extends keyof CommandMap> {
  messageType: 'request',
  commandType: K,
  requestId: string,
  payload: CommandMap[K]['request'],
}

export interface GenericResponse<CommandMap extends AbstractCommandMap, K extends keyof CommandMap> {
  messageType: 'response',
  commandType: K,
  requestId: string,
  payload: CommandMap[K]['response'],
}

export type GetDomRequest = unknown;
export type GetDomResponse = {
  documentUrl: string,
  serializedDocument: string,
  documentOrigin: string,
};

export interface CommandMap extends AbstractCommandMap {
  getDom: CommandDefinition<GetDomRequest, GetDomResponse>,
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AnyRequest<K extends keyof CommandMap = keyof CommandMap>
extends GenericRequest<CommandMap, K>
{}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AnyResponse<K extends keyof CommandMap = keyof CommandMap>
extends GenericResponse<CommandMap, K>
{}
