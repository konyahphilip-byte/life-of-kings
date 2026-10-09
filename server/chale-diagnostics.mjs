import { APP_GUIDE_VERSION, CHALE_GUIDE } from './chale-guide.mjs';

const guidesById = new Map(CHALE_GUIDE.entries.map((guide) => [guide.id, guide]));
const destinations = new Set(CHALE_GUIDE.entries.map((guide) => guide.destination));
const allowedCapabilities = [
  'aiConfigured', 'liveKitConfigured', 'mediaStorageConfigured',
  'paymentsTestConfigured', 'shopifyConfigured', 'signedIn', 'learningEnabled',
];

function safeCapabilities(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(allowedCapabilities.flatMap((key) =>
    Object.hasOwn(source, key) && typeof source[key] === 'boolean' ? [[key, source[key]]] : []));
}

const unknown = (label, detail) => ({ label, status: 'unknown', detail });

function configurationCheck(label, value, service) {
  if (value === undefined) return unknown(label, `No server configuration flag was supplied for ${service}. Availability has not been checked.`);
  return {
    label, status: value ? 'ready' : 'needs_setup',
    detail: value
      ? `The API host reports ${service} configured. This is configuration evidence only; a live operation has not been verified.`
      : `The API host reports ${service} not configured. An EcoVibes maintainer must review the setup; do not share credentials in chat.`,
  };
}

function sessionCheck(signedIn) {
  if (signedIn === undefined) return unknown('Sign-in session', 'No server sign-in flag was supplied. No account or role has been checked.');
  return {
    label: 'Sign-in session', status: signedIn ? 'ready' : 'needs_setup',
    detail: signedIn
      ? 'The server reports a signed-in session. This does not verify a role, provider approval or access to a particular record.'
      : 'The server reports no signed-in session. Use the account sign-in steps in the guide; never share passwords or authentication codes here.',
  };
}

function featureCheck(guide) {
  if (!guide) return unknown('App documentation', 'No matching documented feature was identified. Describe the EcoVibes section and visible error without private information.');
  if (guide.availability === 'preview') return unknown('Feature availability', 'The canonical app guide marks this feature as a preview. A preview is not evidence of a connected live service.');
  if (guide.availability === 'provider_required') return unknown('Feature availability', 'The canonical app guide says this feature needs a connected provider. Documentation alone does not establish provider health or account access.');
  return { label: 'App documentation', status: 'ready', detail: 'The canonical app guide documents this feature. This confirms documented guidance only, not successful account actions or live service health.' };
}

function matchingGuides(ids, page) {
  const fallback = CHALE_GUIDE.entries.find((guide) => guide.destination === page) || guidesById.get('home');
  const matches = [...new Set(ids)].flatMap((id) => guidesById.has(id) ? [guidesById.get(id)] : []);
  return matches.length ? matches.slice(0, 3) : fallback ? [fallback] : [];
}

