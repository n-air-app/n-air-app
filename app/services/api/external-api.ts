import { Inject } from 'services/core/injector';
import { InternalApiService } from './internal-api';
import { RpcApi } from './rpc-api';

/**
 * External API for usage outside of SLOBS application
 * for stuff like remote-control, StreamDeck and other 3rd-party services
 * This API is documented and must not have breaking changes
 */
export class ExternalApiService extends RpcApi {
  /**
   * InternalApiService is for fallback calls
   */
  @Inject() internalApiService: InternalApiService;

  /**
   * @see RpcApi.getResource()
   * @override
   */
  getResource(resourceId: string) {
    // this resource has been not found in the external API
    // try to fallback to InternalApiService
    return this.internalApiService.getResource(resourceId);
  }
}
