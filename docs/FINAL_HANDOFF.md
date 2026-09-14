# FIO — entrega consolidada

## O que foi consolidado
- Splash e ícones sem distorção: marca branca centralizada sobre fundo preto.
- Tema claro com item ativo legível.
- Sidebar/mobile compactados e navegação inferior simplificada por perfil.
- Modo demonstração removido da experiência.
- Propaganda grande da IA removida do dashboard; o Assistente continua disponível na navegação.
- Cliente pode abrir Equipe, tocar em responsável/barbeiro e ver telefone/WhatsApp.
- Feed leva o cliente ao contato da equipe.
- Responsável pode personalizar nome, descrição, logo, capa, fundo e cor principal da experiência do cliente.
- Card discreto de instalação PWA no cliente e portal público.
- Android/PC usam prompt nativo quando disponível; iPhone mostra guia visual curto.
- Card pode ser fechado e não aparece quando o app já está em modo standalone.
- Vercel preparada com Function em `api/[...path].ts` e rewrites SPA sem engolir `/api`.
- `.env` permanece no pacote entregue, mas continua ignorado pelo Git.

## Acessos de teste
Forma recomendada:

```powershell
npm run seed:users
```

O script usa `SUPABASE_SERVICE_ROLE_KEY` do `.env`, pede as senhas no terminal e cria/atualiza Auth + perfis sem salvar senha nas tabelas do FIO.

E-mails padrão:
- responsável: `2008kauapedro@gmail.com`
- funcionário: `barbeiro.fio@example.com`
- cliente: `cliente.fio@example.com`

Rotas:
- responsável: `/acesso/gestao`
- funcionário: `/acesso/equipe`
- cliente: `/b/fio-teste`

Se os três usuários já existirem no Supabase Auth, `supabase/test-users-link.sql` pode ser usado apenas para vincular barbearia/papéis.
