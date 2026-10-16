'use client';

import { Bell, CheckCheck, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import './notificacoes.css';

type Aviso = { id: string; titulo: string; descricao: string; criadaEm: string; lida: boolean };
type Lista = { itens: Aviso[]; naoLidas: number; ultimaId: string | null };
const vazia: Lista = { itens: [], naoLidas: 0, ultimaId: null };

export default function Notificacoes({ aoAbrir }: { aoAbrir: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Lista>(vazia);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const requisicao = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const carregar = useCallback(async () => {
    const numero = ++requisicao.current;
    controller.current?.abort();
    const atual = new AbortController(); controller.current = atual;
    setCarregando(true);
    try {
      const resposta = await apiFetch('/api/notificacoes', { cache: 'no-store', signal: atual.signal });
      if (!resposta.ok) throw new Error('Não foi possível carregar as notificações.');
      const dados: Lista = await resposta.json();
      if (numero === requisicao.current && !atual.signal.aborted) { setLista(dados); setErro(''); }
    } catch (error) {
      if (!atual.signal.aborted && numero === requisicao.current) setErro((error as Error).message);
    } finally { if (!atual.signal.aborted && numero === requisicao.current) setCarregando(false); }
  }, []);
  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout>;
    const atualizar = async () => {
      if (!document.hidden) await carregar();
      if (ativo) timer = setTimeout(() => void atualizar(), 20000);
    };
    void atualizar();
    return () => { ativo = false; clearTimeout(timer); controller.current?.abort(); requisicao.current++; };
  }, [carregar]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setAberto(false); };
    const teclado = (event: KeyboardEvent) => { if (event.key === 'Escape') { setAberto(false); botao.current?.focus(); } };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', teclado);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', teclado); };
  }, [aberto]);
  async function marcarLidas() {
    const ate = lista.ultimaId;
    if (!ate) return;
    setSalvando(true); setErro('');
    ++requisicao.current; controller.current?.abort(); setCarregando(false);
    try {
      const resposta = await apiFetch('/api/notificacoes/lidas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ate }) });
      if (!resposta.ok) throw new Error('Não foi possível marcar as notificações como lidas.');
      await carregar();
    } catch (error) { setErro((error as Error).message); }
    finally { setSalvando(false); }
  }
  return <div className="notificacoes" ref={container}>
    <button className="notificacoes-gatilho" type="button" ref={botao} aria-label="Notificações" aria-expanded={aberto} aria-controls="central-notificacoes" title={lista.naoLidas ? `${lista.naoLidas} ${lista.naoLidas === 1 ? 'notificação não lida' : 'notificações não lidas'}` : 'Notificações'} onClick={() => {
      setAberto(atual => !atual);
      if (!aberto) { aoAbrir(); void carregar(); }
    }}><Bell size={20} aria-hidden="true" />{lista.naoLidas > 0 && <span className="notificacoes-contador" aria-hidden="true">{lista.naoLidas > 99 ? '99+' : lista.naoLidas}</span>}</button>
    {aberto && <section id="central-notificacoes" className="notificacoes-painel" aria-label="Central de notificações">
      <header><div><h2>Notificações</h2><p>{lista.naoLidas ? `${lista.naoLidas} ${lista.naoLidas === 1 ? 'não lida' : 'não lidas'}` : 'Você está em dia'}</p></div><button type="button" className="notificacoes-icone" aria-label="Fechar notificações" onClick={() => { setAberto(false); botao.current?.focus(); }}><X size={18} /></button></header>
      <div className="notificacoes-acoes"><button type="button" disabled={carregando || salvando} onClick={() => void carregar()}><RefreshCw size={14} aria-hidden="true" />Atualizar</button><button type="button" disabled={!lista.naoLidas || salvando || carregando} onClick={() => void marcarLidas()}><CheckCheck size={15} aria-hidden="true" />{salvando ? 'Salvando...' : 'Marcar como lidas'}</button></div>
      {erro && <p className="notificacoes-erro" role="alert">{erro}</p>}
      {carregando && !lista.itens.length ? <p className="notificacoes-vazio" role="status">Carregando notificações...</p> : !lista.itens.length && !erro ? <div className="notificacoes-vazio"><Bell size={28} aria-hidden="true" /><strong>Nenhuma notificação por enquanto</strong><p>Novos fretes e importações da sua empresa aparecerão aqui.</p></div> : <ul>{lista.itens.map(item => <li key={item.id} className={item.lida ? 'lida' : 'nao-lida'}><span className="notificacoes-ponto" aria-label={item.lida ? 'Lida' : 'Não lida'} /><div><h3>{item.titulo}</h3><p>{item.descricao}</p><time dateTime={item.criadaEm}>{new Date(item.criadaEm).toLocaleString('pt-BR')}</time></div></li>)}</ul>}
    </section>}
  </div>;
}
