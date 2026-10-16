'use client';

import { apiFetch } from '../../lib/api';
import { useEffect, useRef, useState } from 'react';
const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
type Municipio = { id: number; nome: string };
type Endereco = { cidade: string; uf: string; logradouro: string; bairro: string };

async function buscar<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await apiFetch(url, { signal });
  const dados = await res.json();
  if (!res.ok) throw new Error(dados.message || 'Consulta indisponível.');
  return dados;
}

export default function Localidades({ aplicar }: { aplicar: (campo: string, cidade: string) => void }) {
  const aplicarRef = useRef(aplicar);
  useEffect(() => { aplicarRef.current = aplicar; }, [aplicar]);
  const [aberto, setAberto] = useState(false);
  const [cep, setCep] = useState('');
  const [uf, setUf] = useState('SP');
  const [campo, setCampo] = useState('destino');
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipio, setMunicipio] = useState('');
  const [erroCep, setErroCep] = useState('');
  const [erroMunicipios, setErroMunicipios] = useState('');
  const [aviso, setAviso] = useState('');
  const [consultandoCep, setConsultandoCep] = useState(false);
  const [carregandoMunicipios, setCarregandoMunicipios] = useState(false);
  const [tentativaCep, setTentativaCep] = useState(0);
  const [tentativaMunicipios, setTentativaMunicipios] = useState(0);
  const cepNumerico = cep.replace(/\D/g, '');

  useEffect(() => {
    setErroCep('');
    setConsultandoCep(false);
    if (!/^\d{8}$/.test(cepNumerico)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setConsultandoCep(true);
      setAviso('');
      try {
        const dados = await buscar<Endereco>(`/api/integracoes/cep/${cepNumerico}`, controller.signal);
        if (controller.signal.aborted) return;
        setUf(dados.uf);
        setMunicipio(dados.cidade);
        aplicarRef.current(campo, `${dados.cidade}/${dados.uf}`);
        setAviso(`ViaCEP: ${[dados.logradouro, dados.bairro].filter(Boolean).join(', ')} — ${dados.cidade}/${dados.uf}. Campo ${campo === 'origem' ? 'Origem' : 'Destino'} preenchido abaixo.`);
      } catch (e) {
        if (!controller.signal.aborted) setErroCep((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setConsultandoCep(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [cepNumerico, campo, tentativaCep]);

  useEffect(() => {
    setErroMunicipios('');
    setCarregandoMunicipios(false);
    if (!aberto) return;
    const controller = new AbortController();
    setMunicipios([]);
    setCarregandoMunicipios(true);
    buscar<Municipio[]>(`/api/integracoes/municipios/${uf}`, controller.signal)
      .then(dados => { if (!controller.signal.aborted) setMunicipios(dados); })
      .catch((e: Error) => { if (!controller.signal.aborted) setErroMunicipios(e.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregandoMunicipios(false); });
    return () => controller.abort();
  }, [aberto, uf, tentativaMunicipios]);

  return <details onToggle={e => setAberto(e.currentTarget.open)}>
    <summary>Buscar cidade por CEP ou UF</summary>
    <p>Digite o CEP completo para preencher a cidade automaticamente, ou escolha uma UF para carregar seus municípios. A distância continua sendo informada manualmente.</p>
    <div className="gestao-campos">
      <label>Aplicar em<select value={campo} onChange={e => { setCampo(e.target.value); setCep(''); setMunicipio(''); setAviso(''); }}><option value="origem">Origem</option><option value="destino">Destino</option></select></label>
      <label>CEP (ViaCEP)<input value={cep} inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="01001-000" onChange={e => { setCep(e.target.value); setAviso(''); }} /></label>
      <label>UF (IBGE)<select value={uf} onChange={e => { setUf(e.target.value); setCep(''); setMunicipios([]); setMunicipio(''); setAviso(''); }}>{ufs.map(u => <option key={u}>{u}</option>)}</select></label>
      <label>Município<select disabled={consultandoCep || carregandoMunicipios || (!municipios.length && !municipio)} value={municipio} onChange={e => {
        const cidade = e.target.value;
        setCep('');
        setMunicipio(cidade);
        setAviso('');
        if (!cidade) return;
        aplicar(campo, `${cidade}/${uf}`);
        setAviso(`Campo ${campo === 'origem' ? 'Origem' : 'Destino'} preenchido abaixo: ${cidade}/${uf}.`);
      }}>
        <option value="">{carregandoMunicipios ? 'Carregando municípios...' : 'Selecione para aplicar'}</option>
        {municipio && !municipios.some(m => m.nome === municipio) && <option value={municipio}>{municipio}</option>}
        {municipios.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
      </select></label>
    </div>
    {consultandoCep && <p role="status">Consultando CEP...</p>}
    {carregandoMunicipios && <p role="status">Carregando municípios...</p>}
    {erroCep && <><p role="alert" className="gestao-erro">{erroCep}</p><button type="button" onClick={() => setTentativaCep(atual => atual + 1)}>Tentar CEP novamente</button></>}
    {erroMunicipios && <><p role="alert" className="gestao-erro">{erroMunicipios}</p><button type="button" onClick={() => setTentativaMunicipios(atual => atual + 1)}>Tentar municípios novamente</button></>}
    {aviso && <p role="status">{aviso}</p>}
  </details>;
}
