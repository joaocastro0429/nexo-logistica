import assert from 'node:assert/strict';
const base = process.env.NEXO_TEST_URL || 'http://localhost:3000';
const origin = process.env.NEXO_TEST_ORIGIN || base;
async function login(email, perfil = 'Administrador', extra = {}) {
  return fetch(`${base}/api/sessao`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha: 'NexoDemo@2026', perfil, ...extra }) });
}
assert.equal((await fetch(`${base}/api/plataforma`)).status, 401);
assert.equal((await login('operador@aurea.com')).status, 401);
const a = await login('admin@aurea.com', 'Administrador', { tenantId: 'vertex' });
assert.equal(a.status, 200);
assert.match(a.headers.get('set-cookie'), /HttpOnly/i);
assert.match(a.headers.get('set-cookie'), /SameSite=lax/i);
const ca = a.headers.get('set-cookie').split(';')[0];
const b = await login('admin@vertex.com');
assert.equal(b.status, 200);
const cb = b.headers.get('set-cookie').split(';')[0];
try {
  const response = await fetch(`${base}/api/plataforma?tenantId=vertex`, { headers: { Cookie: ca, 'X-Tenant-Id': 'vertex' } });
  assert.match(response.headers.get('cache-control'), /no-store/);
  const pa = await response.json();
  const pb = await (await fetch(`${base}/api/plataforma`, { headers: { Cookie: cb } })).json();
  assert.equal(pa.sessao.tenantId, 'aurea');
  assert.equal(pb.sessao.tenantId, 'vertex');
  assert.notDeepEqual(pa.rotas, pb.rotas);
  assert.notDeepEqual(pa.resumo, pb.resumo);
  assert.equal((await fetch(`${base}/api/sessao`, { method: 'DELETE', headers: { Cookie: ca, Origin: 'https://outra-origem.example' } })).status, 403);
  assert.equal((await fetch(`${base}/api/sessao`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: 'null' })).status, 400);
} finally {
  for (const cookie of [ca, cb]) {
    assert.equal((await fetch(`${base}/api/sessao`, { method: 'DELETE', headers: { Cookie: cookie, Origin: origin } })).status, 200);
    assert.equal((await fetch(`${base}/api/plataforma`, { headers: { Cookie: cookie } })).status, 401);
  }
}
console.log('APIs verificadas: credenciais, perfil, isolamento, cookies, origem, validação e logout.');
