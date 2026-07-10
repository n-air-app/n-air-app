import { Inject } from 'services/core';
import { $t } from 'services/i18n';
import { ScenesService } from 'services/scenes';
import { VideoSettingsService } from 'services/settings-v2/video';
import { VideoService } from 'services/video';

import { HotkeysNode } from './hotkeys';
import { Node } from './node';
import { ScenesNode } from './scenes';
import { SourcesNode } from './sources';
import { TransitionsNode } from './transitions';

// Identifies this file as N Air's own scene collection format, as opposed
// to a Streamlabs OBS file (which has no such field). N Air forked from
// Streamlabs OBS and the two formats may now evolve independently.
export const NAIR_SCENE_COLLECTION_FORMAT_ID = 'n-air-scene-collection';

// Version of the overall file format (formatId/formatVersion/baseResolution
// and any future top-level additions). Independent of each node's own
// schemaVersion.
export const CURRENT_FORMAT_VERSION = 1;

interface ISchema {
  sources: SourcesNode;
  scenes: ScenesNode;
  hotkeys?: HotkeysNode;
  transitions?: TransitionsNode; // V2 Transitions
  formatId?: string; // absent on files from before this was introduced, or from Streamlabs OBS
  formatVersion?: number;
  // Canvas resolution at the time this collection was saved. Absent on
  // older files; in that case we don't rescale on load (see load() below).
  baseResolution?: { width: number; height: number };
}

// This is the root node of the config file
export class RootNode extends Node<ISchema, {}> {
  schemaVersion = 3;

  @Inject() videoService: VideoService;
  @Inject() videoSettingsService: VideoSettingsService;
  @Inject() scenesService: ScenesService;

  async save(): Promise<void> {
    const sources = new SourcesNode();
    const scenes = new ScenesNode();
    const transitions = new TransitionsNode();
    const hotkeys = new HotkeysNode();

    await sources.save({});
    await scenes.save({});
    await transitions.save();
    await hotkeys.save({});

    this.data = {
      formatId: NAIR_SCENE_COLLECTION_FORMAT_ID,
      formatVersion: CURRENT_FORMAT_VERSION,
      baseResolution: { ...this.videoService.baseResolution },
      sources,
      scenes,
      transitions,
      hotkeys,
    };
  }

  async load(): Promise<void> {
    this.clearLoadErrors();

    if (
      typeof this.data.formatVersion === 'number'
      && this.data.formatVersion > CURRENT_FORMAT_VERSION
    ) {
      const message = $t('scenes.formatVersionTooNew', {
        found: this.data.formatVersion,
        supported: CURRENT_FORMAT_VERSION,
      });
      this.addLoadError({
        type: 'format',
        name: message,
        error: new Error(message),
      });
    }

    // The collection's saved canvas resolution, if any (absent on files
    // saved before this was tracked). We keep the app's current canvas
    // resolution rather than restoring the saved one, and instead rescale
    // scene items to fit it below, once they're loaded.
    const savedResolution = this.data.baseResolution;

    const wh = this.videoSettingsService.baseResolutions.horizontal;
    const targetResolution = { width: wh.baseWidth, height: wh.baseHeight };
    this.videoService.setBaseResolution(targetResolution);

    // Load transitions
    try {
      await this.data.transitions.load();
      // Collect errors from transitions
      const transitionErrors = this.data.transitions.getLoadErrors();
      transitionErrors.forEach((err) => this.addLoadError(err));
    } catch (e) {
      console.error('Failed to load transitions:', e);
      this.addLoadError({
        type: 'transition',
        name: 'Transitions',
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }

    // Load sources
    try {
      await this.data.sources.load({});
      // Collect errors from sources
      const sourceErrors = this.data.sources.getLoadErrors();
      sourceErrors.forEach((err) => this.addLoadError(err));
    } catch (e) {
      console.error('Failed to load sources:', e);
      this.addLoadError({
        type: 'source',
        name: 'Sources',
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }

    // Load scenes
    try {
      await this.data.scenes.load({});
      // Collect errors from scenes
      const sceneErrors = this.data.scenes.getLoadErrors();
      sceneErrors.forEach((err) => this.addLoadError(err));
    } catch (e) {
      console.error('Failed to load scenes:', e);
      this.addLoadError({
        type: 'scene',
        name: 'Scenes',
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }

    // Load hotkeys
    if (this.data.hotkeys) {
      try {
        await this.data.hotkeys.load({});
        // Collect errors from hotkeys
        const hotkeyErrors = this.data.hotkeys.getLoadErrors();
        hotkeyErrors.forEach((err) => this.addLoadError(err));
      } catch (e) {
        console.error('Failed to load hotkeys:', e);
        this.addLoadError({
          type: 'hotkey',
          name: 'Hotkeys',
          error: e instanceof Error ? e : new Error(String(e)),
        });
      }
    }

    // Rescale scene items to fit the current canvas resolution if the
    // collection was saved at a different one. We keep the current
    // resolution as-is (so output resolution never changes as a side
    // effect of switching/importing a collection) and scale the layout to
    // match. Must run after scene items are loaded above. Nothing to do
    // (and no rescale) if the collection predates baseResolution tracking.
    if (
      savedResolution
      && savedResolution.width > 0
      && savedResolution.height > 0
      && (savedResolution.width !== targetResolution.width
        || savedResolution.height !== targetResolution.height)
    ) {
      try {
        this.scenesService.rescaleAllScenes(
          targetResolution.width / savedResolution.width,
          targetResolution.height / savedResolution.height,
        );
      } catch (e) {
        console.error('Failed to rescale scene items:', e);
        this.addLoadError({
          type: 'format',
          name: 'Rescale',
          error: e instanceof Error ? e : new Error(String(e)),
        });
      }
    }
  }

  migrate(version: number) {
    if (version === 1) {
      this.data.transitions = (this.data as Dictionary<any>)['transition'];
    }
    if (version <= 2 && this.data.formatId === undefined) {
      // Files from before formatId/formatVersion existed (this includes
      // Streamlabs OBS-originated files, which never had these fields).
      // Backfill the identifiers so downstream validation treats them as
      // ours going forward. Deliberately do NOT backfill baseResolution:
      // we have no way to know the canvas resolution these files were
      // authored at, and leaving it absent means load() above correctly
      // skips rescaling (preserving today's behavior for old files).
      this.data.formatId = NAIR_SCENE_COLLECTION_FORMAT_ID;
      this.data.formatVersion = CURRENT_FORMAT_VERSION;
    }
  }
}
