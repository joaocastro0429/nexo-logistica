import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export function criarIntegracoes(buscar: typeof fetch = fetch) {
  async function json(url: string): Promise<any> {
    try {
      const resposta = await buscar(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (!resposta.ok) throw new Error();
      return await resposta.json();
    } catch { throw new BadGatewayException('Serviço externo indisponível. Tente novamente.'); }
  }
  return {
    async cep(cep: string) {
      if (!/^\d{8}$/.test(cep)) throw new BadRequestException('Informe oito dígitos para o CEP.');
      const dado = await json(`https://viacep.com.br/ws/${cep}/json/`);
      if (dado?.erro) throw new NotFoundException('CEP não encontrado.');
      if (typeof dado?.localidade !== 'string' || !UFS.includes(dado.uf)) throw new BadGatewayException('Resposta inválida do ViaCEP.');
      return { cidade: dado.localidade, uf: dado.uf, logradouro: typeof dado.logradouro === 'string' ? dado.logradouro : '', bairro: typeof dado.bairro === 'string' ? dado.bairro : '' };
    },
    async municipios(uf: string) {
      if (!UFS.includes(uf)) throw new BadRequestException('UF inválida.');
      const dados = await json(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
      if (!Array.isArray(dados) || dados.some(d => !Number.isInteger(d?.id) || typeof d?.nome !== 'string')) throw new BadGatewayException('Resposta inválida do IBGE.');
      return dados.map(d => ({ id: d.id as number, nome: d.nome as string }));
    },
  };
}
