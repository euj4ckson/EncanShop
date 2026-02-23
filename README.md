# EncantArtes — E-commerce (React + TypeScript + Vite)

Projeto front-end completo para a loja EncantArtes, com vitrine, carrinho e área admin.

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

A senha é definida via variável de ambiente:

```bash
VITE_ADMIN_PASSWORD="sua_senha_segura"
```

Caso não exista, a aplicação usa `encantartes123` e exibe um alerta no login.

## Produtos compartilhados (Vercel Blob + Redis)

O projeto agora usa:

- `Vercel Blob` para salvar imagens enviadas pelo painel admin.
- `Upstash Redis` (integração da Vercel) para salvar produtos de forma compartilhada.

Com isso, produtos cadastrados no `/admin` em produção passam a aparecer para todos os visitantes.

### Configuração na Vercel

1. No projeto da Vercel, adicione a integração **Blob**.
2. Adicione a integração **Upstash Redis**.
3. Configure as variáveis de ambiente (Production/Preview):

```bash
VITE_ADMIN_PASSWORD="sua_senha_segura"
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
BLOB_READ_WRITE_TOKEN="..."
```

4. Faça um novo deploy.

### Modos de execução

- `npm run dev` (local): usa `localStorage` para produtos (mais simples para desenvolvimento).
- Produção (`Vercel`): usa `/api/products` + Redis/Blob automaticamente.
- Opcional: force um modo com `VITE_PRODUCTS_BACKEND=local` ou `VITE_PRODUCTS_BACKEND=api`.

## Contatos

- Editáveis pelo painel `/admin` ? aba **Configurações**.
- Valores padrão estão em `src/lib/config.ts`.
- Persistência via LocalStorage em `encantartes_contacts`.

## Seed de produtos

- Arquivo: `src/data/seedProducts.json`
- Usado como fallback inicial quando o Redis ainda não possui produtos.
- Em desenvolvimento local, a persistência continua via LocalStorage em `encantartes_products`.

Para redefinir a vitrine, limpe o LocalStorage do navegador.

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

## Próximos passos

1. Migrar autenticação admin para validação no servidor (sessão/cookie/JWT).
2. Levar contatos (`Configurações`) para o mesmo backend compartilhado.
3. Migrar persistência do carrinho para backend (opcional).
4. Adicionar otimização/redimensionamento de imagens no upload.

---

Feito para priorizar UI/UX premium, performance e manutenção.
