import { Inject } from 'services/core/injector';
import {
  NVoiceCharacterService,
  NVoiceCharacterType,
  NVoiceCharacterTypes,
  NVoiceAvatarStyle,
  NVoiceAvatarStyles,
} from 'services/nvoice-character';
import { IObsListInput, TObsFormData, TObsValue } from 'components/obs/inputs/ObsInput';
import { $t } from 'services/i18n';
import { PropertiesManager } from './properties-manager';

export interface INVoiceCharacterSettings {
  nVoiceCharacterType: NVoiceCharacterType;
  nVoiceAvatarStyle?: NVoiceAvatarStyle;
}

export class NVoiceCharacterManager extends PropertiesManager {
  @Inject() nVoiceCharacterService: NVoiceCharacterService;
  blacklist = [
    'url',
    'is_local_file',
    'fps_custom',
    'reroute_audio',
    'fps',
    'css',
    'shutdown',
    'restart_when_active',
    'refreshnocache',
  ];
  // displayOrder = [];

  settings: INVoiceCharacterSettings;

  applySettings(settings: Dictionary<any>) {
    this.settings.nVoiceCharacterType = (NVoiceCharacterTypes.includes(settings.nVoiceCharacterType)
        && settings.nVoiceCharacterType)
      || 'near';
    this.settings.nVoiceAvatarStyle = (NVoiceAvatarStyles.includes(settings.nVoiceAvatarStyle) && settings.nVoiceAvatarStyle)
      || 'standing1';
    this.setNVoiceCharacterType(this.settings.nVoiceCharacterType);
  }

  getPropertiesFormData(): TObsFormData {
    const formData = super.getPropertiesFormData();
    const styleProperty: IObsListInput<TObsValue> = {
      type: 'OBS_PROPERTY_LIST',
      name: 'nVoiceAvatarStyle',
      description: $t('source-props.near.avatar_style.name'),
      visible: true,
      enabled: true,
      value: this.settings.nVoiceAvatarStyle || 'standing1',
      options: [
        {
          description: $t('source-props.near.avatar_style.standing1'),
          value: 'standing1',
        },
        {
          description: $t('source-props.near.avatar_style.standing2'),
          value: 'standing2',
        },
      ],
    };
    return [styleProperty, ...formData];
  }

  setPropertiesFormData(properties: TObsFormData) {
    // nVoiceAvatarStyleの変更を処理
    const styleProperty = properties.find((prop) => prop.name === 'nVoiceAvatarStyle');
    if (styleProperty && NVoiceAvatarStyles.includes(styleProperty.value as NVoiceAvatarStyle)) {
      const newStyle = styleProperty.value as NVoiceAvatarStyle;
      if (this.settings.nVoiceAvatarStyle !== newStyle) {
        this.settings.nVoiceAvatarStyle = newStyle;
        this.applySettings(this.settings);
      }
    }

    // nVoiceAvatarStyleはOBSプロパティではないので、formDataから除外
    const filteredProperties = properties.filter((prop) => prop.name !== 'nVoiceAvatarStyle');
    super.setPropertiesFormData(filteredProperties);
  }

  setNVoiceCharacterType(type: NVoiceCharacterType) {
    const style = this.settings.nVoiceAvatarStyle || 'standing1';
    const url = this.nVoiceCharacterService.getUrl(type, undefined, style);

    if (this.obsSource.settings['url'] !== url) {
      this.obsSource.update({ url });
    }
  }
}
