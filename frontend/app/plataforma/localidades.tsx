'use client';

import { apiFetch } from '../../lib/api';
import { useState } from 'react';
const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export default function Localidades({ aplicar }: { aplicar: (campo: string, cidade: string) => void }) {
  const [cep, setCep] = useState('');
  const [uf, setUf] = useState('SP');
  const [campo, setCampo] = useState('destino');
  const [municipios, setMunicipios] = useState<{ id: number; nome: string }[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function consultar(tipo: 'cep' | 'municipios') {
    setErro(''); setAviso(''); setOcupado(true);
    try {
      const res = await apiFetch(`/api/integracoes/${tipo}/${tipo === 'cep' ? cep.replace(/\D/g, '') : uf}`);
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.message || 'Consulta indisponível.');
      if (tipo === 'cep') { aplicar(campo, `${dados.cidade}/${dados.uf}`); setAviso(`ViaCEP: ${dados.logradouro} ${dados.bairro} — ${dados.cidade}/${dados.uf}. Cidade aplicada à ${campo}.`); }
      else setMunicipios(dados);
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }
  return <details><summary>Buscar cidade por CEP ou UF</summary><p>Use ViaCEP ou IBGE para preencher a cidade do trajeto. A distância continua sendo informada manualmente.</p><div className="gestao-campos"><label>Aplicar em<select disabled={ocupado} value={campo} onChange={e => setCampo(e.target.value)}><option value="origem">Origem</option><option value="destino">Destino</option></select></label><label>CEP (ViaCEP)<input value={cep} maxLength={9} placeholder="01001-000" onChange={e => setCep(e.target.value)} /></label><button type="button" disabled={ocupado || !/^\d{8}$/.test(cep.replace(/\D/g, ''))} onClick={() => consultar('cep')}>Consultar CEP</button><label>UF (IBGE)<select value={uf} disabled={ocupado} onChange={e => { setUf(e.target.value); setMunicipios([]); }}>{ufs.map(u => <option key={u}>{u}</option>)}</select></label><button type="button" disabled={ocupado} onClick={() => consultar('municipios')}>Carregar municípios</button>{municipios.length > 0 && <label>Município<select value="" onChange={e => { aplicar(campo, `${e.target.value}/${uf}`); setAviso(`Cidade aplicada à ${campo}.`); }}><option value="">Selecione para aplicar</option>{municipios.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}</select></label>}</div>{ocupado && <p role="status">Consultando serviço externo...</p>}{erro && <p role="alert" className="gestao-erro">{erro}</p>}{aviso && <p role="status">{aviso}</p>}</details>;
}
