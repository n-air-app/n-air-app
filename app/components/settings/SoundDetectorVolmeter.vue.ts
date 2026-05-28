import { Subscription } from 'rxjs';
import { AudioSource } from 'services/audio';
import { defineComponent } from 'vue';

// Configuration
const CHANNEL_HEIGHT = 4;
const PADDING_HEIGHT = 4;
const WARNING_LEVEL = -20;
const DANGER_LEVEL = -9;
const MIN_DB = -60; // Minimum dB level displayed on the meter
const MAX_DB = 0; // Maximum dB level displayed on the meter

// Colors
const GREEN = 'rgba(0,224,79, .4)';
const GREEN_BG = 'rgba(1,85,49, .4)';
const YELLOW = 'rgba(181,224,79, .4)';
const YELLOW_BG = 'rgba(65,85,49, .4)';
const RED = 'rgba(255,31,79, .4)';
const RED_BG = 'rgba(65,20,49, .4)';
const ADVANCED_BG = '#050e18';

export default defineComponent({
  name: 'SoundDetectorVolmeter',
  props: {
    audioSource: { type: Object as () => AudioSource, required: true },
    threshold: { type: Number, default: -19 },
    enabled: { type: Boolean, default: true },
  },
  data() {
    return {
      volmeterSubscription: undefined as Subscription | undefined,
      ctx: null as CanvasRenderingContext2D | null,
      canvasWidth: 0,
      channelCount: 0,
      canvasHeight: 0,
      previousPeaks: [] as number[],
      hasDrawn: false,
      resizeObserver: undefined as ResizeObserver | undefined,
      warningPx: 0,
      dangerPx: 0,
      thresholdPx: 0,
    };
  },
  computed: {
    sourceName(): string {
      return this.audioSource.name;
    },
  },
  watch: {
    threshold() {
      this.thresholdPx = this.convertDbToPixelsWithClipping(this.threshold);
      this.hasDrawn = false;
    },
    enabled(enabled: boolean) {
      if (enabled) {
        this.subscribeVolmeter();
      } else {
        this.unsubscribeVolmeter();
        this.drawVolmeter([-Infinity]);
        this.hasDrawn = false;
      }
    },
  },
  mounted(): void {
    this.ctx = (this.$refs.canvas as HTMLCanvasElement).getContext('2d')!;
    this.setChannelCount(1);
    this.updateCanvasWidth();
    if (this.enabled) {
      this.subscribeVolmeter();
    } else {
      this.drawVolmeter([-Infinity]);
    }

    this.resizeObserver = new ResizeObserver(() => this.updateCanvasWidth());
    const parentElement = (this.$refs.canvas as HTMLCanvasElement).parentElement;
    if (parentElement) this.resizeObserver.observe(parentElement);
  },
  unmounted(): void {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.unsubscribeVolmeter();
  },
  methods: {
    setChannelCount(channels: number): void {
      if (channels === this.channelCount) return;

      this.channelCount = channels;
      this.canvasHeight = channels * (CHANNEL_HEIGHT + PADDING_HEIGHT) - PADDING_HEIGHT;
      const canvas = this.$refs.canvas as HTMLCanvasElement;
      const spacer = this.$refs.spacer as HTMLDivElement;
      canvas.height = this.canvasHeight;
      canvas.style.height = `${this.canvasHeight}px`;
      spacer.style.height = `${this.canvasHeight}px`;

      this.previousPeaks = Array(channels).fill(-65535);
    },
    updateCanvasWidth(): void {
      const canvas = this.$refs.canvas as HTMLCanvasElement | undefined;
      if (!canvas) return;
      const parentElement = canvas.parentElement;
      if (!parentElement) return;

      const width = Math.floor(parentElement.offsetWidth);
      if (width === this.canvasWidth) return;

      this.canvasWidth = width;
      canvas.width = width;
      canvas.style.width = `${width}px`;
      this.hasDrawn = false;

      this.recalculatePixelCache();
    },
    recalculatePixelCache(): void {
      this.warningPx = this.convertDbToPixels(WARNING_LEVEL);
      this.dangerPx = this.convertDbToPixels(DANGER_LEVEL);
      this.thresholdPx = this.convertDbToPixelsWithClipping(this.threshold);
    },
    convertDbToPixelsWithClipping(db: number): number {
      const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, db));
      return this.convertDbToPixels(clampedDb);
    },
    drawVolmeter(peaks: number[]): void {
      this.ctx!.fillStyle = ADVANCED_BG;
      this.ctx!.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

      peaks.forEach((peak: number, channel: number) => {
        this.drawVolmeterChannel(peak, channel);
      });

      this.drawThresholdLine();
    },
    drawVolmeterChannel(peak: number, channel: number): void {
      const heightOffset = channel * (CHANNEL_HEIGHT + PADDING_HEIGHT);
      const peakPx = this.convertDbToPixels(peak);

      this.drawChannelBackground(heightOffset);
      this.drawPeakLevel(peak, peakPx, heightOffset);
    },
    drawChannelBackground(heightOffset: number): void {
      this.ctx!.fillStyle = GREEN_BG;
      this.ctx!.fillRect(0, heightOffset, this.warningPx, CHANNEL_HEIGHT);
      this.ctx!.fillStyle = YELLOW_BG;
      this.ctx!.fillRect(this.warningPx, heightOffset, this.dangerPx - this.warningPx, CHANNEL_HEIGHT);
      this.ctx!.fillStyle = RED_BG;
      this.ctx!.fillRect(this.dangerPx, heightOffset, this.canvasWidth - this.dangerPx, CHANNEL_HEIGHT);
    },
    drawPeakLevel(peak: number, peakPx: number, heightOffset: number): void {
      const greenLevel = Math.min(peakPx, this.warningPx);
      if (greenLevel <= 0) return;

      this.ctx!.fillStyle = GREEN;
      this.ctx!.fillRect(0, heightOffset, greenLevel, CHANNEL_HEIGHT);

      if (peak <= WARNING_LEVEL) return;

      const yellowLevel = Math.min(peakPx, this.dangerPx);
      this.ctx!.fillStyle = YELLOW;
      this.ctx!.fillRect(this.warningPx, heightOffset, yellowLevel - this.warningPx, CHANNEL_HEIGHT);

      if (peak <= DANGER_LEVEL) return;

      this.ctx!.fillStyle = RED;
      this.ctx!.fillRect(this.dangerPx, heightOffset, peakPx - this.dangerPx, CHANNEL_HEIGHT);
    },
    drawThresholdLine(): void {
      this.ctx!.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx!.lineWidth = 4;
      this.ctx!.beginPath();
      this.ctx!.moveTo(this.thresholdPx, 0);
      this.ctx!.lineTo(this.thresholdPx, this.canvasHeight);
      this.ctx!.stroke();

      this.ctx!.strokeStyle = 'rgba(255, 255, 255, 1.0)';
      this.ctx!.lineWidth = 2;
      this.ctx!.beginPath();
      this.ctx!.moveTo(this.thresholdPx, 0);
      this.ctx!.lineTo(this.thresholdPx, this.canvasHeight);
      this.ctx!.stroke();
    },
    convertDbToPixels(db: number): number {
      const dbRange = MAX_DB - MIN_DB;
      return Math.round((db - MIN_DB) * (this.canvasWidth / dbRange));
    },
    checkPeaks(peaks: number[]): boolean {
      if (peaks.length !== this.channelCount) {
        this.hasDrawn = false;
        return false;
      }

      let changed = false;
      peaks.forEach((peak: number, channel: number) => {
        if (peak !== this.previousPeaks[channel]) changed = true;
        this.previousPeaks[channel] = peak;
      });

      return !changed && this.hasDrawn;
    },
    subscribeVolmeter(): void {
      this.volmeterSubscription = this.audioSource
        .getVolmeterStream()
        .subscribe((volmeter: any) => {
          const maxPeak = volmeter.peak.length > 0
            ? Math.max(...volmeter.peak)
            : -Infinity;
          const singlePeak = [maxPeak];

          if (this.checkPeaks(singlePeak)) return;
          this.setChannelCount(1);
          this.drawVolmeter(singlePeak);
          this.hasDrawn = true;
        });
    },
    unsubscribeVolmeter(): void {
      if (this.volmeterSubscription) this.volmeterSubscription.unsubscribe();
    },
  },
});
