import { io, Socket } from 'socket.io-client';

const href = window.location.href;
const params = new URLSearchParams(href.split('?')[1]);
let socket: Socket | undefined;
try {
  const port = params.get('port');
  if (port && parseInt(port, 10) !== 0) {
    const host = `http://localhost:${port}`;
    socket = io(host);
  } else {
    console.log('offline mode.');
  }
} catch (e) {
  console.log(e);
}

const debug = document.getElementById('debug'); // DEBUG時に使う用

const image = document.getElementById('image') as HTMLImageElement;
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

const IMAGE_FILENAMES = {
  default: 'default.png',
  smile: 'smile.png',

  a: 'a.png',

  i: 'i.png',
  I: 'i.png',

  u: 'u.png',
  U: 'u.png',
  w: 'u.png',

  e: 'e.png',

  o: 'o.png',

  m: 'm.png',
  p: 'm.png',
  b: 'm.png',
  silE: 'm.png',
};
const DEFAULT_COOL_TIME_MS = 1000;

// デフォルト状態に戻る際にdefault.pngとsmile.pngをランダムで選択
const DEFAULT_IMAGES = [IMAGE_FILENAMES.default, IMAGE_FILENAMES.smile];

let t: ReturnType<typeof setTimeout> | undefined;
function timer_set() {
  timer_reset();
  t = setTimeout(() => {
    const randomImage = DEFAULT_IMAGES[Math.floor(Math.random() * DEFAULT_IMAGES.length)];
    image.src = randomImage;
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
    if (IMAGE_FILENAMES[phoneme as keyof typeof IMAGE_FILENAMES]) {
      image.src = IMAGE_FILENAMES[phoneme as keyof typeof IMAGE_FILENAMES];
    }
    timer_set();
  });
}

let blinkIndex = -1;
const blinkSequence = ['A', 'B', 'C', 'B', 'A'];
const BLINK_FRAME_MS = 100;
const BLINK_INTERVAL_MS = 5000;

setInterval(() => {
  if (active) {
    const blink = () => {
      // default.pngまたはsmile.pngの場合はSD_default_*.pngを使用
      const isDefaultOrSmile = image.src.endsWith('default.png') || image.src.endsWith('smile.png');
      ++blinkIndex;
      if (blinkIndex < blinkSequence.length) {
        eyes.src = `SD_${isDefaultOrSmile ? 'default' : 'read'}_${blinkSequence[blinkIndex]}.png`;
        eyes.hidden = false;
        setTimeout(blink, BLINK_FRAME_MS);
      } else {
        eyes.hidden = true;
        blinkIndex = -1;
      }
    };
    setTimeout(blink, BLINK_FRAME_MS);
  }
}, BLINK_INTERVAL_MS);
