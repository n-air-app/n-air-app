import * as remote from '@electron/remote';
import { IObsListInput, TObsFormData, TObsValue } from 'components/obs/inputs/ObsInput';
import fs from 'fs';
import * as fi from 'node-fontinfo';
import { EFontStyle } from 'obs-studio-node';
import path from 'path';
import { Inject } from 'services/core/injector';
import { CustomizationService } from 'services/customization';
import { FontLibraryService } from 'services/font-library';
import { $t } from 'services/i18n';
import { UserService } from 'services/user';
import { PropertiesManager } from './properties-manager';

export interface IDefaultManagerSettings {
  mediaBackup?: {
    localId?: string;
    serverId?: number;
    originalPath?: string;
  };
}

/**
 * This properties manager simply exposes all properties
 * and does not modify them.
 */
export class DefaultManager extends PropertiesManager {
  @Inject() fontLibraryService: FontLibraryService;
  @Inject() userService: UserService;
  @Inject() customizationService: CustomizationService;

  settings: IDefaultManagerSettings;

  mediaBackupFileSetting: string;
  currentMediaPath: string;

  init() {
    if (!this.settings.mediaBackup) this.settings.mediaBackup = {};
    this.downloadGoogleFont();

    if (this.obsSource.id === 'slideshow') {
      this.blacklist = ['slide_mode'];
    }

    this.setupAutomaticGameCapture();
  }

  setPropertiesFormData(properties: TObsFormData) {
    super.setPropertiesFormData(properties);
    if (this.obsSource.settings[this.mediaBackupFileSetting] !== this.currentMediaPath) {
      this.currentMediaPath = this.obsSource.settings[this.mediaBackupFileSetting];
    }
  }

  getPropertiesFormData(): TObsFormData {
    const propArray = super.getPropertiesFormData();

    // TODO: 選択肢単位のフィルタリング機構がないので暫定対処、これ以上増やしたくなったらやり方を考えること
    // TODO: ホットキーのフォームが未実装
    if (this.obsSource.id === 'game_capture') {
      const captureModeProp = propArray.find(
        (prop) => prop.name === 'capture_mode',
      ) as IObsListInput<TObsValue>;
      if (captureModeProp) {
        captureModeProp.options = captureModeProp.options.filter((option) => {
          return option.value !== 'hotkey';
        });
      }
    }

    return propArray;
  }

  async downloadGoogleFont() {
    if (this.obsSource.id !== 'text_gdiplus') return;

    const settings = this.obsSource.settings;
    const newSettings: Dictionary<any> = {};

    if (!settings['custom_font']) return;
    if (fs.existsSync(settings.custom_font)) return;

    const filename = path.parse(settings['custom_font']).base;

    const fontPath = await this.fontLibraryService.downloadFont(filename);

    // Make sure this wasn't destroyed while fetching the font
    if (this.destroyed) return;

    const fontInfo = fi.getFontInfo(fontPath);

    if (!fontInfo) {
      // Fallback to Arial
      newSettings['custom_font'] = null;
      newSettings['font'] = {
        face: 'Arial',
        flags: 0,
      };
      this.obsSource.update(newSettings);
      return;
    }

    newSettings['custom_font'] = fontPath;
    newSettings['font'] = { ...settings['font'] };
    newSettings['font'] = newSettings['font'] || {};
    newSettings['font']['face'] = fontInfo.family_name;
    newSettings['font']['flags'] = (fontInfo.italic ? EFontStyle.Italic : 0) | (fontInfo.bold ? EFontStyle.Bold : 0);

    this.obsSource.update(newSettings);
  }
  private async setupAutomaticGameCapture() {
    if (!['game_capture', 'screen_capture'].includes(this.obsSource.id)) return;

    const appPath = remote.app.isPackaged
      ? path.dirname(remote.app.getPath('exe'))
      : remote.app.getAppPath();

    const listPath = path.join(appPath, 'assets/gamecapture/game_capture_list.json');

    console.log('Setting up automatic game capture with list:', listPath);

    if (!fs.existsSync(listPath)) {
      console.log('Game capture list not found:', listPath);
      return;
    }

    const imagePath = path.join(appPath, 'assets/gamecapture/nair_capture_back.jpg');

    // これらは遅延設定しても作用する
    this.obsSource.update({
      auto_capture_rules_path: listPath,
      auto_placeholder_image: imagePath,
      auto_placeholder_message: $t('common.gameCapture.searching'),
      window_placeholder_image: imagePath,
      window_placeholder_waiting_message: $t('common.gameCapture.searching'),
      window_placeholder_missing_message: $t('common.gameCapture.missing'),
      capture_overlays: this.obsSource.settings.capture_overlays ?? true,
    });

    console.log('Automatic game capture setup complete.');
  }
}
