import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFrete } from '../src/server/gestao';

test('cálculo usa o maior peso e arredonda as parcelas monetárias', () => {
    assert.deepEqual(calcularFrete(10, 60, 40, 50, 100, 1000, { taxa_base: 20, valor_kg: 2, valor_km: 0.5 }), {
        pesoCubado: 20, pesoCobrado: 20, base: 20, porPeso: 40, porDistancia: 50, seguro: 5, total: 115,
    });
    assert.equal(calcularFrete(30, 60, 40, 50, 100, 1000, { taxa_base: 20, valor_kg: 2, valor_km: 0.5 }).total, 135);
});

import { criarGestao } from '../src/server/gestao';
import { calcularPainel } from '../src/server/painel';
import type { GestaoRepository } from '../src/domain/repositories';
import type { Sessao } from '../src/types';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

test('exclusão de simulação restringe perfil e empresa e retira valores do painel', async () => {
    const sessao: Sessao = { usuarioId: 'u1', tenantId: 'a', empresa: 'A', nome: 'Admin', perfil: 'Administrador' };
    const snapshot = { criada_em: '2026-10-16T15:00:00Z', origem: 'A', destino: 'B', total: 115, peso: 10, pesoCubado: 20, porPeso: 40, transportadora: { id: 't1', nome: 'Transportadora removida', valor_kg: 2 } };
    const registros = new Map([['a:s1', JSON.stringify(snapshot)], ['b:s2', JSON.stringify(snapshot)]]);
    let escritas = 0;
    const repository = {
        removerSimulacao: async (tenant: string, id: string) => { escritas++; return registros.delete(`${tenant}:${id}`); },
        listarSimulacoes: async (tenant: string) => [...registros].filter(([key]) => key.startsWith(`${tenant}:`)).map(([, value]) => value),
    } as unknown as GestaoRepository;
    const gestao = criarGestao(repository);
    await assert.rejects(gestao.removerSimulacao({ ...sessao, perfil: 'Operador' }, 's1'), ForbiddenException);
    assert.equal(escritas, 0);
    await assert.rejects(gestao.removerSimulacao(sessao, 's2'), NotFoundException);
    assert.ok(registros.has('b:s2'));
    await assert.rejects(gestao.removerSimulacao(sessao, 'x'.repeat(65)), BadRequestException);
    assert.equal((await gestao.historico(sessao)).length, 1);
    assert.notDeepEqual(calcularPainel(await gestao.historico(sessao)), calcularPainel([]));
    assert.deepEqual(await gestao.removerSimulacao(sessao, 's1'), { ok: true });
    assert.deepEqual(await gestao.historico(sessao), []);
    const vazio = calcularPainel([], new Date('2026-10-16T15:00:00Z'));
    assert.deepEqual(calcularPainel((await gestao.historico(sessao)), new Date('2026-10-16T15:00:00Z')), vazio);
    await assert.rejects(gestao.removerSimulacao(sessao, 's1'), NotFoundException);
    assert.deepEqual(await gestao.removerSimulacao({ ...sessao, tenantId: 'b', perfil: 'Gestor' }, 's2'), { ok: true });
});
