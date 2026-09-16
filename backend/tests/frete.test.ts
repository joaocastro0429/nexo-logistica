import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFrete } from '../src/server/gestao';

test('cálculo usa o maior peso e arredonda as parcelas monetárias', () => {
    assert.deepEqual(calcularFrete(10, 60, 40, 50, 100, 1000, { taxa_base: 20, valor_kg: 2, valor_km: 0.5 }), {
        pesoCubado: 20, pesoCobrado: 20, base: 20, porPeso: 40, porDistancia: 50, seguro: 5, total: 115,
    });
    assert.equal(calcularFrete(30, 60, 40, 50, 100, 1000, { taxa_base: 20, valor_kg: 2, valor_km: 0.5 }).total, 135);
});
