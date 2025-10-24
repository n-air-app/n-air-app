import { Inject } from 'services/core';
import { VideoService } from 'services/video';
import { HotkeysNode } from './hotkeys';
import { Node } from './node';
import { ScenesNode } from './scenes';
import { SourcesNode } from './sources';
import { TransitionsNode } from './transitions';

import { VideoSettingsService } from 'services/settings-v2/video';

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
    const wh = this.videoSettingsService.baseResolutions.horizontal;
    this.videoService.setBaseResolution({ width: wh.baseWidth, height: wh.baseHeight });

    // Load transitions
    try {
      await this.data.transitions.load();
    } catch (e) {
      console.error('Failed to load transitions:', e);
    }

    // Load sources
    try {
      await this.data.sources.load({});
    } catch (e) {
      console.error('Failed to load sources:', e);
    }

    // Load scenes
    try {
      await this.data.scenes.load({});
    } catch (e) {
      console.error('Failed to load scenes:', e);
    }

    // Load hotkeys
    if (this.data.hotkeys) {
      try {
        await this.data.hotkeys.load({});
      } catch (e) {
        console.error('Failed to load hotkeys:', e);
      }
    }
  }

  migrate(version: number) {
    if (version === 1) {
      this.data.transitions = (this.data as Dictionary<any>)['transition'];
    }
  }
}
