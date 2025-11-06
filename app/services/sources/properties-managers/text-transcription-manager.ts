import { PropertiesManager } from './properties-manager';

export class TextTranscriptionManager extends PropertiesManager {
  blacklist = ['read_from_file', 'file'];
  customUIComponent = 'TextTranscriptionProperties';

  //   init() {
  //     // ここで初期値を入れたいが、起動毎でもここにくるのでスルー
  //     console.log('TextTranscriptionManager init');
  //   }
}
