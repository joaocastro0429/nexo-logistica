const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => { const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); try {
    for (const mfa of [false, true]) {
        const page = await browser.newPage();
        await page.route('**/api/**', r => { const path = new URL(r.request().url()).pathname; return r.fulfill({ json: path === '/api/oauth/providers' ? { github: true, google: false } : path === '/api/seguranca' ? { mfa: false, providers: [] } : path === '/api/sessao' && mfa ? { mfaRequired: true } : { ok: true } }); });
        await page.goto((process.env.BASE_URL || 'http://localhost:3105') + '/login?oauth=nao_vinculado');
        await page.getByText('Esta conta do provedor ainda não está vinculada ao Nexo.', { exact: false }).waitFor();
        await page.getByLabel('E-mail profissional').fill('teste@example.com');
        await page.getByLabel('Senha', { exact: true }).fill('senha-ficticia');
        await page.getByRole('button', { name: 'Entrar na plataforma', exact: true }).click();
        if (mfa) {
            await page.getByLabel('Código do autenticador ou de recuperação').fill('123456');
            await page.getByRole('button', { name: 'Verificar código e entrar', exact: true }).click();
        }
        await page.waitForURL('**/seguranca?vincular=1');
        await page.getByText('Para habilitar o login pelo provedor, confirme sua senha abaixo', { exact: false }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Vincular', exact: true }).isDisabled(), true);
        await page.close();
    }
    console.log('PASS: mensagem de conta sem vínculo; login com senha e com MFA encaminham à Segurança; vínculo continua exigindo reautenticação. APIs simuladas.');
}
finally {
    await browser.close();
} })().catch(e => { console.error(e); process.exit(1); });
