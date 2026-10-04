# Impla — Estoque de Implantes

App mobile-first (PWA) para controle de estoque de implantes.

## O que faz

- Estoque por **código + quantidade + mínimo**
- **Uso por clínica** (OC / RO)
- Pedidos de reposição **pelo uso** ou **pelo mínimo**
- **Relatório mensal** de uso por clínica (com totais por família e por dia)
- **Instalável no celular** (PWA / Adicionar à Tela de Início)

## Como rodar

```bash
cd estoque-implantes
npm install
cd client && npm install && cd ..
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3847

Produção (necessário para instalar como app fora do localhost, com HTTPS):

```bash
cd client && npm run build && cd ..
NODE_ENV=production npm start
```

## Instalar no celular

- **Android / Chrome:** banner “Instalar” no início, ou menu → Instalar app
- **iPhone:** Safari → Compartilhar → **Adicionar à Tela de Início**

## Publicar na Railway

Veja o guia completo em [`RAILWAY.md`](./RAILWAY.md).

Resumo: conectar o GitHub → gerar domínio → criar Volume em `/data`.
