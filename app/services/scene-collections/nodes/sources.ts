import * as Sentry from '@sentry/vue';
import * as fi from 'node-fontinfo';
import { AudioService, DEFAULT_AUDIO_MIXERS } from 'services/audio';
import { FontLibraryService } from 'services/font-library';
import { $t } from 'services/i18n';
import { ScenesService } from 'services/scenes';
import {
  SourcesService,
  TPropertiesManager,
  TSourceType,
  isNoAudioPropertiesManagerType,
} from 'services/sources';
import Utils from 'services/utils';
import * as obs from '../../../../obs-api';
import { Inject } from '../../core/injector';
import { HotkeysNode } from './hotkeys';
import { Node } from './node';
import { applyPathConvertForPreset, unapplyPathConvertForPreset } from './sources-util';

interface ISchema {
  items: ISourceInfo[];
}

interface IFilterInfo {
  name: string;
  type: string;
  settings: obs.ISettings;
  enabled?: boolean;
}

export interface ISourceInfo {
  id: string;
  name: string;
  type: TSourceType;
  settings: obs.ISettings;

  volume: number;
  forceMono?: boolean;
  syncOffset?: obs.ITimeSpec;
  deinterlaceMode?: obs.EDeinterlaceMode;
  deinterlaceFieldOrder?: obs.EDeinterlaceFieldOrder;

  audioMixers?: number;
  monitoringType?: obs.EMonitoringType;
  mixerHidden?: boolean;

  filters: {
    items: IFilterInfo[];
  };
  hotkeys?: HotkeysNode;
  channel?: number;
  muted?: boolean;

  propertiesManager?: TPropertiesManager;
  propertiesManagerSettings?: Dictionary<any>;
}

export class SourcesNode extends Node<ISchema, {}> {
  schemaVersion = 3;

  @Inject() private fontLibraryService: FontLibraryService;
  @Inject() private sourcesService: SourcesService;
  @Inject() private audioService: AudioService;
  @Inject() private scenesService: ScenesService;

  getItems() {
    const linkedSourcesIds = this.scenesService
      .getSceneItems()
      .map(sceneItem => sceneItem.sourceId);

    return this.sourcesService.sources.filter(source => {
      // we store scenes in separated config
      if (source.type === 'scene') return false;

      // global audio sources must be saved
      if (source.channel) return true;

      // prevent sources without linked sceneItems to be saved
      if (!linkedSourcesIds.includes(source.sourceId)) return false;
      return true;
    });
  }

  save(context: {}): Promise<void> {
    const promises: Promise<ISourceInfo>[] = this.getItems().map(source => {
      return new Promise(resolve => {
        const hotkeys = new HotkeysNode();

        hotkeys.save({ sourceId: source.sourceId }).then(() => {
          const audioSource = this.audioService.getSource(source.sourceId);

          const obsInput = source.getObsInput();
          if (!obsInput) {
            throw Error(`source '${source.sourceId}': getObsInput() not found`);
          }

          /* Signal to the source that it needs to save settings as
           * we're about to cache them to disk. */
          obsInput.save();

          let data: ISourceInfo = {
            id: source.sourceId,
            name: source.name,
            type: source.type,
            settings: unapplyPathConvertForPreset(source.type, obsInput.settings),
            volume: obsInput.volume,
            channel: source.channel,
            hotkeys,
            muted: obsInput.muted,
            filters: {
              items: obsInput.filters.map(filter => {
                /* Remember that filters are also sources.
                 * We should eventually do this for transitions
                 * as well. Scenes can be ignored. */
                filter.save();

                return {
                  name: filter.name,
                  type: filter.id,
                  settings: filter.settings,
                  enabled: filter.enabled,
                };
              }),
            },
            propertiesManager: source.getPropertiesManagerType(),
            propertiesManagerSettings: source.getPropertiesManagerSettings(),
          };

          if (source.video && source.async) {
            data = {
              ...data,
              deinterlaceMode: source.deinterlaceMode,
              deinterlaceFieldOrder: source.deinterlaceFieldOrder,
            };
          }

          if (audioSource) {
            data = {
              ...data,
              forceMono: audioSource.forceMono,
              syncOffset: AudioService.msToTimeSpec(audioSource.syncOffset),
              audioMixers: audioSource.audioMixers,
              monitoringType: audioSource.monitoringType,
              mixerHidden: audioSource.mixerHidden,
            };
          }

          resolve(data);
        });
      });
    });

    return new Promise(resolve => {
      Promise.all(promises).then(items => {
        this.data = { items };
        resolve();
      });
    });
  }

