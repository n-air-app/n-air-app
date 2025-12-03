import { SettingsCategory } from 'services/settings/settings-api';

export const CategoryIcons = new Map<SettingsCategory, string>([
  ['General', 'icon-settings'],
  ['Stream', 'icon-video'],
  ['Output', 'icon-output'],
  ['Video', 'icon-video'],
  ['Audio', 'icon-speaker'],
  ['Hotkeys', 'icon-keyboard'],
  ['Advanced', 'icon-details-setting'],
  ['Comment', 'icon-comment-setting'],
  ['SpeechEngine', 'icon-speech-engine'],
  ['SubStream', 'icon-output'],
  ['Transcription', 'icon-text' /* TODO */],
] satisfies [SettingsCategory, string][]);
