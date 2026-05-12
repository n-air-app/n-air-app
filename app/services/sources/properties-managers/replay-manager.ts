import { Inject } from 'services/core/injector';
import { StreamingService } from 'services/streaming';
import { PropertiesManager } from './properties-manager';

export class ReplayManager extends PropertiesManager {
  @Inject() streamingService: StreamingService;

  blacklist = ['is_local_file', 'local_file'];

  init() {
    super.init();
    this.obsSource.update({ local_file: '' });

    this.streamingService.replayBufferFileWrite.subscribe((filePath) => {
      this.obsSource.update({ local_file: filePath });
    });
  }
}
