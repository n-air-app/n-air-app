const { VueLoaderPlugin } = require('vue-loader');
const ESLintPlugin = require('eslint-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const DefinePlugin = require('webpack').DefinePlugin;
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

const path = require('node:path');
const fs = require('node:fs');

const package = require('./package.json');

/**
 * Load dev hosts config from .dev-hosts-path based on NAIR_DEV_HOSTS index.
 * NAIR_DEV_HOSTS=N (1-indexed) selects the N-th path in .dev-hosts-path.
 * Returns null if not configured or loading fails.
 */
function loadDevHostsConfig() {
  const n = parseInt(process.env.NAIR_DEV_HOSTS, 10);
  if (!n || n <= 0) return null;
  try {
    const devHostsPathFile = path.join(__dirname, '.dev-hosts-path');
    const lines = fs
      .readFileSync(devHostsPathFile, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    const relPath = lines[n - 1];
    if (!relPath) throw new Error(`.dev-hosts-path has no line ${n}`);
    const fullPath = path.resolve(__dirname, relPath);
    const config = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    console.log(`[dev-hosts] Loaded config from: ${fullPath}`);
    return config;
  } catch (e) {
    console.warn('[dev-hosts] Failed to load config:', e.message);
    return null;
  }
}

const devHostsConfig = loadDevHostsConfig();

// Write dev-hosts.json for main process, or remove stale one.
// This lets `pnpm start` automatically pick up the dev config compiled into the bundle.
const devHostsJsonPath = path.join(__dirname, 'dev-hosts.json');
if (devHostsConfig) {
  fs.writeFileSync(devHostsJsonPath, JSON.stringify(devHostsConfig, null, 2));
  console.log('[dev-hosts] Written dev-hosts.json for main process');
} else {
  fs.rmSync(devHostsJsonPath, { force: true });
  console.log('[dev-hosts] Removed stale dev-hosts.json');
}

function getSentryMiniDumpURLFromDSN(dsn) {
  /*
    const sentryDsn = `https://${params.key}@${params.organization}.ingest.sentry.io/${params.project}`;
    const sentryMiniDumpURL = `https://${params.organization}.ingest.sentry.io/api/${params.project}/minidump/?sentry_key=${params.key}`;
*/

  const re = /https:\/\/([^@]+)@([^/]+)\/(.+)$/;
  const match = dsn.match(re);
  if (!match) return null;
  return `https://${match[2]}/api/${match[3]}/minidump/?sentry_key=${match[1]}`;
}

/** @type function ({production: boolean}, {mode?:string}): import('webpack').Configuration */
module.exports = function (env, argv) {
  const SENTRY_ORG = 'n-air-app2';
  const SENTRY_PROJECT = (() => {
    if (argv.mode === 'production') {
      return package.name === 'n-air-app' ? 'n-air-app' : 'n-air-app-unstable';
    } else {
      return 'n-air-app-dwango';
    }
  })();
  const SentryDSNTable = {
    'n-air-app':
      'https://35a02d8ebec14fd3aadc9d95894fabcf@o4507508755791872.ingest.us.sentry.io/1246812',
    'n-air-app-unstable':
      'https://7451aaa71b7640a69ee1d31d6fd9ef78@o4507508755791872.ingest.us.sentry.io/1546758',
    'n-air-app-dwango':
      'https://1cb5cdf6a93c466dad570861b8c82b61@o4507508755791872.ingest.us.sentry.io/1262580',
  };
  const SENTRY_DSN = SentryDSNTable[SENTRY_PROJECT];
  const SENTRY_MINIDUMP_URL = getSentryMiniDumpURLFromDSN(SENTRY_DSN);

  const isProduction = argv.mode === 'production';
  const definePlugin = new DefinePlugin({
    SENTRY_DSN: JSON.stringify(SENTRY_DSN),
    SENTRY_MINIDUMP_URL: JSON.stringify(SENTRY_MINIDUMP_URL),
    DEV_HOSTS_CONFIG: JSON.stringify(devHostsConfig),
    // Required Vue 3 feature flags
    __VUE_OPTIONS_API__: JSON.stringify(true),
    __VUE_PROD_DEVTOOLS__: JSON.stringify(!isProduction),
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
  });

  const plugins = [];
  plugins.push(definePlugin);
  plugins.push(
    sentryWebpackPlugin({
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: package.version,
      },
      // disable: true, // DEBUG
    }),
  );
  plugins.push(new VueLoaderPlugin());
  plugins.push(new ESLintPlugin({ extensions: ['js', 'ts'], configType: 'flat' }));

  /** @type import('webpack').Configuration */
  const common = {
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
        packageJson: [path.resolve(__dirname, 'package.json')],
        lockfile: [path.resolve(__dirname, 'pnpm-lock.yaml')],
      },
    },
  };

  return [
    {
      ...common,
      output: {
        path: `${__dirname}/bundles`,
        filename: '[name].js',
        publicPath: '/bundles/',
        libraryTarget: 'commonjs2',
      },

      entry: {
        'sentry-defs': './sentry-defs.js',
      },
      plugins: [definePlugin],
      target: 'electron29-main',
    },
    {
      ...common,

      output: {
        path: `${__dirname}/bundles`,
        filename: '[name].js',
        publicPath: '/bundles/',
      },

      entry: {
        renderer: './app/app.ts',
        updater: './updater/ui.js',
      },

      devServer: {
        static: {
          directory: __dirname,
          publicPath: '/',
          watch: {
            // Ignore source directories compiled by webpack — they should trigger
            // webpack HMR, not a static-file live reload before recompilation.
            ignored: [/node_modules/, /[/\\]app[/\\]/, /[/\\]nvoice[/\\]/],
          },
        },
        proxy: [
          {
            context: ['/id'],
            target: 'https://api.id.nicovideo.jp',
            changeOrigin: true,
            pathRewrite: { '^/id': '' },
          },
          {
            context: ['/oauth'],
            target: 'https://oauth.nicovideo.jp',
            changeOrigin: true,
            pathRewrite: { '^/oauth': '' },
          },
          {
            context: ['/blog'],
            target: 'https://blog.nicovideo.jp',
            changeOrigin: true,
            pathRewrite: { '^/blog': '' },
          },
        ],
      },

      devtool: 'source-map',

      target: 'electron29-renderer',

      resolve: {
        extensions: ['.js', '.ts', '.vue'],
        modules: [path.resolve(__dirname, 'app'), 'node_modules'],
      },

      // We want to dynamically require native addons
      externals: {
        'font-manager': 'require("font-manager")',
        'color-picker': 'require("color-picker")',
        'node-fontinfo': 'require("node-fontinfo")',
      },

      module: {
        rules: [
          {
            test: /\.vue$/,
            loader: 'vue-loader',
            options: {
              enableTsInTemplate: false,
              transformAssetUrls: {
                video: ['src', 'poster'],
                source: ['src'],
                img: ['src'],
                image: ['xlink:href', 'href'],
                use: ['xlink:href', 'href'],
              },
            },
          },
          {
            test: /\.ts$/,
            use: [
              {
                loader: 'ts-loader',
                options: {
                  transpileOnly: false,
                  compilerOptions: {
                    sourceMap: true,
                    inlineSources: !isProduction,
                    sourceRoot: '',
                  },
                },
              },
            ],
            exclude: /node_modules|vue\/src/,
          },
          {
            test: /\.js$/,
            loader: 'babel-loader',
            exclude: [/node_modules/, path.join(__dirname, 'bin')],
          },
          {
            test: /\.css$/,
            use: [
              'style-loader',
              {
                loader: 'css-loader',
                options: {
                  importLoaders: 1,
                  esModule: false,
                },
              },
              {
                loader: 'postcss-loader',
                options: {
                  postcssOptions: {
                    plugins: [require('autoprefixer')({ grid: true })],
                  },
                },
              },
            ],
          },
          {
            test: /\.less$/,
            use: [
              'style-loader',
              {
                loader: 'css-loader',
                options: {
                  importLoaders: 1,
                  esModule: false,
                },
              },
              {
                loader: 'postcss-loader',
                options: {
                  postcssOptions: {
                    plugins: [require('autoprefixer')({ grid: true })],
                  },
                },
              },
              'less-loader',
            ],
          },
          {
            test: /\.(png|jpe?g|gif|mp4|mp3|ico|wav|webm)(\?.*)?$/,
            loader: 'file-loader',
            options: {
              name: '[name]-[hash].[ext]',
              outputPath: 'media/',
              publicPath: 'bundles/media/',
              esModule: false,
            },
          },
          // Handles custom fonts. Currently used for icons.
          {
            test: /\.woff$/,
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/',
              publicPath: 'bundles/fonts/',
              esModule: false,
            },
          },
          {
            test: /\.svg$/,
            use: ['vue-loader', path.resolve(__dirname, 'build-utils/svg-loader.js')],
          },
        ],
      },

      optimization: {
        splitChunks: {
          chunks: (chunk) => chunk.name === 'renderer',
          name: 'vendors~renderer',
        },
        chunkIds: 'named',
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              mangle: false,
              compress: { unsafe: false },
              keep_classnames: true,
              keep_fnames: true,
            },
          }),
        ],
      },

      plugins,

      ignoreWarnings: [
        { message: /Can't resolve 'osx-temperature-sensor'/ },
        // protobufjs/src/util/inquire.js uses dynamic require() to try optional deps at runtime
        { module: /protobufjs\/src\/util\/inquire\.js/ },
      ],
    },
    {
      ...common,

      output: {
        path: `${__dirname}/nvoice/near`,
        filename: 'bundle.js',
        publicPath: './',
      },

      entry: {
        bundle: './nvoice/near/src/index.ts',
      },

      target: 'web',
      devtool: argv.mode === 'production' ? false : 'source-map',

      resolve: {
        extensions: ['.ts', '.js'],
      },

      module: {
        rules: [
          {
            test: /\.ts$/,
            loader: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
      },

      plugins: [definePlugin],
    },
  ];
};
