export const CA_COMMON_NAME = 'Yanshuf Root CA';
export const CA_ORG_NAME = 'Yanshuf';
export const CA_EXPORT_FILENAME = 'Yanshuf-Root-CA.cer';

export const KEYCHAIN_ACCESS = '/System/Applications/Utilities/Keychain Access.app';
export const INSTALL_CER_PATH = '/tmp/yanshuf-root-ca.cer';

/** Admin trust domain. Trusting a root here decrypts HTTPS system-wide without a manual step. */
export const SYSTEM_KEYCHAIN = '/Library/Keychains/System.keychain';
