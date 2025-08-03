
import Dexie, { type EntityTable } from 'dexie';

export interface Session {
  /**
   * Primary key.
   */
  cookieStoreId: string;
  controllerTabId: number;
}

export const db = new Dexie('ZombieDB') as Dexie & {
  sessions: EntityTable<Session, 'cookieStoreId'>,
};

db.version(1).stores({
  sessions: `cookieStoreId, &controllerTabId`,
});
