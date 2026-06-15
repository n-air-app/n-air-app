import { randomBytes } from 'crypto';

import * as remote from '@electron/remote';
import { isFakeMode } from 'util/fakeMode';

import { Inject } from './core/injector';
import { Service } from './core/service';
import { HostsService } from './hosts';
import { SynthesizerSelector } from './nicolive-program/state';
import { NVoiceCharacterUsageLog } from './nvoice-character-usage';
import { EncoderFamily } from './settings/optimizer';
import { SpeechActionOnSoundDetected } from './sound-detector/sound-detector';
import {
  CommentColor,
  CommentFont,
  CommentPosition,
  CommentSize,
} from './transcription/CommentModifier';
import { UserService } from './user';
import { UuidService } from './uuid';

function randomCharacters(len: number): string {
  const buf = randomBytes(len);
  const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from(buf)
    .map((b) => characters[Math.floor((b / 256) * characters.length)])
    .join('');
}

export type RtvcParamPresetKeys = 'preset0' | 'preset1' | 'preset2';
export type RtvcParamPreset = {
  [name in RtvcParamPresetKeys]: {
    pitch_shift?: number;
    pitch_shift_song?: number;
  };
};

export type RtvcParamManualKeys = 'manual0' | 'manual1' | 'manual2' | 'manual3' | 'manual4';
export type RtvcParamManual = {
  [name in RtvcParamManualKeys]: {
    name: string;
    pitch_shift?: number;
    pitch_shift_song?: number;
    amount: number;
    primary_voice: number;
    secondary_voice: number;
  };
};

export type RtvcEventLog = {
  used?: boolean;
  latency?: number;
  param?: RtvcParamPreset | RtvcParamManual | Record<string, never>;
};

export type SubStreamLog = {
  url: string;
  videoBitrate: number;
  audioBitrate: number;
  videoCodec: string;
  audioCodec: string;
  sync: boolean;
};

export type SoundDetectorLog = {
  enabled: boolean;
  sourceId: string | null | 'mic';
  soundThresholdDb: number;
  resumeSilenceMs: number;
  speechActionOnSoundDetected: SpeechActionOnSoundDetected;
};

export type TranscriptionLog = {
  enabled: boolean;
  voskModelName: string;
  commentEnabled: boolean;
  commentColor: CommentColor;
  commentPosition: CommentPosition;
  commentSize: CommentSize;
  commentFont: CommentFont;
  commentPostDelay: number;
  commentVposOffset: number;
  textFileMaxLine: number;
  textFileLineTimeToLive: number; // in milliseconds
  transcriptionSourceUsed: boolean;
};

export type TUsageEvent =
  | {
      event: 'boot';
    }
  | {
      event: 'stream_start' | 'stream_end';
      platform: string;
      stream_track_id: string;
      content_id: string | null;
      output_mode: 'Simple' | 'Advanced';
      video: {
        base_resolution: string; // eg. '1920x1080'
        output_resolution: string; // eg. '1280x720'
        fps: string; // "30", "29.97", "24 NTSC", ...
        bitrate: number;
      };
      audio: {
        bitrate: number;
        sample_rate: 44100 | 48000;
      };
      encoder: {
        encoder_type: EncoderFamily;
        preset: string;
      };
      auto_optimize: {
        enabled: boolean;
        use_hardware_encoder: boolean;
      };
      advanced?: {
        rate_control: 'CBR' | 'VBR' | 'ABR' | 'CRF';
        profile: 'high' | 'main' | 'baseline';
      };
      yomiage: {
        enabled: boolean;
        pitch: number;
        rate: number;
        volume: number;
        max_seconds: number;
        engine: {
          normal: SynthesizerSelector;
          operator: SynthesizerSelector;
          system: SynthesizerSelector;
        };
        voicevox: {
          normal: string;
          operator: string;
          system: string;
        };
        onecomme: {
          used: boolean;
          removeComment: boolean;
        };
      };
      compact_mode: {
        auto_compact_mode: boolean;
        current: boolean;
      };
      rtvc: RtvcEventLog;
      substream?: SubStreamLog;
      transcription?: TranscriptionLog;
      soundDetector?: SoundDetectorLog;
      nvoiceCharacter?: NVoiceCharacterUsageLog;
    }
  | {
      event: 'app_start' | 'app_close';
    }
  | {
      event: 'crash';
    };

export function track(event: TUsageEvent) {
  return (target: any, methodName: string, descriptor: PropertyDescriptor) => {
    return {
      ...descriptor,
      value(...args: any[]): any {
        // recordEvent は async だが await する必要はない（非同期で記録）
        UsageStatisticsService.instance().recordEvent(event);
        // 元の関数の戻り値を必ず return する（async 関数の場合 Promise が返る）
        return descriptor.value.apply(this, args);
      },
    };
  };
}

export class UsageStatisticsService extends Service {
  @Inject() userService: UserService;
  @Inject() hostsService: HostsService;
  @Inject() uuidService: UuidService;

  version = remote.process.env.NAIR_VERSION;

  init() {}

  generateStreamingTrackID(): string {
    // 配信の開始と終了を対応付ける一時的な識別子はランダムな文字列で生成する
    const id = randomCharacters(10);
    return id;
  }

  /**
   * Record a usage event on our server.
   * @param event the event type to record
   * @param metadata arbitrary data to store with the event (must be serializable)
   */
  async recordEvent(event: TUsageEvent) {
    console.log('recordEvent', event);
    if (isFakeMode()) {
      return;
    }
    try {
      if (event.event === 'boot') {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        const body = JSON.stringify({
          ...event,
          uuid: this.uuidService.uuid, // inject UUID
          user_id: this.userService.isLoggedIn() ? this.userService.platformId : null,
        });

        const request = new Request(`${this.hostsService.statistics}/boot`, {
          headers,
          method: 'POST',
          body,
        });

        console.log('send boot log', request.url, body);
        return await fetch(request);
      } else if (event.event === 'stream_start' || event.event === 'stream_end') {
        console.log('send action log', `${this.hostsService.statistics}/action`);
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');

        const request = new Request(`${this.hostsService.statistics}/action`, {
          headers,
          method: 'POST',
          body: JSON.stringify({
            ...event,
            uuid: this.uuidService.uuid, // inject UUID
            user_id: this.userService.isLoggedIn() ? this.userService.platformId : null,
          }),
        });

        return await fetch(request);
      }
    } catch (err) {
      console.error(err);
    }
  }
}
