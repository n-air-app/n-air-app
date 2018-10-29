import { Service } from './service';
import { ServicesManager } from '../services-manager';
import electron from 'electron';
import { Subscription } from 'rxjs/Subscription';
import {
  IJsonRpcRequest,
  IJsonRpcResponse,
  IJsonRpcEvent
} from 'services/jsonrpc';

const { ipcRenderer } = electron;

/**
 * sever for handling API requests from IPC
 * using by child window
 */
export class IpcServerService extends Service {
  servicesManager: ServicesManager = ServicesManager.instance;
  servicesEventsSubscription: Subscription;
  requestHandler: Function;

  listen() {
    this.requestHandler = (event: Electron.Event, request: IJsonRpcRequest) => {
      const response: IJsonRpcResponse<
        any
      > = this.servicesManager.executeServiceRequest(request);
      ipcRenderer.send('services-response', response);
    };
    ipcRenderer.on('services-request', this.requestHandler);
    ipcRenderer.send('services-ready');

    this.servicesEventsSubscription = this.servicesManager.serviceEvent.subscribe(
      event => this.sendEvent(event)
    );
  }

  stopListening() {
    if (this.requestHandler) {
      ipcRenderer.removeListener('services-request', this.requestHandler);
    }
    if (this.servicesEventsSubscription) {
      this.servicesEventsSubscription.unsubscribe();
    }
  }

  private sendEvent(event: IJsonRpcResponse<IJsonRpcEvent>) {
    ipcRenderer.send('services-message', event);
  }
}
