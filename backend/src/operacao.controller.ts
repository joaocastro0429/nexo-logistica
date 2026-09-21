import { BadRequestException, Controller, ForbiddenException, Get, HttpCode, Param, Post, Req, Res, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { getStore } from './server/store';
import { criarIntegracoes } from './server/integracoes';

@Controller()
export class OperacaoController {
  private readonly store = getStore();
  private readonly integracoes = criarIntegracoes();
  private async sessao(req: Request, escrita = false) {
    if (escrita && req.headers.origin !== (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')) throw new ForbiddenException('Origem não permitida.');
    const sessao = await (await this.store).session(req.cookies?.['nexo-sessao']);
    if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
    return sessao;
  }
  @Get('integracoes/cep/:cep')
  async cep(@Req() req: Request, @Param('cep') cep: string) {
    await this.sessao(req); return this.integracoes.cep(cep);
  }
  @Get('integracoes/municipios/:uf')
  async municipios(@Req() req: Request, @Param('uf') uf: string) {
    await this.sessao(req); return this.integracoes.municipios(uf);
  }
  @Post('importacoes/clientes')
  @HttpCode(202)
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 256 * 1024, files: 1, fields: 0, parts: 2 } }))
  async importar(@Req() req: Request, @UploadedFile() arquivo?: { originalname: string; buffer: Buffer }) {
    const sessao = await this.sessao(req, true);
    if (!arquivo || !/\.csv$/i.test(arquivo.originalname)) throw new BadRequestException('Selecione um arquivo CSV.');
    return (await this.store).importacoes.iniciar(sessao, req.cookies['nexo-sessao'], arquivo.buffer);
  }
  @Get('importacoes/:id')
  async consultar(@Req() req: Request, @Param('id') id: string) {
    return (await this.store).importacoes.consultar(await this.sessao(req), id);
  }
  @Get('importacoes/:id/eventos')
  async eventos(@Req() req: Request, @Res() res: Response, @Param('id') id: string) {
    const store = await this.store;
    await store.importacoes.consultar(await this.sessao(req), id);
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    res.flushHeaders();
    let fechado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const encerrarStream = setTimeout(() => { if (!fechado) res.end(); }, 25000);
    res.on('close', () => { fechado = true; clearTimeout(timer); clearTimeout(encerrarStream); });
    const enviar = async () => {
      try {
        const p = await store.importacoes.consultar(await this.sessao(req), id);
        if (fechado) return;
        res.write(`data: ${JSON.stringify(p)}\n\n`);
        if (p.estado === 'concluida' || p.estado === 'falhou') { res.end(); return; }
        timer = setTimeout(() => void enviar(), 500);
      } catch { if (!fechado) { res.write('event: encerrado\ndata: {}\n\n'); res.end(); } }
    };
    await enviar();
  }
}
