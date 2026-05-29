import * as remote from '@electron/remote';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { $t } from 'services/i18n';
import { NVoiceCharacterType, NVoiceCharacterTypes } from 'services/nvoice-character';
import { ScenesService } from 'services/scenes';
import { SourcesService, TPropertiesManager, TSelectableSourceType } from 'services/sources';
import { TranscriptionService } from 'services/transcription/transcription';
import { UserService } from 'services/user';
import { defineComponent } from 'vue';

import AddFileIcon from '../../../media/images/add-file-icon.svg';
import AddSceneIcon from '../../../media/images/add-scene-icon.svg';
import AppAudioCaptureSourceIcon from '../../../media/images/app-speaker.svg';
import BlackmagicSourceIcon from '../../../media/images/blackmagic-icon.svg';
import BrowserSourceIcon from '../../../media/images/browser-source-icon.svg';
import CharacterSourceIcon from '../../../media/images/character-source-icon.svg';
import ColorSourceIcon from '../../../media/images/color-source-icon.svg';
import DshowInputIcon from '../../../media/images/display-icon.svg';
import FfmpegSourceIcon from '../../../media/images/ffmpeg-source-icon.svg';
import GameCaptureIcon from '../../../media/images/game-capture-icon.svg';
import MonitorCaptureIcon from '../../../media/images/monitor-capture-icon.svg';
import NdiSourceIcon from '../../../media/images/ndi-icon.svg';
import VLCSourceIcon from '../../../media/images/play.svg';
import {
  default as ImageSourceIcon,
  default as SlideshowIcon,
} from '../../../media/images/slideshow-icon.svg';
import SpeechEngineIcon from '../../../media/images/speech-engine.svg';
import TextGdiplusIcon from '../../../media/images/text-gdiplus-icon.svg';
import WasapiInputCaptureIcon from '../../../media/images/wasapi-input-icon.svg';
import WasapiOutputIcon from '../../../media/images/wasapi-output-icon.svg';
import WindowCaptureIcon from '../../../media/images/window-capture-icon.svg';

import AddSourceInfo from './AddSourceInfo.vue';

type TInspectableSource = TSelectableSourceType;

interface ISelectSourceOptions {
  propertiesManager?: TPropertiesManager;
  nVoiceCharacterType?: NVoiceCharacterType;
}

function addSource(
  readyToAdd: boolean,
  inspectedSource: TSelectableSourceType | null,
  sourceType: TSelectableSourceType,
  options: ISelectSourceOptions = {},
): void {
  if (!readyToAdd) return;

  // 自動文字起こしソースを追加する際に自動文字起こしが有効になっていない場合は迷わないように案内を表示する
  if (
    inspectedSource === 'text_transcription'
    && TranscriptionService.instance().activeStatus() !== 'active'
  ) {
    remote.dialog.showMessageBoxSync(remote.getCurrentWindow(), {
      type: 'info',
      buttons: [$t('common.ok')],
      defaultId: 0,
      message: $t('settings.transcription.addSource.notActive'),
      noLink: true,
    });
  }

  const { propertiesManager: optionsPropertiesManager, ...optionsWithoutManager } = options;
  if (sourceType === 'custom_cast_ndi_source') {
    const propertiesManagerSettings: Dictionary<any> = {
      ...optionsWithoutManager,
      propertiesManager: 'custom-cast-ndi',
    };
    SourcesService.instance().showAddSource('ndi_source', propertiesManagerSettings);
  } else if (NVoiceCharacterTypes.includes(sourceType as NVoiceCharacterType)) {
    const propertiesManagerSettings: Dictionary<any> = {
      NVoiceCharacterType: sourceType as NVoiceCharacterType,
      ...optionsWithoutManager,
    };
    SourcesService.instance().showAddSource('browser_source', {
      propertiesManagerSettings,
      propertiesManager: 'nvoice-character',
    });
  } else {
    const propertiesManager = optionsPropertiesManager || 'default';
    const propertiesManagerSettings: Dictionary<any> = { ...optionsWithoutManager };

    SourcesService.instance().showAddSource(sourceType, {
      propertiesManagerSettings,
      propertiesManager,
    });
  }
}

export default defineComponent({
  name: 'SourcesShowcase',

  components: {
    ModalLayout,
    AddSourceInfo,
    BrowserSourceIcon,
    ColorSourceIcon,
    DshowInputIcon,
    ImageSourceIcon,
    WindowCaptureIcon,
    AddSceneIcon,
    AddFileIcon,
    WasapiInputCaptureIcon,
    TextGdiplusIcon,
    GameCaptureIcon,
    FfmpegSourceIcon,
    SlideshowIcon,
    WasapiOutputIcon,
    MonitorCaptureIcon,
    NdiSourceIcon,
    BlackmagicSourceIcon,
    CharacterSourceIcon,
    AppAudioCaptureSourceIcon,
    VLCSourceIcon,
    SpeechEngineIcon,
  },

  data() {
    return {
      inspectedSource: null as TInspectableSource | null,
    };
  },

  computed: {
    loggedIn(): boolean {
      return UserService.instance().isLoggedIn();
    },

    platform() {
      if (!this.loggedIn) return null;
      return UserService.instance().platform.type;
    },

    availableSources() {
      return SourcesService.instance().getAvailableSourcesTypesList().filter((type: any) => {
        if (type.value === 'text_ft2_source') return false;
        if (type.value === 'scene' && ScenesService.instance().scenes.length <= 1) return false;
        return true;
      });
    },

    readyToAdd(): boolean {
      if (this.inspectedSource === 'nair-rtvc-source') {
        // 同一scene上では1つだけ
        for (const s of ScenesService.instance().activeScene.items) {
          if (SourcesService.instance().getSourceById(s.sourceId).type === 'nair-rtvc-source') return false;
        }
      }

      return this.inspectedSource !== null && this.inspectedSource !== 'custom_cast_ndi_guide';
    },
  },

  methods: {
    selectSource(sourceType: TInspectableSource, options: ISelectSourceOptions = {}): void {
      addSource(this.readyToAdd, this.inspectedSource, sourceType, options);
    },

    inspectSource(inspectedSource: TInspectableSource): void {
      this.inspectedSource = inspectedSource;
    },

    selectInspectedSource(): void {
      if (this.inspectedSource === null) return;
      addSource(this.readyToAdd, this.inspectedSource, this.inspectedSource);
    },

    downloadNdiRuntime(): void {
      remote.shell.openExternal('https://downloads.ndi.tv/SDK/NDI_SDK/NDI%206%20Runtime.exe');
    },
  },
});

