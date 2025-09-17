import { InitAfter, Inject, Service } from '../core';
import { ISourceAddOptions, ISourceApi, SourcesService } from '../sources';
import { VideoService } from '../video';
import { TranscriptionService } from './transcription';

@InitAfter('SourcesService')
export class TranscriptionSourceService extends Service {
  @Inject() private sourcesService: SourcesService;
  @Inject() private videoService: VideoService;
  @Inject() private transcriptionService: TranscriptionService;

  createTextTranscriptionSourceAndOption(
    name: string,
    sourceAddOptions: ISourceAddOptions,
  ): {
    source: ISourceApi;
    options: ISourceAddOptions;
    forceSkipProperties?: boolean;
  } {
    const width = 1600;
    const height = 260;
    const scale = this.videoService.baseWidth / 1920;

    // これらの値は画面で弄った後、OBSが保存するjson(....\AppData\Roaming\n-air-app-unstable\SceneCollections)を参照で
    return {
      source: this.sourcesService.createSource(
        name,
        'text_gdiplus',
        {
          text: '',
          read_from_file: true,
          file: this.transcriptionService.getTextFilePath(),
          outline: true,
          vertical: false,
          gradient: false,
          chatlog: true,
          extents: true,
          font: {
            face: 'Arial',
            style: '',
            size: 64,
            flags: 0,
          },
          align: 'center',
          valign: 'bottom',
          color: 0xffffff,
          opacity: 100,
          gradient_color: 0xffffff,
          gradient_opacity: 100,
          gradient_dir: 90,
          bk_color: 0,
          bk_opacity: 0,
          outline_size: 2,
          outline_color: 0x5052c,
          outline_opacity: 100,
          chatlog_lines: 3,
          extents_wrap: true,
          extents_cx: width,
          extents_cy: height,
          transform: 0,
          antialiasing: true,
        },
        {
          propertiesManager: 'text_transcription',
          propertiesManagerSettings: sourceAddOptions.propertiesManagerSettings,
        },
      ),
      options: {
        initialTransform: {
          position: {
            // bottom-center
            x: (this.videoService.baseWidth - width * scale) / 2,
            y: this.videoService.baseHeight - (height + 40) * scale,
          },
          scale: { x: scale, y: scale },
        },
      },
      forceSkipProperties: true,
    };
  }
}
