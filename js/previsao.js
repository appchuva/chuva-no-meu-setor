// Tela "Chuva no meu setor": resumo, linha do tempo, mapa de risco e próximos dias.

import { nivel, intensidade, resumo, riscoPorCelula, formatarHora, gravidadeCodigo } from './forecast.js';
import { criarMapaBase, camadaDoLugar } from './mapa.js';
import { centroide, distanciaKm, direcao } from './geo.js';

const CORES = ['#cfd8e3', '#9cc3ec', '#4f95dd', '#1f5fbf'];
const COR_TEMPORAL = '#6a2fb0';
const PROXIMAS = 6;
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function corDaHora(h) {
  return h.codigo >= 95 && nivel(h) >= 2 ? COR_TEMPORAL : CORES[nivel(h)];
}

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function nomeDoDia(data, analise) {
  if (data === analise.hoje) return 'Hoje';
  if (data === analise.amanha) return 'Amanhã';
  const d = new Date(`${data}T12:00:00Z`);
  return `${DIAS_SEMANA[d.getUTCDay()]}, ${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

function textoDaHora(h) {
  const n = nivel(h);
  if (n === 0) return 'sem chuva';
  const forca = intensidade(h);
  if (n === 1) return forca ? `pouca chance · ${forca}` : 'pouca chance';
  if (n === 2) return forca ? `possível · ${forca}` : 'possível';
  return forca ? `chuva ${forca}` : 'chuva';
}

function descreverDia(d) {
  if (d.prob < 30 && d.mm < 1) return 'pouca ou nenhuma chuva';
  const g = gravidadeCodigo(d.codigo);
  if (g === 4) return 'temporais';
  if (g === 3) return 'pancadas de chuva';
  if (g >= 1) return 'chuva';
  return 'chuva possível';
}

// Períodos dos atalhos. Se o de hoje já passou, usa o de amanhã.
function periodos(analise) {
  const faixa = (de, ate) => (h) => h.hora >= de && h.hora < ate;
  const definicoes = [
    { nome: 'Manhã', filtro: faixa(6, 12) },
    { nome: 'Tarde', filtro: faixa(12, 18) },
    { nome: 'Noite', filtro: faixa(18, 24) },
  ];
  const lista = definicoes.map(({ nome, filtro }) => {
    let horas = analise.horas.filter((h) => h.data === analise.hoje && filtro(h));
    let quando = 'hoje';
    if (horas.length === 0) {
      horas = analise.horas.filter((h) => h.data === analise.amanha && filtro(h));
      quando = 'amanhã';
    }
    return { nome, quando, horas };
  });
  lista.push({
    nome: 'Amanhã',
    quando: '6h às 22h',
    horas: analise.horas.filter((h) => h.data === analise.amanha && h.hora >= 6 && h.hora < 22),
  });
  return lista.filter((p) => p.horas.length);
}

export function criarTelaPrevisao(els) {
  let mapa = null;
  let camadaRisco = null;
  let analiseAtual = null;
  let lugarAtual = null;

  function linhaDaHora(h, analise) {
    const li = el('li', `hora${h.noite ? ' noite' : ''}`);
    li.dataset.inicio = h.inicio;
    li.append(el('span', 'quando', `${formatarHora(h.inicio, analise)}–${formatarHora(h.fim, analise)}`));
    const barra = el('span', 'barra');
    const preenchido = el('span', 'preenchido');
    preenchido.style.width = `${Math.max(h.prob, 2)}%`;
    preenchido.style.background = corDaHora(h);
    barra.append(preenchido);
    li.append(barra);
    li.append(el('span', 'chance', `${h.prob}%`));
    const raio = h.codigo >= 95 && nivel(h) >= 2 ? ' ⚡' : '';
    const mm = h.mm >= 0.1 ? ` · ${h.mm.toFixed(1).replace('.', ',')} mm` : '';
    li.append(el('span', 'descricao', textoDaHora(h) + mm + raio));
    return li;
  }

  function desenharLinhaDoTempo(analise) {
    els.proximas.replaceChildren(...analise.horas.slice(0, PROXIMAS).map((h) => linhaDaHora(h, analise)));
    els.resto.replaceChildren();
    let dataAtual = null;
    for (const h of analise.horas.slice(PROXIMAS)) {
      if (h.data !== dataAtual) {
        dataAtual = h.data;
        els.resto.append(el('li', 'cabecalho-dia', nomeDoDia(h.data, analise)));
      }
      els.resto.append(linhaDaHora(h, analise));
    }
  }

  function desenharAtalhos(analise) {
    els.atalhos.replaceChildren();
    for (const p of periodos(analise)) {
      const prob = Math.max(...p.horas.map((h) => h.prob));
      const pior = p.horas.reduce((a, b) => (nivel(b) > nivel(a) ? b : a));
      const b = el('button', 'atalho');
      b.type = 'button';
      const marca = el('span', 'marca');
      marca.style.background = corDaHora(pior);
      b.append(marca, el('strong', '', p.nome), el('span', 'atalho-sub', `${p.quando} · até ${prob}%`));
      b.addEventListener('click', () => irParaPeriodo(p, b));
      els.atalhos.append(b);
    }
  }

  function irParaPeriodo(periodo, botao) {
    els.atalhos.querySelectorAll('.atalho').forEach((b) => b.classList.toggle('ativo', b === botao));
    const inicios = new Set(periodo.horas.map((h) => String(h.inicio)));
    const linhas = [...document.querySelectorAll('.linha-tempo .hora')].filter((li) => inicios.has(li.dataset.inicio));
    document.querySelectorAll('.linha-tempo .hora.destaque').forEach((li) => li.classList.remove('destaque'));
    linhas.forEach((li) => li.classList.add('destaque'));
    desenharRisco(periodo.horas, `${periodo.nome} (${periodo.quando})`);
    linhas[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function desenharRisco(horas, rotulo) {
    const analise = analiseAtual;
    els.tituloRisco.textContent = `Onde o risco é maior · ${rotulo}`;
    if (!mapa) {
      mapa = criarMapaBase(els.mapa, { scrollWheelZoom: false });
      camadaRisco = L.layerGroup().addTo(mapa);
    }
    camadaRisco.clearLayers();
    camadaDoLugar(lugarAtual, { fillOpacity: 0.05, interactive: false }).addTo(camadaRisco);

    const risco = riscoPorCelula(analise, horas);
    analise.pontos.forEach((p, i) => {
      const c = analise.celulaDoPonto[i];
      const ehPior = risco.diferente && c === risco.pior;
      const h = { prob: risco.probMax[c], mm: risco.mmMax[c], codigo: 0 };
      L.circleMarker(p, {
        radius: ehPior ? 11 : 7,
        color: ehPior ? '#c0392b' : '#ffffff',
        weight: ehPior ? 3 : 2,
        fillColor: CORES[nivel(h)],
        fillOpacity: 0.95,
      }).bindTooltip(`Chance máxima: ${risco.probMax[c]}%${ehPior ? ' · parte mais arriscada' : ''}`)
        .addTo(camadaRisco);
    });

    if (lugarAtual.tipo === 'ponto') {
      els.legendaRisco.textContent = 'Lugar marcado como ponto: a previsão vale para a área ao redor dele.';
    } else if (risco.diferente) {
      const centro = centroide(lugarAtual.pontos);
      const pontosDaPior = analise.pontos.filter((_, i) => analise.celulaDoPonto[i] === risco.pior);
      const meio = centroide(pontosDaPior);
      const onde = distanciaKm(centro, meio) > 1.5 ? `na parte ${direcao(centro, meio)} do setor` : 'no meio do setor';
      els.legendaRisco.textContent = `Risco maior ${onde} (círculo com borda vermelha), com chance de até ${risco.probMax[risco.pior]}%. ` +
        `As diferenças dentro do setor são pequenas e incertas: os modelos enxergam áreas de cerca de 10 km.`;
    } else {
      els.legendaRisco.textContent = analise.celulas.length > 1
        ? 'O setor inteiro está na mesma situação neste período.'
        : 'O setor inteiro cabe numa só área do modelo de previsão (cerca de 10 km), então a previsão é a mesma em todo ele.';
    }

    mapa.invalidateSize();
    const pontos = lugarAtual.pontos;
    if (pontos.length === 1) mapa.setView(pontos[0], 12);
    else mapa.fitBounds(pontos, { padding: [20, 20] });
  }

  function desenharDias(analise) {
    els.dias.replaceChildren(...analise.dias.map((d) => {
      const li = el('li', 'dia');
      const marca = el('span', 'marca');
      marca.style.background = gravidadeCodigo(d.codigo) === 4 && d.prob >= 30 ? COR_TEMPORAL : CORES[nivel({ prob: d.prob, mm: d.mm / 4 })];
      li.append(
        marca,
        el('strong', '', nomeDoDia(d.data, analise)),
        el('span', 'chance', `${d.prob}%`),
        el('span', 'descricao', `${descreverDia(d)}${d.mm >= 0.1 ? ` · ${d.mm.toFixed(1).replace('.', ',')} mm no dia` : ''}`),
      );
      return li;
    }));
  }

  return {
    mostrar(lugar, analise) {
      lugarAtual = lugar;
      analiseAtual = analise;
      const r = resumo(analise);
      els.resumoPrincipal.textContent = r.principal;
      els.resumoDetalhe.textContent = r.detalhe;
      els.resumoDetalhe.hidden = !r.detalhe;
      els.resumo.className = `resumo nivel-${Math.max(0, ...analise.horas.slice(0, 12).map(nivel))}`;
      desenharAtalhos(analise);
      desenharLinhaDoTempo(analise);
      desenharDias(analise);
      // Mapa só depois de a seção estar visível, para o Leaflet medir o espaço.
      requestAnimationFrame(() => desenharRisco(analise.horas.slice(0, PROXIMAS), `próximas ${PROXIMAS} horas`));
    },
  };
}
