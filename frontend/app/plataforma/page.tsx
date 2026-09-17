'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, Bell, ChartNoAxesCombined, CircleDollarSign, LogOut, Menu, PackageCheck, Route, Settings, ShieldCheck, Truck, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import './styles.css';
import Gestao from './gestao';
import Importacoes from './importacoes';

import type { Painel, Perfil } from '../../lib/types';

const permissoes: Record<Perfil, string[]> = {
  Administrador: ['Visão geral', 'Usuários', 'Clientes', 'Transportadoras', 'Simulação de frete', 'Histórico', 'Importações'],
  Gestor: ['Visão geral', 'Clientes', 'Transportadoras', 'Simulação de frete', 'Histórico', 'Importações'],
  Operador: ['Visão geral', 'Clientes', 'Transportadoras', 'Simulação de frete', 'Histórico'],
};

export default function PlataformaPage() {
  const router = useRouter();
  const [painel, setPainel] = useState<Painel | null>(null);
  const [secao, setSecao] = useState('Visão geral');
  const [erro, setErro] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuUsuario) return;
    function aoClicarFora(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuUsuario(false);
    }
    function aoPressionarEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuUsuario(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoPressionarEsc);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoPressionarEsc);
    };
  }, [menuUsuario]);

  useEffect(() => {
    if (secao !== 'Visão geral') return;
    const controller = new AbortController();
    setErro('');
    fetch('/api/plataforma', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) { router.replace('/login'); return; }
        if (!response.ok) throw new Error('Falha ao carregar');
        setPainel(await response.json());
      })
      .catch((error) => { if (error.name !== 'AbortError') setErro('Não foi possível carregar sua operação. Atualize a página para tentar novamente.'); });
    return () => controller.abort();
  }, [router, secao]);

  async function sair() {
    setMenuUsuario(false);
    try {
      const response = await fetch('/api/sessao', { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao sair');
      setPainel(null);
      router.replace('/login');
    } catch { setErro('Não foi possível sair. Tente novamente.'); }
  }

  if (!painel) return <div className="plataforma-carregando">{erro || 'Carregando sua operação...'}</div>;
  const { sessao, rotas, evolucao, insights } = painel;
  const icones = [PackageCheck, Activity, CircleDollarSign];
  const cores = ['lime', 'blue', 'coral'];
  const resumo = painel.resumo.map((item, index) => ({ ...item, icone: icones[index % 3], cor: cores[index % 3] }));

  const menus = permissoes[sessao.perfil];

  return (
    <main className="plataforma-page">
      <aside className={`plataforma-sidebar ${menuAberto ? 'aberta' : ''}`}>
        <div className="sidebar-head"><a className="brand" href="/"><span className="brand-mark"><span /></span><span>nexo<span className="brand-dot">.</span></span></a><button className="sidebar-close" onClick={() => setMenuAberto(false)} aria-label="Fechar menu"><X size={20} /></button></div>
        <div className="sidebar-label">navegação principal</div>
        <nav className="plataforma-nav">{menus.map((menu, index) => <a className={secao === menu ? 'ativo' : ''} onClick={event => { event.preventDefault(); setSecao(menu); setMenuAberto(false); }} href={`#${menu.toLowerCase().replaceAll(' ', '-')}`} key={menu}>{index === 0 ? <ChartNoAxesCombined size={18} /> : menu === 'Pedidos' ? <PackageCheck size={18} /> : menu === 'Rotas' ? <Route size={18} /> : menu === 'Cotações' ? <CircleDollarSign size={18} /> : menu === 'Equipe' ? <Users size={18} /> : <Settings size={18} />}{menu}</a>)}</nav>
        <div className="sidebar-bottom"><div className="nivel-acesso"><ShieldCheck size={17} /><span><small>nível de acesso</small><strong>{sessao.perfil}</strong></span></div><button className="sair-button" onClick={sair}><LogOut size={16} /> Sair da conta</button></div>
      </aside>

      <section className="plataforma-content">
        <header className="plataforma-header"><button className="sidebar-toggle" onClick={() => setMenuAberto(true)} aria-label="Abrir menu"><Menu size={21} /></button><div><span className="overline">{sessao.empresa}</span><h1>Bom dia, <button className="nome-menu" onClick={() => setMenuUsuario(!menuUsuario)} aria-expanded={menuUsuario} title="Abrir menu do usuário">{sessao.nome}.</button></h1></div><div className="header-actions"><button aria-label="Notificações"><Bell size={19} /><b /></button><div className="usuario-menu" ref={menuRef}><button className="avatar-usuario avatar-trigger" onClick={() => setMenuUsuario(!menuUsuario)} aria-label="Menu do usuário" aria-expanded={menuUsuario}>{sessao.nome.slice(0, 2).toUpperCase()}</button>{menuUsuario && <div className="usuario-dropdown"><div className="usuario-info"><div className="avatar-usuario avatar-dropdown">{sessao.nome.slice(0, 2).toUpperCase()}</div><span><strong>{sessao.nome}</strong><small>{sessao.perfil} · {sessao.empresa}</small></span></div><button className="sair-button sair-dropdown" onClick={sair}><LogOut size={16} /> Sair da conta</button></div>}</div></div></header>
        {secao === 'Visão geral' ? <>
        <div className="plataforma-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> centro de controle</div><h2>O que está acontecendo<br /><em>na sua operação.</em></h2></div><span className="periodo-button">Todo o histórico</span></div>
        <div className="resumo-grid">{resumo.map((item) => { const Icon = item.icone; return <article className={`resumo-card ${item.cor}`} key={item.titulo}><div className="resumo-card-top"><span>{item.titulo}</span><Icon size={20} /></div><strong>{item.valor}</strong><p>{item.variacao}</p></article>; })}</div>
        <div className="operacao-grid">
          <section className="painel rotas-painel"><div className="painel-heading"><div><span className="overline">todo o histórico</span><h3>Trajetos mais simulados</h3></div></div>
            {!rotas.length && <p>Nenhuma simulação realizada.</p>}
            {rotas.map(rota => <div className="rota-linha" key={rota.id}><span className="rota-icone"><Truck size={18} /></span><div><strong>{rota.nome}</strong><p>{rota.quantidade} simulações · média de {rota.media.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div></div>)}
          </section>
          <section className="painel eficiencia-painel"><div className="painel-heading"><div><span className="overline">últimos 7 dias · UTC</span><h3>Simulações por dia</h3></div><ChartNoAxesCombined size={21} /></div>
            <div className="grafico-barras" role="img" aria-label={evolucao.map(d => `${d.data}: ${d.quantidade} simulações`).join('; ')}>{evolucao.map(d => <i key={d.data} title={`${d.data}: ${d.quantidade} simulações`} style={{ height: `${d.quantidade / Math.max(1, ...evolucao.map(p => p.quantidade)) * 100}%` }} />)}</div>
            <div className="grafico-legenda">{evolucao.map(d => <span key={d.data}>{d.data.slice(8)}/{d.data.slice(5, 7)}<br />{d.quantidade}</span>)}</div>
          </section>
        </div>
        <section className="painel insights-painel"><div className="painel-heading"><div><span className="overline">análise automática das simulações</span><h3>Insights</h3></div></div>{insights.map(insight => <article key={insight.titulo}><h4>{insight.titulo}</h4><p>{insight.descricao}</p></article>)}</section>
        </> : secao === 'Importações' ? <Importacoes /> : <Gestao key={secao} secao={secao} sessao={sessao} />}
        {erro && <p role="alert">{erro}</p>}
        <section className="permissao-aviso"><ShieldCheck size={18} /><span>Você está acessando como <strong>{sessao.perfil}</strong>. Os dados exibidos pertencem à empresa <strong>{sessao.empresa}</strong>.</span></section>
      </section>
    </main>
  );
}
