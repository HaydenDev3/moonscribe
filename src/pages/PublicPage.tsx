import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type PageKey = 'privacy' | 'terms' | 'cookies' | 'acceptable-use' | 'community' | 'contact'

const UPDATED = '22 August 2026'

const pages: Record<PageKey, { title: string; description: string; content: ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    description: 'How MoonScribe collects, uses, protects, and gives you control of your account and writing data.',
    content: <>
      <h2>1. What this policy covers</h2><p>This policy applies to the MoonScribe website, cloud application, desktop application, account services, collaboration tools, and messages we send. MoonScribe is a writing studio for creating and organising novels.</p>
      <h2>2. Information we process</h2><p>We process account details such as your username, email address, authentication provider identifier, profile image, and signed-in device sessions. We also process content you choose to store or sync, including novels, chapters, notes, characters, worldbuilding, comments, cover designs, preferences, and collaboration activity.</p><p>Technical information may include IP address, browser or device type, security and error logs, request timestamps, and service-performance data. We do not sell personal information.</p>
      <h2>3. Why we use information</h2><p>We use information to provide accounts and syncing, save and restore your work, enable private collaboration, secure the service, prevent abuse, provide support, deliver requested account emails, and improve reliability. We process this information to perform our contract with you, pursue legitimate security and service interests, comply with law, or act with your consent where required.</p>
      <h2>4. Service providers</h2><p>MoonScribe may use carefully selected providers for hosting, authentication, transactional email, error monitoring, and infrastructure. Discord and Google receive information when you choose their sign-in options and apply their own privacy policies. Resend processes transactional email delivery. Providers may only process information for the services they supply to us.</p>
      <h2>5. Storage, security, and retention</h2><p>We use encrypted transport, account-scoped access controls, revocable sessions, and restricted collaboration rooms. No online system is perfectly secure, so you should keep an independent backup of important manuscripts. Account and manuscript information is retained while your account is active and as reasonably necessary for recovery, security, disputes, or legal obligations. Deleted data may remain briefly in backups before expiry.</p>
      <h2>6. Your choices and rights</h2><p>You can export your library, manage connected sessions, work locally where supported, correct account information, and request access to or deletion of personal information. Depending on where you live, you may also have rights to restrict or object to processing, portability, and a complaint to your privacy regulator.</p>
      <h2>7. Children</h2><p>MoonScribe is not directed to children under 13. If local law requires a higher minimum age for independent consent, users below that age need permission from a parent or guardian.</p>
      <h2>8. Contact and changes</h2><p>Privacy requests can be sent through our <Link to="/contact">contact page</Link>. We may update this policy as the product or law changes. Material changes will be identified by a new effective date and, where appropriate, an in-app notice.</p>
    </>,
  },
  terms: {
    title: 'Terms of Service',
    description: 'The terms governing access to and use of MoonScribe.',
    content: <>
      <h2>1. Agreement</h2><p>By creating an account or using MoonScribe, you agree to these Terms and our Privacy Policy. If you use MoonScribe for an organisation, you confirm that you can bind that organisation.</p>
      <h2>2. Your account</h2><p>You must provide accurate information, keep credentials secure, and promptly report suspected unauthorised access. You are responsible for activity under your account. You must meet the minimum legal age to enter this agreement in your location.</p>
      <h2>3. Your writing remains yours</h2><p>You retain ownership of the manuscripts and other content you create. You grant MoonScribe a limited, non-exclusive licence to host, copy, transmit, format, and process that content only as needed to operate features you request, such as syncing, export, backup, and collaboration. We do not claim authorship of your work.</p>
      <h2>4. Acceptable use</h2><p>You must follow our <Link to="/acceptable-use">Acceptable Use Policy</Link>. Do not break the law, violate another person’s rights, disrupt the service, probe accounts or systems without permission, distribute malware, or use MoonScribe to exploit or harm others.</p>
      <h2>5. Collaboration</h2><p>You control whom you invite to a manuscript and the permission assigned. Collaborators may see or change shared content according to that permission. Only invite people you trust and remove access when it is no longer required.</p>
      <h2>6. Availability and beta features</h2><p>MoonScribe may change, suspend, or discontinue features. Beta and preview features may be incomplete or change without notice. Keep independent backups of irreplaceable work. We may perform maintenance or restrict access to protect users and infrastructure.</p>
      <h2>7. Suspension and termination</h2><p>You may stop using MoonScribe at any time. We may suspend or terminate access for serious or repeated violations, security threats, legal requirements, or prolonged service closure. Where practical, we will provide notice and an opportunity to export content.</p>
      <h2>8. Disclaimers and liability</h2><p>MoonScribe is provided “as is” and “as available” to the extent permitted by law. We do not promise uninterrupted operation or that the service will catch every continuity issue or prevent every loss. Nothing in these Terms excludes rights or liability that cannot legally be excluded. To the maximum extent allowed by law, MoonScribe is not liable for indirect, special, incidental, or consequential loss.</p>
      <h2>9. Governing law and contact</h2><p>These Terms are governed by the laws of Queensland, Australia, without excluding mandatory consumer protections that apply where you live. Contact us through the <Link to="/contact">contact page</Link> before starting a formal dispute so we can try to resolve it.</p>
    </>,
  },
  cookies: {
    title: 'Cookie & Storage Policy',
    description: 'How MoonScribe uses browser storage and similar technologies.',
    content: <><h2>Essential storage</h2><p>MoonScribe uses browser storage, local databases, and similar technology to keep you signed in, preserve settings, support offline-safe drafts, remember security choices, and sync your library. These functions are necessary for the application to work.</p><h2>Analytics and advertising</h2><p>MoonScribe does not currently use third-party advertising cookies. If optional analytics are introduced, this policy and any required consent controls will be updated before they are enabled.</p><h2>Your controls</h2><p>You can clear site data using your browser or device settings, but doing so may sign you out and remove unsynced local content. Export important work before clearing MoonScribe storage.</p></>,
  },
  'acceptable-use': {
    title: 'Acceptable Use Policy',
    description: 'Safety and responsible-use rules for MoonScribe accounts and collaboration.',
    content: <><h2>Use MoonScribe responsibly</h2><p>Creative writing may explore difficult subjects. This policy regulates conduct and misuse of the service, not lawful fictional themes.</p><h2>Prohibited conduct</h2><ul><li>Breaking applicable law or encouraging imminent harm.</li><li>Sexual exploitation of children or content that facilitates it.</li><li>Credible threats, targeted harassment, stalking, or disclosure of private information.</li><li>Malware, phishing, credential theft, spam, or deceptive impersonation.</li><li>Unauthorised access, security probing, rate-limit evasion, or disruption of MoonScribe or another service.</li><li>Infringing copyright, privacy, publicity, or other rights.</li></ul><h2>Enforcement</h2><p>We may remove access, preserve evidence, or report conduct when reasonably necessary to protect people, comply with law, or secure the service. Reports can be made through our <Link to="/contact">contact page</Link>.</p></>,
  },
  community: {
    title: 'MoonScribe Community',
    description: 'Community standards and official updates for MoonScribe writers.',
    content: <><h2>A thoughtful room for writers</h2><p>MoonScribe’s public community spaces are being prepared. When the official Discord and social profiles open, verified links will be published on this page and nowhere else should be assumed official.</p><h2>Community standard</h2><p>Be constructive, respect unpublished work, ask before sharing another writer’s material, label spoilers and sensitive topics, and critique the writing rather than the writer. Harassment, plagiarism, scams, and unauthorised promotion are not welcome.</p><h2>Stay safe</h2><p>MoonScribe staff will never ask for your password or recovery code. Report impersonation or a suspicious invitation through our <Link to="/contact">contact page</Link>.</p></>,
  },
  contact: {
    title: 'Contact MoonScribe',
    description: 'Contact options for MoonScribe support, privacy, safety, and legal requests.',
    content: <><h2>Support</h2><p>For account, sync, product, privacy, safety, or legal questions, open an issue in the official <a href="https://github.com/HaydenDev3/moonscribe/issues" target="_blank" rel="noreferrer">MoonScribe GitHub repository</a>. Do not include passwords, recovery codes, private manuscript text, or other sensitive information in a public issue.</p><h2>Security reports</h2><p>Describe the affected area and impact without publishing exploit details or accessing another user’s data. Mark the report clearly as a security issue and request a private reporting channel.</p><h2>Response information</h2><p>Include the platform you use, a concise description, and steps to reproduce a technical problem. Account ownership may need to be verified before account-specific help can be provided.</p></>,
  },
}

export default function PublicPage({ page }: { page: PageKey }) {
  const item = pages[page]
  useEffect(() => {
    document.title = `${item.title} — MoonScribe`
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', item.description)
    return () => { document.title = 'MoonScribe — Novel Writing & Book Design Studio' }
  }, [item])
  return <main className="public-page"><header><Link to="/" className="public-brand"><img src="/moonscribelogo.png" alt="" />MoonScribe<span>✦</span></Link><nav aria-label="Public navigation"><Link to="/">Home</Link><Link to="/community">Community</Link><Link to="/contact">Contact</Link></nav></header><article><p className="public-kicker">MoonScribe · Legal &amp; trust</p><h1>{item.title}</h1><p className="public-lead">{item.description}</p><p className="public-date">Effective and last updated: {UPDATED}</p>{item.content}</article><footer><span>© 2026 MoonScribe</span><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/acceptable-use">Acceptable use</Link></footer></main>
}
