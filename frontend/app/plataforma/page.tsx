'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Bell, ChartNoAxesCombined, ChevronRight, CircleDollarSign, LogOut, Menu, PackageCheck, Route, Settings, ShieldCheck, Truck, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import './styles.css';
import Gestao from './gestao';

import type { Painel, Perfil } from '../../lib/types';

const permissoes: Record<Perfil, string[]> = {
  Administrador: ['Visão geral', 'Usuários', 'Clientes', 'Transportadoras', 'Simulação de frete', 'Histórico'],
  Gestor: ['Visão geral', 'Clientes', 'Transportadoras', 'Simulação de frete', 'Histórico'],
  Operador: ['Visão geral', 'Clientes', 'Transportadoras', 'Simulação de frete', 'Histórico'],
};

export default function PlataformaPage() {
  const router = useRouter();
  const [painel, setPainel] = useState<Painel | null>(null);
  const [secao, setSecao] = useState('Visão geral');
  const [erro, setErro] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/plataforma', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) { router.replace('/login'); return; }
        if (!response.ok) throw new Error('Falha ao carregar');
        setPainel(await response.json());
      })
      .catch((error) => { if (error.name !== 'AbortError') setErro('Não foi possível carregar sua operação. Atualize a página para tentar novamente.'); });
    return () => controller.abort();
  }, [router]);

  async function sair() {
    try {
      const response = await fetch('/api/sessao', { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao sair');
      setPainel(null);
      router.replace('/login');
    } catch { setErro('Não foi possível sair. Tente novamente.'); }
  }

  if (!painel) return <div className="plataforma-carregando">{erro || 'Carregando sua operação...'}</div>;
  const { sessao, rotas, eficiencia } = painel;
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
        <header className="plataforma-header"><button className="sidebar-toggle" onClick={() => setMenuAberto(true)} aria-label="Abrir menu"><Menu size={21} /></button><div><span className="overline">{sessao.empresa}</span><h1>Bom dia, {sessao.nome}.</h1></div><div className="header-actions"><button aria-label="Notificações"><Bell size={19} /><b /></button><div className="avatar-usuario">{sessao.nome.slice(0, 2).toUpperCase()}</div></div></header>
        {secao === 'Visão geral' ? <>
        <div className="plataforma-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> centro de controle</div><h2>O que está acontecendo<br /><em>na sua operação.</em></h2></div><button className="periodo-button">Hoje <ChevronRight size={16} /></button></div>
        <div className="resumo-grid">{resumo.map((item) => { const Icon = item.icone; return <article className={`resumo-card ${item.cor}`} key={item.titulo}><div className="resumo-card-top"><span>{item.titulo}</span><Icon size={20} /></div><strong>{item.valor}</strong><p><span>↗ {item.variacao}</span> desde a semana passada</p></article>; })}</div>
        <div className="operacao-grid"><section className="painel rotas-painel"><div className="painel-heading"><div><span className="overline">acompanhamento ao vivo</span><h3>Rotas em andamento</h3></div><span>Rotas demonstrativas</span></div>{rotas.map((rota, index) => <div className="rota-linha" key={rota.id}><span className={`rota-icone ${['', 'azul', 'coral'][index % 3]}`}><Truck size={18} /></span><div><strong>{rota.nome}</strong><p>{rota.pedidos} pedidos · previsão de conclusão {rota.previsao}</p></div><span className={`status ${rota.status === 'Em rota' ? 'em-rota' : 'aguardando'}`}>{rota.status}</span></div>)}</section><section className="painel eficiencia-painel"><div className="painel-heading"><div><span className="overline">últimos 7 dias</span><h3>Eficiência da operação</h3></div><ChartNoAxesCombined size={21} /></div><div className="grafico-barras">{eficiencia.map((valor, index) => <i key={index} style={{ height: `${valor}%` }} aria-label={`${valor}%`} />)}</div><div className="grafico-legenda"><span>seg</span><span>ter</span><span>qua</span><span>qui</span><span>sex</span><span>sáb</span><span>dom</span></div></section></div>
        </> : <Gestao key={secao} secao={secao} sessao={sessao} />}
        {erro && <p role="alert">{erro}</p>}
        <section className="permissao-aviso"><ShieldCheck size={18} /><span>Você está acessando como <strong>{sessao.perfil}</strong>. Os dados exibidos pertencem à empresa <strong>{sessao.empresa}</strong>.</span></section>
      </section>
    </main>
  );
}
