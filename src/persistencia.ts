import Dexie, { type Table } from 'dexie';
import type { Pedido } from './pedido';

export type BancoFeira = Dexie & { pedidos: Table<Pedido, string> };

export function criarBanco(nome = 'feira-organizada'): BancoFeira {
  const banco = new Dexie(nome) as BancoFeira;
  banco.version(1).stores({ pedidos: 'codigo, situacao, prazo' });
  return banco;
}
