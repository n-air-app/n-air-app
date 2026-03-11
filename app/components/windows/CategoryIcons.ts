import { SettingsCategory } from 'services/settings/settings-api';

export const CategoryIcons = new Map<SettingsCategory, string>([
  ['General', 'icon-setting-border'],
  ['Stream', 'icon-broadcast-border'],
  ['Output', 'icon-output'],
  ['Video', 'icon-broadcast-border'],
  ['Audio', 'icon-sound-border'],
  ['Hotkeys', 'icon-shortcut'],
  ['Advanced', 'icon-setting-border'],
  ['Comment', 'icon-comment-setting-border'],
  ['SpeechEngine', 'icon-voice-engine-border'],
  ['SubStream', 'icon-output'],
  ['Transcription', 'icon-text' /* TODO */],
] satisfies [SettingsCategory, string][]);