// All capabilities must come from the authenticated API host. This function
// performs no queries, network calls, environment reads, account checks or writes.
// It never echoes the symptom, identifiers or unknown capability fields.
export function diagnoseEcovibesIssue(symptom, currentPage, capabilities = {}) {
  const text = typeof symptom === 'string'
    ? symptom.slice(0, 120).replace(/[\u0000-\u001f\u007f]/g, ' ').normalize('NFKC').toLowerCase()
    : '';
  const page = destinations.has(currentPage) ? currentPage : 'Home';
  const flags = safeCapabilities(capabilities);
  const isWaste = /\b(waste|recycl\w*|collection|pickup|collector)\b/u.test(text) || page === 'Waste';
  const isJob = /\b(jobs?|handi|quickhandi|providers?|offers?|services?|work)\b/u.test(text) || page === 'Quick&Handi';
  const isMarket = /\b(marketplace|shops?|products?|orders?|sellers?|checkout)\b/u.test(text) || page === 'Marketplace';
  let category = 'unknown';
  let focus = 'unknown';
  let title = 'Narrow down an EcoVibes issue';
  let summary = 'These checks use only supplied server flags and the canonical app guide. The cause has not been diagnosed; share the app section and visible symptom without private information.';
  let ids = [];
  let checks = [];

  if (/\b(disput\w*|refund\w*|fraud|scam|unsafe|harass\w*|complaint)\b/u.test(text)) {
    category = focus = 'dispute';
    title = 'Find the EcoVibes support and dispute route';
    summary = 'Use the authenticated support route and the relevant job or order controls. No private record, payment or dispute has been inspected, and no outcome is promised.';
    ids = ['support', ...(isWaste ? ['waste'] : isJob ? ['quickhandi'] : isMarket ? ['marketplace'] : [])];
    checks = [sessionCheck(flags.signedIn), unknown('Record and participant access', 'This tool has not read any job, order, message, payment or staff record. Ownership, assignment and record status remain unknown.'), unknown('Resolution status', 'No report, refund or resolution has been submitted or approved. Review the actual form and its response in EcoVibes.')];
  } else if (/\b(learn\w*|recommend\w*|personaliz\w*|interests?|ranking|consent)\b/u.test(text)) {
    category = focus = 'learning';
    title = 'Check EcoVibes recommendation learning';
    summary = 'Recommendation learning changes eligible app ranking, not Chale model training. Pausing is a valid choice; this diagnostic does not change consent, interests or learned activity.';
    ids = ['learning', 'identity'];
    const learning = flags.signedIn === true && flags.learningEnabled !== undefined
      ? { label: 'Personalization choice', status: 'ready', detail: flags.learningEnabled ? 'The authenticated server reports personalization enabled. No private preferences or activity were inspected; ranking results have not been verified.' : 'The authenticated server reports personalization paused. Keep it paused if that is your preference; no new setting or learning signal was saved by this diagnostic.' }
      : unknown('Personalization choice', 'No authenticated learning flag is available. Consent and private learning activity have not been inspected.');
    checks = [sessionCheck(flags.signedIn), learning, unknown('Recommendation result', 'This tool has not inspected individual recommendations or learned signals. Use the guide to review or reset learning through the actual account controls.')];
  } else if (/\b(login|log in|sign in|signin|password|authentication|auth|mfa|permission|access denied)\b/u.test(text)) {
    category = focus = 'login';
    title = 'Check EcoVibes sign-in and access';
    summary = 'A session flag can confirm sign-in state, but it cannot explain a rejected login, missing role or record permission. Follow the account guide and keep authentication details private.';
    ids = ['identity', 'support'];
    checks = [sessionCheck(flags.signedIn), unknown('Role and record permission', 'No role, identity verification, MFA level, provider approval or record ownership was inspected. A signed-in session does not guarantee permission.'), unknown('Sign-in failure cause', 'This diagnostic has not contacted the identity provider or read authentication logs. It cannot confirm why a login failed.')];
  } else if (/\b(offline|network|connection|internet|timeout|timed out|load\w*|unreachable|connectivity)\b/u.test(text)) {
    category = focus = 'network';
    title = 'Check connection and EcoVibes feature availability';
    summary = 'The app guide remains useful while connectivity is uncertain. This diagnostic performs no network or device test, so it cannot confirm an outage or its cause.';
    ids = [isWaste ? 'waste' : isJob ? 'quickhandi' : isMarket ? 'marketplace' : CHALE_GUIDE.entries.find((guide) => guide.destination === page)?.id, 'settings', 'support'];
    checks = [unknown('Device connection', 'Device connectivity, data balance and browser permissions have not been tested.'), unknown('API and provider health', 'No request was sent to the API, identity provider or external services by this diagnostic. Server and provider reachability remain unknown.')];
  } else {
    const calls = /\b(livekit|calls?|rooms?|microphone|camera|voice|stream\w*|obs)\b/u.test(text) || page === 'Calls & Live';
    const media = /\b(reels?|upload\w*|video|media|storage)\b/u.test(text) || page === 'Reels';
    const payments = /\b(paystack|payment\w*|paid|checkout|funds|wallet|transfer)\b/u.test(text) || page === 'Wallet';
    const shopify = /\b(shopify|oauth|connector|sync products)\b/u.test(text);
    const ai = /\b(chale|assistant|model|ai|answer|reply|quota|credits?)\b/u.test(text);
    const provider = /\b(providers?|approval|approved|reviews?|profiles?|directory|offers?|onboard\w*|submit|services?)\b/u.test(text) && (isJob || isWaste);
    if (shopify || calls || media || payments || ai || provider) {
      category = 'provider';
      if (shopify) {
        focus = 'shopify'; title = 'Check EcoVibes Shopify setup';
        summary = 'Configuration flags describe API-host setup only. They do not establish a connected store, seller permission, a completed import or a published listing.';
        ids = ['marketplace', 'identity'];
        checks = [configurationCheck('Shopify configuration', flags.shopifyConfigured, 'Shopify'), sessionCheck(flags.signedIn), unknown('Store connection and import', 'No seller role, store authorization, sync result or listing status has been inspected. Review the actual connector and listing state in EcoVibes.')];
      } else if (calls) {
        focus = 'calls'; title = 'Check EcoVibes call setup';
        summary = 'Call setup, session access and device permission are separate requirements. A configuration flag is not a verified connection or permission to join a room.';
        ids = ['calls-live', 'identity'];
        checks = [configurationCheck('LiveKit configuration', flags.liveKitConfigured, 'LiveKit calls'), sessionCheck(flags.signedIn), unknown('Device and room access', 'Camera, microphone, room membership and invitations have not been checked. Use the actual call controls and browser permissions.'), unknown('Call operation', 'No room was created, joined or tested by this diagnostic.')];
      } else if (media) {
        focus = 'media'; title = 'Check EcoVibes media setup';
        summary = 'Media configuration is separate from upload completion and account permission. This diagnostic does not inspect a video, storage object or publishing result.';
        ids = ['reels', 'identity'];
        checks = [configurationCheck('Media storage configuration', flags.mediaStorageConfigured, 'media storage'), sessionCheck(flags.signedIn), unknown('Upload and publishing result', 'No file, storage response or Reel was inspected, uploaded or published. Configured storage alone does not confirm that an upload succeeded.')];
      } else if (payments) {
        focus = 'payments'; title = 'Check EcoVibes payment availability';
        summary = 'Marketplace Paystack test checkout is separate from the Wallet preview. Configuration does not confirm money, a completed transaction or a refund.';
        ids = ['wallet', 'marketplace'];
        checks = [configurationCheck('Paystack test configuration', flags.paymentsTestConfigured, 'Paystack test checkout'), sessionCheck(flags.signedIn), unknown('Payment and funds', 'No order, transaction, balance or refund was inspected. Wallet funding and transfers remain previews; this diagnostic cannot confirm or move funds.')];
      } else if (ai) {
        focus = 'ai'; title = 'Check Chale AI availability in EcoVibes';
        summary = 'A configured model key is separate from provider availability and usable quota. The canonical EcoVibes app guide can help while live replies are unavailable.';
        ids = ['home', 'settings', 'support'];
        checks = [configurationCheck('Chale model configuration', flags.aiConfigured, 'Chale AI'), unknown('Model health and quota', 'No model request, billing state or quota was checked by this diagnostic. A configured key does not confirm that a live answer will succeed.')];
      } else {
        focus = 'service'; title = 'Check EcoVibes service-provider onboarding';
        summary = 'Saving a service, submitting it for review and receiving staff approval are separate steps. Chale cannot inspect approval or approve a service from chat.';
        ids = isWaste ? ['waste', 'identity', 'support'] : ['provider-onboarding', 'quickhandi', 'identity'];
        checks = [sessionCheck(flags.signedIn), unknown('Saved profile and review', 'No service profile or staff-review record was read. Saving a profile does not establish submission or approval; changed profiles require review again.'), unknown('Directory and job offers', 'No directory listing, provider role, assignment or offer permission was checked. Staff approval remains a prerequisite for provider offers.')];
      }
    } else if (/\b(open|find|navigate|navigation|page|section|where|start|use)\b/u.test(text)) {
      category = focus = 'navigation';
      title = 'Find the relevant EcoVibes section';
      summary = 'Use the canonical app guide for documented navigation and feature limitations. Opening a section does not perform an account action.';
      ids = [isWaste ? 'waste' : isJob ? 'quickhandi' : isMarket ? 'marketplace' : CHALE_GUIDE.entries.find((guide) => guide.destination === page)?.id];
    }
  }

  const guides = matchingGuides(ids, page);
  if (!checks.length || category === 'network') checks.push(featureCheck(guides[0]));
  if (category === 'unknown') checks.push(unknown('Cause of the issue', 'No matching documented issue was identified. No private records, device state or live service operation were checked.'));
  return {
    id: `ecovibes-diagnostic-${focus}`, title, summary,
    checks: checks.slice(0, 4), guideIds: guides.map((guide) => guide.id),
    destination: guides[0]?.destination || 'Home', category,
    outcome: 'guidance_only', guideVersion: APP_GUIDE_VERSION,
  };
}
