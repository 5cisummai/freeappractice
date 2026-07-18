# Security Policy

## Scope

[freeappractice.org](https://freeappractice.org) is a continuously deployed web application. There are no user-selectable release versions; security fixes are shipped to the live site as part of normal deployments.

Only the currently live production service is in scope for security reports. Local development setups, staging environments, and third-party services we integrate with (except where a vulnerability in our integration exposes freeappractice.org users) are generally out of scope unless they demonstrate a clear impact on production.

## Reporting a Vulnerability

We take the security of freeappractice.org and our users seriously. If you discover a security vulnerability, please report it responsibly so we can protect user data and platform integrity.

### How to Report

Please email your vulnerability report to **security@freeappractice.org** with:

- A clear description of the vulnerability
- The affected page(s), API route(s), or feature(s)
- Steps to reproduce the issue
- Potential impact (data exposure, unauthorized access, account takeover, etc.)
- Screenshots or a proof of concept (if applicable)
- Any suggested remediation

**Do not** publicly disclose the vulnerability, post it on social media, open a public GitHub issue, or discuss it publicly until we have had time to address it.

### What to Expect

- **Initial response**: Acknowledgment within 48 hours
- **Updates**: Status updates at least every 7 days while the report is open
- **Resolution targets** (from confirmation):
  - Critical (data exposure, account compromise): ~10 days
  - High (authentication bypass, XSS with meaningful impact): ~20 days
  - Medium / lower: ~90 days
- **Disclosure**: After a fix is deployed, we may request a coordinated disclosure timeline

### Outcomes

**Accepted**: If we confirm the vulnerability, we will:

- Develop and deploy a fix to production
- Monitor for related exploitation where appropriate
- Credit you in a security advisory or changelog note if you want to be credited

**Declined**: If we determine the report is not a valid security concern, we will:

- Explain our reasoning
- Offer guidance if applicable

Examples of reports that are often declined: purely theoretical issues without a practical exploit path, missing security headers with no demonstrated impact, brute-force against login without evidence of missing rate limiting that we can act on, or findings limited to outdated software on the researcher’s own machine.

## Security Measures

We aim to protect user data through practices such as:

- HTTPS for all production traffic
- Secure session and authentication handling
- Industry-standard password hashing for credential-based accounts
- Dependency and platform updates as part of ongoing maintenance
- Backups and recovery procedures for critical data
- Compliance with applicable privacy obligations (see our Privacy Policy)

## User Security Responsibilities

To help keep your account safe:

- Use a strong, unique password (or sign in with a trusted provider when available)
- Never share your login credentials or session with anyone
- Log out when using shared or public devices
- Report suspicious account activity to **security@freeappractice.org** or **support@freeappractice.org**

Thank you for helping us keep freeappractice.org safe.
