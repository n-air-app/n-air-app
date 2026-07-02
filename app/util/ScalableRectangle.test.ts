import { ScalableRectangle } from './ScalableRectangle';

describe('ScalableRectangle#fitTo', () => {
  // target rect: 16:9, x=100,y=50,width=800,height=450 (aspectRatio = 800/450 = 1.7778)
  const targetRect = { x: 100, y: 50, width: 800, height: 450 };

  test('カメラのアスペクト比が枠と一致する場合、枠にちょうど一致する', () => {
    // 1600x900 (16:9) の実解像度カメラを想定
    const item = new ScalableRectangle({ x: 0, y: 0, width: 1600, height: 900 });

    item.fitTo(new ScalableRectangle(targetRect));

    expect(item.scaleX).toBeCloseTo(0.5);
    expect(item.scaleY).toBeCloseTo(0.5);
    expect(item.x).toBeCloseTo(100);
    expect(item.y).toBeCloseTo(50);
  });

  test('カメラが枠より横長でない(4:3)場合、高さ基準でフィットし左右に均等な余白ができる', () => {
    // 800x600 (4:3) の実解像度カメラを想定
    const item = new ScalableRectangle({ x: 0, y: 0, width: 800, height: 600 });

    item.fitTo(new ScalableRectangle(targetRect));

    expect(item.scaleX).toBeCloseTo(0.75);
    expect(item.scaleY).toBeCloseTo(0.75);
    // 幅は 600 (枠の800より小さい) になるため、左右に (800-600)/2=100 の余白ができ、中央寄せされる
    expect(item.x).toBeCloseTo(200);
    expect(item.y).toBeCloseTo(50);
  });

  test('カメラが枠より横長の場合、幅基準でフィットし上下に均等な余白ができる', () => {
    // 1600x400 (アスペクト比4:1) の実解像度カメラを想定
    const item = new ScalableRectangle({ x: 0, y: 0, width: 1600, height: 400 });

    item.fitTo(new ScalableRectangle(targetRect));

    expect(item.scaleX).toBeCloseTo(0.5);
    expect(item.scaleY).toBeCloseTo(0.5);
    expect(item.x).toBeCloseTo(100);
    // 高さは 200 (枠の450より小さい) になるため、上下に (450-200)/2=125 の余白ができ、中央寄せされる
    expect(item.y).toBeCloseTo(175);
  });
});
