/**
 * カスタムスライダーコンポーネント
 *
 * ## 利用方法
 *
 * ### 基本的な使い方（数値範囲指定）
 * ```vue
 * <slider
 *   :value="currentValue"
 *   :min="0"
 *   :max="100"
 *   :interval="1"
 *   @input="handleInput"
 * />
 * ```
 *
 * ### 配列から値を選択
 * ```vue
 * <slider
 *   :value="selectedValue"
 *   :data="[0.1, 0.5, 1.0, 1.5, 2.0]"
 *   @input="handleInput"
 * />
 * ```
 * dataプロパティを指定すると、配列のインデックスで内部管理し、
 * 実際の値（配列の要素）をemitします。
 *
 * ### その他のオプション
 * - `disabled`: スライダーを無効化
 * - `tooltip`: ツールチップ表示 ('none' | 'hover')
 * - `valueBox`: 値を表示するボックスを表示
 * - `usePercentages`: 値をパーセンテージ表示
 *
 * ## 現在の利用箇所
 *
 * 1. **ObsSliderInput** (app/components/obs/inputs/ObsSliderInput.vue.ts)
 *    - OBSプロパティのスライダー入力のベースコンポーネント
 *    - デバウンス処理によるパフォーマンス最適化
 *
 * 2. **MixerItem** (app/components/MixerItem.vue.ts)
 *    - オーディオミキサーの音量調整
 *    - 0.0〜1.0の範囲で音量を制御
 *
 * 3. **CommentSettings** (app/components/CommentSettings.vue.ts)
 *    - コメント読み上げの速度(rate)と音量(volume)調整
 *    - dataプロパティで離散的な値のリストから選択
 *
 * 4. **SpeechEngineSettings** (app/components/SpeechEngineSettings.vue.ts)
 *    - 音声合成エンジンの最大時間(maxTime)とピッチ(pitch)調整
 *    - dataプロパティで事前定義された値から選択
 *
 * 5. **RtvcSourceProperties** (app/components/windows/RtvcSourceProperties.vue.ts)
 *    - RTVCソースのピッチシフトや音量調整など
 *    - ボイスチェンジャーのパラメータ制御
 */
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';

export default defineComponent({
  name: 'SliderInput',
  props: {
    value: { type: Number, required: true },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    interval: { type: Number, default: undefined },
    data: { type: Array as () => number[], default: undefined },
    disabled: { type: Boolean, default: false },
    tooltip: { type: String, default: 'none' },
    valueBox: { type: Boolean, default: false },
    usePercentages: { type: Boolean, default: false },
  },
  emits: ['input'],
  setup(props, { emit }) {
    const slider = ref<HTMLInputElement | null>(null);
    const showTooltip = ref(false);

    // dataプロパティが指定されている場合、それを使用
    const useData = computed(() => props.data && props.data.length > 0);

    const actualMin = computed(() => {
      if (useData.value) return 0;
      return props.min ?? 0;
    });

    const actualMax = computed(() => {
      if (useData.value) return props.data!.length - 1;
      return props.max ?? 100;
    });

    const actualInterval = computed(() => {
      if (useData.value) return 1;
      return props.interval ?? 1;
    });

    // dataを使う場合、valueからインデックスを取得
    const valueToIndex = (value: number): number => {
      if (!useData.value) return value;
      const index = props.data!.indexOf(value);
      return index >= 0 ? index : 0;
    };

    // dataを使う場合、インデックスから値を取得
    const indexToValue = (index: number): number => {
      if (!useData.value) return index;
      return props.data![Math.round(index)] ?? props.value;
    };

    const currentIndex = computed(() => valueToIndex(props.value));

    const sliderPercent = computed(() => {
      const min = actualMin.value;
      const max = actualMax.value;
      const current = currentIndex.value;
      return ((current - min) / (max - min)) * 100;
    });

    const tooltipStyle = computed(() => {
      const percent = sliderPercent.value;
      return {
        left: `calc(${percent}% + ${8 - percent * 0.16}px)`,
      };
    });

    const handleMouseEnter = () => {
      if (props.tooltip === 'hover') {
        showTooltip.value = true;
      }
    };

    const handleMouseLeave = () => {
      if (props.tooltip === 'hover') {
        showTooltip.value = false;
      }
    };

    // Javascript precision is weird
    const roundNumber = (num: number) => {
      return parseFloat(num.toFixed(6));
    };

    const updateValue = (inputValue: number) => {
      if (isNaN(inputValue)) return;
      const newValue = useData.value ? indexToValue(inputValue) : inputValue;
      emit('input', roundNumber(newValue));
    };

    const handleKeydown = (event: KeyboardEvent) => {
      const step = actualInterval.value;
      if (useData.value) {
        const currentIdx = currentIndex.value;
        if (event.code === 'ArrowUp' && currentIdx < actualMax.value) {
          updateValue(currentIdx + 1);
        }
        if (event.code === 'ArrowDown' && currentIdx > actualMin.value) {
          updateValue(currentIdx - 1);
        }
      } else {
        if (event.code === 'ArrowUp') updateValue(props.value + step);
        if (event.code === 'ArrowDown') updateValue(props.value - step);
      }
    };

    const formatter = (value: number) => {
      let formattedValue = String(value);
      if (props.usePercentages) formattedValue = Math.round(value * 100) + '%';
      return formattedValue;
    };

    onMounted(() => {
      if (slider.value) {
        slider.value.addEventListener('mouseenter', handleMouseEnter);
        slider.value.addEventListener('mouseleave', handleMouseLeave);
      }
    });

    onBeforeUnmount(() => {
      if (slider.value) {
        slider.value.removeEventListener('mouseenter', handleMouseEnter);
        slider.value.removeEventListener('mouseleave', handleMouseLeave);
      }
    });

    return {
      slider,
      showTooltip,
      sliderPercent,
      tooltipStyle,
      updateValue,
      handleKeydown,
      formatter,
      currentIndex,
      actualMin,
      actualMax,
      actualInterval,
    };
  },
});
