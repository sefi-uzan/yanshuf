import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'node:path';
import { copyMainExternals } from './scripts/copy-main-externals';
import { copyMcpBundle, packagedResourcesDir } from './scripts/copy-mcp-bundle';

const entitlementsPath = path.resolve(__dirname, 'entitlements.plist');

const signingConfig = process.env.APPLE_SIGNING_IDENTITY
  ? {
      osxSign: {
        identity: process.env.APPLE_SIGNING_IDENTITY,
        hardenedRuntime: true,
        entitlements: entitlementsPath,
        'entitlements-inherit': entitlementsPath,
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID!,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
    }
  : {};

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Yanshuf',
    appBundleId: 'com.yanshuf.app',
    icon: path.resolve(__dirname, 'assets/icon'),
    extraResource: [path.resolve(__dirname, 'assets')],
    ...signingConfig,
  },
  rebuildConfig: {},
  hooks: {
    async packageAfterCopy(_forgeConfig, buildPath) {
      copyMainExternals(buildPath, __dirname);
    },
    async postPackage(_forgeConfig, { outputPaths, platform }) {
      if (platform !== 'darwin') return;
      for (const outputPath of outputPaths) {
        copyMcpBundle(packagedResourcesDir(outputPath), __dirname);
      }
    },
  },
  makers: [new MakerDMG({}, ['darwin'])],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'sefi-uzan',
          name: 'yanshuf',
        },
      },
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new AutoUnpackNativesPlugin({}),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
