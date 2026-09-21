'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import './styles.css';

import type { Perfil } from '../../lib/types';

const perfis: Array<{ nome: Perfil; descricao: string }> = [
  { nome: 'Administrador', descricao: 'Acesso completo à operação' },
  { nome: 'Gestor', descricao: 'Indicadores e decisões da equipe' },
  { nome: 'Operador', descricao: 'Rotas, pedidos e ocorrências' },
];

export default function LoginPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil>('Administrador');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [mfa, setMfa] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [providers, setProviders] = useState({ google: false, github: false });
  const [providersState, setProvidersState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [oauthAviso, setOauthAviso] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMfa(params.get('mfa') === '1');
    if (params.has('oauth')) setErro('Não foi possível entrar pelo provedor. Vincule sua conta em Segurança após entrar com senha.');
    fetch('/api/oauth/providers').then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (typeof data.google !== 'boolean' || typeof data.github !== 'boolean') throw new Error();
      setProviders(data);
      setProvidersState('ready');
    }).catch(() => setProvidersState('error'));
  }, []);

  const [enviando, setEnviando] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfa && (!email || !senha)) {
      setErro('Informe seu e-mail e sua senha para continuar.');
      return;
    }

    setErro('');
    setEnviando(true);
    try {
      const response = await fetch(mfa ? '/api/sessao/mfa' : '/api/sessao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mfa ? { codigo } : { email, senha, perfil }),
      });
      const dados = await response.json();
      if (!response.ok) { setErro(dados.message || 'Não foi possível entrar.'); return; }
      if (dados.mfaRequired) { setMfa(true); setSenha(''); return; }
      localStorage.removeItem('nexo-sessao');
      router.replace('/plataforma');
    } catch { setErro('Não foi possível conectar. Tente novamente.'); }
    finally { setEnviando(false); }
  }

  return (
    <main className="acesso-page">
      <section className="acesso-intro">
        <a className="brand acesso-brand" href="/" aria-label="Voltar para o início">
          <span className="brand-mark"><span /></span>
          <span>nexo<span className="brand-dot">.</span></span>
        </a>
        <div className="acesso-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> área restrita</div>
          <h1>A operação<br /><em>começa aqui.</em></h1>
          <p>Entre no Nexo para transformar cada entrega em uma decisão mais inteligente.</p>
        </div>
        <div className="acesso-foot"><ShieldCheck size={17} /> Ambiente protegido por níveis de acesso</div>
      </section>

      <section className="acesso-panel">
        <div className="acesso-panel-head"><span className="overline">acesso à plataforma</span><h2>{mfa ? 'Verificação em duas etapas' : 'Entrar na plataforma'}</h2><p>{mfa ? 'Confirme sua identidade para concluir o acesso à sua conta.' : 'Entre com uma conta vinculada ou informe seu e-mail e senha.'}</p></div>
        {!mfa && <section className="oauth-section" aria-label="Login com conta vinculada">
          <div className="oauth-buttons">{(['google', 'github'] as const).map(provider => {
            const label = `Entrar com ${provider === 'google' ? 'Google' : 'GitHub'}`;
            return providersState === 'ready' && providers[provider]
              ? <a key={provider} className="button oauth-button" href={`/api/oauth/${provider}`}>{label}</a>
              : <button key={provider} className="button oauth-button oauth-button-unavailable" type="button" aria-describedby="oauth-status" onClick={() => setOauthAviso(providersState === 'loading' ? 'Aguarde a verificação dos provedores.' : `O login com ${provider === 'google' ? 'Google' : 'GitHub'} ainda não foi configurado no servidor.`)}>{label}</button>;
          })}</div>
          <p id="oauth-status" className="oauth-status" role="status">{providersState === 'loading'
            ? 'Verificando opções de acesso…'
            : providersState === 'error'
              ? 'Não foi possível consultar as opções de acesso. Verifique a conexão e recarregue a página.'
              : !providers.google || !providers.github
                ? 'As opções desabilitadas ainda não foram configuradas. Entre com e-mail e senha.'
                : 'Use uma conta já vinculada em Segurança da conta.'}</p>
                  {oauthAviso && <p className="form-error" role="alert">{oauthAviso}</p>}
          <div className="acesso-divider">ou entre com e-mail e senha</div>
        </section>}
        <form onSubmit={entrar} className="acesso-form">
          {!mfa && <><label htmlFor="email">E-mail profissional</label>
          <div className="input-wrap"><UserRound size={17} /><input id="email" type="email" required autoComplete="username" placeholder="voce@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <label htmlFor="senha">Senha</label>
          <div className="input-wrap"><LockKeyhole size={17} /><input id="senha" type={mostrarSenha ? 'text' : 'password'} required autoComplete="current-password" placeholder="Digite sua senha" value={senha} onChange={(event) => setSenha(event.target.value)} /><button type="button" className="senha-toggle" onClick={() => setMostrarSenha(v => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha}>{mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <div className="perfil-heading"><label>Seu nível de acesso</label><span>3 perfis disponíveis</span></div>
          <div className="perfil-list">{perfis.map((item) => <button type="button" className={`perfil-option ${perfil === item.nome ? 'selecionado' : ''}`} key={item.nome} onClick={() => setPerfil(item.nome)}><span className="perfil-radio" /><span><strong>{item.nome}</strong><em>{item.descricao}</em></span></button>)}</div>
          </>}
          {mfa && <><label htmlFor="codigo">Código do autenticador ou de recuperação</label><div className="input-wrap"><input id="codigo" value={codigo} onChange={event => setCodigo(event.target.value)} autoComplete="one-time-code" required maxLength={32} autoFocus /></div><p>Informe os seis dígitos do aplicativo ou um código de recuperação ainda não utilizado.</p><button type="button" onClick={() => { setMfa(false); setCodigo(''); setErro(''); window.history.replaceState(null, '', '/login'); }}>Voltar ao login</button></>}
          {erro && <p className="form-error" role="alert">{erro}</p>}
          <button className="button button-primary acesso-submit" type="submit" disabled={enviando}>{enviando ? 'Verificando...' : mfa ? 'Verificar código e entrar' : 'Entrar na plataforma'} <ArrowRight size={17} /></button>
        </form>
        {!mfa && <p className="acesso-cadastro-info"><ShieldCheck size={16} aria-hidden="true" /> Autenticação em duas etapas (MFA): ative em <a href="/seguranca">Segurança da conta</a> após entrar. Se já estiver ativa, seu código será solicitado na próxima etapa.</p>}
        <p className="acesso-demo">Utilize o e-mail e a senha cadastrados na sua empresa. Selecione o perfil associado à sua conta.</p>
        <a className="acesso-cadastro-link" href="/cadastro">Criar conta para minha empresa <ArrowRight size={15} /></a>
        <p className="acesso-demo">Para participar de uma empresa já cadastrada, peça seu acesso ao administrador.</p>
      </section>
    </main>
  );
}
