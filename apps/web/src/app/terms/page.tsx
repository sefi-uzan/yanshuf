import Link from 'next/link';
import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';
import { LegalLayout } from '@/components/legal-layout';

export const metadata: Metadata = createMetadata({
  title: 'Terms of Use',
  description: 'Terms of use for the Yanshuf website and open-source macOS application.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" updated="July 29, 2026">
      <section>
        <h2>Agreement</h2>
        <p>
          By downloading, installing, or using Yanshuf (&quot;the Software&quot;) or browsing this website, you
          agree to these terms. If you do not agree, do not use the Software or this site.
        </p>
      </section>

      <section>
        <h2>License</h2>
        <p>
          Yanshuf is distributed under the{' '}
          <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">
            MIT License
          </a>
          . You may use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the Software
          subject to the license conditions. The Software is provided &quot;as is&quot;, without warranty of any
          kind.
        </p>
      </section>

      <section>
        <h2>What Yanshuf is</h2>
        <p>
          Yanshuf is a local network debugging tool for macOS. It can route traffic through a proxy, decrypt
          HTTPS when you install its root certificate, and expose a localhost API for integrations such as MCP.
          You are responsible for how you configure and use the Software on your machine.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You agree not to use Yanshuf to:</p>
        <ul>
          <li>Intercept traffic you are not authorized to inspect</li>
          <li>Violate applicable laws, contracts, or third-party terms of service</li>
          <li>Distribute modified builds that misrepresent their origin or author</li>
          <li>Attempt to harm, disrupt, or gain unauthorized access to systems or data</li>
        </ul>
      </section>

      <section>
        <h2>Website</h2>
        <p>
          This marketing site is provided for informational purposes. Links to GitHub Releases and the source
          repository are provided as-is. We may update or remove site content at any time.
        </p>
      </section>

      <section>
        <h2>Disclaimer</h2>
        <p>
          To the fullest extent permitted by law, the authors and contributors disclaim all liability for damages
          arising from use of the Software or this website, including data loss, security incidents, or
          misconfiguration of system proxies or trusted certificates.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms from time to time. Continued use after changes are posted constitutes
          acceptance of the revised terms.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms:{' '}
          <a href="mailto:sefiuzan812@gmail.com">sefiuzan812@gmail.com</a>. See also our{' '}
          <Link href="/privacy">Privacy Policy</Link> and <Link href="/security">Security Policy</Link>.
        </p>
      </section>
    </LegalLayout>
  );
}
