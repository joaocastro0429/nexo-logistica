import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPainel, type SimulacaoAnalitica } from '../src/server/painel';
const agora = new Date('2026-09-17T12:00:00Z');
const simulacao = (extra: Partial<SimulacaoAnalitica> = {}): SimulacaoAnalitica => ({
  criada_em: '2026-09-17T10:00:00Z', origem: 'São Paulo', destino: 'Campinas', total: 115,
  peso: 10, pesoCubado: 20, porPeso: 40, transportadora: { id: 't1', nome: 'Transportadora', valor_kg: 2 }, ...extra,
});
test('painel vazio apresenta zeros e sete dias ordenados na virada do mês', () => {
  const p = calcularPainel([], new Date('2026-03-02T00:01:00Z'));
  assert.equal(p.resumo[0].valor, '0');
  assert.deepEqual(p.rotas, []);
  assert.equal(p.evolucao[0].data, '2026-02-24');
  assert.equal(p.evolucao[6].data, '2026-03-02');
  assert.ok(p.evolucao.every(d => d.quantidade === 0));
  assert.equal(p.insights[0].titulo, 'Comece a construir seu histórico');
});
test('agrega snapshots, agrupa trajetos e quantifica cubagem e concentração', () => {
  const dados = [simulacao(), simulacao({ origem: ' são paulo ', total: 135 }), simulacao({ criada_em: '2026-09-01T10:00:00Z', total: 50, destino: 'Santos', pesoCubado: 5, porPeso: 20 })];
  const p = calcularPainel(dados, agora);
  assert.equal(p.resumo[0].valor, '3');
  assert.match(p.resumo[1].valor, /300,00/);
  assert.match(p.resumo[2].valor, /100,00/);
  assert.equal(p.rotas[0].quantidade, 2);
  assert.equal(p.rotas[0].media, 125);
  assert.equal(p.evolucao[6].quantidade, 2);
  assert.match(p.insights.find(i => i.titulo === 'Impacto da cubagem')!.descricao, /40,00/);
  assert.match(p.insights.find(i => i.titulo === 'Concentração de cotações')!.descricao, /100.0%/);
});
test('variação exige amostra mínima e compara janelas sem sobreposição', () => {
  const dados = Array.from({ length: 3 }, () => simulacao({ total: 120 })).concat(Array.from({ length: 3 }, () => simulacao({ total: 100, criada_em: '2026-09-10T23:59:59Z' })));
  assert.match(calcularPainel(dados, agora).insights.find(i => i.titulo === 'Variação do frete médio')!.descricao, /subiu 20.0%/);
  assert.ok(!calcularPainel(dados.slice(1), agora).insights.some(i => i.titulo === 'Variação do frete médio'));
  assert.ok(!calcularPainel(dados.map(s => ({ ...s, total: 0 })), agora).insights.some(i => i.titulo === 'Variação do frete médio'));
});
