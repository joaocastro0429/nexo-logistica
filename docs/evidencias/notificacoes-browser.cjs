const root = require('node:path').resolve(__dirname, '../..');
if (!process.env.REDIS_TEST_URL)
    throw new Error('Defina REDIS_TEST_URL para um Redis de teste.');
require(root + '/node_modules/reflect-metadata');
const { Module } = require(root + '/node_modules/@nestjs/common');
const { NestFactory } = require(root + '/node_modules/@nestjs/core');
const cookieParser = require(root + '/node_modules/cookie-parser');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
(async () => {
    const { abrirRedis } = require(root + '/backend/dist/src/server/redis');
    const { criarNotificacoesRedis } = require(root + '/backend/dist/src/infrastructure/repositories/notificacoes.repository');
    const { criarNotificacoes } = require(root + '/backend/dist/src/server/notificacoes');
    const redis = await abrirRedis(process.env.REDIS_TEST_URL);
    const namespace = 'nexo_browser_' + randomUUID();
    const servico = criarNotificacoes(criarNotificacoesRedis(redis, namespace));
    const modulo = require(root + '/backend/dist/src/server/store');
    const original = modulo.getStore;
    let token = 'a';
    const sessao = { usuarioId: 'u1', tenantId: 'a', empresa: 'Teste', nome: 'Teste', perfil: 'Administrador' };
    modulo.getStore = async () => ({ notificacoes: servico, session: async (t) => t === 'a' ? sessao : t === 'a2' ? { ...sessao, usuarioId: 'u2' } : t === 'b' ? { ...sessao, tenantId: 'b' } : null });
    const { NotificacoesController } = require(root + '/backend/dist/src/notificacoes.controller');
    class TestModule {
    }
    Module({ controllers: [NotificacoesController] })(TestModule);
    const app = await NestFactory.create(TestModule, { logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    try {
        await servico.publicar('a', 'frete_criado');
        const p = await browser.newPage();
        const errors = [];
        p.on('pageerror', e => errors.push(e.message));
        await p.route('**/api/**', async (r) => { const path = new URL(r.request().url()).pathname; if (path.startsWith('/api/notificacoes')) {
            const method = r.request().method();
            const res = await fetch(base + path, { method, headers: { Cookie: 'nexo-sessao=' + token, Origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000', 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: r.request().postData() } : {}) });
            await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
            return;
        } await r.fulfill({ json: path === '/api/plataforma' ? { sessao, resumo: [], rotas: [], evolucao: [], insights: [] } : [] }); });
        await p.goto(process.env.BASE_URL || 'http://localhost:3104/plataforma');
        const bell = p.getByRole('button', { name: 'Notificações', exact: true });
        await bell.waitFor();
        await p.locator('.notificacoes-contador').filter({ hasText: '1' }).waitFor();
        await bell.click();
        await p.getByRole('heading', { name: 'Nova simulação de frete' }).waitFor();
        await p.locator('.notificacoes-painel').screenshot({ path: '/tmp/nexo-notificacoes-desktop.png' });
        await p.getByRole('button', { name: 'Marcar como lidas', exact: true }).click();
        await p.getByText('Você está em dia', { exact: true }).waitFor();
        assert.equal((await servico.listar(sessao)).naoLidas, 0);
        await p.keyboard.press('Escape');
        assert.equal(await bell.getAttribute('aria-expanded'), 'false');
        await servico.publicar('a', 'frete_excluido');
        await bell.click();
        await p.getByRole('heading', { name: 'Simulação excluída' }).waitFor();
        await p.setViewportSize({ width: 390, height: 844 });
        await p.waitForTimeout(400);
        await p.locator('.notificacoes-painel').screenshot({ path: '/tmp/nexo-notificacoes-mobile.png' });
        const box = await p.locator('.notificacoes-painel').boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= 390);
        token = 'a2';
        await p.reload();
        await bell.click();
        await p.getByText('2 não lidas', { exact: true }).waitFor();
        token = 'b';
        await p.reload();
        await bell.click();
        await p.getByText('Nenhuma notificação por enquanto', { exact: true }).waitFor();
        assert.equal(await p.getByRole('heading', { name: 'Nova simulação de frete' }).count(), 0);
        assert.deepEqual(errors, []);
        console.log('PASS: navegador → API NestJS → Redis real; sino, contador, leitura por usuário, nova mensagem, isolamento e mobile. Autenticação e painel simulados.');
    }
    finally {
        await browser.close();
        await app.close();
        modulo.getStore = original;
        for await (const keys of redis.scanIterator({ MATCH: namespace + ':*', COUNT: 100 }))
            if (keys.length)
                await redis.del(keys);
        await redis.quit();
    }
})().catch(e => { console.error(e); process.exit(1); });
