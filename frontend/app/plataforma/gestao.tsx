'use client';

import { apiFetch } from '../../lib/api';
import { RefreshCw, Trash2, X } from 'lucide-react';

import { FormEvent, useEffect, useState } from 'react';
import type { Sessao } from '../../lib/types';
import './gestao.css';
import Localidades from './localidades';

type Registro = { id: string; nome: string; email: string; [campo: string]: string | number };
type Campo = { nome: string; label: string; tipo?: string; opcional?: boolean; min?: number };
type Simulacao = {
  id: string; criada_em: string; usuario: string; origem: string; destino: string;
  peso: number; comprimento: number; largura: number; altura: number; distancia: number; valorCarga: number;
  pesoCubado: number; pesoCobrado: number; base: number; porPeso: number; porDistancia: number; seguro: number; total: number;
  transportadora: Registro; cliente: Registro | null;
};
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/${url}`, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (response.status === 401) { window.location.assign('/login'); throw new Error('Sua sessão expirou. Entre novamente.'); }
  const dados = await response.json();
  if (!response.ok) throw new Error(typeof dados.message === 'string' ? dados.message : 'Não foi possível concluir a operação.');
  return dados;
}
const comuns: Campo[] = [{ nome: 'nome', label: 'Nome' }, { nome: 'email', label: 'E-mail', tipo: 'email' }];
const contato: Campo = { nome: 'telefone', label: 'Telefone', opcional: true };
const campos: Record<string, Campo[]> = {
  usuarios: [...comuns, { nome: 'perfil', label: 'Perfil', tipo: 'select' }, { nome: 'senha', label: 'Senha (mínimo 8 caracteres)', tipo: 'password' }],
  clientes: [...comuns, contato, { nome: 'documento', label: 'CPF/CNPJ', opcional: true }],
  transportadoras: [...comuns, contato, { nome: 'taxa_base', label: 'Taxa base (R$)', tipo: 'number', min: 0 }, { nome: 'valor_kg', label: 'Preço por kg (R$)', tipo: 'number', min: 0 }, { nome: 'valor_km', label: 'Preço por km (R$)', tipo: 'number', min: 0 }],
};

function Cadastro({ tipo, sessao }: { tipo: string; sessao: Sessao }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [form, setForm] = useState<Record<string, string>>({ perfil: 'Operador' });
  const [editando, setEditando] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const podeEditar = sessao.perfil !== 'Operador';
  async function carregar() { setRegistros(await api<Registro[]>(`gestao/${tipo}`)); }
  useEffect(() => {
    let ativo = true;
    api<Registro[]>(`gestao/${tipo}`).then(dados => { if (ativo) setRegistros(dados); }).catch(error => { if (ativo) setErro(error.message); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tipo]);
  function editar(registro?: Registro) {
    setEditando(registro?.id || null);
    setForm(registro ? Object.fromEntries(Object.entries(registro).map(([k, v]) => [k, String(v)])) : { perfil: 'Operador' });
    setAberto(true); setErro(''); setAviso('');
  }
  async function salvar(event: FormEvent) {
    event.preventDefault(); setOcupado(true); setErro(''); setAviso('');
    const dados = Object.fromEntries(campos[tipo].map(c => [c.nome, c.tipo === 'number' ? Number(form[c.nome]) : form[c.nome] || '']));
    try {
      await api(`gestao/${tipo}${editando ? `/${editando}` : ''}`, { method: editando ? 'PUT' : 'POST', body: JSON.stringify(dados) });
      if (tipo === 'usuarios' && editando === sessao.usuarioId) { window.location.assign('/login'); return; }
      setAberto(false); setAviso('Cadastro salvo.'); await carregar();
    } catch (error) { setErro((error as Error).message); }
    finally { setOcupado(false); }
  }
  async function remover(registro: Registro) {
    if (!window.confirm(`Remover ${registro.nome}? Esta ação não pode ser desfeita.`)) return;
    setOcupado(true); setErro(''); setAviso('');
    try {
      await api(`gestao/${tipo}/${registro.id}`, { method: 'DELETE' });
      if (tipo === 'usuarios' && registro.id === sessao.usuarioId) { window.location.assign('/login'); return; }
      if (editando === registro.id) setAberto(false);
      setAviso('Cadastro removido.'); await carregar();
    } catch (error) { setErro((error as Error).message); }
    finally { setOcupado(false); }
  }
  return <section className="gestao">
    <div className="gestao-toolbar"><label>Buscar por nome ou e-mail<input value={busca} onChange={e => setBusca(e.target.value)} type="search" /></label>{podeEditar && <button className="button button-primary" onClick={() => editar()} disabled={ocupado}>Novo cadastro</button>}</div>
    {erro && <p className="gestao-erro" role="alert">{erro}</p>}{aviso && <p role="status">{aviso}</p>}
    {aberto && <form className="gestao-form" onSubmit={salvar}><h3>{editando ? 'Editar cadastro' : 'Novo cadastro'}</h3><div className="gestao-campos">{campos[tipo].map(c => <label key={c.nome}>{c.label}{c.tipo === 'password' && editando ? ' — deixe vazia para manter' : c.opcional ? ' (opcional)' : ''}{c.nome === 'email' && tipo === 'usuarios' ? <em className="gestao-dica">O e-mail é único no Nexo. Se um usuário de qualquer empresa já o utiliza, escolha outro.</em> : null}{c.tipo === 'select' ? <select value={form[c.nome] || 'Operador'} onChange={e => setForm({ ...form, [c.nome]: e.target.value })}>{['Administrador', 'Gestor', 'Operador'].map(p => <option key={p}>{p}</option>)}</select> : <input type={c.tipo || 'text'} required={!c.opcional && !(c.tipo === 'password' && !!editando)} min={c.min} step={c.tipo === 'number' ? '0.01' : undefined} minLength={c.tipo === 'password' ? 8 : undefined} maxLength={c.tipo === 'password' ? 256 : 254} autoComplete={c.tipo === 'password' ? 'new-password' : 'off'} value={form[c.nome] || ''} onChange={e => setForm({ ...form, [c.nome]: e.target.value })} />}</label>)}</div><div className="gestao-acoes"><button className="button button-primary" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Salvar'}</button><button type="button" onClick={() => setAberto(false)} disabled={ocupado}>Cancelar</button></div></form>}
    {carregando ? <p role="status">Carregando cadastros...</p> : <div className="gestao-tabela"><table><thead><tr>{campos[tipo].filter(c => c.tipo !== 'password').map(c => <th key={c.nome}>{c.label}</th>)}{podeEditar && <th>Ações</th>}</tr></thead><tbody>{registros.filter(r => `${r.nome} ${r.email}`.toLowerCase().includes(busca.toLowerCase())).map(r => <tr key={r.id}>{campos[tipo].filter(c => c.tipo !== 'password').map(c => <td key={c.nome}>{c.tipo === 'number' ? moeda(Number(r[c.nome])) : r[c.nome] || '—'}</td>)}{podeEditar && <td><div className="gestao-acoes"><button onClick={() => editar(r)} disabled={ocupado}>Editar</button><button onClick={() => remover(r)} disabled={ocupado}>Remover</button></div></td>}</tr>)}</tbody></table>{!registros.some(r => `${r.nome} ${r.email}`.toLowerCase().includes(busca.toLowerCase())) && <p>Nenhum cadastro encontrado.</p>}</div>}
  </section>;
}

function Resultado({ simulacao: s }: { simulacao: Simulacao }) {
  return <article className="gestao-resultado"><h3>{s.origem} → {s.destino}</h3><p>{s.transportadora.nome} · {new Date(s.criada_em).toLocaleString('pt-BR')}</p><p>Cliente: {s.cliente?.nome || 'Não informado'} · Responsável: {s.usuario}</p><p>Peso: {s.peso} kg · Dimensões: {s.comprimento} × {s.largura} × {s.altura} cm · Distância: {s.distancia} km · Carga: {moeda(s.valorCarga)}</p><dl><div><dt>Peso cubado</dt><dd>{s.pesoCubado.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg</dd></div><div><dt>Peso cobrado</dt><dd>{s.pesoCobrado.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg</dd></div><div><dt>Taxa base</dt><dd>{moeda(s.base)}</dd></div><div><dt>Parcela por peso</dt><dd>{moeda(s.porPeso)}</dd></div><div><dt>Parcela por distância</dt><dd>{moeda(s.porDistancia)}</dd></div><div><dt>Seguro (0,5%)</dt><dd>{moeda(s.seguro)}</dd></div></dl><strong>Total estimado: {moeda(s.total)}</strong></article>;
}
const camposFrete: Campo[] = [
  { nome: 'origem', label: 'Origem (cidade/UF)' }, { nome: 'destino', label: 'Destino (cidade/UF)' },
  { nome: 'peso', label: 'Peso (kg)', tipo: 'number', min: 0.01 },
  { nome: 'comprimento', label: 'Comprimento (cm)', tipo: 'number', min: 0.01 },
  { nome: 'largura', label: 'Largura (cm)', tipo: 'number', min: 0.01 },
  { nome: 'altura', label: 'Altura (cm)', tipo: 'number', min: 0.01 },
  { nome: 'distancia', label: 'Distância estimada (km)', tipo: 'number', min: 0 },
  { nome: 'valorCarga', label: 'Valor da carga (R$)', tipo: 'number', min: 0 },
];
function Frete() {
  const [clientes, setClientes] = useState<Registro[]>([]);
  const [transportadoras, setTransportadoras] = useState<Registro[]>([]);
  const [buscaTransportadora, setBuscaTransportadora] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<Simulacao | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let ativo = true;
    Promise.all([api<Registro[]>('gestao/clientes'), api<Registro[]>('gestao/transportadoras')]).then(([c, t]) => { if (ativo) { setClientes(c); setTransportadoras(t); } }).catch(e => { if (ativo) setErro(e.message); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);
  const normalizar = (nome: string) => nome.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const transportadoraSelecionada = transportadoras.find(t => t.id === form.transportadoraId);
  const transportadorasFiltradas = transportadoras.filter(t => normalizar(t.nome).includes(normalizar(buscaTransportadora)));
  function buscarTransportadora(nome: string) {
    setBuscaTransportadora(nome);
    const exatas = transportadoras.filter(t => normalizar(t.nome) === normalizar(nome));
    setForm(atual => ({ ...atual, transportadoraId: exatas.length === 1 ? exatas[0].id : '' }));
    setResultado(null);
  }
  async function simular(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setErro(''); setResultado(null);
    const dados = { ...form, ...Object.fromEntries(camposFrete.filter(c => c.tipo === 'number').map(c => [c.nome, Number(form[c.nome])])) };
    try { setResultado(await api<Simulacao>('simulacoes', { method: 'POST', body: JSON.stringify(dados) })); }
    catch (error) { setErro((error as Error).message); }
    finally { setOcupado(false); }
  }
  return <section className="gestao">{erro && <p className="gestao-erro" role="alert">{erro}</p>}{carregando ? <p>Carregando...</p> : <><p>Informe a distância estimada do trajeto. O cálculo considera o maior entre peso real e cubado, as tarifas da transportadora e seguro de 0,5%.</p>{!transportadoras.length && <p>Cadastre uma transportadora antes de simular. Administradores e gestores podem realizar esse cadastro.</p>}<Localidades aplicar={(campo, cidade) => { setForm(atual => ({ ...atual, [campo]: cidade })); setResultado(null); }} /><form className="gestao-form" onSubmit={simular}><div className="gestao-campos"><label>Buscar transportadora por nome<input type="search" value={buscaTransportadora} onChange={e => buscarTransportadora(e.target.value)} placeholder="Digite o nome cadastrado" /></label><label>Transportadora<select required value={form.transportadoraId || ''} onChange={e => { setForm(atual => ({ ...atual, transportadoraId: e.target.value })); setResultado(null); }}><option value="">Selecione</option>{transportadorasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>{buscaTransportadora && !transportadorasFiltradas.length && <p role="status">Nenhuma transportadora cadastrada com esse nome. Cadastre-a em Transportadoras antes de simular.</p>}{transportadoraSelecionada && <article className="gestao-resultado" aria-label="Dados da transportadora" aria-live="polite"><h3>{transportadoraSelecionada.nome}</h3><p>E-mail: {transportadoraSelecionada.email} · Telefone: {transportadoraSelecionada.telefone || 'Não informado'}</p><dl><div><dt>Taxa base</dt><dd>{moeda(Number(transportadoraSelecionada.taxa_base))}</dd></div><div><dt>Preço por kg</dt><dd>{moeda(Number(transportadoraSelecionada.valor_kg))}</dd></div><div><dt>Preço por km</dt><dd>{moeda(Number(transportadoraSelecionada.valor_km))}</dd></div></dl><p>Tarifas do cadastro usadas pelo servidor no cálculo do frete.</p></article>}<label>Cliente (opcional)<select value={form.clienteId || ''} onChange={e => setForm({ ...form, clienteId: e.target.value })}><option value="">Não informado</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>{camposFrete.map(c => <label key={c.nome}>{c.label}<input required type={c.tipo || 'text'} min={c.min} step={c.tipo === 'number' ? '0.01' : undefined} maxLength={150} value={form[c.nome] || ''} onChange={e => { setForm({ ...form, [c.nome]: e.target.value }); setResultado(null); }} /></label>)}</div><button className="button button-primary" disabled={ocupado || !transportadoras.length}>{ocupado ? 'Calculando...' : 'Simular e salvar no histórico'}</button></form></>}{resultado && <><p role="status">Simulação salva no histórico.</p><Resultado simulacao={resultado} /></>}</section>;
}
function Historico({ sessao }: { sessao: Sessao }) {
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [dados, setDados] = useState<Simulacao[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [atualizacao, setAtualizacao] = useState(0);
  useEffect(() => {
    setCarregando(true);
    setErro('');
    let ativo = true;
    api<Simulacao[]>('simulacoes').then(d => { if (ativo) setDados(d); }).catch(e => { if (ativo) setErro(e.message); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [atualizacao]);
  async function excluir(simulacao: Simulacao) {
    if (!window.confirm(`Excluir a simulação ${simulacao.origem} → ${simulacao.destino}, da transportadora ${simulacao.transportadora.nome}? Esta ação não pode ser desfeita e removerá seus valores dos indicadores do dashboard.`)) return;
    setRemovendo(simulacao.id); setErro(''); setAviso('');
    try {
      await api(`simulacoes/${encodeURIComponent(simulacao.id)}`, { method: 'DELETE' });
      setDados(atuais => atuais.filter(s => s.id !== simulacao.id));
      setAviso('Simulação excluída. Os indicadores serão atualizados ao abrir a Visão geral.');
    } catch (error) { setErro((error as Error).message); }
    finally { setRemovendo(null); }
  }
  const normalizarBusca = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  const filtrados = dados.filter(s => {
    const texto = normalizarBusca(`${s.origem} ${s.destino} ${s.transportadora.nome} ${s.cliente?.nome || ''} ${s.usuario} ${new Date(s.criada_em).toLocaleDateString('pt-BR')} ${s.id}`);
    return termos.every(termo => texto.includes(termo));
  });
  return <section className="gestao"><div className="historico-toolbar"><button className="historico-botao historico-atualizar" type="button" disabled={carregando || !!removendo} onClick={() => setAtualizacao(atual => atual + 1)}><RefreshCw size={17} aria-hidden="true" /><span>{carregando ? 'Atualizando...' : 'Atualizar histórico'}</span></button></div>{aviso && <p role="status">{aviso}</p>}<label>Buscar no histórico por cidade, transportadora, cliente, responsável, data ou código<input type="search" placeholder="Ex.: Sao Paulo, nome da transportadora ou 16/10/2026" value={busca} onChange={e => setBusca(e.target.value)} /></label>{erro && <p className="gestao-erro" role="alert">{erro}</p>}{carregando ? <p>Carregando histórico...</p> : erro ? <p>Não foi possível carregar o histórico. Tente atualizar novamente.</p> : !dados.length ? <p>Nenhuma simulação salva para esta empresa. Em Simulação de frete, preencha os dados e clique em “Simular e salvar no histórico”.</p> : !filtrados.length ? <><p>Nenhuma simulação corresponde à busca.</p><button className="historico-botao historico-limpar" type="button" onClick={() => setBusca('')}><X size={17} aria-hidden="true" /><span>Limpar busca</span></button></> : filtrados.map(s => <details key={s.id}><summary>{new Date(s.criada_em).toLocaleString('pt-BR')} · {s.origem} → {s.destino} · {s.transportadora.nome} · {moeda(s.total)}</summary><Resultado simulacao={s} />{(sessao.perfil === 'Administrador' || sessao.perfil === 'Gestor') && <div className="historico-acoes"><button className="historico-excluir" type="button" disabled={!!removendo} onClick={() => excluir(s)}><Trash2 size={17} aria-hidden="true" /><span>{removendo === s.id ? 'Excluindo...' : 'Excluir simulação'}</span></button></div>}</details>)}</section>;
}
export default function Gestao({ secao, sessao }: { secao: string; sessao: Sessao }) {
  const tipos: Record<string, string> = { 'Usuários': 'usuarios', 'Clientes': 'clientes', 'Transportadoras': 'transportadoras' };
  return <><div className="plataforma-intro"><div><span className="overline">{sessao.empresa}</span><h2>{secao}</h2></div></div>{tipos[secao] ? <Cadastro key={secao} tipo={tipos[secao]} sessao={sessao} /> : secao === 'Simulação de frete' ? <Frete /> : <Historico sessao={sessao} />}</>;
}
