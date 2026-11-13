import { $t } from 'services/i18n';
import { formatGainDb, GAIN_STEPS_DB, isSameGain, LoudnessService, nextGainStep } from 'services/loudness';
import { SourceFiltersService } from 'services/source-filters';

import { Menu } from './Menu';

/**
 * 音声ソースのゲイン (ゲインフィルタ) を段階で選ぶメニュー。
 * オフにしてもゲインフィルタは削除せず 0 dB に戻すだけ (ユーザーが自分で追加したものかもしれないため)
 */
export class GainMenu extends Menu {
  constructor(private sourceId: string) {
    super();
    this.appendMenuItems();
  }

  private appendMenuItems() {
    const loudnessService = LoudnessService.instance();
    const current = loudnessService.getGain(this.sourceId);

    this.append({
      id: 'Gain off',
      label: $t('audio.gainOff'),
      type: 'radio',
      checked: isSameGain(current, 0),
      click: () => loudnessService.setGain(this.sourceId, 0),
    });

    // フィルター画面で段階以外の値にしている場合は、その値も選択中として出す
    const isStep = isSameGain(current, 0) || GAIN_STEPS_DB.some((step) => isSameGain(current, step));
    const steps = isStep ? GAIN_STEPS_DB : [...GAIN_STEPS_DB, current].sort((a, b) => a - b);
    steps.forEach((db) => {
      this.append({
        id: `Gain ${db}`,
        label: $t('audio.gainItem', { db: formatGainDb(db) }),
        type: 'radio',
        checked: isSameGain(current, db),
        click: () => loudnessService.setGain(this.sourceId, db),
      });
    });

    this.append({ type: 'separator' });
    if (nextGainStep(current) === null) {
      // 上限なら、これ以上は OS の入力音量で上げることを案内する
      this.append({ id: 'Gain max', label: $t('audio.gainMaxTooltip'), enabled: false });
    }
    this.append({
      id: 'Gain filters',
      label: $t('audio.gainOpenFilters'),
      click: () => SourceFiltersService.instance().showSourceFilters(this.sourceId),
    });
  }
}
