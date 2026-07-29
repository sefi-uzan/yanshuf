import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'node:path';
import { copyMainExternals } from './scripts/copy-main-externals';
import { copyMcpBundle, stagedResourcesDir } from './scripts/copy-mcp-bundle';
import { notarizeAndStapleDmg, notarizeCredentialsFromEnv } from './scripts/notarize-dmg';

const entitlementsPath = path.resolve(__dirname, 'entitlements.plist');
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY;

const signingConfig = signingIdentity
  ? {
      osxSign: {
        identity: signingIdentity,
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

const dmgConfig = signingIdentity
  ? { additionalDMGOptions: { 'code-sign': { 'signing-identity': signingIdentity } } }
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
    async packageAfterCopy(_forgeConfig, buildPath, _electronVersion, platform) {
      copyMainExternals(buildPath, __dirname);
      if (platform !== 'darwin') return;
      // Anything written into Contents/Resources after @electron/packager signs the
      // bundle breaks the sealed resource manifest, so stage the bundle here instead of
      // in a post-package hook.
      copyMcpBundle(stagedResourcesDir(buildPath), __dirname);
    },
    async postMake(_forgeConfig, makeResults) {
      const credentials = notarizeCredentialsFromEnv();
      if (!signingIdentity || !credentials) return makeResults;

      for (const result of makeResults) {
        if (result.platform !== 'darwin') continue;
        for (const artifact of result.artifacts.filter((file) => file.endsWith('.dmg'))) {
          await notarizeAndStapleDmg(artifact, credentials);
        }
      }

      return makeResults;
    },
  },
  makers: [new MakerDMG(dmgConfig, ['darwin'])],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'sefi-uzan',
          name: 'yanshuf',
        },
        // Kept as a draft so the release workflow can attach every architecture before
        // the updater, which reads /releases/latest, is able to see the release.
        draft: true,
        generateReleaseNotes: true,
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
