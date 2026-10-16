import { io, Socket } from 'socket.io-client';

const href = window.location.href;
const params = new URLSearchParams(href.split('?')[1]);
let socket: Socket | undefined;
try {
  const port = params.get('port');
  if (port && parseInt(port, 10) !== 0) {
    const host = `http://127.0.0.1:${port}`;
    socket = io(host, {
      transports: ['websocket'],
    });
  } else {
    console.log('offline mode.');
  }
} catch (e) {
  console.log(e);
}

const debug = document.getElementById('debug'); // DEBUG時に使う用

const image = document.getElementById('image') as HTMLImageElement;
const mouth = document.getElementById('mouth') as HTMLImageElement;
const eyes = document.getElementById('eyes') as HTMLImageElement;

let active = false;
function setActive(a: boolean) {
  if (active !== a) {
    active = a;
    if (socket) {
      socket.emit('active', active);
    }
  }
}

setActive(document.visibilityState === 'visible');
addEventListener('visibilitychange', () => {
  console.log('visibilitychange', document.visibilityState);
  setActive(document.visibilityState === 'visible');
});

// Style configuration
type AvatarStyle = 'standing1' | 'standing2';
const style: AvatarStyle = (params.get('style') as AvatarStyle) || 'standing1';

interface SingleLayerStyleConfig {
  useLayeredImages: false;
  imageFilenames: Record<string, string>;
  blinkSequence: string[];
  defaultImages: string[];
}

interface LayeredStyleConfig {
  useLayeredImages: true;
  imageFilenames: Record<string, string>;
  mouthFilenames: Record<string, string>;
  eyesFilenames: {
    idle: string;
    read: string;
    closedIdle: string;
    closedRead: string;
  };
  blinkSequence: string[];
  defaultImages: string[];
}

type StyleConfig = SingleLayerStyleConfig | LayeredStyleConfig;

const styleConfigs: Record<AvatarStyle, StyleConfig> = {
  standing1: {
    useLayeredImages: false,
    imageFilenames: {
      default: 'standing1/default.png',
      smile: 'standing1/smile.png',
      a: 'standing1/a.png',
      i: 'standing1/i.png',
      I: 'standing1/i.png',
      u: 'standing1/u.png',
      U: 'standing1/u.png',
      w: 'standing1/u.png',
      e: 'standing1/e.png',
      o: 'standing1/o.png',
      m: 'standing1/m.png',
      p: 'standing1/m.png',
      b: 'standing1/m.png',
      silE: 'standing1/m.png',
    },
    blinkSequence: ['A', 'B', 'C', 'B', 'A'],
    defaultImages: ['standing1/default.png', 'standing1/smile.png'],
  },
  standing2: {
    useLayeredImages: true,
    imageFilenames: {
      base: 'standing2/base.png',
    },
    mouthFilenames: {
      default: 'standing2/mouth_default.png',
      smile: 'standing2/mouth_smile.png',
      a: 'standing2/mouth_a.png',
      i: 'standing2/mouth_i.png',
      I: 'standing2/mouth_i.png',
      u: 'standing2/mouth_u.png',
      U: 'standing2/mouth_u.png',
      w: 'standing2/mouth_u.png',
      e: 'standing2/mouth_e.png',
      o: 'standing2/mouth_o.png',
      m: 'standing2/mouth_default.png',
      p: 'standing2/mouth_default.png',
      b: 'standing2/mouth_default.png',
      silE: 'standing2/mouth_default.png',
    },
    eyesFilenames: {
      idle: 'standing2/eyes_default.png',
      read: 'standing2/eyes_down.png',
      closedIdle: 'standing2/eyes_closed_smile.png',
      closedRead: 'standing2/eyes_closed_down.png',
    },
    blinkSequence: ['A', 'B', 'A'],
    defaultImages: ['standing2/mouth_default.png', 'standing2/mouth_smile.png'],
  },
};

const config = styleConfigs[style];

// Initialize images based on style
if (config.useLayeredImages) {
  // standing2: layered mode
  image.src = config.imageFilenames.base;
  mouth.hidden = false;
  mouth.src = config.defaultImages[Math.floor(Math.random() * config.defaultImages.length)];
  eyes.hidden = false;
  eyes.src = config.eyesFilenames.idle;
} else {
  // standing1: full-body image mode
  image.src = config.defaultImages[Math.floor(Math.random() * config.defaultImages.length)];
  mouth.hidden = true;
  eyes.hidden = true;
}

const DEFAULT_COOL_TIME_MS = 1000;

let isReading = false;
let t: ReturnType<typeof setTimeout> | undefined;

function timer_set() {
  timer_reset();
  t = setTimeout(() => {
    isReading = false;
    if (config.useLayeredImages) {
      // standing2: reset mouth to random default
      const randomMouth = config.defaultImages[Math.floor(Math.random() * config.defaultImages.length)];
      mouth.src = randomMouth;
      // Update eyes to idle state
      eyes.src = config.eyesFilenames.idle;
    } else {
      // standing1: reset to random full-body image
      const randomImage = config.defaultImages[Math.floor(Math.random() * config.defaultImages.length)];
      image.src = randomImage;
    }
    t = undefined;
  }, DEFAULT_COOL_TIME_MS);
}

function timer_reset() {
  if (t) {
    clearTimeout(t);
    t = undefined;
  }
}

if (socket) {
  socket.on('phoneme', (phoneme: string) => {
    if (!active) {
      return;
    }
    console.log('phoneme', phoneme);

    if (config.useLayeredImages) {
      // standing2: update mouth layer and set reading state
      isReading = true;
      if (config.mouthFilenames[phoneme]) {
        mouth.src = config.mouthFilenames[phoneme];
      }
      // Update eyes to reading state
      eyes.src = config.eyesFilenames.read;
    } else {
      // standing1: update full-body image
      if (config.imageFilenames[phoneme as keyof typeof config.imageFilenames]) {
        image.src = config.imageFilenames[phoneme as keyof typeof config.imageFilenames];
      }
    }

    timer_set();
  });
}

// Blinking animation
let blinkIndex = -1;
const BLINK_FRAME_MS = 100;
const BLINK_INTERVAL_MS = 5000;

setInterval(() => {
  if (active) {
    const blink = () => {
      ++blinkIndex;
      if (blinkIndex < config.blinkSequence.length) {
        if (config.useLayeredImages) {
          // standing2: 3-frame blink (A-B-A) with state-aware eyes
          if (config.blinkSequence[blinkIndex] === 'B') {
            // Closed eyes
            eyes.src = isReading ? config.eyesFilenames.closedRead : config.eyesFilenames.closedIdle;
          } else {
            // Open eyes
            eyes.src = isReading ? config.eyesFilenames.read : config.eyesFilenames.idle;
          }
        } else {
          // standing1: 5-frame blink (A-B-C-B-A) with overlay
          const isDefaultOrSmile = image.src.endsWith('default.png') || image.src.endsWith('smile.png');
          eyes.src = `standing1/SD_${isDefaultOrSmile ? 'default' : 'read'}_${config.blinkSequence[blinkIndex]}.png`;
          eyes.hidden = false;
        }
        setTimeout(blink, BLINK_FRAME_MS);
      } else {
        if (!config.useLayeredImages) {
          // standing1: hide eyes overlay after blink
          eyes.hidden = true;
        }
        // standing2: eyes stay visible (already set to correct state)
        blinkIndex = -1;
      }
    };
    setTimeout(blink, BLINK_FRAME_MS);
  }
}, BLINK_INTERVAL_MS);
