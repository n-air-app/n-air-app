import { Subscription } from 'rxjs';
import { AudioSource } from 'services/audio';
import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';

// Configuration
const CHANNEL_HEIGHT = 4;
const PADDING_HEIGHT = 4;
const PEAK_WIDTH = 4;
const PEAK_HOLD_CYCLES = 100;
const WARNING_LEVEL = -20;
const DANGER_LEVEL = -9;

// Colors
const GREEN = 'rgba(0,224,79, .4)';
const GREEN_BG = 'rgba(1,85,49, .4)';
const YELLOW = 'rgba(181,224,79, .4)';
const YELLOW_BG = 'rgba(65,85,49, .4)';
const RED = 'rgba(255,31,79, .4)';
const RED_BG = 'rgba(65,20,49, .4)';
const ADVANCED_BG = '#050e18';

@Component({})
export default class MixerVolmeter extends Vue {
  @Prop() audioSource!: AudioSource;

  private volmeterSubscription?: Subscription;

  $refs!: {
    canvas: HTMLCanvasElement;
    spacer: HTMLDivElement;
  };

  private ctx!: CanvasRenderingContext2D;

  private peakHoldCounters: number[] = [];
  private peakHolds: number[] = [];
  private canvasWidth = 0;
  private channelCount = 0;
  private canvasHeight = 0;

  private previousPeaks: number[] = [];
  private previousPeakHolds: number[] = [];
  private hasDrawn = false;

  private resizeObserver?: ResizeObserver;

  mounted(): void {
    this.ctx = this.$refs.canvas.getContext('2d')!;
    this.setChannelCount(1);
    this.updateCanvasWidth();
    this.subscribeVolmeter();

    // ResizeObserverでサイズ変更を監視
    this.resizeObserver = new ResizeObserver(() => this.updateCanvasWidth());

    const parentElement = this.$refs.canvas.parentElement;
    if (parentElement) this.resizeObserver.observe(parentElement);
  }

  destroyed(): void {
    // ResizeObserverの監視を停止
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.unsubscribeVolmeter();
  }

  private setChannelCount(channels: number): void {
    if (channels === this.channelCount) return;

    this.channelCount = channels;
    this.canvasHeight = channels * (CHANNEL_HEIGHT + PADDING_HEIGHT) - PADDING_HEIGHT;
    this.$refs.canvas.height = this.canvasHeight;
    this.$refs.canvas.style.height = `${this.canvasHeight}px`;
    this.$refs.spacer.style.height = `${this.canvasHeight}px`;

    this.peakHoldCounters = Array(channels).fill(0);
    this.peakHolds = Array(channels).fill(-65535);
    this.previousPeaks = Array(channels).fill(-65535);
    this.previousPeakHolds = Array(channels).fill(-65535);
  }

  private updateCanvasWidth(): void {
    const parentElement = this.$refs.canvas.parentElement;
    if (!parentElement) return;

    const width = Math.floor(parentElement.offsetWidth);
    if (width === this.canvasWidth) return;

    this.canvasWidth = width;
    this.$refs.canvas.width = width;
    this.$refs.canvas.style.width = `${width}px`;
    this.hasDrawn = false;

    // キャッシュを更新
    this.recalculatePixelCache();
  }

  private recalculatePixelCache(): void {
    this.warningPx = this.convertDbToPixels(WARNING_LEVEL);
    this.dangerPx = this.convertDbToPixels(DANGER_LEVEL);
  }

  private drawVolmeter(peaks: number[]): void {
    this.ctx.fillStyle = ADVANCED_BG;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    peaks.forEach((peak, channel) => {
      this.drawVolmeterChannel(peak, channel);
    });
  }

  // キャッシュ用プロパティ
  private warningPx = 0;
  private dangerPx = 0;

