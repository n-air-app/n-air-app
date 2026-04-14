// Dev environment host configuration
// Injected at compile time via webpack DefinePlugin (DEV_HOSTS_CONFIG).
// When not configured (production builds), all functions return production defaults.
//
// Configuration file format (in private repository):
// {
//   "domainMap": { "nicovideo.jp": "dev.example.jp" },  // base domain suffix replacement
//   "overrides": { "https://api.live2.nicovideo.jp": "https://other.example.jp" }, // per-URL override (takes priority)
//   "cookieDomain": ".dev.example.jp"
// }
//
// Replacement order:
// 1. overrides: longest-prefix-first match, replaces prefix and keeps the rest of the path
// 2. domainMap: replaces matching domain suffix in hostname

declare const DEV_HOSTS_CONFIG:
  | {
      domainMap?: Record<string, string>;
      overrides?: Record<string, string>;
      cookieDomain?: string;
    }
  | null
  | undefined;

type DevHostsConfig = NonNullable<typeof DEV_HOSTS_CONFIG>;

const config: DevHostsConfig | null =
  typeof DEV_HOSTS_CONFIG !== 'undefined' ? DEV_HOSTS_CONFIG : null;

export function transformUrl(url: string): string {
  if (!config) return url;

  // 1. overrides: longest prefix match takes priority
  if (config.overrides) {
    const sortedPrefixes = Object.keys(config.overrides).sort((a, b) => b.length - a.length);
    for (const prefix of sortedPrefixes) {
      if (url.startsWith(prefix)) {
        return config.overrides[prefix] + url.slice(prefix.length);
      }
    }
  }

  // 2. domainMap: replace matching suffix in hostname
  if (config.domainMap) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      for (const [prodDomain, devDomain] of Object.entries(config.domainMap)) {
        if (hostname === prodDomain || hostname.endsWith('.' + prodDomain)) {
          urlObj.hostname = hostname.slice(0, hostname.length - prodDomain.length) + devDomain;
          return urlObj.toString();
        }
      }
    } catch {
      // not a parseable URL, return as-is
    }
  }

  return url;
}

export function getCookieDomain(): string {
  return config?.cookieDomain ?? '.nicovideo.jp';
}

export function isDevHosts(): boolean {
  return config !== null;
}

export function getPartitionName(): string | undefined {
  return config ? 'persist:dev-hosts' : undefined;
}
