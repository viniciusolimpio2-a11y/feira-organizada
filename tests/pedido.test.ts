import { describe, expect, it } from 'vitest';
import {
  LIMITE_CLIENTE,
  LIMITE_ITEM,
  corresponde,
  dataLocal,
  estaAtrasado,
  gerarCodigo,
  listarAlertas,
  proximaSituacao,
  validarNovoPedido,
  venceHoje,
  type NovoPedido,
  type Pedido,
  type Situacao,
} from '../src/pedido';

const HOJE = '2026-11-17';

const valido: NovoPedido = {
  cliente: 'João',
  item: 'tampa de panela de pressão, trocar a borracha',
  tipo: 'conserto',
  prazo: '2026-11-20',
};

function pedido(
  codigo: string,
  cliente: string,
  prazo: string,
  situacao: Situacao = 'pendente',
): Pedido {
  return {
    codigo,
    cliente,
    item: 'panela',
    tipo: 'conserto',
    prazo,
    situacao,
    criadoEm: '2026-11-10T10:00:00.000Z',
  };
}

describe('gerarCodigo', () => {
  it('gera o código com quatro dígitos', () => {
    expect(gerarCodigo(1)).toBe('P-0001');
    expect(gerarCodigo(23)).toBe('P-0023');
  });

  it('mantém números maiores que quatro dígitos', () => {
    expect(gerarCodigo(12345)).toBe('P-12345');
  });
});

describe('dataLocal', () => {
  it('formata a data local como AAAA-MM-DD', () => {
    expect(dataLocal(new Date(2026, 10, 7, 23, 30))).toBe('2026-11-07');
  });
});

describe('validarNovoPedido', () => {
  it('aceita dados válidos', () => {
    expect(validarNovoPedido(valido, HOJE)).toEqual([]);
  });

  it('aceita prazo igual a hoje', () => {
    expect(validarNovoPedido({ ...valido, prazo: HOJE }, HOJE)).toEqual([]);
  });

  it('recusa cliente vazio ou só com espaços', () => {
    expect(validarNovoPedido({ ...valido, cliente: '' }, HOJE)).toContain(
      'Informe o nome do cliente',
    );
    expect(validarNovoPedido({ ...valido, cliente: '   ' }, HOJE)).toContain(
      'Informe o nome do cliente',
    );
  });

  it('recusa cliente acima do limite de caracteres', () => {
    const cliente = 'a'.repeat(LIMITE_CLIENTE + 1);
    expect(validarNovoPedido({ ...valido, cliente }, HOJE)).toContain(
      `O nome do cliente deve ter até ${LIMITE_CLIENTE} caracteres`,
    );
  });

  it('recusa sinais < e > no cliente (previne injeção de scripts)', () => {
    const cliente = '<script>alert(1)</script>';
    expect(validarNovoPedido({ ...valido, cliente }, HOJE)).toContain(
      'O nome do cliente não pode ter os sinais < ou >',
    );
  });

  it('recusa item vazio, longo demais ou com < e >', () => {
    expect(validarNovoPedido({ ...valido, item: '' }, HOJE)).toContain('Informe o item');
    expect(
      validarNovoPedido({ ...valido, item: 'b'.repeat(LIMITE_ITEM + 1) }, HOJE),
    ).toContain(`O item deve ter até ${LIMITE_ITEM} caracteres`);
    expect(validarNovoPedido({ ...valido, item: 'alça <b>' }, HOJE)).toContain(
      'O item não pode ter os sinais < ou >',
    );
  });

  it('recusa tipo diferente de conserto ou encomenda', () => {
    const dados = { ...valido, tipo: 'outro' } as unknown as NovoPedido;
    expect(validarNovoPedido(dados, HOJE)).toContain('Escolha o tipo: conserto ou encomenda');
  });

  it('recusa prazo vazio', () => {
    expect(validarNovoPedido({ ...valido, prazo: '' }, HOJE)).toContain('Informe o prazo');
  });

  it('recusa prazo em formato ou data inválidos', () => {
    expect(validarNovoPedido({ ...valido, prazo: '20/11/2026' }, HOJE)).toContain(
      'Prazo inválido',
    );
    expect(validarNovoPedido({ ...valido, prazo: '2026-02-30' }, HOJE)).toContain(
      'Prazo inválido',
    );
    expect(validarNovoPedido({ ...valido, prazo: '2026-13-01' }, HOJE)).toContain(
      'Prazo inválido',
    );
  });

  it('recusa prazo anterior a hoje', () => {
    expect(validarNovoPedido({ ...valido, prazo: '2026-11-16' }, HOJE)).toContain(
      'O prazo não pode ser anterior a hoje',
    );
  });

  it('acumula vários erros e trata campos ausentes', () => {
    const erros = validarNovoPedido({} as NovoPedido, HOJE);
    expect(erros).toEqual([
      'Informe o nome do cliente',
      'Informe o item',
      'Escolha o tipo: conserto ou encomenda',
      'Informe o prazo',
    ]);
  });
});

