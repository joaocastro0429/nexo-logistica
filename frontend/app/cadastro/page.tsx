'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import '../login/styles.css';

export default function CadastroPage() {
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = Object.fromEntries(new FormData(form));
    setErro('');
    if (dados.senha !== dados.confirmacao) { setErro('As senhas precisam ser iguais.'); return; }
    setEnviando(true);
    try {
      const response = await fetch('/api/cadastro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: dados.nome, empresa: dados.empresa, email: dados.email, senha: dados.senha }),
      });
      const resultado = await response.json();
      if (!response.ok) { setErro(typeof resultado.message === 'string' ? resultado.message : 'Não foi possível criar sua conta.'); return; }
      form.reset();
      setConcluido(true);
    } catch { setErro('Não foi possível conectar. Tente novamente.'); }
    finally { setEnviando(false); }
  }

  return <main className="acesso-page">
    <section className="acesso-intro">
      <a className="brand acesso-brand" href="/" aria-label="Voltar para o início"><span className="brand-mark"><span /></span><span>nexo<span className="brand-dot">.</span></span></a>
      <div className="acesso-copy"><div className="eyebrow"><span className="eyebrow-line" /> cadastro de nova empresa</div><h1>Sua operação<br /><em>começa aqui.</em></h1><p>Cadastre sua empresa e organize sua equipe em um só lugar.</p></div>
      <div className="acesso-foot"><ShieldCheck size={17} /> Cada empresa tem seu próprio ambiente</div>
    </section>
    <section className="acesso-panel">
      {concluido ? <>
        <div className="acesso-panel-head" role="status"><span className="overline">cadastro concluído</span><h2>Conta criada!</h2><p>Sua empresa foi cadastrada. Entre com seu e-mail, sua senha e o perfil Administrador.</p></div>
        <a className="button button-primary acesso-submit" href="/login">Ir para entrar <ArrowRight size={17} /></a>
      </> : <>
        <div className="acesso-panel-head"><span className="overline">nova conta</span><h2>Criar conta</h2><p>Você será o administrador da nova empresa e poderá cadastrar gestores e operadores.</p></div>
        <form onSubmit={cadastrar} className="acesso-form">
          <label htmlFor="nome">Seu nome</label><div className="input-wrap"><input id="nome" name="nome" required maxLength={150} autoComplete="name" /></div>
          <label htmlFor="empresa">Nome da nova empresa</label><div className="input-wrap"><input id="empresa" name="empresa" required maxLength={150} autoComplete="organization" /></div>
          <label htmlFor="email">E-mail profissional</label><div className="input-wrap"><input id="email" name="email" type="email" required maxLength={254} autoComplete="username" /></div>
          <label htmlFor="senha">Criar senha (mínimo 8 caracteres)</label><div className="input-wrap"><input id="senha" name="senha" type={mostrarSenha ? 'text' : 'password'} required minLength={8} maxLength={256} autoComplete="new-password" /><button type="button" className="senha-toggle" onClick={() => setMostrarSenha(v => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha}>{mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <label htmlFor="confirmacao">Confirmar senha</label><div className="input-wrap"><input id="confirmacao" name="confirmacao" type={mostrarConfirmacao ? 'text' : 'password'} required minLength={8} maxLength={256} autoComplete="new-password" /><button type="button" className="senha-toggle" onClick={() => setMostrarConfirmacao(v => !v)} aria-label={mostrarConfirmacao ? 'Ocultar confirmar senha' : 'Mostrar confirmar senha'} aria-pressed={mostrarConfirmacao}>{mostrarConfirmacao ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {erro && <p className="form-error" role="alert">{erro}</p>}
          <button className="button button-primary acesso-submit" type="submit" disabled={enviando}>{enviando ? 'Criando conta...' : 'Criar conta e empresa'} <ArrowRight size={17} /></button>
        </form>
        <a className="acesso-cadastro-link" href="/login">Já tenho conta — entrar <ArrowRight size={15} /></a>
        <p className="acesso-demo">Sua empresa já usa o Nexo? Solicite um acesso ao administrador dela.</p>
      </>}
    </section>
  </main>;
}
