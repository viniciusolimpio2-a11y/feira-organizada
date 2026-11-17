export type Situacao = 'pendente' | 'pronto' | 'entregue';
export type Tipo = 'conserto' | 'encomenda';

export interface Pedido {
  codigo: string;
  cliente: string;
  item: string;
  tipo: Tipo;
  prazo: string; // formato AAAA-MM-DD
  situacao: Situacao;
  criadoEm: string; // data e hora em formato ISO
  entregueEm?: string;
}

export interface NovoPedido {
  cliente: string;
  item: string;
  tipo: Tipo;
  prazo: string;
}

export interface Alertas {
  atrasados: Pedido[];
  vencemHoje: Pedido[];
}

export const LIMITE_CLIENTE = 80;
export const LIMITE_ITEM = 200;

const ORDEM_SITUACOES: Situacao[] = ['pendente', 'pronto', 'entregue'];
const TIPOS: Tipo[] = ['conserto', 'encomenda'];
const SINAIS_PROIBIDOS = /[<>]/;

export function dataLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function gerarCodigo(numero: number): string {
  return `P-${String(numero).padStart(4, '0')}`;
}

function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

export function validarNovoPedido(dados: NovoPedido, hoje: string): string[] {
  const erros: string[] = [];
  const cliente = (dados.cliente ?? '').trim();
  const item = (dados.item ?? '').trim();
  const prazo = (dados.prazo ?? '').trim();

  if (!cliente) {
    erros.push('Informe o nome do cliente');
  } else if (cliente.length > LIMITE_CLIENTE) {
    erros.push(`O nome do cliente deve ter até ${LIMITE_CLIENTE} caracteres`);
  } else if (SINAIS_PROIBIDOS.test(cliente)) {
    erros.push('O nome do cliente não pode ter os sinais < ou >');
  }

  if (!item) {
    erros.push('Informe o item');
  } else if (item.length > LIMITE_ITEM) {
    erros.push(`O item deve ter até ${LIMITE_ITEM} caracteres`);
  } else if (SINAIS_PROIBIDOS.test(item)) {
    erros.push('O item não pode ter os sinais < ou >');
  }

  if (!TIPOS.includes(dados.tipo)) {
    erros.push('Escolha o tipo: conserto ou encomenda');
  }

  if (!prazo) {
    erros.push('Informe o prazo');
  } else if (!dataValida(prazo)) {
    erros.push('Prazo inválido');
  } else if (prazo < hoje) {
    erros.push('O prazo não pode ser anterior a hoje');
  }

  return erros;
}

export function estaAtrasado(pedido: Pedido, hoje: string): boolean {
  return pedido.situacao !== 'entregue' && pedido.prazo < hoje;
}

export function venceHoje(pedido: Pedido, hoje: string): boolean {
  return pedido.situacao !== 'entregue' && pedido.prazo === hoje;
}

export function proximaSituacao(atual: Situacao): Situacao | null {
  const posicao = ORDEM_SITUACOES.indexOf(atual);
  return ORDEM_SITUACOES[posicao + 1] ?? null;
}

export function listarAlertas(pedidos: Pedido[], hoje: string): Alertas {
  const atrasados = pedidos
    .filter((p) => estaAtrasado(p, hoje))
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  const vencemHoje = pedidos.filter((p) => venceHoje(p, hoje));
  return { atrasados, vencemHoje };
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function corresponde(pedido: Pedido, termo: string): boolean {
  const busca = normalizar(termo);
  if (!busca) return true;
  return normalizar(pedido.codigo) === busca || normalizar(pedido.cliente).includes(busca);
}
