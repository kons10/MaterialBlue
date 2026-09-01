# Security Policy

## Reporting a Vulnerability

We take the security of MaterialBlue seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please contact us by opening a draft security advisory on GitHub:

1. Go to the [Security tab](https://github.com/kons10/MaterialBlue/security) of the repository
2. Click "Report a vulnerability"
3. Provide a detailed description of the vulnerability
4. Include steps to reproduce the issue, if possible
5. Submit the report

You should receive a response within 72 hours confirming receipt of your report.

## Preferred Languages

We prefer all communications to be in English or Japanese.

## Security Policy Details

- **Supported Versions**: We only support the latest version of MaterialBlue
- **Response Time**: We aim to respond to security reports within 72 hours
- **Disclosure**: We follow responsible disclosure practices and will coordinate with you on public disclosure timing

## Types of Issues

### High Priority
- Authentication bypass
- Session hijacking
- Cross-site scripting (XSS)
- Credential leakage
- API token exposure

### Medium Priority
- CSRF vulnerabilities
- Information disclosure
- Insecure direct object references

### Lower Priority
- Missing security headers (when not exploitable)
- Rate limiting issues
- Best practice violations without clear exploit path

## Known Limitations

As a static client that stores session tokens in browser cookies:
- JWT tokens are stored as JS-readable cookies (necessary for client-side operation)
- The application is designed for personal/small-scale use, not enterprise deployment
- Users should be aware that XSS vulnerabilities could lead to session theft

We are transparent about these design decisions and users should evaluate whether this threat model matches their needs.

## Acknowledgments

We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.
