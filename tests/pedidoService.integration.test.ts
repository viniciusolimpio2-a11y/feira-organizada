import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarBanco, type BancoFeira } from '../src/persistencia';
import { ErroValidacao, PedidoService } from '../src/pedidoService';

const DIA_17 = new Date(2026, 10, 17, 10, 0, 0); // 17/11/2026
const DIA_18 = new Date(2026, 10, 18, 9, 0, 0); // 18/11/2026

const dados = {
  cliente: 'Maria',
  item: 'panela de pressão, trocar borracha',
  tipo: 'conserto' as const,
  prazo: '2026-11-20',
};

let contador = 0;
let nomeBanco = '';
let banco: BancoFeira;
let relogio: Date;
let servico: PedidoService;

beforeEach(() => {
  contador += 1;
  nomeBanco = `feira-teste-${contador}`;
  banco = criarBanco(nomeBanco);
  relogio = DIA_17;
  servico = new PedidoService(banco, () => relogio);
});

afterEach(() => {
  banco.close();
});

describe('persistência', () => {
  it('usa o nome padrão do banco quando nenhum é informado', () => {
    const padrao = criarBanco();
    expect(padrao.name).toBe('feira-organizada');
    padrao.close();
  });

  it('mantém os dados ao fechar e reabrir o banco', async () => {
    await servico.cadastrar(dados);
    banco.close();

    const reaberto = criarBanco(nomeBanco);
    const outroServico = new PedidoService(reaberto, () => relogio);
    const pedido = await outroServico.obter('P-0001');
    expect(pedido?.cliente).toBe('Maria');
    reaberto.close();
  });
});

describe('cadastro de pedidos', () => {
  it('grava o pedido com código, situação pendente e dados limpos', async () => {
    const pedido = await servico.cadastrar({ ...dados, cliente: '  Maria  ' });
    expect(pedido.codigo).toBe('P-0001');
    expect(pedido.situacao).toBe('pendente');
    expect(pedido.cliente).toBe('Maria');

    const gravado = await servico.obter('P-0001');
    expect(gravado).toEqual(pedido);
  });

  it('gera códigos em sequência e únicos', async () => {
    const primeiro = await servico.cadastrar(dados);
    const segundo = await servico.cadastrar({ ...dados, cliente: 'Carlos' });
    expect(primeiro.codigo).toBe('P-0001');
    expect(segundo.codigo).toBe('P-0002');
  });

  it('recusa dados inválidos e não grava nada', async () => {
    await expect(servico.cadastrar({ ...dados, cliente: '' })).rejects.toBeInstanceOf(
      ErroValidacao,
    );
    expect(await banco.pedidos.count()).toBe(0);
  });

  it('informa as mensagens de erro de validação', async () => {
    try {
      await servico.cadastrar({ ...dados, cliente: '<b>', prazo: '2026-11-01' });
      expect.unreachable('deveria ter lançado ErroValidacao');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroValidacao);
      expect((erro as ErroValidacao).erros).toEqual([
        'O nome do cliente não pode ter os sinais < ou >',
        'O prazo não pode ser anterior a hoje',
      ]);
    }
  });

  it('devolve undefined ao procurar um código que não existe', async () => {
    expect(await servico.obter('P-9999')).toBeUndefined();
  });
});

describe('situação do pedido', () => {
  it('avança de pendente para pronto e para entregue, gravando a data de entrega', async () => {
    await servico.cadastrar(dados);

    const pronto = await servico.avancarSituacao('P-0001');
    expect(pronto.situacao).toBe('pronto');
    expect(pronto.entregueEm).toBeUndefined();

    const entregue = await servico.avancarSituacao('P-0001');
    expect(entregue.situacao).toBe('entregue');
    expect(entregue.entregueEm).toBeDefined();

    expect((await servico.obter('P-0001'))?.situacao).toBe('entregue');
  });

  it('não avança um pedido já entregue', async () => {
    await servico.cadastrar(dados);
    await servico.avancarSituacao('P-0001');
    await servico.avancarSituacao('P-0001');
    await expect(servico.avancarSituacao('P-0001')).rejects.toThrow('O pedido já foi entregue');
  });

  it('avisa quando o pedido não existe', async () => {
    await expect(servico.avancarSituacao('P-9999')).rejects.toThrow('Pedido não encontrado');
  });
});

describe('alertas de prazo', () => {
  it('lista atrasados e os que vencem hoje, e remove o pedido entregue', async () => {
    await servico.cadastrar({ ...dados, cliente: 'Ana', prazo: '2026-11-17' });
    await servico.cadastrar({ ...dados, cliente: 'Carlos', prazo: '2026-11-18' });
    await servico.cadastrar({ ...dados, cliente: 'Rita', prazo: '2026-11-25' });

    relogio = DIA_18; // um dia depois

    let alertas = await servico.alertas();
    expect(alertas.atrasados.map((p) => p.cliente)).toEqual(['Ana']);
    expect(alertas.vencemHoje.map((p) => p.cliente)).toEqual(['Carlos']);

    await servico.avancarSituacao('P-0001');
    await servico.avancarSituacao('P-0001'); // Ana entregue

    alertas = await servico.alertas();
    expect(alertas.atrasados).toEqual([]);
    expect(alertas.vencemHoje.map((p) => p.cliente)).toEqual(['Carlos']);
  });

  it('usa o relógio do sistema quando nenhum é informado', async () => {
    const servicoPadrao = new PedidoService(banco);
    expect(await servicoPadrao.alertas()).toEqual({ atrasados: [], vencemHoje: [] });
  });
});

describe('busca de pedidos', () => {
  beforeEach(async () => {
    await servico.cadastrar({ ...dados, cliente: 'Maria' });
    await servico.cadastrar({ ...dados, cliente: 'Marcos' });
    await servico.cadastrar({ ...dados, cliente: 'José' });
  });

  it('encontra por parte do nome', async () => {
    const achados = await servico.buscar('mar');
    expect(achados.map((p) => p.cliente).sort()).toEqual(['Marcos', 'Maria']);
  });

  it('ignora acentos e maiúsculas', async () => {
    const achados = await servico.buscar('JOSE');
    expect(achados.map((p) => p.cliente)).toEqual(['José']);
  });

  it('encontra pelo código exato', async () => {
    const achados = await servico.buscar('P-0003');
    expect(achados.map((p) => p.cliente)).toEqual(['José']);
  });

  it('devolve lista vazia quando nada corresponde', async () => {
    expect(await servico.buscar('zzz')).toEqual([]);
  });
});
