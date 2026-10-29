// Junta as telas, troca de lugar e atualiza a previsão de tempos em tempos.

import { lerLugares, lerEscolhido, salvarEscolhido, lerCache, salvarCache, pedirArmazenamentoPersistente } from './store.js';
import { pontosDeAmostra } from './geo.js';
import { buscarPrevisao, analisar, ErroPrevisao } from './forecast.js';
import { iniciarTelaLugares } from './mapa.js';
import { criarTelaPrevisao } from './previsao.js';

const DEZ_MINUTOS = 10 * 60 * 1000;
const $ = (id) => document.getElementById(id);

let ultimaBusca = 0;
let numeroDaBusca = 0;

const telaPrevisao = criarTelaPrevisao({
  resumo: $('resumo'),
  resumoPrincipal: $('resumo-principal'),
  resumoDetalhe: $('resumo-detalhe'),
  atalhos: $('atalhos'),
  proximas: $('proximas'),
  resto: $('resto'),
  tituloRisco: $('titulo-risco'),
  mapa: $('mapa-risco'),
  legendaRisco: $('legenda-risco'),
  dias: $('dias'),
});

const telaLugares = iniciarTelaLugares({
  elMapa: $('mapa-lugares'),
  elBarra: $('barra-desenho'),
  elLista: $('lista-lugares'),
  elAcoes: $('acoes-lugares'),
  dialogo: $('dialogo-nome'),
  aoMudar: (id) => {
    if (id) salvarEscolhido(id);
    ultimaBusca = 0;
  },
  aoVerPrevisao: (id) => {
    salvarEscolhido(id);
    location.hash = '#previsao';
  },
});

function lugarEscolhido(lugares) {
  return lugares.find((l) => l.id === lerEscolhido()) || lugares[0];
}

function formatarHorario(ms) {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function desenharChips(lugares, escolhido) {
  $('chips-lugares').replaceChildren(...lugares.map((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = l.nome;
    b.setAttribute('aria-pressed', String(l.id === escolhido.id));
    b.addEventListener('click', () => {
      salvarEscolhido(l.id);
      carregarPrevisao();
    });
    return b;
  }));
}

function mostrarStatus(texto, comBotao = false) {
  const status = $('status');
  status.replaceChildren(texto);
  if (comBotao) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Tentar de novo';
    b.addEventListener('click', carregarPrevisao);
    status.append(' ', b);
  }
  status.hidden = !texto;
}

function exibir(lugar, pontos, respostas, quando, veioDoCache) {
  const analise = analisar(pontos, respostas);
  if (analise.horas.length === 0) return false;
  $('conteudo-previsao').hidden = false;
  telaPrevisao.mostrar(lugar, analise);
  const celulas = analise.celulas.length;
  $('atualizacao').textContent =
    `Previsão baixada às ${formatarHorario(quando)}${veioDoCache ? ' (guardada no aparelho)' : ''}. ` +
    `${pontos.length} ponto(s) de previsão no lugar, em ${celulas} área(s) diferente(s) do modelo. ` +
    'O app confere de novo a cada 10 minutos enquanto está aberto, mas o serviço só refaz a previsão de tempos em tempos (de 1 em 1 hora até de 6 em 6 horas).';
  return true;
}

async function carregarPrevisao() {
  const lugares = lerLugares();
  $('sem-lugares').hidden = lugares.length > 0;
  if (lugares.length === 0) {
    $('chips-lugares').replaceChildren();
    $('conteudo-previsao').hidden = true;
    mostrarStatus('');
    return;
  }
  const lugar = lugarEscolhido(lugares);
  desenharChips(lugares, lugar);
  const pontos = pontosDeAmostra(lugar);
  const assinatura = JSON.stringify(pontos);
  const busca = ++numeroDaBusca;

  const cache = lerCache(lugar.id, assinatura);
  const temCache = cache ? exibir(lugar, pontos, cache.respostas, cache.quando, true) : false;
  if (!temCache) $('conteudo-previsao').hidden = true;
  mostrarStatus('Buscando a previsão mais recente…');

  try {
    const respostas = await buscarPrevisao(pontos);
    if (busca !== numeroDaBusca) return;
    salvarCache(lugar.id, assinatura, respostas);
    ultimaBusca = Date.now();
    exibir(lugar, pontos, respostas, ultimaBusca, false);
    mostrarStatus('');
  } catch (erro) {
    if (busca !== numeroDaBusca) return;
    console.error(erro);
    const motivo = erro instanceof ErroPrevisao ? erro.message : 'Não consegui buscar a previsão.';
    mostrarStatus(temCache
      ? `${motivo} Mostrando a última previsão guardada, baixada às ${formatarHorario(cache.quando)}. O app tenta de novo sozinho a cada 10 minutos.`
      : `${motivo} Ainda não há previsão guardada para este lugar.`, true);
  }
}

function irPara() {
  const tela = location.hash === '#lugares' ? 'lugares' : 'previsao';
  $('tela-previsao').hidden = tela !== 'previsao';
  $('tela-lugares').hidden = tela !== 'lugares';
  document.querySelectorAll('.abas a').forEach((a) => {
    a.toggleAttribute('aria-current', a.getAttribute('href') === `#${tela}`);
  });
  if (tela === 'lugares') telaLugares.mostrar();
  else carregarPrevisao();
}

$('botao-desenhar').addEventListener('click', () => {
  history.pushState(null, '', '#lugares');
  irPara();
  telaLugares.comecarArea();
});

window.addEventListener('hashchange', irPara);

// Atualiza sozinho enquanto a tela de previsão está aberta.
setInterval(() => {
  if (document.visibilityState === 'visible' && !$('tela-previsao').hidden) carregarPrevisao();
}, DEZ_MINUTOS);
document.addEventListener('visibilitychange', () => {
  const passou = Date.now() - ultimaBusca > DEZ_MINUTOS;
  if (document.visibilityState === 'visible' && passou && !$('tela-previsao').hidden) carregarPrevisao();
});

pedirArmazenamentoPersistente();
irPara();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((erro) => console.warn('Service worker não registrado', erro));
}
