import Link from 'next/link';
import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';
import { LegalLayout } from '@/components/legal-layout';
import { navLinks } from '@/lib/site-config';

export const metadata: Metadata = createMetadata({
  title: 'Security Policy',
  description:
    'How Yanshuf decrypts HTTPS on your Mac, what the root certificate does, and how to report a security problem.',
  path: '/security',
});

export default function SecurityPage() {
  return (
    <LegalLayout title="Security Policy" updated="July 29, 2026">
      <section>
        <h2>Trust model</h2>
        <p>
          Yanshuf is a <strong>local</strong> network debugging tool. It behaves like other MITM proxies (Charles,
          mitmproxy, Proxyman): to inspect HTTPS, you install a root certificate that Yanshuf controls on your Mac.
          Read this before installing the certificate or routing production traffic through Yanshuf.
        </p>
      </section>

      <section>
        <h2>What Yanshuf can do on your Mac</h2>
        <p>When capture is enabled, Yanshuf can:</p>
        <ul>
          <li>Route selected system or app traffic through a local proxy on 127.0.0.1</li>
          <li>Terminate TLS and decrypt HTTPS for traffic that passes through the proxy</li>
          <li>Read, display, modify, and replay request and response data in the app</li>
          <li>
            Expose a local MCP API (for AI tool integration) on 127.0.0.1, protected by a token stored in your
            user data directory
          </li>
        </ul>
        <p>
          Yanshuf does <strong>not</strong> upload captured traffic to Yanshuf servers. There is no built-in
          analytics or telemetry.
        </p>
      </section>

      <section>
        <h2>The root certificate</h2>
        <p>
          On first launch, Yanshuf generates a <strong>Yanshuf Root CA</strong> in your local app data. When you
          choose Install &amp; Trust Certificate, macOS adds it to your login keychain as a trusted root.
        </p>
        <ul>
          <li>Any HTTPS connection routed through Yanshuf can be decrypted and inspected on your machine</li>
          <li>Only trust certificates from builds you intentionally installed</li>
          <li>Do not install the certificate on shared or untrusted machines</li>
          <li>Turn capture off and remove the certificate when you are done debugging</li>
        </ul>
        <h3>Remove the certificate</h3>
        <ol>
          <li>Open Yanshuf → Settings → Certificate</li>
          <li>Use Remove certificate / Reset if available, or</li>
          <li>
            Open Keychain Access → login → Certificates, find Yanshuf Root CA, and delete it
          </li>
        </ol>
        <p>
          Also disable the system proxy under System Settings → Network → … → Proxies if Yanshuf is not running.
        </p>
      </section>

      <section>
        <h2>Verify you have an official build</h2>
        <p>
          Install Yanshuf from{' '}
          <a href={navLinks.download} target="_blank" rel="noopener noreferrer">
            GitHub Releases
          </a>
          , not from unverified third-party mirrors.
        </p>
        <p>Official releases are:</p>
        <ul>
          <li>Signed with a Developer ID certificate</li>
          <li>Notarized by Apple</li>
          <li>Published from this repository&apos;s release workflow</li>
        </ul>
        <p>
          Gatekeeper should open them without xattr workarounds. If macOS warns about an unidentified developer, do
          not proceed — download the release again from GitHub.
        </p>
        <p>
          In-app updates download from the same GitHub release feed and apply only after you click Restart &amp;
          update.
        </p>
      </section>

      <section>
        <h2>Data storage</h2>
        <p>
          Captured sessions, rules, certificates, and settings are stored locally in Yanshuf&apos;s application
          data on your Mac. Export or copy features share data only when you use them.
        </p>
        <p>
          The MCP integration writes a local auth token so editor tools on your machine can talk to the running
          app. That API listens on localhost only.
        </p>
      </section>

      <section>
        <h2>Supported versions</h2>
        <p>Security fixes are provided for the latest release only.</p>
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Supported</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Latest release</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>Older releases</td>
              <td>No</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Reporting a vulnerability</h2>
        <p>If you believe you have found a security issue in Yanshuf, please report it privately.</p>
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:sefiuzan812@gmail.com">sefiuzan812@gmail.com</a>
        </p>
        <p>Please include:</p>
        <ul>
          <li>A description of the issue and the impact you believe it has</li>
          <li>Steps to reproduce, if applicable</li>
          <li>Your Yanshuf version and macOS version (including arm64 or x64)</li>
        </ul>
        <p>Do not open a public GitHub issue for undisclosed security vulnerabilities.</p>
        <p>
          We aim to acknowledge reports within a few business days and will work with you on a fix and coordinated
          disclosure when appropriate.
        </p>
      </section>

      <section>
        <h2>Related</h2>
        <p>
          See also our <Link href="/privacy">Privacy Policy</Link> and{' '}
          <Link href="/terms">Terms of Use</Link>.
        </p>
      </section>
    </LegalLayout>
  );
}
