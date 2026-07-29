# Security policy

## Supported versions

Security fixes are provided for the latest release only.

| Version | Supported |
| ------- | --------- |
| Latest release | Yes |
| Older releases | No |

Download the latest build from [GitHub Releases](https://github.com/sefi-uzan/yanshuf/releases).

## Reporting a vulnerability

If you believe you have found a security issue in Yanshuf, please report it privately.

**Email:** sefiuzan812@gmail.com

Please include:

- A description of the issue and the impact you believe it has
- Steps to reproduce, if applicable
- Your Yanshuf version and macOS version (including arm64 or x64)

Do not open a public GitHub issue for undisclosed security vulnerabilities.

We aim to acknowledge reports within a few business days. We will work with you on a fix and coordinate disclosure when appropriate.

## Trust model (summary)

Yanshuf is a local HTTPS debugging proxy. It generates a root certificate authority on your Mac and can decrypt traffic routed through it. Captured data stays on your machine unless you export or share it yourself.

See [Security and trust](docs/user/security-and-trust.md) for what that means in practice and how to remove the certificate.
