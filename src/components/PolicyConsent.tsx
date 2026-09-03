import { Link } from 'react-router-dom'
import { REQUIRED_SIGNUP_POLICIES, type PolicyAcceptance } from '../data/policies'
import { Checkbox } from './ui/checkbox'

export default function PolicyConsent({ value, onChange, source = 'native-signup' }: { value: Record<string, boolean>; onChange: (value: Record<string, boolean>) => void; source?: PolicyAcceptance['source'] }) {
  return <fieldset className="policy-consent" aria-describedby="policy-consent-note"><legend>Before you create your account</legend><p id="policy-consent-note">Please review and accept each current policy. Your choices are recorded with the versions shown.</p>{REQUIRED_SIGNUP_POLICIES.map((policy) => <label key={policy.key} className="policy-consent-row"><Checkbox checked={Boolean(value[policy.key])} onChange={(e) => onChange({ ...value, [policy.key]: e.target.checked })} required /><span>I accept the <Link to={`/${policy.key}`}>{policy.title}</Link> <small>v{policy.version}</small></span></label>)}<span className="sr-only">Signup source: {source}</span></fieldset>
}
