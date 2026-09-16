'use client';

import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleDollarSign,
  Clock3,
  Gauge,
  Menu,
  PackageCheck,
  Route,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

const benefits = [
  {
    icon: Gauge,
    number: '01',
    title: 'Decida antes do problema',
    text: 'Visibilidade de ponta a ponta para agir com antecedência, reduzir atrasos e transformar exceções em escolhas melhores.',
    tone: 'lime',
  },
  {
    icon: CircleDollarSign,
    number: '02',
    title: 'Frete que cabe na margem',
    text: 'Compare transportadoras, prazos e custos em segundos. Cada cotação vira uma oportunidade de proteger sua margem.',
    tone: 'coral',
  },
  {
    icon: PackageCheck,
    number: '03',
    title: 'A operação no mesmo ritmo',
    text: 'Automatize o que é repetitivo e dê contexto para seu time fazer o que exige inteligência humana.',
    tone: 'blue',
  },
];

const steps = [
  ['01', 'Conecte', 'Integre seus pedidos, estoques e parceiros em uma só visão.'],
  ['02', 'Entenda', 'O Nexo lê seus dados e revela onde a operação perde tempo e dinheiro.'],
  ['03', 'Acelere', 'Você escolhe melhor. Sua entrega chega antes. Seu cliente percebe.'],
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#inicio" aria-label="Nexo início">
          <span className="brand-mark"><span /></span>
          <span>nexo<span className="brand-dot">.</span></span>
        </a>
        <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
          <a href="#plataforma" onClick={() => setMenuOpen(false)}>Plataforma</a>
          <a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a>
          <a href="#resultados" onClick={() => setMenuOpen(false)}>Resultados</a>
          <a href="#contato" onClick={() => setMenuOpen(false)}>Fale com a gente</a>
        </div>
        <a className="nav-action" href="/login">Entrar na plataforma <ArrowRight size={16} /></a>
        <button className="menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <section className="hero section-pad" id="inicio">
        <div className="hero-grid shell">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> inteligência que move</div>
            <h1>A logística do seu negócio, <em>um passo à frente.</em></h1>
            <p className="hero-lead">O Nexo conecta dados, pessoas e decisões para sua operação entregar mais. Com menos custo, menos atrito e muito mais clareza.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contato">Quero conhecer o Nexo <ArrowRight size={18} /></a>
              <a className="text-link" href="#plataforma"><span className="play-icon">▶</span> ver como funciona</a>
            </div>
            <div className="hero-proof"><div className="avatars"><span>MC</span><span>RA</span><span>JP</span><span>+</span></div><p>Mais de <strong>240 operações</strong> já movem melhor</p></div>
          </div>
          <div className="hero-visual" aria-label="Painel visual de rotas logísticas">
            <div className="visual-glow" />
            <div className="dashboard-window">
              <div className="window-bar"><div className="window-dots"><i /><i /><i /></div><span>visão geral / hoje</span><span className="live"><b /> ao vivo</span></div>
              <div className="dashboard-body">
                <div className="dashboard-top"><div><span className="overline">desempenho da operação</span><strong>89,4 <small>/ 100</small></strong></div><div className="trend">↗ 12,8%</div></div>
                <div className="route-map">
                  <div className="map-grid" />
                  <div className="route route-one" /><div className="route route-two" /><div className="route route-three" />
                  <span className="map-point point-one" /><span className="map-point point-two" /><span className="map-point point-three" /><span className="map-point point-four" />
                  <div className="map-label label-one"><span /> CD Cajamar <b>+12 min</b></div><div className="map-label label-two"><span /> Loja Moema <b>entregue</b></div>
                  <div className="map-center"><Route size={18} /><span>47<br /><small>em rota</small></span></div>
                </div>
                <div className="dashboard-stats"><div><Clock3 size={15} /><span>tempo médio</span><b>2h 18m</b></div><div><BarChart3 size={15} /><span>no prazo</span><b>96,2%</b></div><div><ShieldCheck size={15} /><span>ocorrências</span><b>−34%</b></div></div>
              </div>
            </div>
            <div className="float-card float-card-top"><Sparkles size={15} /><span>análise encontrada</span><strong>Rota 23 pode economizar R$ 1.240</strong></div>
            <div className="float-card float-card-bottom"><span className="check-badge"><Check size={14} /></span><span>Pedido #8241<br /><b>entregue no prazo</b></span></div>
          </div>
        </div>
        <div className="hero-edge shell"><span>Feito para quem faz a operação acontecer</span><div className="edge-line" /><span>arraste para explorar <ArrowRight size={14} /></span></div>
      </section>

      <section className="trust-band"><div className="shell trust-inner"><span>Quem já está em movimento</span><div className="logos"><b>áurea</b><b className="logo-serif">Ponto<span>+</span></b><b>VERTEX</b><b className="logo-light">mobi<span>.</span></b><b>norte<span>co.</span></b></div></div></section>

      <section className="benefits section-pad" id="plataforma">
        <div className="shell">
          <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> o que muda na prática</div><h2>Menos apagar incêndio.<br /><em>Mais fazer acontecer.</em></h2></div><p>Uma plataforma para enxergar o todo sem perder o detalhe que faz a diferença.</p></div>
          <div className="benefit-grid">{benefits.map((benefit) => { const Icon = benefit.icon; return <article className={`benefit-card ${benefit.tone}`} key={benefit.number}><div className="benefit-top"><span>{benefit.number}</span><Icon size={25} strokeWidth={1.7} /></div><h3>{benefit.title}</h3><p>{benefit.text}</p><a href="#contato" aria-label={`Saiba mais sobre ${benefit.title}`}><ArrowRight size={17} /></a></article>; })}</div>
        </div>
      </section>

      <section className="story section-pad" id="como-funciona"><div className="shell story-grid"><div className="story-sticky"><div className="eyebrow"><span className="eyebrow-line" /> do dado à entrega</div><h2>Clareza para<br /><em>ir mais longe.</em></h2><p>O Nexo transforma a complexidade da logística em movimento simples, visível e contínuo.</p><a className="button button-dark" href="#contato">Conheça a plataforma <ArrowRight size={17} /></a></div><div className="steps">{steps.map(([num, title, text]) => <div className="step" key={num}><span className="step-number">{num}</span><div className="step-icon">{num === '01' ? <Route /> : num === '02' ? <BarChart3 /> : <PackageCheck />}</div><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></div></section>

      <section className="results section-pad" id="resultados"><div className="shell"><div className="results-head"><div className="eyebrow"><span className="eyebrow-line" /> impacto que aparece</div><h2>Os números contam<br /><em>uma história melhor.</em></h2></div><div className="results-grid"><div className="big-result"><strong>32<span>%</span></strong><p>de redução no custo operacional médio</p><div className="mini-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div><div className="result-note"><span className="quote-mark">“</span><p>Quando você enxerga a operação inteira, cada decisão pequena começa a trabalhar a favor do negócio.</p><span className="note-author">— Camila Reis, COO na Áurea</span></div><div className="result-side"><div><strong>+18<span>%</span></strong><p>mais entregas no prazo</p></div><div><strong>4,6<span>x</span></strong><p>mais velocidade na cotação</p></div></div></div></div></section>

      <section className="cta section-pad" id="contato"><div className="shell cta-inner"><div className="cta-mark"><span /><span /><span /></div><div className="eyebrow"><span className="eyebrow-line" /> seu próximo movimento</div><h2>Pronto para levar<br /><em>sua operação além?</em></h2><p>Converse com nosso time e descubra o que o Nexo pode destravar na sua logística.</p><a className="button button-light" href="mailto:ola@nexo.log.br">Falar com um especialista <ArrowRight size={18} /></a></div></section>

      <footer className="footer"><div className="shell footer-top"><a className="brand" href="#inicio"><span className="brand-mark"><span /></span><span>nexo<span className="brand-dot">.</span></span></a><p>Inteligência que move seu negócio.</p><div className="footer-links"><a href="#plataforma">Plataforma</a><a href="#como-funciona">Como funciona</a><a href="#contato">Contato</a></div></div><div className="shell footer-bottom"><span>© 2025 Nexo Logística</span><span>feito para mover o que importa <span className="heart">♥</span></span></div></footer>
    </main>
  );
}