  checkTextSourceValidity(item: ISourceInfo) {
    if (item.type !== 'text_gdiplus') {
      return;
    }

    const settings = item.settings;

    if (settings['font']['face'] && settings['font']['flags'] != null) {
      return;
    }

    /* Defaults */
    settings['font']['face'] = 'Arial';
    settings['font']['flags'] = 0;

    /* This should never happen */
    if (!settings.custom_font) {
      const source = this.sourcesService.getSource(item.id);
      source.updateSettings({ font: settings.font });
      return;
    }

    const fontInfo = fi.getFontInfo(settings.custom_font);

    if (!fontInfo) {
      const source = this.sourcesService.getSource(item.id);
      source.updateSettings({ font: settings.font });
      return;
    }

    settings['font']['face'] = fontInfo.family_name;

    settings['font']['flags'] =
      (fontInfo.italic ? obs.EFontStyle.Italic : 0) | (fontInfo.bold ? obs.EFontStyle.Bold : 0);

    const source = this.sourcesService.getSource(item.id);
    source.updateSettings({ font: settings.font });
  }

  /**
   * Do some data sanitizing
   */
  sanitizeSources() {
    // Look for duplicate ids and channels
    const ids: Set<string> = new Set();
    const channels: Set<number> = new Set();

    this.data.items = this.data.items.filter(item => {
      if (ids.has(item.id)) return false;
      ids.add(item.id);

      if (item.channel != null) {
        if (channels.has(item.channel)) return false;
        channels.add(item.channel);
      }

      return true;
    });
  }

