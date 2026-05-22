import { TObsFormData } from 'components/obs/inputs/ObsInput';

export interface ISettingsSubCategory {
  nameSubCategory: string;
  codeSubCategory?: string;
  parameters: TObsFormData;
}

export type SettingsCategory =
  | 'General'
  | 'Stream'
  | 'Output'
  | 'Audio'
  | 'Video'
  | 'Hotkeys'
  | 'Advanced'
  | 'Comment'
  | 'CommentSpeech'
  | 'Developer'
  | 'Scene Collections'
  | 'StreamSecond'
  | 'SubStream'
  | 'Transcription';

export interface ISettingsServiceApi {
  getCategories(): SettingsCategory[];
  getSettingsFormData(categoryName: SettingsCategory): ISettingsSubCategory[];
  setSettings(categoryName: SettingsCategory, settingsData: ISettingsSubCategory[]): void;
  showSettings(categoryName?: SettingsCategory, anchor?: string): void;
  showSoundDetectorSettings(): void;
}
