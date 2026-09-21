import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authFixture } from './auth-fixture';
import { criarOAuth } from '../src/server/oauth';

const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
test('GitHub: PKCE, state/browser, vínculo autenticado, identidade estável e MFA sem associação automática por e-mail', async () => {
  process.env.GITHUB_CLIENT_ID = 'test-client'; process.env.GITHUB_CLIENT_SECRET = 'test-secret';
  const { repository, redis, auth, senha, user } = authFixture();
  const oauth = criarOAuth(repository, redis, auth);
  const original = globalThis.fetch;
  let verified = true;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/access_token')) {
      const body = new URLSearchParams(String(init?.body));
      assert.ok(body.get('code_verifier')); assert.equal(body.get('client_secret'), 'test-secret');
      return response({ access_token: 'provider-token' });
    }
    if (url.endsWith('/user/emails')) return response([{ email: 'teste@example.com', verified, primary: true }]);
    if (url.endsWith('/user')) return response({ id: 123, login: 'mutable-name' });
    throw new Error('URL inesperada');
  };
  try {
    const begin = await oauth.start('github');
    const url = new URL(begin.url);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    await assert.rejects(oauth.callback('github', url.searchParams.get('state'), 'code', 'wrong'));
    await assert.rejects(oauth.callback('github', url.searchParams.get('state'), 'code', begin.browser));
    const unlinked = await oauth.start('github');
    await assert.rejects(oauth.callback('github', new URL(unlinked.url).searchParams.get('state'), 'code', unlinked.browser), /vincule/);
    const login = await auth.passwordLogin('teste@example.com', senha);
    assert.ok(login && 'access' in login);
    const link = await oauth.start('github', { id: user.id, version: user.sessionVersion });
    assert.deepEqual(await oauth.callback('github', new URL(link.url).searchParams.get('state'), 'code', link.browser, login.access), { linked: true });
    const start = await oauth.start('github');
    const result = await oauth.callback('github', new URL(start.url).searchParams.get('state'), 'code', start.browser);
    assert.ok('access' in result && await auth.session(result.access));
    verified = false;
    const invalid = await oauth.start('github');
    await assert.rejects(oauth.callback('github', new URL(invalid.url).searchParams.get('state'), 'code', invalid.browser));
    verified = true; user.mfaSecret = 'encrypted';
    const mfa = await oauth.start('github');
    assert.ok('challenge' in await oauth.callback('github', new URL(mfa.url).searchParams.get('state'), 'code', mfa.browser));
    const revokedLink = await oauth.start('github', { id: user.id, version: user.sessionVersion });
    user.sessionVersion++;
    await assert.rejects(oauth.callback('github', new URL(revokedLink.url).searchParams.get('state'), 'code', revokedLink.browser, login.access));
  } finally { globalThis.fetch = original; delete process.env.GITHUB_CLIENT_ID; delete process.env.GITHUB_CLIENT_SECRET; }
});
test('Google: ID token assinado, issuer/audience/nonce e e-mail verificado', async () => {
  process.env.GOOGLE_CLIENT_ID = 'google-test'; process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
  const { repository, redis, auth, user } = authFixture();
  const oauth = criarOAuth(repository, redis, auth);
  await repository.vincularOAuth(user.id, 'google', 'google-subject');
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const original = globalThis.fetch;
  let idToken = '';
  globalThis.fetch = async input => String(input).includes('/certs') ? response({ keys: [jwk] }) : response({ id_token: idToken });
  try {
    for (const failure of ['', 'nonce', 'aud', 'iss', 'email', 'exp', 'signature']) {
      const start = await oauth.start('google');
      const url = new URL(start.url);
      const payload = { nonce: failure === 'nonce' ? 'wrong' : url.searchParams.get('nonce'), email_verified: failure !== 'email' };
      const signingKey = failure === 'signature' ? (await generateKeyPair('RS256')).privateKey : privateKey;
      idToken = await new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setSubject('google-subject')
        .setIssuer(failure === 'iss' ? 'wrong' : 'https://accounts.google.com').setAudience(failure === 'aud' ? 'wrong' : 'google-test')
        .setIssuedAt().setExpirationTime(failure === 'exp' ? 1 : '5m').sign(signingKey);
      const result = oauth.callback('google', url.searchParams.get('state'), 'code', start.browser);
      if (failure) await assert.rejects(result);
      else assert.ok('access' in await result);
    }
  } finally { globalThis.fetch = original; delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; }
});