  load(context: {}): Promise<void> {
    this.clearLoadErrors();
    this.sanitizeSources();

    // This ensures we have bound the source size callback
    // before creating any sources in OBS.
    this.sourcesService;

    const promises: Promise<void>[] = [];

    // Create sources individually to properly handle errors and maintain index alignment
    // Based on obs-studio-node's createSources implementation:
    // https://github.com/streamlabs/obs-studio-node/blob/e09b3c4ae55a9af120c51a8116f629ca8f2be5c0/js/module.ts#L1548
    this.data.items.forEach((sourceInfo, index) => {
      let obsInput: obs.IInput | null = null;

      // Try to create the OBS input source
      try {
        const settings = applyPathConvertForPreset(sourceInfo.type, sourceInfo.settings);
        obsInput = obs.InputFactory.create(sourceInfo.type, sourceInfo.id, settings);

        // Apply basic source properties (equivalent to createSources lines 1563-1570)
        if (obsInput.audioMixers) {
          obsInput.muted = sourceInfo.muted || false;
          obsInput.volume = sourceInfo.volume != null ? sourceInfo.volume : 1;
          obsInput.syncOffset = { sec: 0, nsec: 0 };
        }

        obsInput.deinterlaceMode = sourceInfo.deinterlaceMode || obs.EDeinterlaceMode.Disable;
        obsInput.deinterlaceFieldOrder =
          sourceInfo.deinterlaceFieldOrder || obs.EDeinterlaceFieldOrder.Top;

        // Create and add filters (equivalent to createSources lines 1573-1589)
        if (sourceInfo.filters && Array.isArray(sourceInfo.filters.items)) {
          sourceInfo.filters.items.forEach(filterInfo => {
            try {
              const obsFilter = obs.FilterFactory.create(
                filterInfo.type,
                filterInfo.name,
                filterInfo.settings,
              );
              if (obsFilter) {
                obsFilter.enabled = filterInfo.enabled === undefined ? true : filterInfo.enabled;
                obsInput!.addFilter(obsFilter);
                obsFilter.release();
              }
            } catch (filterError) {
              console.warn(
                `Failed to create filter "${filterInfo.name}" for source "${sourceInfo.name}":`,
                filterError,
              );
              // Note: filter errors are not added to loadErrors as they are less critical
            }
          });
        }
      } catch (e) {
        console.warn(`Failed to create input for source "${sourceInfo.name}":`, e);
        this.addLoadError({
          type: 'source',
          id: sourceInfo.id,
          name: `${sourceInfo.name} [${sourceInfo.type}]`,
          error: e instanceof Error ? e : new Error(String(e)),
        });
        // Note: Individual errors are not sent to Sentry here.
        // They will be aggregated and sent by SceneCollectionsService.
        return; // Skip to next source
      }

      // If source creation succeeded, add it to the service and configure it
      if (obsInput) {
        try {
          this.sourcesService.addSource(obsInput, sourceInfo.name, {
            channel: sourceInfo.channel,
            propertiesManager: sourceInfo.propertiesManager,
            propertiesManagerSettings: sourceInfo.propertiesManagerSettings || {},
          });

          const newSource = this.sourcesService.getSource(sourceInfo.id);
          if (newSource.async && newSource.video) {
            if (sourceInfo.deinterlaceMode !== undefined) {
              newSource.setDeinterlaceMode(sourceInfo.deinterlaceMode);
            }
            if (sourceInfo.deinterlaceFieldOrder !== undefined) {
              newSource.setDeinterlaceFieldOrder(sourceInfo.deinterlaceFieldOrder);
            }
          }

          const useAudio = !isNoAudioPropertiesManagerType(sourceInfo.propertiesManager);

          if (useAudio && obsInput.audioMixers) {
            const audioSource = this.audioService.getSource(sourceInfo.id);
            if (!audioSource) {
              // maybe the source was removed after the last save
              if (Utils.isDevMode()) {
                console.warn(`Audio source ${sourceInfo.id} not found in AudioService. ignore.`);
              }
              Sentry.captureEvent({
                message: `Audio source not found in AudioService`,
                level: 'warning',
                tags: {
                  sourceId: sourceInfo.id,
                },
                extra: {
                  audioSources: Object.keys(this.audioService.state.audioSources),
                },
              });
            } else {
              audioSource.setMul(sourceInfo.volume != null ? sourceInfo.volume : 1);

              // マイグレーション: 音声を持つべきソースでaudioMixers=0の場合、デフォルト値に修正
              // 注: 内部的には8ビットだがUIでは6トラック（ビット0-5）しか操作できないため、
              //     手動で全トラックOFFにしても0（全ビットOFF）にはならない（ビット6-7は変更されない）
              //     audioMixers=0は過去のバグや初期化ミスによる異常値であり、マイグレーション対象とする
              let audioMixers = sourceInfo.audioMixers;
              const sourceTypesWithAudio = [
                'nair-rtvc-source',
                'game_capture',
                'wasapi_input_capture',
                'wasapi_output_capture',
              ];

              if (audioMixers === 0 && sourceTypesWithAudio.includes(sourceInfo.type)) {
                const message = `Migrating audioMixers for source "${sourceInfo.name}" (${sourceInfo.type}) from 0 to ${DEFAULT_AUDIO_MIXERS}`;
                console.warn(message);

                // Sentryに警告を送信（タグとfingerprintを付けて同一イベントとして集計）
                Sentry.captureEvent({
                  message,
                  level: 'warning',
                  tags: {
                    sourceType: sourceInfo.type,
                    migration: 'audioMixers',
                  },
                  fingerprint: ['audioMixers-migration', sourceInfo.type],
                  extra: {
                    sourceName: sourceInfo.name,
                    oldAudioMixers: 0,
                    newAudioMixers: DEFAULT_AUDIO_MIXERS,
                  },
                });

                audioMixers = DEFAULT_AUDIO_MIXERS; // 全トラックON
              }

              audioSource.setSettings({
                forceMono: sourceInfo.forceMono,
                syncOffset: sourceInfo.syncOffset
                  ? AudioService.timeSpecToMs(sourceInfo.syncOffset)
                  : 0,
                audioMixers,
                monitoringType: sourceInfo.monitoringType,
              });
              audioSource.setHidden(!!sourceInfo.mixerHidden);
            }
          }

          if (sourceInfo.hotkeys) {
            promises.push(sourceInfo.hotkeys.load({ sourceId: sourceInfo.id }));
          }
        } catch (e) {
          console.warn(`Failed to configure source ${sourceInfo.name} (${sourceInfo.id}):`, e);
          this.addLoadError({
            type: 'source',
            id: sourceInfo.id,
            name: `${sourceInfo.name} [${sourceInfo.type}]`,
            error: e instanceof Error ? e : new Error(String(e)),
          });
          // Note: Individual errors are not sent to Sentry here.
          // They will be aggregated and sent by SceneCollectionsService.
        }
      }
    });

    return new Promise(resolve => {
      Promise.all(promises).then(() => resolve());
    });
  }

  migrate(version: number) {
    // migrate audio sources names
    if (version < 3) {
      this.data.items.forEach(source => {
        const desktopDeviceMatch = /^DesktopAudioDevice(\d)$/.exec(source.name);
        if (desktopDeviceMatch) {
          const index = parseInt(desktopDeviceMatch[1], 10);
          source.name = $t('sources.desktopAudio') + (index > 1 ? ' ' + index : '');
          return;
        }

        const auxDeviceMatch = /^AuxAudioDevice(\d)$/.exec(source.name);
        if (auxDeviceMatch) {
          const index = parseInt(auxDeviceMatch[1], 10);
          source.name = $t('sources.micAux') + (index > 1 ? ' ' + index : '');
          return;
        }
      });
    }
  }
}
