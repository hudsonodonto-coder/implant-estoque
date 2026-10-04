# Publicar o Impla na Railway

O app já está preparado com `Dockerfile` e volume em `/data` (banco SQLite).

## Opção recomendada (GitHub + Railway)

### 1. Subir o código no GitHub

No computador (ou no Cursor Desktop), na pasta do projeto:

```bash
cd estoque-implantes
git remote add origin https://github.com/SEU_USUARIO/impla-estoque.git
git push -u origin cursor/estoque-implantes-mobile-e008
```

Crie o repositório vazio no GitHub antes (sem README).

### 2. Criar o serviço na Railway

1. Entre em [railway.app](https://railway.app) e abra o seu projeto
2. **New** → **GitHub Repo** → selecione `impla-estoque`
3. Railway vai detectar o `Dockerfile` e fazer o deploy

### 3. Volume (obrigatório para não perder o estoque)

Na Railway atual o volume **não** fica em Settings do serviço.

1. Abra o projeto (visão do canvas com os cards)
2. Clique com o **botão direito** num espaço vazio → **Volume** / **New Volume**  
   (ou `Ctrl+K` / `Cmd+K` → digite `New Volume`)
3. Selecione o serviço do Impla
4. Mount path: `/data`
5. Salve (vai redesployar)

Também funciona definir a variável `DATA_DIR=/data`.

### 4. Variáveis

Em **Variables**, confira:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/data` |
| `PORT` | (Railway define sozinho; não precisa criar) |

### 5. Domínio público

1. **Settings** → **Networking** → **Generate Domain**
2. Abra a URL no celular (HTTPS)
3. Instale como app:
   - iPhone: Compartilhar → Adicionar à Tela de Início
   - Android: Instalar app

### 6. Teste rápido

- `https://SUA-URL.up.railway.app/api/health` → `{"ok":true}`
- Abra o app, registre um uso em OC/RO e veja o Relatório

---

## Opção alternativa (Railway CLI)

```bash
npm i -g @railway/cli
railway login
cd estoque-implantes
railway init
railway add --volume /data
railway up
railway domain
```

---

## Observações

- Sem o volume em `/data`, o estoque some a cada redeploy
- O primeiro boot importa automaticamente os 41 produtos da planilha
- Para atualizar depois: só dar `git push` na branch conectada
