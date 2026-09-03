import type { ReactNode } from 'react'

export type PolicyKey = 'privacy' | 'terms' | 'cookies' | 'acceptable-use'
export type PolicyAcceptance = { policyKey: PolicyKey; version: string; acceptedAt?: string; source: 'native-signup' | 'oauth-signup' }
export type PolicyDocument = { key: PolicyKey; version: string; effectiveDate: string; updatedDate: string; title: string; summary: string; requiresSignupConsent: boolean; sections: Array<{ id: string; title: string; content: ReactNode }> }

const draftDates = { effectiveDate: 'September 2026', updatedDate: 'September 2026' }
const section = (id: string, title: string, content: ReactNode) => ({ id, title, content })

export const POLICY_DOCUMENTS: Record<PolicyKey, PolicyDocument> = {
  privacy: { key: 'privacy', version: '1.0', ...draftDates, title: 'Privacy Policy', summary: 'How MoonScribe stores, syncs, and protects your writing and account information.', requiresSignupConsent: true, sections: [
    section('information', 'Information we handle', <p>MoonScribe may handle account details, authentication identifiers, session information, writing records you choose to sync, collaboration presence, support messages, and technical information needed to operate the service.</p>),
    section('storage', 'Local storage and sync', <p>Your local writing remains available on your device. If you enable an account or sync, selected records are transmitted to MoonScribe so they can be restored across your signed-in devices. You can use local writing features without creating an account where the product supports that mode.</p>),
    section('rights', 'Your choices', <p>You can export your work, disconnect sync, review sessions, request support, and ask for account deletion. Do not include private manuscript text or recovery credentials in support requests unless necessary.</p>),
    section('contact', 'Questions and deletion', <p>Use the MoonScribe contact route for privacy questions or deletion requests. This product-grounded draft requires independent legal review before launch.</p>),
  ] },
  terms: { key: 'terms', version: '1.0', ...draftDates, title: 'Terms of Service', summary: 'The conditions for using MoonScribe as a private writing and book-design studio.', requiresSignupConsent: true, sections: [
    section('account', 'Accounts', <p>Keep your sign-in details secure and provide accurate information. You are responsible for activity performed through your account and for maintaining access to your devices and recovery methods.</p>),
    section('ownership', 'Your work', <p>You retain ownership of the writing, images, and other material you submit. You grant MoonScribe only the permissions reasonably needed to store, sync, display, export, and collaborate on features you choose to use.</p>),
    section('use', 'Acceptable use', <p>Do not misuse the service, interfere with other users, upload unlawful material, attempt unauthorized access, or use MoonScribe to distribute harmful code or abuse another person.</p>),
    section('changes', 'Service and terms changes', <p>Features and these draft terms may change as MoonScribe develops. Material changes should be communicated through the product or the account contact channel.</p>),
  ] },
  cookies: { key: 'cookies', version: '1.0', ...draftDates, title: 'Cookies Policy', summary: 'What browser storage and essential session technologies MoonScribe uses.', requiresSignupConsent: false, sections: [
    section('essential', 'Essential storage', <p>MoonScribe uses browser storage such as IndexedDB and local storage to keep local writing, preferences, offline records, and interface state available. Essential session technologies support authentication, sync, security, and collaboration.</p>),
    section('choices', 'Your choices', <p>Clearing browser storage can remove local-only data, so export your work first. Blocking essential storage may prevent sign-in, sync, or offline features from working.</p>),
    section('updates', 'Updates to this policy', <p>We will update this page if the storage technologies used by the production service change. This is a product-grounded draft pending independent legal review.</p>),
  ] },
  'acceptable-use': { key: 'acceptable-use', version: '1.0', ...draftDates, title: 'Acceptable Use Policy', summary: 'The safety standards for using MoonScribe and collaborating with other writers.', requiresSignupConsent: true, sections: [
    section('respect', 'Respect people and creative work', <p>Do not harass, threaten, impersonate, or target people. Do not share another writer’s unpublished work or private information without permission.</p>),
    section('security', 'Protect the service', <p>Do not probe accounts, bypass access controls, introduce malicious code, overload the service, or use automated access in a way that harms availability or privacy.</p>),
    section('enforcement', 'Reports and enforcement', <p>Safety or abuse reports may lead to investigation, content restrictions, suspension, or account closure where appropriate. Contact MoonScribe with relevant details, but never include passwords or recovery codes.</p>),
  ] },
}

export const REQUIRED_SIGNUP_POLICIES = [POLICY_DOCUMENTS.privacy, POLICY_DOCUMENTS.terms, POLICY_DOCUMENTS['acceptable-use']]
