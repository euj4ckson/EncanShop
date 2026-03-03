# EncantArtes - E-commerce (React + TypeScript + Vite)

Projeto da loja EncantArtes com vitrine, carrinho, checkout online, area do cliente e painel admin.

## Estado atual (03/03/2026)

- Checkout com WhatsApp, PIX (QR Code) e cartao de credito (ate 4x) via Mercado Pago.
- Webhook oficial do Mercado Pago para atualizacao automatica de status.
- Cupons de desconto (valor fixo, percentual e frete gratis) com aplicacao no checkout.
- Area do cliente com cadastro/login, enderecos salvos e pedidos.
- Lista de pedidos do cliente expansivel (itens, endereco, totais, observacoes, status).
- Retomada de pagamento de pedido pendente/falho pela area do cliente, no mesmo metodo original do pedido.
- Painel admin com gestao de produtos, fragrancias globais, cupons, status de pedidos e exclusao de pedidos.

## Requisitos

- Node.js 18+
- npm

## Como instalar

```bash
npm install
```

## Como rodar

```bash
npm run dev
```

## Como buildar

```bash
npm run build
```

## Admin

A senha e definida via variavel de ambiente:

```bash
VITE_ADMIN_PASSWORD="sua_senha_segura"
```

Caso nao exista, a aplicacao usa `encantartes123` e exibe um alerta no login.

### Recursos no painel admin

- Produtos: criar, editar, remover.
- Fragrancias globais: criar, ativar/desativar, remover.
- Cupons: criar, ativar/desativar, remover.
- Pedidos:
  - Atualizar status para `em preparacao`, `enviado` e `cancelado`.
  - Excluir pedido com confirmacao previa (somente admin).

## Produtos compartilhados (Vercel Blob + Redis)

O projeto usa:

- `Vercel Blob` para salvar imagens enviadas pelo painel admin.
- `Upstash Redis` (integracao da Vercel) para salvar dados compartilhados.

Com isso, dados cadastrados no `/admin` em producao aparecem para todos os visitantes.

### Configuracao na Vercel

1. No projeto da Vercel, adicione a integracao **Blob**.
2. Adicione a integracao **Upstash Redis**.
3. Configure as variaveis de ambiente (Production/Preview):

```bash
VITE_ADMIN_PASSWORD="sua_senha_segura"
ADMIN_PASSWORD="sua_senha_segura"
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
BLOB_READ_WRITE_TOKEN="..."
CUSTOMER_AUTH_SECRET="..."
MP_ACCESS_TOKEN="..."
MP_PUBLIC_KEY="..."
MP_WEBHOOK_SECRET="..."
APP_BASE_URL="https://seu-dominio.com"
RESEND_API_KEY="..."
ORDER_EMAIL_FROM="EncantArtes <pedidos@seu-dominio.com>"
ORDER_ADMIN_EMAIL="jacksonduardo6@gmail.com"
```

Observacoes de seguranca:

- Em producao, `CUSTOMER_AUTH_SECRET`, `ADMIN_PASSWORD` e `MP_WEBHOOK_SECRET` sao obrigatorios.
- Sem `MP_WEBHOOK_SECRET` em producao, o webhook e rejeitado por seguranca.

4. Faca um novo deploy.

### Modos de execucao

- `npm run dev` (local): usa `localStorage` para parte dos dados (modo desenvolvimento).
- Producao (`Vercel`): usa `/api/*` + Redis/Blob automaticamente.
- Opcional: force modo com `VITE_PRODUCTS_BACKEND=local` ou `VITE_PRODUCTS_BACKEND=api`.

## Checkout online (Mercado Pago)

Fluxos suportados:

- WhatsApp
- PIX com QR Code
- Cartao de credito (Checkout Mercado Pago, ate 4x)
- Cupons de desconto (`fixed`, `percent`, `free_shipping`)
- Campo de observacoes do pedido
- Mensagem pos-pagamento orientando envio de detalhes via WhatsApp
- Cancelamento de pedido na area do cliente (com tentativa de cancelamento/estorno no Mercado Pago)

### Endpoints

- `/api/customer-auth` (cadastro/login)
- `/api/customer-profile` (perfil e enderecos)
- `/api/shipping` (calculo de frete por CEP)
- `/api/orders` (criacao, consulta, cancelamento, retomada de pagamento, atualizacao/exclusao admin)
- `/api/fragrances` (fragrancias globais)
- `/api/coupons` (CRUD admin + validacao de cupom)
- `/api/checkout-config`
- `/api/mercadopago-webhook`

### Rotas de frontend

- `/conta` para login/cadastro e area do cliente
- `/carrinho` com checkout completo
- `/admin` para painel de administracao

### Regras de pagamento em pedidos existentes

- A retomada de pagamento vale para pedidos pendentes/falhos.
- O cliente nao pode trocar o metodo nesse fluxo:
  - Pedido PIX continua PIX.
  - Pedido cartao continua cartao.
  - Pedido WhatsApp continua WhatsApp.

## Fragrancias globais

- Gerenciadas no painel `/admin` em **Fragrancias**.
- Nao precisam ser cadastradas produto por produto.
- A selecao feita no detalhe do produto e salva no carrinho e no pedido.

## Cupons de desconto

- Gerenciados no painel `/admin` em **Cupons**.
- Tipos suportados:
  - `percent`: desconto percentual no subtotal.
  - `fixed`: desconto em valor no subtotal.
  - `free_shipping`: isenta frete.
- O cupom aplicado e salvo no pedido (`couponCode`, `couponType`, `discountAmount`).

## Contatos

- Editaveis pelo painel `/admin` na aba **Configuracoes**.
- Valores padrao em `src/lib/config.ts`.
- Persistencia local em `encantartes_contacts` (quando aplicavel ao modo local).

## Seed de produtos

- Arquivo: `src/data/seedProducts.json`
- Usado como fallback inicial quando o Redis ainda nao possui dados.

Para redefinir vitrine local, limpe o LocalStorage do navegador.

## Testes

```bash
npm run test
```

## Lint/Format

```bash
npm run lint
npm run format
```

## Logo

Coloque o logo real em `src/assets/logo.svg` (ou `.png`) e mantenha o import em uso.

## Proximos passos sugeridos

1. Migrar autenticacao admin para sessao/cookie/JWT server-side.
2. Centralizar todos os dados de contato no backend compartilhado.
3. Adicionar testes automatizados para fluxos de checkout e pedidos.
4. Adicionar otimizacao/redimensionamento de imagens no upload.

---

Feito para priorizar UI/UX, performance e manutencao.
