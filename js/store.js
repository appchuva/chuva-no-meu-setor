// Guarda os lugares e a última previsão SÓ neste aparelho (localStorage).
// Nada vai para servidor nenhum.

const CHAVE_LUGARES = 'chuva.lugares.v1';
const CHAVE_ESCOLHIDO = 'chuva.escolhido.v1';
const CHAVE_CACHE = 'chuva.cache.v1';

function ler(chave, padrao) {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? JSON.parse(texto) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

// Lugar: { id, nome, tipo: 'area' | 'ponto', pontos: [[lat, lng], ...] }
export function lerLugares() {
  const lista = ler(CHAVE_LUGARES, []);
  return Array.isArray(lista) ? lista : [];
}

export function salvarLugares(lista) {
  return gravar(CHAVE_LUGARES, lista);
}

export function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function lerEscolhido() {
  return ler(CHAVE_ESCOLHIDO, null);
}

export function salvarEscolhido(id) {
  gravar(CHAVE_ESCOLHIDO, id);
}

// Última previsão de cada lugar, para mostrar algo se a internet cair.
export function lerCache(id, assinatura) {
  const cache = ler(CHAVE_CACHE, {});
  const item = cache[id];
  return item && item.assinatura === assinatura ? item : null;
}

export function salvarCache(id, assinatura, respostas) {
  const cache = ler(CHAVE_CACHE, {});
  const idsValidos = new Set(lerLugares().map((l) => l.id));
  for (const chave of Object.keys(cache)) {
    if (!idsValidos.has(chave)) delete cache[chave];
  }
  cache[id] = { quando: Date.now(), assinatura, respostas };
  gravar(CHAVE_CACHE, cache);
}

// Pede ao navegador para não apagar os dados sozinho quando faltar espaço.
export function pedirArmazenamentoPersistente() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}
