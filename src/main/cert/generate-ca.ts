import fs from 'node:fs/promises';
import path from 'node:path';
import forge from 'node-forge';
import { CA_COMMON_NAME, CA_ORG_NAME } from './constants';

const { pki, md } = forge;

const CA_ATTRS: forge.pki.CertificateField[] = [
  { name: 'commonName', value: CA_COMMON_NAME },
  { name: 'countryName', value: 'US' },
  { shortName: 'ST', value: 'California' },
  { name: 'localityName', value: 'San Francisco' },
  { name: 'organizationName', value: CA_ORG_NAME },
  { shortName: 'OU', value: 'Root CA' },
];

const CA_EXTENSIONS: Parameters<forge.pki.Certificate['setExtensions']>[0] = [
  { name: 'basicConstraints', cA: true },
  {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true,
  },
  {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true,
  },
  {
    name: 'nsCertType',
    client: true,
    server: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true,
  },
  { name: 'subjectKeyIdentifier' },
];

function randomSerialNumber(): string {
  let sn = '';
  for (let i = 0; i < 4; i++) {
    sn += `00000000${Math.floor(Math.random() * 256 ** 4).toString(16)}`.slice(-8);
  }
  return sn;
}

function generateKeyPair(): Promise<forge.pki.rsa.KeyPair> {
  return new Promise((resolve, reject) => {
    pki.rsa.generateKeyPair({ bits: 2048 }, (err, keys) => {
      if (err) reject(err);
      else resolve(keys);
    });
  });
}

export function sha1HexFromPem(pem: string): string {
  const cert = pki.certificateFromPem(pem);
  const der = forge.asn1.toDer(pki.certificateToAsn1(cert)).getBytes();
  const digest = md.sha1.create();
  digest.update(der);
  return digest.digest().toHex().toUpperCase();
}

export async function readSha1HexFromPemFile(pemPath: string): Promise<string> {
  const pem = await fs.readFile(pemPath, 'utf8');
  return sha1HexFromPem(pem);
}
export function getCaCommonNameFromPem(pem: string): string | undefined {
  try {
    const cert = pki.certificateFromPem(pem);
    const cn = cert.subject.getField('CN');
    return cn?.value;
  } catch {
    return undefined;
  }
}

export async function readCaCommonName(caPemPath: string): Promise<string | undefined> {
  try {
    const pem = await fs.readFile(caPemPath, 'utf8');
    return getCaCommonNameFromPem(pem);
  } catch {
    return undefined;
  }
}

export async function generateCa(certsDir: string): Promise<void> {
  const certsFolder = path.join(certsDir, 'certs');
  const keysFolder = path.join(certsDir, 'keys');
  await fs.mkdir(certsFolder, { recursive: true });
  await fs.mkdir(keysFolder, { recursive: true });
  // The CA private key can decrypt all intercepted TLS — keep it owner-only.
  await fs.chmod(keysFolder, 0o700).catch(() => undefined);

  const keys = await generateKeyPair();
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerialNumber();
  cert.validity.notBefore = new Date();
  cert.validity.notBefore.setDate(cert.validity.notBefore.getDate() - 1);
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
  cert.setSubject(CA_ATTRS);
  cert.setIssuer(CA_ATTRS);
  cert.setExtensions(CA_EXTENSIONS);
  cert.sign(keys.privateKey, md.sha256.create());

  await Promise.all([
    fs.writeFile(path.join(certsFolder, 'ca.pem'), pki.certificateToPem(cert)),
    fs.writeFile(path.join(keysFolder, 'ca.private.key'), pki.privateKeyToPem(keys.privateKey), {
      mode: 0o600,
    }),
    fs.writeFile(path.join(keysFolder, 'ca.public.key'), pki.publicKeyToPem(keys.publicKey)),
  ]);
}

export async function caFilesExist(certsDir: string): Promise<boolean> {
  try {
    await fs.access(path.join(certsDir, 'certs', 'ca.pem'));
    return true;
  } catch {
    return false;
  }
}
