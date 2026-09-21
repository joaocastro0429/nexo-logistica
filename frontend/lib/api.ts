let renewal: Promise<boolean> | undefined;
async function renew() {
  const request = async () => (await fetch('/api/sessao/refresh', { method: 'POST' })).ok;
  // Serializa a renovação entre abas quando Web Locks está disponível.
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('nexo-refresh', request) : request();
}
export async function apiFetch(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (response.status !== 401) return response;
  if (!renewal) renewal = renew().finally(() => { renewal = undefined; });
  if (!await renewal) return response;
  return fetch(url, options);
}
