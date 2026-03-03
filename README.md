# EncantArtes - E-commerce (React + TypeScript + Vite)

Projeto da loja EncantArtes com vitrine, carrinho, checkout online, area do cliente e painel admin.

## Estado atual (03/03/2026)

- Checkout com WhatsApp, PIX (QR Code) e cartao de credito (ate 4x) via Mercado Pago.
- Webhook oficial do Mercado Pago para atualizacao automatica de status.
- Pagamento aprovado move o pedido automaticamente para `em preparacao`.
- Em pedidos pendentes, o cliente tambem sincroniza status na consulta do pedido (fallback), evitando tela travada se webhook atrasar.
- Cupons de desconto (valor fixo, percentual e frete gratis) com aplicacao no checkout.
- Area do cliente com cadastro/login, telefone de contato, enderecos salvos e pedidos.
- Lista compacta de pedidos na area do cliente, sem pedido aberto por padrao; ao clicar, entra em modo foco (oculta endereco e mostra apenas o pedido selecionado), com opcao de voltar para a tela completa.
- Retomada de pagamento de pedido pendente/falho pela area do cliente, no mesmo metodo original do pedido.
- Painel admin com gestao de produtos, fragrancias globais, cupons, status de pedidos e exclusao de pedidos.
- Painel admin permite adicionar observacao opcional ao marcar pedido como `em preparacao`/`enviado` (a observacao segue no e-mail).
- Tela pos-pagamento no checkout com ilustracao SVG tematica de vela quando o pagamento e confirmado.
- E-mails transacionais personalizados por etapa (pedido recebido, pagamento confirmado, em preparacao, enviado, falha e cancelado) com layout visual e ilustracao.
- Atualizacao de rastreio pelo admin dispara e-mail dedicado para cliente e admin, com codigo/link atualizados.
- Atualizacao de rastreio tambem permite informar a transportadora (ex.: Correios, Jadlog), exibida no painel, conta do cliente e e-mails.
- Campos de formulario padronizados (input/select/textarea/botoes), com melhor legibilidade e responsividade no mobile.
- Backend de pedidos endurecido: itens/precos/variantes/fragrancias e frete sao recalculados no servidor (sem confiar em valores enviados pelo frontend).
- Escritas sensiveis agora usam lock no Redis (pedidos, perfil de cliente e cupons), reduzindo risco de sobrescrita em concorrencia.

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
  - Inserir observacao opcional no momento de atualizar para `em preparacao`/`enviado`.
  - Se o pedido estiver sem pagamento aprovado, o painel pede confirmacao explicita antes de avancar para `em preparacao`/`enviado`.
  - Atualizar transportadora, codigo e link de rastreio para exibicao ao cliente.
  - Atualizacao de rastreio dispara notificacao por e-mail para cliente e admin.
  - Excluir pedido com confirmacao previa (somente admin).
- Configuracoes:
  - Botao para disparar teste das notificacoes de e-mail (pedido realizado, pagamento confirmado, em preparacao e enviado).

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
# aliases aceitos (opcional): RESEND_FROM_EMAIL/RESEND_FROM e ADMIN_EMAIL
# fallback SMTP (opcional, recomendado sem dominio proprio)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="seuemail@gmail.com"
SMTP_PASS="sua-app-password-do-gmail"
SMTP_FROM="EncantArtes <seuemail@gmail.com>" # opcional; se vazio, usa SMTP_USER
# aliases tambem aceitos:
# USER: SMTP_USERNAME, SMTP_EMAIL, SMTP_LOGIN, EMAIL_USER, EMAIL, EMAIL_LOGIN, EMAIL_ADDRESS, MAIL_USER, MAIL_LOGIN, MAIL_ADDRESS, MAIL_USERNAME
# PASS: SMTP_PASSWORD, SMTP_SENHA, SMTP_SECRET, EMAIL_PASS, EMAIL_PASSWORD, EMAIL_SECRET, SENHA_EMAIL, SENHA, MAIL_PASS, MAIL_PASSWORD, MAIL_SECRET, PASSWORD, PASS
# FROM: GMAIL_FROM_EMAIL, EMAIL_FROM, FROM_EMAIL, FROM, MAIL_FROM, MAIL_FROM_EMAIL
```

Observacoes de seguranca:

- Em producao, `CUSTOMER_AUTH_SECRET`, `ADMIN_PASSWORD` e `MP_WEBHOOK_SECRET` sao obrigatorios.
- Sem `MP_WEBHOOK_SECRET` em producao, o webhook e rejeitado por seguranca.
- Criacao de pedido ignora preco/frete vindo do cliente e calcula com base no catalogo salvo no Redis + regra de frete por CEP.
- Transicoes de status no admin seguem validacao de fluxo para evitar regressao de estado (ex.: `enviado` nao volta para `em preparacao`).
- Para envio de e-mails via Resend, o remetente (`ORDER_EMAIL_FROM`) precisa estar em dominio/verificacao aceita pelo Resend.
- Se estiver usando `onboarding@resend.dev`, o Resend limita destinatarios; para cliente final, configure `SMTP_*` (fallback automatico).
- Sem dominio proprio no Resend, o sistema pode usar fallback SMTP automaticamente quando `SMTP_*` estiver configurado.
- Para Gmail SMTP, use App Password (conta com verificacao em 2 etapas).
- O sistema prioriza envio ao cliente e depois ao admin, com pequeno intervalo para reduzir rate-limit.
- Se `SMTP_FROM` estiver invalido ou em `resend.dev`, o backend normaliza para o `SMTP_USER` automaticamente.
- Se `ORDER_EMAIL_FROM` estiver em `resend.dev`, destinatario de cliente externo nao usa fallback para Resend (evita erro mascarado e garante diagnostico real do SMTP).
- Em caso de falha no envio, o erro da API agora inclui mais detalhe (ex.: `http-403:...`) para diagnostico rapido.
- Falhas de envio agora sao registradas nos logs da funcao serverless (`[email] ...`) para diagnostico no painel da Vercel.

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
  - inclui atualizacao de telefone de contato do cliente
- `/api/admin-email-test` (teste de notificacoes por e-mail, protegido por senha admin)
  - usa o mesmo template visual e os mesmos assuntos das rotinas reais de envio
  - retorna diagnostico por etapa (provider e erro de cliente/admin) quando houver falha
- `/api/shipping` (calculo de frete por CEP)
- `/api/orders` (criacao, consulta, cancelamento, retomada de pagamento, atualizacao/exclusao admin e rastreio)
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
