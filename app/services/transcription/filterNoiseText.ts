export function filterNoiseText(text: string): string {
  const noisePatterns = [/^え(ー|ーっ|っ)と/, /^ん/];
  // const noisePatterns = [/^えーと/, /^えーっと/, /^えっと/];
  for (const pattern of noisePatterns) {
    if (pattern.test(text)) {
      text = text.replace(pattern, '').trim();
      break; // 一つでもマッチしたら終了
    }
  }
  return text;
}
