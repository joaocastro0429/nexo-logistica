'use client';

import { apiFetch } from '../../lib/api';
import { FormEvent, useEffect, useState } from 'react';
import './gestao.css';
type Progresso = { id: string; estado: string; total: number; processadas: number; importadas: number; erros: { linha: number; mensagem: string }[] };
export default function Importacoes() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [job, setJob] = useState<Progresso | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [conexao, setConexao] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const ativo = job && ['aguardando', 'processando'].includes(job.estado);
  useEffect(() => {
    if (!job?.id || !ativo) return;
    const eventos = new EventSource(`/api/importacoes/${job.id}/eventos`);
    setConexao('Conectando ao acompanhamento...');
    eventos.onopen = () => setConexao('Acompanhamento em tempo real conectado.');
    eventos.onmessage = e => {
      const p = JSON.parse(e.data) as Progresso;
      setJob(p);
      if (['concluida', 'falhou'].includes(p.estado)) { eventos.close(); setConexao('Acompanhamento finalizado.'); }
    };
    eventos.onerror = () => setConexao('Conexão interrompida. Tentando reconectar...');
    eventos.addEventListener('encerrado', () => { eventos.close(); setConexao('Acompanhamento encerrado. Verifique sua sessão e consulte o status.'); });
    return () => eventos.close();
  }, [job?.id, ativo, tentativa]);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setErro('');
    if (!arquivo.name.toLowerCase().endsWith('.csv') || arquivo.size > 256 * 1024) { setErro('Selecione um CSV de até 256 KB.'); return; }
    setEnviando(true);
    try {
      const body = new FormData(); body.append('arquivo', arquivo);
      const res = await apiFetch('/api/importacoes/clientes', { method: 'POST', body });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.message || 'Falha no upload.');
      setJob(dados);
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  }
  async function consultar() {
    if (!job) return;
    try {
      const res = await apiFetch(`/api/importacoes/${job.id}`, { cache: 'no-store' });
      const dado = await res.json();
      if (!res.ok) throw new Error(dado.message || 'Falha ao consultar.');
      setJob(dado); setErro(''); setTentativa(t => t + 1);
    } catch (e) { setErro((e as Error).message); }
  }
  return <section className="gestao"><h2>Importação de clientes</h2><p>Importe clientes da operação com CSV em UTF-8, separado por vírgula ou ponto e vírgula. Limite: 256 KB e 500 registros. Os campos nome e email são obrigatórios; telefone e documento são opcionais.</p><p><a href="/modelo-clientes.csv" download>Baixar modelo CSV</a></p><form className="gestao-form" onSubmit={enviar}><label>Arquivo CSV<input type="file" accept=".csv,text/csv" required disabled={enviando || !!ativo} onChange={e => setArquivo(e.target.files?.[0] || null)} /></label><button className="button button-primary" disabled={enviando || !!ativo || !arquivo}>{enviando ? 'Enviando...' : 'Importar clientes'}</button></form>{erro && <p className="gestao-erro" role="alert">{erro}</p>}{job && <article aria-live="polite"><h3>Estado: {job.estado}</h3><progress aria-label="Registros processados" value={job.processadas} max={job.total} /><p>{job.processadas} de {job.total} processados · {job.importadas} importados · {job.erros.length} ocorrências</p><p>{conexao}</p><button onClick={consultar}>Consultar status / reconectar</button>{job.erros.length > 0 && <ul>{job.erros.map((e, i) => <li key={i}>Registro {e.linha}: {e.mensagem}</li>)}</ul>}{job.estado === 'concluida' && <p>Processamento concluído. Consulte os registros na seção Clientes.</p>}</article>}<p>Registros válidos são salvos individualmente. Erros não desfazem os clientes já importados. Reenviar o mesmo arquivo cria novos cadastros; confira o resultado antes de repetir. Mantenha esta tela aberta para acompanhar.</p></section>;
}
