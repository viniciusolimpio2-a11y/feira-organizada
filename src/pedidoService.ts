import type { BancoFeira } from './persistencia';
import {
  corresponde,
  dataLocal,
  gerarCodigo,
  listarAlertas,
  proximaSituacao,
  validarNovoPedido,
  type Alertas,
  type NovoPedido,
  type Pedido,
} from './pedido';

export class ErroValidacao extends Error {
  readonly erros: string[];

  constructor(erros: string[]) {
    super(erros.join('; '));
    this.name = 'ErroValidacao';
    this.erros = erros;
  }
}

export class PedidoService {
  private readonly banco: BancoFeira;
  private readonly agora: () => Date;

  constructor(banco: BancoFeira, agora: () => Date = () => new Date()) {
    this.banco = banco;
    this.agora = agora;
  }

  private hoje(): string {
    return dataLocal(this.agora());
  }

  async cadastrar(dados: NovoPedido): Promise<Pedido> {
    const erros = validarNovoPedido(dados, this.hoje());
    if (erros.length > 0) throw new ErroValidacao(erros);

    return this.banco.transaction('rw', this.banco.pedidos, async () => {
      const codigos = (await this.banco.pedidos.toCollection().primaryKeys()) as string[];
      const maior = codigos.reduce((m, c) => Math.max(m, Number(c.replace('P-', ''))), 0);
      const pedido: Pedido = {
        codigo: gerarCodigo(maior + 1),
        cliente: dados.cliente.trim(),
        item: dados.item.trim(),
        tipo: dados.tipo,
        prazo: dados.prazo.trim(),
        situacao: 'pendente',
        criadoEm: this.agora().toISOString(),
      };
      await this.banco.pedidos.add(pedido);
      return pedido;
    });
  }

  async obter(codigo: string): Promise<Pedido | undefined> {
    return this.banco.pedidos.get(codigo);
  }

  async avancarSituacao(codigo: string): Promise<Pedido> {
    const pedido = await this.banco.pedidos.get(codigo);
    if (!pedido) throw new Error('Pedido não encontrado');

    const proxima = proximaSituacao(pedido.situacao);
    if (!proxima) throw new Error('O pedido já foi entregue');

    const atualizado: Pedido = { ...pedido, situacao: proxima };
    if (proxima === 'entregue') atualizado.entregueEm = this.agora().toISOString();
    await this.banco.pedidos.put(atualizado);
    return atualizado;
  }

  async alertas(): Promise<Alertas> {
    const abertos = await this.banco.pedidos.where('situacao').notEqual('entregue').toArray();
    return listarAlertas(abertos, this.hoje());
  }

  async buscar(termo: string): Promise<Pedido[]> {
    const todos = await this.banco.pedidos.toArray();
    return todos.filter((p) => corresponde(p, termo));
  }
}
