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

## Contatos

- Editáveis pelo painel `/admin` ? aba **Configurações**.
- Valores padrão estão em `src/lib/config.ts`.
- Persistência via LocalStorage em `encantartes_contacts`.

## Seed de produtos

- Arquivo: `src/data/seedProducts.json`
- Persistência via LocalStorage em `encantartes_products`.

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

## Próximos passos (LocalStorage ? API)

1. Criar uma API Node/Express ou Nest com endpoints CRUD de produtos.
2. Substituir `ProductRepoLocal` por `ProductRepoApi` em `src/services/`.
3. Migrar persistência do carrinho para banco (opcional) e adicionar autenticação real.
4. Adicionar upload real de imagens (S3, Cloudinary, etc).

---

Feito para priorizar UI/UX premium, performance e manutenção.
