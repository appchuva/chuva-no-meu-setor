// Tela "Meus lugares": mapa onde a pessoa desenha, edita, nomeia e apaga lugares.

import { lerLugares, salvarLugares, novoId } from './store.js';

const CENTRO_DF = [-15.75, -47.85];
const COR_LUGAR = '#1f5fbf';

export function criarMapaBase(elemento, opcoes = {}) {
  const mapa = L.map(elemento, opcoes).setView(CENTRO_DF, 10);
  // Mapa do OpenStreetMap: uso gratuito, com crédito obrigatório.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>',
  }).addTo(mapa);
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  return mapa;
}

export function camadaDoLugar(lugar, estilo = {}) {
  if (lugar.tipo === 'ponto') return L.marker(lugar.pontos[0], { title: lugar.nome });
  return L.polygon(lugar.pontos, { color: COR_LUGAR, weight: 2, fillOpacity: 0.1, ...estilo });
}

function icone(classe) {
  return L.divIcon({ className: classe, iconSize: [22, 22], iconAnchor: [11, 11] });
}

function botao(texto, aoClicar, classe = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = texto;
  if (classe) b.className = classe;
  b.addEventListener('click', aoClicar);
  return b;
}

export function iniciarTelaLugares({ elMapa, elBarra, elLista, elAcoes, dialogo, aoMudar, aoVerPrevisao }) {
  let mapa = null;
  let camadaSalvos = null;
  let modo = null;

  // ---------- Janela de nome ----------
  function pedirNome(titulo, sugestao) {
    const campo = dialogo.querySelector('input');
    dialogo.querySelector('h2').textContent = titulo;
    campo.value = sugestao;
    dialogo.returnValue = '';
    dialogo.showModal();
    campo.select();
    return new Promise((resolver) => {
      dialogo.addEventListener('close', () => {
        const nome = campo.value.trim();
        resolver(dialogo.returnValue === 'ok' && nome ? nome.slice(0, 40) : null);
      }, { once: true });
    });
  }
  // Enter no campo = Salvar (sem isso o formulário usaria o primeiro botão, "Cancelar").
  dialogo.querySelector('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dialogo.close('ok');
    }
  });
  dialogo.querySelectorAll('[data-sugestao]').forEach((b) => {
    b.addEventListener('click', () => {
      dialogo.querySelector('input').value = b.dataset.sugestao;
    });
  });

  function sugerirNome(tipo) {
    const nomes = new Set(lerLugares().map((l) => l.nome));
    const opcoes = tipo === 'ponto' ? ['Casa', 'Fórum', 'Ponto'] : ['Meu setor', 'Setor 2', 'Setor 3', 'Setor 4'];
    return opcoes.find((n) => !nomes.has(n)) || '';
  }

  // ---------- Barra de instruções durante o desenho ----------
  function mostrarBarra(texto, botoes) {
    elBarra.replaceChildren();
    const p = document.createElement('p');
    p.textContent = texto;
    const linha = document.createElement('div');
    linha.className = 'botoes';
    botoes.forEach(([rotulo, acao, classe]) => linha.append(botao(rotulo, acao, classe)));
    elBarra.append(p, linha);
    elBarra.hidden = false;
    elAcoes.hidden = true;
    elBarra.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function avisoNaBarra(texto) {
    let aviso = elBarra.querySelector('.aviso-barra');
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.className = 'aviso-barra';
      elBarra.append(aviso);
    }
    aviso.textContent = texto;
  }

  function sairDoModo() {
    if (modo) modo.camada.remove();
    modo = null;
    elBarra.hidden = true;
    elAcoes.hidden = false;
    mapa.doubleClickZoom.enable();
    elMapa.classList.remove('desenhando');
    desenharSalvos();
  }

  // ---------- Lugares salvos ----------
  function desenharSalvos(excetoId) {
    camadaSalvos.clearLayers();
    for (const lugar of lerLugares()) {
      if (lugar.id === excetoId) continue;
      camadaDoLugar(lugar)
        .bindTooltip(lugar.nome, { permanent: true, direction: 'center', className: 'rotulo-lugar' })
        .addTo(camadaSalvos);
    }
  }

  function enquadrar(lugares) {
    const pontos = lugares.flatMap((l) => l.pontos);
    if (pontos.length === 0) return;
    // Sem animação: marcadores criados durante o zoom animado ficavam fora do lugar.
    if (pontos.length === 1) mapa.setView(pontos[0], 15, { animate: false });
    else mapa.fitBounds(pontos, { padding: [30, 30], maxZoom: 16, animate: false });
  }

  function desenharLista() {
    const lugares = lerLugares();
    elLista.replaceChildren();
    if (lugares.length === 0) {
      const li = document.createElement('li');
      li.className = 'vazio';
      li.textContent = 'Nenhum lugar salvo ainda. Use os botões acima para desenhar o seu setor e marcar a sua casa.';
      elLista.append(li);
      return;
    }
    for (const lugar of lugares) {
      const li = document.createElement('li');
      const titulo = document.createElement('div');
      titulo.className = 'lugar-titulo';
      titulo.append(botao(lugar.nome, () => enquadrar([lugar]), 'link'));
      const tipo = document.createElement('span');
      tipo.className = 'tipo';
      tipo.textContent = lugar.tipo === 'ponto' ? 'ponto' : `área · ${lugar.pontos.length} cantos`;
      titulo.append(tipo);
      const acoes = document.createElement('div');
      acoes.className = 'botoes';
      acoes.append(
        botao('Ver chuva', () => aoVerPrevisao(lugar.id), 'primario'),
        botao('Mudar forma', () => comecarEdicao(lugar)),
        ...(lugar.tipo === 'area' ? [botao('Mover', () => comecarMover(lugar))] : []),
        botao('Renomear', () => renomear(lugar)),
        botao('Apagar', () => apagar(lugar), 'perigo'),
      );
      li.append(titulo, acoes);
      elLista.append(li);
    }
  }

  function guardar(lista, idMudado) {
    if (!salvarLugares(lista)) {
      alert('Não consegui guardar neste aparelho. Verifique se o navegador não está em modo anônimo.');
      return;
    }
    desenharSalvos();
    desenharLista();
    aoMudar(idMudado);
  }

  async function renomear(lugar) {
    const nome = await pedirNome('Novo nome do lugar', lugar.nome);
    if (!nome) return;
    const lista = lerLugares().map((l) => (l.id === lugar.id ? { ...l, nome } : l));
    guardar(lista, lugar.id);
  }

  function apagar(lugar) {
    if (!confirm(`Apagar "${lugar.nome}"? O desenho some deste aparelho.`)) return;
    guardar(lerLugares().filter((l) => l.id !== lugar.id), null);
  }

  // ---------- Desenhar uma área nova ----------
  function comecarArea() {
    if (modo) sairDoModo();
    modo = { tipo: 'area', pontos: [], camada: L.layerGroup().addTo(mapa) };
    mapa.doubleClickZoom.disable();
    elMapa.classList.add('desenhando');
    mostrarBarra('Toque no mapa para marcar os cantos do setor, um de cada vez, dando a volta nele. Marque pelo menos 3 cantos. Para corrigir um canto, arraste a bolinha azul.', [
      ['Desfazer último', () => { modo.pontos.pop(); desenharRascunho(); }],
      ['Cancelar', sairDoModo],
      ['Concluir', concluirArea, 'primario'],
    ]);
    desenharRascunho();
  }

  async function concluirArea() {
    if (modo.pontos.length < 3) {
      avisoNaBarra('Faltam cantos: marque pelo menos 3 pontos no mapa.');
      return;
    }
    const nome = await pedirNome('Como quer chamar esta área?', sugerirNome('area'));
    if (!nome) return;
    const lugar = { id: novoId(), nome, tipo: 'area', pontos: modo.pontos };
    sairDoModo();
    guardar([...lerLugares(), lugar], lugar.id);
  }

  // ---------- Marcar um ponto (Casa, Fórum) ----------
  function comecarPonto() {
    if (modo) sairDoModo();
    modo = { tipo: 'ponto', pontos: [], camada: L.layerGroup().addTo(mapa) };
    elMapa.classList.add('desenhando');
    mostrarBarra('Toque no mapa onde fica o lugar (por exemplo, a sua casa). Para corrigir, toque de novo ou arraste o marcador.', [
      ['Cancelar', sairDoModo],
      ['Salvar', concluirPonto, 'primario'],
    ]);
  }

  async function concluirPonto() {
    if (modo.pontos.length === 0) {
      avisoNaBarra('Toque primeiro no mapa para marcar o lugar.');
      return;
    }
    const nome = await pedirNome('Como quer chamar este lugar?', sugerirNome('ponto'));
    if (!nome) return;
    const lugar = { id: novoId(), nome, tipo: 'ponto', pontos: modo.pontos };
    sairDoModo();
    guardar([...lerLugares(), lugar], lugar.id);
  }

  function desenharRascunho() {
    modo.camada.clearLayers();
    const pts = modo.pontos;
    if (modo.tipo === 'ponto') {
      if (pts.length) {
        L.marker(pts[0], { draggable: true }).addTo(modo.camada).on('dragend', (e) => {
          const { lat, lng } = e.target.getLatLng();
          pts[0] = [lat, lng];
        });
      }
      return;
    }
    const estilo = { color: COR_LUGAR, dashArray: '6 6', weight: 2, fillOpacity: 0.1 };
    const contorno = pts.length >= 3 ? L.polygon(pts, estilo) : L.polyline(pts, estilo);
    contorno.addTo(modo.camada);
    // Os cantos já podem ser arrastados enquanto o setor é desenhado.
    pts.forEach((p, i) => {
      L.marker(p, { draggable: true, icon: icone('vertice'), title: `Canto ${i + 1}` })
        .addTo(modo.camada)
        .on('drag', (e) => {
          const { lat, lng } = e.target.getLatLng();
          pts[i] = [lat, lng];
          contorno.setLatLngs(pts);
        })
        .on('dragend', desenharRascunho);
    });
    avisoNaBarra(`Cantos marcados: ${pts.length}`);
  }

  // ---------- Mudar a forma de um lugar salvo ----------
  function comecarEdicao(lugar) {
    if (modo) sairDoModo();
    modo = { tipo: 'editar', lugar, pontos: lugar.pontos.map((p) => [...p]), escolhido: null, camada: L.layerGroup().addTo(mapa) };
    mapa.doubleClickZoom.disable();
    desenharSalvos(lugar.id);
    enquadrar([lugar]);
    const texto = lugar.tipo === 'ponto'
      ? 'Arraste o marcador para o lugar certo.'
      : 'Arraste os cantos (bolinhas azuis) para ajustar. Toque num "+" para criar um canto novo. Para tirar um canto, toque nele e depois em "Apagar canto".';
    const botoes = [['Cancelar', sairDoModo], ['Salvar', salvarEdicao, 'primario']];
    if (lugar.tipo === 'area') botoes.unshift(['Apagar canto', apagarCanto]);
    mostrarBarra(texto, botoes);
    desenharEdicao();
  }

  function apagarCanto() {
    if (modo.escolhido === null) {
      avisoNaBarra('Toque primeiro no canto que quer tirar.');
      return;
    }
    if (modo.pontos.length <= 3) {
      avisoNaBarra('Uma área precisa de pelo menos 3 cantos.');
      return;
    }
    modo.pontos.splice(modo.escolhido, 1);
    modo.escolhido = null;
    desenharEdicao();
  }

  function desenharEdicao() {
    const { camada, pontos } = modo;
    camada.clearLayers();
    if (modo.lugar.tipo === 'ponto') {
      L.marker(pontos[0], { draggable: true }).addTo(camada).on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        pontos[0] = [lat, lng];
      });
      return;
    }
    const poligono = L.polygon(pontos, { color: COR_LUGAR, weight: 2, fillOpacity: 0.1 }).addTo(camada);
    pontos.forEach((p, i) => {
      const classe = i === modo.escolhido ? 'vertice escolhido' : 'vertice';
      L.marker(p, { draggable: true, icon: icone(classe), title: `Canto ${i + 1}` })
        .addTo(camada)
        .on('drag', (e) => {
          const { lat, lng } = e.target.getLatLng();
          pontos[i] = [lat, lng];
          poligono.setLatLngs(pontos);
        })
        .on('dragend', desenharEdicao)
        .on('click', () => { modo.escolhido = i; desenharEdicao(); });
    });
    pontos.forEach((p, i) => {
      const q = pontos[(i + 1) % pontos.length];
      const meio = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      L.marker(meio, { icon: icone('meio'), title: 'Criar canto aqui' })
        .addTo(camada)
        .on('click', () => {
          pontos.splice(i + 1, 0, meio);
          modo.escolhido = i + 1;
          desenharEdicao();
        });
    });
  }

  // ---------- Mover o setor inteiro, sem mudar a forma ----------
  function comecarMover(lugar) {
    if (modo) sairDoModo();
    const original = lugar.pontos.map((p) => [...p]);
    modo = { tipo: 'mover', lugar, pontos: original.map((p) => [...p]), camada: L.layerGroup().addTo(mapa) };
    desenharSalvos(lugar.id);
    enquadrar([lugar]);
    mostrarBarra('Arraste o círculo azul com setas, no meio do setor ("Arraste daqui"), para levar o setor inteiro até o lugar certo. A forma não muda.', [
      ['Cancelar', sairDoModo],
      ['Salvar', salvarEdicao, 'primario'],
    ]);
    const poligono = L.polygon(original, { color: COR_LUGAR, weight: 2, fillOpacity: 0.15 }).addTo(modo.camada);
    const centro = poligono.getBounds().getCenter();
    const setas = '<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff" aria-hidden="true">' +
      '<path d="M12 2l4 4h-3v5h5V8l4 4-4 4v-3h-5v5h3l-4 4-4-4h3v-5H6v3l-4-4 4-4v3h5V6H8z"/></svg>';
    L.marker(centro, {
      draggable: true,
      icon: L.divIcon({ className: 'alca-mover', html: setas, iconSize: [48, 48], iconAnchor: [24, 24] }),
      title: 'Arraste para mover o setor',
    })
      .bindTooltip('Arraste daqui', { permanent: true, direction: 'bottom', offset: [0, 24] })
      .addTo(modo.camada)
      .on('drag', (e) => {
        const agora = e.target.getLatLng();
        const dLat = agora.lat - centro.lat;
        const dLng = agora.lng - centro.lng;
        modo.pontos = original.map(([lat, lng]) => [lat + dLat, lng + dLng]);
        poligono.setLatLngs(modo.pontos);
      });
  }

  function salvarEdicao() {
    const { lugar, pontos } = modo;
    sairDoModo();
    guardar(lerLugares().map((l) => (l.id === lugar.id ? { ...l, pontos } : l)), lugar.id);
  }

  // ---------- Montagem ----------
  function montar() {
    mapa = criarMapaBase(elMapa);
    camadaSalvos = L.layerGroup().addTo(mapa);
    mapa.on('click', (e) => {
      if (!modo || (modo.tipo !== 'area' && modo.tipo !== 'ponto')) return;
      const p = [e.latlng.lat, e.latlng.lng];
      if (modo.tipo === 'ponto') modo.pontos = [p];
      else modo.pontos.push(p);
      desenharRascunho();
    });
    mapa.on('locationerror', () => alert('Não consegui pegar a sua localização. Verifique se o navegador tem permissão.'));
    elAcoes.querySelector('[data-acao="area"]').addEventListener('click', comecarArea);
    elAcoes.querySelector('[data-acao="ponto"]').addEventListener('click', comecarPonto);
    elAcoes.querySelector('[data-acao="localizar"]').addEventListener('click', () => mapa.locate({ setView: true, maxZoom: 15 }));
    desenharSalvos();
    desenharLista();
    const lugares = lerLugares();
    if (lugares.length) enquadrar(lugares);
    else mapa.setView(CENTRO_DF, 11);
  }

  return {
    mostrar() {
      if (!mapa) montar();
      // O mapa estava escondido: o Leaflet precisa medir de novo o espaço.
      setTimeout(() => mapa.invalidateSize(), 0);
      desenharLista();
    },
    comecarArea() {
      this.mostrar();
      comecarArea();
    },
  };
}
