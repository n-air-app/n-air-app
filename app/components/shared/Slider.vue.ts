import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import VueSlider from 'vue-slider-component';

@Component({
  components: { VueSlider },
})
export default class SliderInput extends Vue {
  @Prop() value: number;
  @Prop() min: number;
  @Prop() max: number;
  @Prop() interval: number;
  @Prop() disabled: boolean;
  @Prop() tooltip: string;
  @Prop() valueBox: boolean;
  @Prop() dotSize: number;
  @Prop() sliderStyle: object;
  @Prop() usePercentages: boolean;

  $refs: { slider: any };

  private resizeObserver?: ResizeObserver;

  mounted() {
    // ResizeObserverでサイズ変更を監視
    this.resizeObserver = new ResizeObserver(() => this.onResizeHandler());
    if (this.$el) this.resizeObserver.observe(this.$el);
  }

  destroyed() {
    // ResizeObserverの監視を停止
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  updateValue(value: number) {
    this.$emit('input', this.roundNumber(this.clampValue(value)));
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.code === 'ArrowUp') {
      event.preventDefault();
      this.updateValue(this.value + this.interval);
    }
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      this.updateValue(this.value - this.interval);
    }
  }

  // Javascript precision is weird
  roundNumber(num: number) {
    return parseFloat(num.toFixed(6));
  }

  clampValue(value: number): number {
    if (Number.isNaN(value)) {
      return this.value;
    }
    return Math.min(Math.max(value, this.min), this.max);
  }

  formatter(value: number) {
    let formattedValue = String(value);
    if (this.usePercentages) formattedValue = Math.round(value * 100) + '%';
    return formattedValue;
  }

  private onResizeHandler() {
    if (this.$refs.slider) this.$refs.slider.refresh();
  }
}
