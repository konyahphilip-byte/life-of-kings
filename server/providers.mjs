// One owner profile per Eco ID. Organization membership is a separate future layer.
export const providerCategories = ['Delivery & Errands','Cleaning','Laundry','Plumbing','Electrical','Repairs','Moving','Photography','Videography','Graphic Design','Video Editing','Beauty & Barber','Event Services','Food & Catering','Tutoring','Technology Services','Home Services','Business Services','Freelancing','Other','Waste & Recycling'];

export function providerInput(body, { assert, inputString, validMinor }) {
  assert(body && typeof body === 'object' && !Array.isArray(body), 400, 'invalid_provider', 'Supply a service profile.');
  assert(Number.isSafeInteger(body.priceMinor) && body.priceMinor <= 2147483647, 400, 'invalid_amount', 'The indicative price is too large or invalid.');
  const choice = (value, options, name) => {
    assert(options.includes(value), 400, 'invalid_provider', `Choose a valid ${name}.`);
    return value;
  };
  // Service pricing/coverage is enabled for Ghana first; country expansion is gated.
  assert(!body.countryCode || body.countryCode === 'GH', 400, 'country_unavailable', 'Service onboarding currently supports Ghana.');
  return {
    name: inputString(body.name, 'Provider name', { min: 2, max: 90 }),
    providerType: choice(body.providerType, ['individual','business','company','team'], 'provider type'),
    category: choice(body.category, providerCategories, 'service category'),
    service: inputString(body.service, 'Main service', { min: 3, max: 100 }),
    area: inputString(body.area, 'Service area', { min: 2, max: 120 }),
    description: inputString(body.description, 'Service description', { min: 20, max: 1000 }),
    priceMinor: validMinor(body.priceMinor, 'Indicative price'),
    pricing: choice(body.pricing, ['quote','from','fixed'], 'pricing approach'),
    countryCode: 'GH',
  };
}

export function createProviderService({ q, all, run, transaction, assert, inputString, validMinor, now, id, event, notify, rateLimit, postgresMode }) {
  const lock = (userId) => q(`SELECT id FROM users WHERE id=?${postgresMode ? ' FOR UPDATE' : ''}`, userId);
  const asProfile = row => ({ ...JSON.parse(row.service_json), id: row.user_id, ecoId: row.eco_id, verificationState: row.verification_state, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at });
  const profile = async (userId) => {
    const row = await q('SELECT p.*,u.eco_id FROM provider_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=?', userId);
    if (!row?.service_json) return null;
    return asProfile(row);
  };
  const invalidate = async (userId) => {
    await run("UPDATE provider_profiles SET verification_state='unverified',revision=revision+1,updated_at=? WHERE user_id=?", now(), userId);
    await run("UPDATE verification_requests SET status='rejected',review_note='Profile changed. Submit the updated details for review.',reviewed_at=? WHERE user_id=? AND target_role='provider' AND status='pending'", now(), userId);
  };
  const submit = async (ctx, body, targetRole, businessType) => {
    const userId = ctx.user.id;
    const evidence = inputString(body.evidenceNote, 'Verification note', { min: 10, max: 500 });
    assert(['seller','provider'].includes(targetRole), 400, 'verification_scope_required', 'Choose which seller or provider profile to verify.');
    await rateLimit(`verification:${userId}`, 10, 60 * 60_000);
    return transaction(async () => {
      await lock(userId);
      const table = targetRole === 'provider' ? 'provider_profiles' : 'seller_profiles';
      const row = await q(`SELECT * FROM ${table} WHERE user_id=?`, userId);
      assert(row, 403, 'role_required', `Enable your ${targetRole} profile first.`);
      assert(row.verification_state !== 'approved', 409, 'already_verified', 'This profile is already approved.');
      const existing = await q("SELECT id,status FROM verification_requests WHERE user_id=? AND target_role=? AND status='pending'", userId, targetRole);
      if (existing) return existing;
      const requestId = id();
      await run('INSERT INTO verification_requests(id,user_id,business_type,evidence_note,target_role,profile_version,created_at) VALUES(?,?,?,?,?,?,?)', requestId, userId, businessType, evidence, targetRole, targetRole === 'provider' ? row.revision : null, now());
      await run(`UPDATE ${table} SET verification_state='pending' WHERE user_id=?`, userId);
      await event(userId, 'verification', requestId, 'VERIFICATION_REQUESTED', { targetRole });
      await notify(userId, 'verification', 'Verification submitted', 'Your profile is pending staff review.', 'verification', requestId);
      return { id: requestId, status: 'pending' };
    });
  };
  return { lock, profile, invalidate, submit,
    async route(ctx, method, path, body) {
      if (method === 'GET' && path === '/providers') {
        const rows = await all("SELECT p.*,u.eco_id FROM provider_profiles p JOIN users u ON u.id=p.user_id WHERE p.verification_state='approved' AND p.service_json IS NOT NULL AND u.status='active' AND EXISTS (SELECT 1 FROM roles r WHERE r.user_id=p.user_id AND r.role='provider') ORDER BY p.updated_at DESC LIMIT 100");
        return { providers: rows.map(asProfile) };
      }
      if (!['/providers/me','/providers/me/submit'].includes(path)) return undefined;
      assert(ctx.user, 401, 'sign_in_required', 'Sign in with your EcoVibes ID to manage your service.');
      if (method === 'GET' && path === '/providers/me') return { profile: await profile(ctx.user.id) };
      if (method === 'PUT' && path === '/providers/me') {
        const value = providerInput(body, { assert, inputString, validMinor });
        await rateLimit(`provider-save:${ctx.user.id}`, 30, 60 * 60_000);
        return transaction(async () => {
          await lock(ctx.user.id);
          const stamp = now();
          await run("INSERT OR IGNORE INTO roles(user_id,role,created_at) VALUES(?,'provider',?)", ctx.user.id, stamp);
          await run('INSERT OR IGNORE INTO provider_profiles(user_id,created_at) VALUES(?,?)', ctx.user.id, stamp);
          const old = await q('SELECT service_json FROM provider_profiles WHERE user_id=?', ctx.user.id);
          const serialized = JSON.stringify(value);
          if (old.service_json !== serialized) {
            await invalidate(ctx.user.id);
            await run('UPDATE provider_profiles SET business_name=?,provider_type=?,service_area=?,service_json=? WHERE user_id=?', value.name, value.providerType, value.area, serialized, ctx.user.id);
            await event(ctx.user.id, 'provider', ctx.user.id, 'PROVIDER_PROFILE_SAVED');
          }
          return { profile: await profile(ctx.user.id) };
        });
      }
      if (method === 'POST' && path === '/providers/me/submit') {
        assert(await profile(ctx.user.id), 409, 'profile_required', 'Save your service profile first.');
        const verification = await submit(ctx, body, 'provider', 'Service provider');
        return { profile: await profile(ctx.user.id), verification };
      }
    },
  };
}
