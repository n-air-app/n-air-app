import type { Net } from 'electron';

import type { MainProcessFetchResponse } from '../app/util/fetchViaMainProcess';

export function fetchViaElectronNet(
  net: Pick<Net, 'fetch'>,
  url: string,
  options: RequestInit,
): Promise<MainProcessFetchResponse>;
