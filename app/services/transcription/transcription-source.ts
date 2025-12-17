import { InitAfter, Inject, Service } from '../core';
import { $t } from '../i18n';
import { SceneItem, ScenesService } from '../scenes';
import { ISourceAddOptions, ISourceApi, SourcesService } from '../sources';
import { VideoService } from '../video';
import { TranscriptionService } from './transcription';

@InitAfter('SourcesService')
export class TranscriptionSourceService extends Service {
  @Inject() private sourcesService: SourcesService;
  @Inject() private videoService: VideoService;
  @Inject() private transcriptionService: TranscriptionService;
  @Inject() private scenesService: ScenesService;

  /**
   * 行数から表示に必要な各種パラメータを計算
   * @param lines 表示する行数（不正な値の場合はデフォルト値2を使用）
   * @returns 正規化された行数と表示パラメータ
   */
  private calculateTranscriptionParams(lines: number) {
    // 行数のバリデーションと正規化
    const normalizedLines = typeof lines === 'number' && lines > 0 ? lines : 2;

    const lineHeight = 64;
    const width = 1600;
    const height = lineHeight * Math.min(normalizedLines + 2, 15); // 折り返しに備えて+2
    const scale = this.videoService.baseWidth / 1920;

    return {
      normalizedLines,
      fontSize: lineHeight,
      width,
      height,
      scale,
      position: {
        x: (this.videoService.baseWidth - width * scale) / 2,
        y: this.videoService.baseHeight - (height + 40) * scale,
      },
    };
  }

  /**
   * 文字起こしソースとその初期設定を生成
   * @param name ソース名
   * @param sourceAddOptions ソース追加オプション
   * @param lines 表示する行数（デフォルト: 2）
   * @returns ソース、配置オプション、プロパティスキップフラグ
   */
  createTextTranscriptionSourceAndOption(
    name: string,
    sourceAddOptions: ISourceAddOptions,
    lines: number = 2,
  ): {
    source: ISourceApi;
    options: ISourceAddOptions;
    forceSkipProperties?: boolean;
  } {
    const params = this.calculateTranscriptionParams(lines);

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
            size: params.fontSize,
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
          chatlog_lines: params.normalizedLines,
          extents_wrap: true,
          extents_cx: params.width,
          extents_cy: params.height,
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
          position: params.position,
          scale: { x: params.scale, y: params.scale },
        },
      },
      forceSkipProperties: true,
    };
  }

  /**
   * text_transcription ソースをデフォルト設定でアクティブシーンに追加する
   * @param name ソース名（省略時は自動生成）
   * @returns 作成されたソース
   */
  addTextTranscriptionSourceToActiveScene(name?: string): ISourceApi {
    // 名前が指定されていなければ自動生成
    if (!name) {
      name = this.sourcesService.suggestName($t('source-props.text_transcription.name'));
    }

    // ソースを作成
    const { source, options } = this.createTextTranscriptionSourceAndOption(
      name,
      { propertiesManagerSettings: {} },
      this.transcriptionService.state.textFileMaxLine,
    );

    // アクティブシーンに追加
    this.scenesService.activeScene.addSource(source.sourceId, options);

    return source;
  }

  /**
   * アクティブシーンから文字起こしソース(text_transcription)のアイテムを取得
   * @returns 文字起こしソースのSceneItem配列
   */
  getTranscriptionItemsInActiveScene(): SceneItem[] {
    return this.scenesService.activeScene.getItems().filter(item => {
      const sourceDetails = this.sourcesService.getSource(item.sourceId).getComparisonDetails();
      return sourceDetails.propertiesManager === 'text_transcription';
    });
  }

  /**
   * アクティブシーンに文字起こしソース(text_transcription)が含まれているかチェック
   * @returns 文字起こしソースが1つでも含まれている場合true、それ以外false
   */
  containsTranscriptionInActiveScene(): boolean {
    return this.getTranscriptionItemsInActiveScene().length > 0;
  }

  /**
   * アクティブシーン内の全ての文字起こしソースの行数設定を更新
   * 現在の設定値(textFileMaxLine)に基づいて、ソースの行数・高さ・位置を自動調整する
   */
  updateTranscriptionLines(): void {
    const params = this.calculateTranscriptionParams(
      this.transcriptionService.state.textFileMaxLine,
    );

    const items = this.getTranscriptionItemsInActiveScene();
    for (const item of items) {
      // ソースの設定を更新
      const source = this.sourcesService.getSource(item.sourceId);
      source.updateSettings({ chatlog_lines: params.normalizedLines, extents_cy: params.height });

      // アイテムの位置を更新
      item.setSettings({ transform: { position: params.position } });
    }
  }
}
