# fio-marketing

Projeto independente. Requer Node.js 22.12+.

```sh
npm ci
cp .env.example .env
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env`.
Configure `VITE_FIO_APP_URL` antes do build; não coloque credenciais no `.env`.

```sh
npm run typecheck
npm run build
npm run preview
```

Publique `dist/`. Na Vercel, use este diretório como raiz; `vercel.json` prepara
o redirecionamento de www e as rotas. Em outra hospedagem, configure o equivalente.
Pendências e fontes: [ENTREGA.md](ENTREGA.md).
