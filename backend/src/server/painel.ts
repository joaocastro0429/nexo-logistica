import type { Painel } from '../types';

export type SimulacaoAnalitica = {
  criada_em: string; origem: string; destino: string; total: number;
  peso: number; pesoCubado: number; porPeso: number;
  transportadora: { id: string; nome: string; valor_kg: number };
};
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (data: Date) => data.toISOString().slice(0, 10);

// As regras usam exclusivamente os snapshots já filtrados pela empresa no repositório.
export function calcularPainel(dados: SimulacaoAnalitica[], agora = new Date()): Omit<Painel, 'sessao'> {
  const total = dados.reduce((soma, s) => soma + Math.round(s.total * 100), 0) / 100;
  const evolucao = Array.from({ length: 7 }, (_, i) => {
    const data = new Date(agora);
    data.setUTCDate(data.getUTCDate() - 6 + i);
    return { data: dia(data), quantidade: 0 };
  });
  const rotas = new Map<string, { id: string; nome: string; quantidade: number; centavos: number }>();
  const transportadoras = new Map<string, { nome: string; quantidade: number }>();
  let cubadas = 0, impacto = 0;
  for (const s of dados) {
    const ponto = evolucao.find(d => d.data === s.criada_em.slice(0, 10));
    if (ponto) ponto.quantidade++;
    const id = JSON.stringify([s.origem.trim().toLowerCase(), s.destino.trim().toLowerCase()]);
    const rota = rotas.get(id) || { id, nome: `${s.origem} → ${s.destino}`, quantidade: 0, centavos: 0 };
    rota.quantidade++; rota.centavos += Math.round(s.total * 100); rotas.set(id, rota);
    const t = transportadoras.get(s.transportadora.id) || { nome: s.transportadora.nome, quantidade: 0 };
    t.quantidade++; transportadoras.set(s.transportadora.id, t);
    if (s.pesoCubado > s.peso) {
      cubadas++;
      impacto += Math.round(s.porPeso * 100) - Math.round((s.peso * s.transportadora.valor_kg + Number.EPSILON) * 100);
    }
  }
  const insights: Painel['insights'] = [];
  if (!dados.length) insights.push({ titulo: 'Comece a construir seu histórico', descricao: 'Realize uma simulação para gerar indicadores e análises da sua empresa.' });
  if (cubadas) insights.push({ titulo: 'Impacto da cubagem', descricao: `${cubadas} de ${dados.length} simulações tiveram peso cubado maior que o real. A diferença na parcela por peso soma ${moeda(impacto / 100)}. Revise as dimensões das embalagens; a redução efetiva depende da carga.` });
  const dominante = [...transportadoras.values()].sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome))[0];
  if (dominante && dados.length >= 3 && dominante.quantidade / dados.length >= 0.7) insights.push({ titulo: 'Concentração de cotações', descricao: `${dominante.nome} representa ${(dominante.quantidade / dados.length * 100).toFixed(1)}% das ${dados.length} simulações. Compare alternativas para os mesmos parâmetros antes de escolher a transportadora.` });
  const inicio = new Date(`${dia(agora)}T00:00:00Z`).getTime();
  const recentes = dados.filter(s => { const idade = inicio - new Date(`${s.criada_em.slice(0, 10)}T00:00:00Z`).getTime(); return idade >= 0 && idade < 7 * 86400000; });
  const anteriores = dados.filter(s => { const idade = inicio - new Date(`${s.criada_em.slice(0, 10)}T00:00:00Z`).getTime(); return idade >= 7 * 86400000 && idade < 14 * 86400000; });
  if (recentes.length >= 3 && anteriores.length >= 3) {
    const media = (itens: SimulacaoAnalitica[]) => itens.reduce((soma, s) => soma + s.total, 0) / itens.length;
    const anterior = media(anteriores);
    if (anterior > 0) {
      const variacao = (media(recentes) / anterior - 1) * 100;
      if (Math.abs(variacao) >= 10) insights.push({ titulo: 'Variação do frete médio', descricao: `O frete médio ${variacao > 0 ? 'subiu' : 'caiu'} ${Math.abs(variacao).toFixed(1)}% nos últimos 7 dias (${recentes.length} simulações), frente aos 7 anteriores (${anteriores.length}). Mudanças de trajeto, peso e transportadora podem explicar a diferença; ela não representa economia realizada.` });
    }
  }
  if (dados.length && !insights.length) insights.push({ titulo: 'Sem alertas nas regras atuais', descricao: `Foram analisadas ${dados.length} simulações. Continue simulando para ampliar a base de comparação.` });
  return {
    resumo: [
      { titulo: 'Simulações realizadas', valor: String(dados.length), variacao: 'Todo o histórico da empresa' },
      { titulo: 'Valor total estimado', valor: moeda(total), variacao: 'Soma das cotações; não é gasto realizado' },
      { titulo: 'Frete médio estimado', valor: moeda(dados.length ? total / dados.length : 0), variacao: 'Valor total dividido pelas simulações' },
    ],
    rotas: [...rotas.values()].sort((a, b) => b.quantidade - a.quantidade || a.id.localeCompare(b.id)).slice(0, 5).map(r => ({ id: r.id, nome: r.nome, quantidade: r.quantidade, media: r.centavos / 100 / r.quantidade })),
    evolucao, insights,
  };
}
