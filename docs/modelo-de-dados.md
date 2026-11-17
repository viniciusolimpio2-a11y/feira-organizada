# Modelo de dados

- Pedido: codigo (chave), cliente, item, tipo, prazo, situacao, criadoEm, entregueEm.
- Foto: id (chave), pedidoCodigo (liga ao Pedido), imagem, criadaEm. Um pedido tem no máximo uma foto.
- Peça (desejável): id (chave), nome, quantidade, quantidadeMinima, atualizadoEm.

Banco: IndexedDB, acessado pela biblioteca Dexie.js, com dados guardados no próprio aparelho.
