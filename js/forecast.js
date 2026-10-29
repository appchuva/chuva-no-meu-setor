// Busca a previsão no Open-Meteo e calcula o "pior caso" do setor.
//
// Atenção (conferido na documentação do Open-Meteo em 29/10/2026):
// - No Brasil só há modelos globais (células de ~9 a 25 km). Dado de 15 em 15
//   minutos aqui é só a previsão horária "esticada", por isso usamos a horária.
// - Cada valor horário vale para a hora ANTERIOR ao horário: o valor das 16:00
//   é a chuva entre 15h e 16h.

const URL_OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const UMA_HORA = 3600 * 1000;

// Diz o que deu errado em palavras simples, para mostrar na tela.
export class ErroPrevisao extends Error {
  constructor(tipo, causa) {
    const textos = {
      'sem-internet': 'Este aparelho está sem internet.',
      'sem-resposta': 'O serviço de previsão (Open-Meteo) não respondeu. Pode ser a sua internet ou o serviço fora do ar.',
      'servico-com-erro': 'O serviço de previsão (Open-Meteo) está com problema agora. Não é a sua internet.',
    };
    super(textos[tipo], { cause: causa });
    this.tipo = tipo;
  }
}

export async function buscarPrevisao(pontos) {
  const parametros = new URLSearchParams({
    latitude: pontos.map((p) => p[0].toFixed(4)).join(','),
    longitude: pontos.map((p) => p[1].toFixed(4)).join(','),
    hourly: 'precipitation_probability,precipitation,weather_code',
    daily: 'weather_code,precipitation_probability_max,precipitation_sum,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
  });
  let resposta;
  try {
    // Se o serviço travar, desiste depois de 20 segundos em vez de esperar para sempre.
    resposta = await fetch(`${URL_OPEN_METEO}?${parametros}`, { signal: AbortSignal.timeout(20000) });
  } catch (erro) {
    throw new ErroPrevisao(navigator.onLine === false ? 'sem-internet' : 'sem-resposta', erro);
  }
  if (!resposta.ok) throw new ErroPrevisao('servico-com-erro', new Error(`HTTP ${resposta.status}`));
  const dados = await resposta.json().catch((erro) => { throw new ErroPrevisao('servico-com-erro', erro); });
  return Array.isArray(dados) ? dados : [dados];
}

// Quanto mais alto, mais grave: trovoada > pancada > chuva > garoa > sem chuva.
export function gravidadeCodigo(codigo) {
  if (codigo >= 95) return 4;
  if (codigo >= 80) return 3;
  if (codigo >= 61) return 2;
  if (codigo >= 51) return 1;
  return 0;
}

// Nota de risco usada para comparar partes do setor.
function pontuar({ prob, mm, codigo }) {
  return prob * (1 + Math.min(mm, 10) / 2) * (codigo >= 95 ? 1.5 : 1);
}

// "Vai chover" = chance de 50% ou mais, ou modelo prevendo chuva com chance razoável.
export function chove(h) {
  return h.prob >= 50 || (h.mm >= 0.5 && h.prob >= 30);
}

// 0 = seco, 1 = pouca chance, 2 = possível, 3 = provável
export function nivel(h) {
  if (chove(h)) return 3;
  if (h.prob >= 30) return 2;
  if (h.prob >= 15 || h.mm >= 0.1) return 1;
  return 0;
}

export function intensidade(h) {
  if (h.codigo >= 95) return 'temporal';
  if (h.mm >= 6) return 'forte';
  if (h.mm >= 2) return 'moderada';
  if (h.mm >= 0.2) return 'fraca';
  return '';
}

export function analisar(pontos, respostas, agora = Date.now()) {
  const desvio = respostas[0].utc_offset_seconds * 1000;
  // "2026-10-29T14:00" (hora local) -> instante real
  const instante = (texto) => Date.parse(`${texto}:00Z`) - desvio;
  const dataLocal = (ms) => new Date(ms + desvio).toISOString().slice(0, 10);
  const horaLocal = (ms) => new Date(ms + desvio).getUTCHours();

  // Pontos próximos caem na mesma célula do modelo: junta os repetidos.
  const celulas = [];
  const indicePorChave = new Map();
  const celulaDoPonto = respostas.map((r) => {
    const chave = `${r.latitude},${r.longitude}`;
    if (!indicePorChave.has(chave)) {
      indicePorChave.set(chave, celulas.length);
      celulas.push({ lat: r.latitude, lng: r.longitude, resposta: r });
    }
    return indicePorChave.get(chave);
  });

  const hoje = dataLocal(agora);
  const amanha = dataLocal(agora + 24 * UMA_HORA);
  const base = celulas[0].resposta;

  const solPorData = new Map(base.daily.time.map((d, i) => [d, {
    nascer: instante(base.daily.sunrise[i]),
    por: instante(base.daily.sunset[i]),
  }]));

  const horas = [];
  base.hourly.time.forEach((texto, i) => {
    const fim = instante(texto);
    const inicio = fim - UMA_HORA;
    if (fim <= agora || dataLocal(inicio) > amanha) return;
    const porCelula = celulas.map(({ resposta: { hourly: h } }) => ({
      prob: h.precipitation_probability[i] ?? 0,
      mm: h.precipitation[i] ?? 0,
      codigo: h.weather_code[i] ?? 0,
    }));
    const meio = inicio + UMA_HORA / 2;
    const sol = solPorData.get(dataLocal(meio));
    horas.push({
      inicio,
      fim,
      data: dataLocal(inicio),
      hora: horaLocal(inicio),
      noite: sol ? meio < sol.nascer || meio > sol.por : false,
      prob: Math.max(...porCelula.map((c) => c.prob)),
      mm: Math.max(...porCelula.map((c) => c.mm)),
      codigo: porCelula.reduce((m, c) => (gravidadeCodigo(c.codigo) > gravidadeCodigo(m) ? c.codigo : m), 0),
      porCelula,
    });
  });

  const dias = base.daily.time.map((data, i) => {
    const doDia = celulas.map(({ resposta: { daily: d } }) => ({
      prob: d.precipitation_probability_max[i] ?? 0,
      mm: d.precipitation_sum[i] ?? 0,
      codigo: d.weather_code[i] ?? 0,
    }));
    return {
      data,
      prob: Math.max(...doDia.map((c) => c.prob)),
      mm: Math.max(...doDia.map((c) => c.mm)),
      codigo: doDia.reduce((m, c) => (gravidadeCodigo(c.codigo) > gravidadeCodigo(m) ? c.codigo : m), 0),
    };
  });

  return { desvio, hoje, amanha, celulas, celulaDoPonto, horas, dias, pontos };
}