  private drawVolmeterChannel(peak: number, channel: number): void {
    const heightOffset = channel * (CHANNEL_HEIGHT + PADDING_HEIGHT);
    const peakPx = this.convertDbToPixels(peak);

    // 背景描画
    this.drawChannelBackground(heightOffset);

    // ピークレベル描画
    this.drawPeakLevel(peak, peakPx, heightOffset);

    // ピークホールド描画
    this.drawPeakHold(channel, heightOffset);
  }

  private drawChannelBackground(heightOffset: number): void {
    this.ctx.fillStyle = GREEN_BG;
    this.ctx.fillRect(0, heightOffset, this.warningPx, CHANNEL_HEIGHT);
    this.ctx.fillStyle = YELLOW_BG;
    this.ctx.fillRect(this.warningPx, heightOffset, this.dangerPx - this.warningPx, CHANNEL_HEIGHT);
    this.ctx.fillStyle = RED_BG;
    this.ctx.fillRect(
      this.dangerPx,
      heightOffset,
      this.canvasWidth - this.dangerPx,
      CHANNEL_HEIGHT,
    );
  }

  private drawPeakLevel(peak: number, peakPx: number, heightOffset: number): void {
    // Green level
    const greenLevel = Math.min(peakPx, this.warningPx);
    if (greenLevel <= 0) return;

    this.ctx.fillStyle = GREEN;
    this.ctx.fillRect(0, heightOffset, greenLevel, CHANNEL_HEIGHT);

    // Yellow level
    if (peak <= WARNING_LEVEL) return;

    const yellowLevel = Math.min(peakPx, this.dangerPx);
    this.ctx.fillStyle = YELLOW;
    this.ctx.fillRect(this.warningPx, heightOffset, yellowLevel - this.warningPx, CHANNEL_HEIGHT);

    // Red level
    if (peak <= DANGER_LEVEL) return;

    this.ctx.fillStyle = RED;
    this.ctx.fillRect(this.dangerPx, heightOffset, peakPx - this.dangerPx, CHANNEL_HEIGHT);
  }

  private drawPeakHold(channel: number, heightOffset: number): void {
    const peakHold = this.peakHolds[channel];

    let color = GREEN;
    if (peakHold > DANGER_LEVEL) color = RED;
    else if (peakHold > WARNING_LEVEL) color = YELLOW;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      this.convertDbToPixels(peakHold) - PEAK_WIDTH / 2,
      heightOffset,
      PEAK_WIDTH,
      CHANNEL_HEIGHT,
    );
  }

  private convertDbToPixels(db: number): number {
    return Math.round((db + 60) * (this.canvasWidth / 60));
  }

  private updatePeakHold(peak: number, channel: number): void {
    if (this.peakHoldCounters[channel] === 0 || peak > this.peakHolds[channel]) {
      this.peakHolds[channel] = peak;
      this.peakHoldCounters[channel] = PEAK_HOLD_CYCLES;
      return;
    }

    this.peakHoldCounters[channel] = Math.max(0, this.peakHoldCounters[channel] - 1);
  }

  private checkPeaks(peaks: number[]): boolean {
    if (peaks.length !== this.channelCount) {
      this.hasDrawn = false;
      return false;
    }

    let changed = false;
    peaks.forEach((peak, channel) => {
      this.updatePeakHold(peak, channel);

      // 変化がなければ再描画しない
      if (
        peak !== this.previousPeaks[channel] ||
        this.peakHolds[channel] !== this.previousPeakHolds[channel]
      )
        changed = true;

      this.previousPeaks[channel] = peak;
      this.previousPeakHolds[channel] = this.peakHolds[channel];
    });

    return !changed && this.hasDrawn;
  }

  private subscribeVolmeter(): void {
    this.volmeterSubscription = this.audioSource
      .getVolmeterStream()
      .subscribe(volmeter => {
        if (this.checkPeaks(volmeter.peak)) return;
        this.setChannelCount(volmeter.peak.length);
        this.drawVolmeter(volmeter.peak);
        this.hasDrawn = true;
      });
  }

  private unsubscribeVolmeter(): void {
    if (this.volmeterSubscription) this.volmeterSubscription.unsubscribe();
  }
}
