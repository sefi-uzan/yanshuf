import Link from 'next/link';
import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';
import { LegalLayout } from '@/components/legal-layout';

export const metadata: Metadata = createMetadata({
  title: 'Privacy Policy',
  description:
    'How Yanshuf handles data — local capture on your Mac, no accounts, and what this website collects.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 29, 2026">
      <section>
        <h2>Overview</h2>
        <p>
          Yanshuf is designed as a local-first tool. Network captures, rules, certificates, and settings are
          stored on your Mac. We do not operate user accounts, cloud sync, or a backend that receives your
          traffic data.
        </p>
      </section>

      <section>
        <h2>Data the desktop app collects</h2>
        <p>
          <strong>Captured traffic:</strong> When you enable capture, request and response data is stored locally
          in Yanshuf&apos;s application data directory on your machine. Nothing is uploaded to Yanshuf servers by
          default.
        </p>
        <p>
          <strong>No analytics or telemetry:</strong> Packaged Yanshuf does not include built-in analytics or
          usage telemetry.
        </p>
        <p>
          <strong>Update checks:</strong> Installed apps may check for updates via{' '}
          <a href="https://update.electronjs.org" target="_blank" rel="noopener noreferrer">
            update.electronjs.org
          </a>
          , which reads public GitHub release metadata for this repository. No capture data is sent as part of
          update checks.
        </p>
        <p>
          <strong>MCP integration:</strong> The local MCP API listens on localhost only and uses an auth token
          stored in your user data directory so editor tools on your machine can connect.
        </p>
      </section>

      <section>
        <h2>Data you choose to share</h2>
        <p>
          Export, copy, and share features transmit data only when you explicitly use them — for example, copying
          a request to the clipboard or sharing a cURL command.
        </p>
      </section>

      <section>
        <h2>This website</h2>
        <p>
          This marketing site is a static site. We do not require sign-in and do not collect personal information
          through forms on this site. If you deploy the site on a host such as Vercel, that provider may process
          standard server logs (IP address, user agent, requested URL) according to their own privacy policy.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          Download links point to GitHub Releases. GitHub&apos;s privacy policy applies when you visit or download
          from GitHub. We do not control third-party services.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>Yanshuf is a developer tool and is not directed at children under 13.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We may update this policy as the product or site evolves. The &quot;Last updated&quot; date reflects the latest revision.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Privacy questions: <a href="mailto:sefiuzan812@gmail.com">sefiuzan812@gmail.com</a>. Security issues: see
          our <Link href="/security">Security Policy</Link>.
        </p>
      </section>
    </LegalLayout>
  );
}
