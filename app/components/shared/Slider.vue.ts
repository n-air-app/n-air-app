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
