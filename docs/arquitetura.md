# Arquitetura e segurança do MVP

## Arquitetura (monolítica em camadas)
- Apresentação: telas e componentes Angular, só exibem dados e recebem toques.
- Serviços: regras de negócio (código do pedido, situação, cálculo de atraso).
- Persistência: gravação no aparelho com Dexie.js e IndexedDB.
- Cada camada fala apenas com a vizinha.

## Segurança
- Senha local com PBKDF2 (HMAC-SHA-256) e salt, nunca em texto limpo.
- Texto exibido por interpolação do Angular, sem innerHTML (previne XSS).
- Validação nos serviços antes de gravar, sem confiar só no formulário.
- Coleta mínima: só o nome do cliente, sem CPF, endereço ou telefone.
