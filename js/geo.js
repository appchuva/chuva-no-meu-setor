// Contas de mapa: espalhar pontos de previsão dentro do setor desenhado.

const KM_POR_GRAU = 111.32;

// Teste clássico do "raio": conta quantas bordas uma linha cruza.
export function dentroDoPoligono([lat, lng], poligono) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [latI, lngI] = poligono[i];
    const [latJ, lngJ] = poligono[j];
    const cruza = latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

export function centroide(pontos) {
  const soma = pontos.reduce((s, [lat, lng]) => [s[0] + lat, s[1] + lng], [0, 0]);
  return [soma[0] / pontos.length, soma[1] / pontos.length];
}

export function distanciaKm([lat1, lng1], [lat2, lng2]) {
  const cosLat = Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const dy = (lat2 - lat1) * KM_POR_GRAU;
  const dx = (lng2 - lng1) * KM_POR_GRAU * cosLat;
  return Math.hypot(dx, dy);
}

// Direção de "de" para "para", em palavras (norte, sudeste...).
export function direcao(de, para) {
  const cosLat = Math.cos(de[0] * Math.PI / 180);
  const dy = para[0] - de[0];
  const dx = (para[1] - de[1]) * cosLat;
  const graus = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  const nomes = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
  return nomes[Math.round(graus / 45) % 8];
}

function segmentosSeCruzam([a, b], [c, d]) {
  const lado = (p, q, r) => Math.sign((q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]));
  return lado(a, b, c) * lado(a, b, d) < 0 && lado(c, d, a) * lado(c, d, b) < 0;
}

// Lados do polígono que cruzam outro lado (desenho "embolado").
// Devolve os índices dos lados: o lado i vai do canto i ao canto i+1.
export function ladosQueSeCruzam(pontos) {
  const n = pontos.length;
  const cruzados = new Set();
  if (n < 4) return cruzados;
  const lado = (i) => [pontos[i], pontos[(i + 1) % n]];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // vizinhos pelo canto 1
      if (segmentosSeCruzam(lado(i), lado(j))) {
        cruzados.add(i);
        cruzados.add(j);
      }
    }
  }
  return cruzados;
}

// Uma grade de pontos dentro do polígono (no máximo `maximo` pontos).
// Os modelos de previsão têm células de ~10 km, então pontos muito próximos
// dariam o mesmo resultado; a grade nunca fica mais fina que 1,5 km.
export function pontosDeAmostra(lugar, maximo = 16) {
  if (lugar.tipo === 'ponto') return [lugar.pontos[0]];

  const poligono = lugar.pontos;
  const lats = poligono.map((p) => p[0]);
  const lngs = poligono.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const kmAltura = (maxLat - minLat) * KM_POR_GRAU;
  const kmLargura = (maxLng - minLng) * KM_POR_GRAU * cosLat;

  let passoKm = Math.max(1.5, Math.sqrt((kmAltura * kmLargura) / maximo));
  let pontos = [];
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    pontos = [];
    const passoLat = passoKm / KM_POR_GRAU;
    const passoLng = passoKm / (KM_POR_GRAU * cosLat);
    for (let lat = minLat + passoLat / 2; lat < maxLat; lat += passoLat) {
      for (let lng = minLng + passoLng / 2; lng < maxLng; lng += passoLng) {
        if (dentroDoPoligono([lat, lng], poligono)) pontos.push([lat, lng]);
      }
    }
    // Setor comprido (uma rodovia, por exemplo): afina a grade.
    if (pontos.length >= 6 || passoKm <= 1.5) break;
    passoKm = Math.max(1.5, passoKm / 2);
  }

  const centro = centroide(poligono);
  if (dentroDoPoligono(centro, poligono)) pontos.unshift(centro);
  if (pontos.length < 3) pontos.push(...poligono);

  if (pontos.length > maximo) {
    const salto = pontos.length / maximo;
    pontos = Array.from({ length: maximo }, (_, i) => pontos[Math.floor(i * salto)]);
  }
  return pontos;
}
