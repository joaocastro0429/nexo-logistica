'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Sessao } from '../../lib/types';
import './gestao.css';

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
  const response = await fetch(`/api/${url}`, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
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
    {aberto && <form className="gestao-form" onSubmit={salvar}><h3>{editando ? 'Editar cadastro' : 'Novo cadastro'}</h3><div className="gestao-campos">{campos[tipo].map(c => <label key={c.nome}>{c.label}{c.tipo === 'password' && editando ? ' — deixe vazia para manter' : c.opcional ? ' (opcional)' : ''}{c.tipo === 'select' ? <select value={form[c.nome] || 'Operador'} onChange={e => setForm({ ...form, [c.nome]: e.target.value })}>{['Administrador', 'Gestor', 'Operador'].map(p => <option key={p}>{p}</option>)}</select> : <input type={c.tipo || 'text'} required={!c.opcional && !(c.tipo === 'password' && !!editando)} min={c.min} step={c.tipo === 'number' ? '0.01' : undefined} minLength={c.tipo === 'password' ? 8 : undefined} maxLength={c.tipo === 'password' ? 256 : 254} autoComplete={c.tipo === 'password' ? 'new-password' : 'off'} value={form[c.nome] || ''} onChange={e => setForm({ ...form, [c.nome]: e.target.value })} />}</label>)}</div><div className="gestao-acoes"><button className="button button-primary" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Salvar'}</button><button type="button" onClick={() => setAberto(false)} disabled={ocupado}>Cancelar</button></div></form>}
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
  async function simular(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setErro(''); setResultado(null);
    const dados = { ...form, ...Object.fromEntries(camposFrete.filter(c => c.tipo === 'number').map(c => [c.nome, Number(form[c.nome])])) };
    try { setResultado(await api<Simulacao>('simulacoes', { method: 'POST', body: JSON.stringify(dados) })); }
    catch (error) { setErro((error as Error).message); }
    finally { setOcupado(false); }
  }
  return <section className="gestao">{erro && <p className="gestao-erro" role="alert">{erro}</p>}{carregando ? <p>Carregando...</p> : <><p>Informe a distância estimada do trajeto. O cálculo considera o maior entre peso real e cubado, as tarifas da transportadora e seguro de 0,5%.</p>{!transportadoras.length && <p>Cadastre uma transportadora antes de simular. Administradores e gestores podem realizar esse cadastro.</p>}<form className="gestao-form" onSubmit={simular}><div className="gestao-campos"><label>Transportadora<select required value={form.transportadoraId || ''} onChange={e => setForm({ ...form, transportadoraId: e.target.value })}><option value="">Selecione</option>{transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label><label>Cliente (opcional)<select value={form.clienteId || ''} onChange={e => setForm({ ...form, clienteId: e.target.value })}><option value="">Não informado</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>{camposFrete.map(c => <label key={c.nome}>{c.label}<input required type={c.tipo || 'text'} min={c.min} step={c.tipo === 'number' ? '0.01' : undefined} maxLength={150} value={form[c.nome] || ''} onChange={e => { setForm({ ...form, [c.nome]: e.target.value }); setResultado(null); }} /></label>)}</div><button className="button button-primary" disabled={ocupado || !transportadoras.length}>{ocupado ? 'Calculando...' : 'Simular e salvar no histórico'}</button></form></>}{resultado && <><p role="status">Simulação salva no histórico.</p><Resultado simulacao={resultado} /></>}</section>;
}
function Historico() {
  const [dados, setDados] = useState<Simulacao[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  useEffect(() => {
    let ativo = true;
    api<Simulacao[]>('simulacoes').then(d => { if (ativo) setDados(d); }).catch(e => { if (ativo) setErro(e.message); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);
  const filtrados = dados.filter(s => `${s.origem} ${s.destino} ${s.transportadora.nome}`.toLowerCase().includes(busca.toLowerCase()));
  return <section className="gestao"><label>Buscar por origem, destino ou transportadora<input type="search" value={busca} onChange={e => setBusca(e.target.value)} /></label>{erro && <p className="gestao-erro" role="alert">{erro}</p>}{carregando ? <p>Carregando histórico...</p> : !filtrados.length ? <p>Nenhuma simulação encontrada.</p> : filtrados.map(s => <details key={s.id}><summary>{new Date(s.criada_em).toLocaleString('pt-BR')} · {s.origem} → {s.destino} · {moeda(s.total)}</summary><Resultado simulacao={s} /></details>)}</section>;
}
export default function Gestao({ secao, sessao }: { secao: string; sessao: Sessao }) {
  const tipos: Record<string, string> = { 'Usuários': 'usuarios', 'Clientes': 'clientes', 'Transportadoras': 'transportadoras' };
  return <><div className="plataforma-intro"><div><span className="overline">{sessao.empresa}</span><h2>{secao}</h2></div></div>{tipos[secao] ? <Cadastro key={secao} tipo={tipos[secao]} sessao={sessao} /> : secao === 'Simulação de frete' ? <Frete /> : <Historico />}</>;
}
