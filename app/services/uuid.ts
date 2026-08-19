import { uuidv4 } from 'services/utils';

import { StatefulService } from './core/stateful-service';

interface IUuidServiceState { }

export class UuidService extends StatefulService<IUuidServiceState> {
  localStorageKey = 'InstallationUuidv4';
  private _uuid: string | null = null;

  init() {
    this._uuid = this.getUuid();
  }

  get uuid() {
    if (this._uuid === null) {
      this._uuid = this.getUuid();
    }
    return this._uuid;
  }

  private getUuid(): string {
    // もし uuid が生成済みで保存されていたらそれを返す
    const storageUuid = localStorage.getItem(this.localStorageKey);
    if (storageUuid !== null) {
      return storageUuid;
    }
    // 無ければ生成して保存してから返す
    const uuid = uuidv4();
    localStorage.setItem(this.localStorageKey, uuid);
    return uuid;
  }
}
