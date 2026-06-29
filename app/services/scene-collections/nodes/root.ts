import { Inject } from 'services/core';
import { VideoSettingsService } from 'services/settings-v2/video';
import { VideoService } from 'services/video';

import { HotkeysNode } from './hotkeys';
import { Node } from './node';
import { ScenesNode } from './scenes';
import { SourcesNode } from './sources';
import { TransitionsNode } from './transitions';

interface ISchema {
  sources: SourcesNode;
  scenes: ScenesNode;
  hotkeys?: HotkeysNode;
  transitions?: TransitionsNode; // V2 Transitions
}

// This is the root node of the config file
export class RootNode extends Node<ISchema, {}> {
  schemaVersion = 2;

  @Inject() videoService: VideoService;
  @Inject() videoSettingsService: VideoSettingsService;

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
      sources,
      scenes,
      transitions,
      hotkeys,
    };
  }

  async load(): Promise<void> {
    this.clearLoadErrors();

    const wh = this.videoSettingsService.baseResolutions.horizontal;
    this.videoService.setBaseResolution({ width: wh.baseWidth, height: wh.baseHeight });

    // Load transitions
    try {
      await this.data!.transitions!.load();
      // Collect errors from transitions
      const transitionErrors = this.data!.transitions!.getLoadErrors();
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
  }

  migrate(version: number) {
    if (version === 1) {
      this.data.transitions = (this.data as Dictionary<any>)['transition'];
    }
  }
}