describe('estaAtrasado e venceHoje', () => {
  it('marca como atrasado o pedido aberto com prazo anterior a hoje', () => {
    expect(estaAtrasado(pedido('P-0001', 'Ana', '2026-11-16'), HOJE)).toBe(true);
  });

  it('não marca como atrasado o pedido entregue, de hoje ou futuro', () => {
    expect(estaAtrasado(pedido('P-0001', 'Ana', '2026-11-10', 'entregue'), HOJE)).toBe(false);
    expect(estaAtrasado(pedido('P-0002', 'Ana', HOJE), HOJE)).toBe(false);
    expect(estaAtrasado(pedido('P-0003', 'Ana', '2026-11-30'), HOJE)).toBe(false);
  });

  it('identifica o pedido que vence hoje apenas se ainda estiver aberto', () => {
    expect(venceHoje(pedido('P-0001', 'Ana', HOJE), HOJE)).toBe(true);
    expect(venceHoje(pedido('P-0002', 'Ana', HOJE, 'entregue'), HOJE)).toBe(false);
    expect(venceHoje(pedido('P-0003', 'Ana', '2026-11-18'), HOJE)).toBe(false);
  });
});

describe('proximaSituacao', () => {
  it('segue a ordem pendente, pronto e entregue', () => {
    expect(proximaSituacao('pendente')).toBe('pronto');
    expect(proximaSituacao('pronto')).toBe('entregue');
  });

  it('não avança depois de entregue', () => {
    expect(proximaSituacao('entregue')).toBeNull();
  });
});

describe('listarAlertas', () => {
  it('separa atrasados (mais antigos primeiro) e os que vencem hoje', () => {
    const pedidos = [
      pedido('P-0001', 'Carlos', '2026-11-14'),
      pedido('P-0002', 'Maria', '2026-11-12'),
      pedido('P-0003', 'Ana', HOJE),
      pedido('P-0004', 'Rita', '2026-11-25'),
      pedido('P-0005', 'Paulo', '2026-11-01', 'entregue'),
    ];
    const alertas = listarAlertas(pedidos, HOJE);
    expect(alertas.atrasados.map((p) => p.codigo)).toEqual(['P-0002', 'P-0001']);
    expect(alertas.vencemHoje.map((p) => p.codigo)).toEqual(['P-0003']);
  });
});

describe('corresponde (busca)', () => {
  const maria = pedido('P-0023', 'Maria', '2026-11-20');
  const jose = pedido('P-0024', 'José', '2026-11-20');

  it('aceita termo vazio', () => {
    expect(corresponde(maria, '   ')).toBe(true);
  });

  it('busca parte do nome ignorando maiúsculas e acentos', () => {
    expect(corresponde(maria, 'MAR')).toBe(true);
    expect(corresponde(jose, 'jose')).toBe(true);
  });

  it('busca o código exato', () => {
    expect(corresponde(maria, 'p-0023')).toBe(true);
    expect(corresponde(maria, 'P-002')).toBe(false);
  });

  it('não encontra termo sem correspondência', () => {
    expect(corresponde(maria, 'zzz')).toBe(false);
  });
});
