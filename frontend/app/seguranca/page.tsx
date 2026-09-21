'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import '../login/styles.css';

export default function SegurancaPage() {
  const [status, setStatus] = useState<{ mfa: boolean; providers: string[] } | null>(null);
  const [providers, setProviders] = useState({ google: false, github: false });
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [recovery, setRecovery] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    apiFetch('/api/seguranca').then(async response => {
      if (response.status === 401) { window.location.assign('/login'); return; }
      if (!response.ok) throw new Error();
      setStatus(await response.json());
    }).catch(() => setMensagem('Não foi possível carregar sua conta.'));
    fetch('/api/oauth/providers').then(r => r.json()).then(setProviders).catch(() => {});
  }, []);
  async function action(path: string, method = 'POST') {
    setBusy(true); setMensagem('');
    try {
      const response = await apiFetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha, codigo }) });
      const data = await response.json();
      if (!response.ok) { setMensagem(data.message || 'Não foi possível concluir.'); return; }
      if (data.url) { window.location.assign(data.url); return; }
      if (data.secret) { setSetup(data); setCodigo(''); }
      else { setSetup(null); setRecovery(data.recoveryCodes || []); setDone(true); setMensagem('Configuração atualizada. Suas sessões foram encerradas. Entre novamente.'); }
      setSenha('');
    } catch { setMensagem('Não foi possível conectar. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <main className="seguranca-page"><section className="acesso-panel">
    <a href="/plataforma">← Plataforma</a><h1>Segurança da conta</h1>
    <p>Proteja seu acesso com um aplicativo autenticador e vincule suas contas Google e GitHub.</p>
    {mensagem && <p role="status">{mensagem}</p>}
    {status && !done && <div className="acesso-form">
      <h2>Autenticação em duas etapas</h2><p>MFA {status.mfa ? 'ativado' : 'desativado'}.</p>
      <label htmlFor="senha">Confirme sua senha para configurar MFA ou vincular um provedor</label>
      <div className="input-wrap"><input id="senha" type="password" autoComplete="current-password" maxLength={256} value={senha} onChange={e => setSenha(e.target.value)} /></div>
      {(status.mfa || setup) && <><label htmlFor="codigo">{setup ? 'Código de seis dígitos do autenticador' : 'Código do autenticador ou de recuperação'}</label><div className="input-wrap"><input id="codigo" autoComplete="one-time-code" maxLength={32} value={codigo} onChange={e => setCodigo(e.target.value)} /></div></>}
      {setup ? <>
        <p>Adicione uma conta TOTP no seu aplicativo (30 segundos, seis dígitos). Chave manual, exibida somente nesta configuração:</p>
        <code className="mfa-secret">{setup.secret}</code>
        <a href={setup.uri}>Abrir em aplicativo autenticador neste dispositivo</a>
        <p>Confirme o código em até cinco minutos. Depois guarde os códigos de recuperação em local seguro.</p>
        <button className="button button-primary" disabled={busy || !codigo} onClick={() => action('seguranca/mfa/ativar')}>Ativar MFA</button>
      </> : <button className="button button-primary" disabled={busy || !senha || (status.mfa && !codigo)} onClick={() => action(status.mfa ? 'seguranca/mfa' : 'seguranca/mfa/configurar', status.mfa ? 'DELETE' : 'POST')}>{status.mfa ? 'Desativar MFA' : 'Configurar MFA'}</button>}
      <h2>Contas vinculadas</h2><p>O primeiro vínculo exige sua senha e, se ativo, o segundo fator. Depois você poderá entrar pelo provedor; o MFA continuará obrigatório.</p>
      {(['google', 'github'] as const).map(provider => <div key={provider}><strong>{provider === 'google' ? 'Google' : 'GitHub'}</strong> — {status.providers.includes(provider) ? 'Vinculado' : providers[provider] ? <button className="button" disabled={busy || !senha || (status.mfa && !codigo)} onClick={() => action(`oauth/${provider}/vincular`)}>Vincular</button> : 'Não configurado pelo servidor'}</div>)}
    </div>}
    {recovery.length > 0 && <><h2>Guarde seus códigos de recuperação</h2><p>Cada código funciona uma única vez. Eles não serão exibidos novamente.</p><ul>{recovery.map(code => <li key={code}><code>{code}</code></li>)}</ul></>}
    {done && <a className="button button-primary" href="/login">Entrar novamente</a>}
  </section></main>;
}
