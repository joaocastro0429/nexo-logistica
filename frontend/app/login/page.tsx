'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
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
  const [erro, setErro] = useState('');

  const [enviando, setEnviando] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !senha) {
      setErro('Informe seu e-mail e sua senha para continuar.');
      return;
    }

    setErro('');
    setEnviando(true);
    try {
      const response = await fetch('/api/sessao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, perfil }),
      });
      const dados = await response.json();
      if (!response.ok) { setErro(dados.message || 'Não foi possível entrar.'); return; }
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
        <div className="acesso-panel-head"><span className="overline">acesso à plataforma</span><h2>Entrar na plataforma</h2><p>Já tem uma conta? Informe suas credenciais e o perfil associado a ela.</p></div>
        <form onSubmit={entrar} className="acesso-form">
          <label htmlFor="email">E-mail profissional</label>
          <div className="input-wrap"><UserRound size={17} /><input id="email" type="email" required autoComplete="username" placeholder="voce@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <label htmlFor="senha">Senha</label>
          <div className="input-wrap"><LockKeyhole size={17} /><input id="senha" type="password" required autoComplete="current-password" placeholder="Digite sua senha" value={senha} onChange={(event) => setSenha(event.target.value)} /></div>
          <div className="perfil-heading"><label>Seu nível de acesso</label><span>3 perfis disponíveis</span></div>
          <div className="perfil-list">{perfis.map((item) => <button type="button" className={`perfil-option ${perfil === item.nome ? 'selecionado' : ''}`} key={item.nome} onClick={() => setPerfil(item.nome)}><span className="perfil-radio" /><span><strong>{item.nome}</strong><em>{item.descricao}</em></span></button>)}</div>
          {erro && <p className="form-error" role="alert">{erro}</p>}
          <button className="button button-primary acesso-submit" type="submit" disabled={enviando}>{enviando ? 'Entrando...' : 'Entrar na plataforma'} <ArrowRight size={17} /></button>
        </form>
        <p className="acesso-demo">Utilize o e-mail e a senha cadastrados na sua empresa. Selecione o perfil associado à sua conta.</p>
        <a className="acesso-cadastro-link" href="/cadastro">Criar conta para minha empresa <ArrowRight size={15} /></a>
        <p className="acesso-demo">Para participar de uma empresa já cadastrada, peça seu acesso ao administrador.</p>
      </section>
    </main>
  );
}