// ---------- Textos ----------

export function formatarHora(ms, analise) {
  return `${new Date(ms + analise.desvio).getUTCHours()}h`;
}

function blocosDeChuva(horas) {
  const blocos = [];
  let atual = null;
  for (const h of horas) {
    if (chove(h)) {
      if (!atual) {
        atual = { inicio: h.inicio, fim: h.fim, horas: [] };
        blocos.push(atual);
      }
      atual.fim = h.fim;
      atual.horas.push(h);
    } else {
      atual = null;
    }
  }
  return blocos;
}

function descreverBloco(bloco) {
  const probMax = Math.max(...bloco.horas.map((h) => h.prob));
  const mmMax = Math.max(...bloco.horas.map((h) => h.mm));
  let tipo = 'chuva';
  if (bloco.horas.some((h) => h.codigo >= 95)) tipo = 'temporal';
  else if (mmMax >= 6) tipo = 'chuva forte';
  else if (mmMax >= 2) tipo = 'chuva moderada';
  const chance = probMax >= 75 ? 'muito provável' : 'provável';
  return { tipo, chance };
}

function maiusculo(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Ex.: "Sem chuva até 14h · temporal provável entre 15h e 17h"
export function resumo(analise, janelaHoras = 12) {
  const horas = analise.horas.slice(0, janelaHoras);
  if (horas.length === 0) return { principal: 'Sem dados para as próximas horas.', detalhe: '' };
  const hh = (ms) => {
    const texto = formatarHora(ms, analise);
    const dia = new Date(ms + analise.desvio).toISOString().slice(0, 10);
    return dia === analise.hoje || texto === '0h' ? texto : `${texto} de amanhã`;
  };
  // Blocos calculados com todas as horas, para não cortar uma chuva no fim da janela.
  const fimDaJanela = horas[horas.length - 1].fim;
  const blocos = blocosDeChuva(analise.horas).filter((b) => b.inicio < fimDaJanela);

  if (blocos.length === 0) {
    const possivel = horas.find((h) => nivel(h) === 2);
    return {
      principal: `Sem chuva prevista nas próximas ${horas.length} horas`,
      detalhe: possivel
        ? `Pancada possível por volta das ${formatarHora(possivel.inicio, analise)} (${possivel.prob}% de chance).`
        : '',
    };
  }

  const [primeiro, segundo] = blocos;
  const { tipo, chance } = descreverBloco(primeiro);
  let principal;
  if (primeiro.inicio === horas[0].inicio) {
    principal = primeiro.fim >= fimDaJanela
      ? `${maiusculo(tipo)} ${chance} agora e nas próximas horas`
      : `${maiusculo(tipo)} ${chance} agora, até ${hh(primeiro.fim)}`;
  } else {
    principal = `Sem chuva até ${hh(primeiro.inicio)} · ${tipo} ${chance} entre ${hh(primeiro.inicio)} e ${hh(primeiro.fim)}`;
  }
  let detalhe = '';
  if (segundo) {
    const s = descreverBloco(segundo);
    detalhe = `Depois, ${s.tipo} ${s.chance} de novo entre ${hh(segundo.inicio)} e ${hh(segundo.fim)}.`;
  }
  return { principal, detalhe };
}

// Nota de risco de cada célula numa janela de horas; aponta a pior.
export function riscoPorCelula(analise, horas) {
  const notas = analise.celulas.map((_, c) => horas.reduce((s, h) => s + pontuar(h.porCelula[c]), 0));
  const probMax = analise.celulas.map((_, c) => Math.max(0, ...horas.map((h) => h.porCelula[c].prob)));
  const mmMax = analise.celulas.map((_, c) => Math.max(0, ...horas.map((h) => h.porCelula[c].mm)));
  const maior = Math.max(...notas);
  const menor = Math.min(...notas);
  const pior = notas.indexOf(maior);
  // Diferença pequena = o setor todo está na mesma situação.
  const diferente = analise.celulas.length > 1 && maior > 0 && (maior - menor) / maior > 0.15;
  return { notas, probMax, mmMax, pior, diferente };
}
