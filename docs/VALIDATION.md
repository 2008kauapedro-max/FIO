> **Nota de extensão (Feed/PWA):** os números de testes e tabelas abaixo pertencem à auditoria da entrega original. Depois dessa auditoria foram adicionados PWA, texturas FIO e a migration `202609130005_feed.sql`, com dois cenários automatizados novos. Reexecute a suíte antes de tratar estes totais históricos como validação da versão estendida.

# Validação — 13/09/2026

## Resultado automatizado

- TypeScript frontend, servidor, contratos e testes: passou (`tsc --noEmit`).
- Build Vite: passou. Fontes locais, CSS e JavaScript gerados em `dist`.
- Compilação do servidor: passou (`tsc -p tsconfig.server.json`), saída em `dist-server`.
- Vitest: **29 testes passaram**, em 2 arquivos.
- 20 testes PostgreSQL/PGlite: quatro migrations aplicadas; roles, RLS, FKs, grants, convites, agenda, estados, saldo, recebimentos, quotas, histórico privado, mudança de papel e auditoria das 15 tabelas.
- 9 testes de API/contratos: autenticação obrigatória, health sem segredos, rejeição de injeção de papel/tenant/preço, limites de mensagem e contexto de IA por perfil.

O build e o Vitest foram executados no modo WebAssembly documentado no README, pois a execução nativa do esbuild foi bloqueada pelo ambiente com `spawn EPERM`. O typecheck e a compilação do servidor utilizaram o TypeScript normal. Não se desativaram proteções do sistema.

## Navegador integrado

Prévia servida pelo backend de produção em loopback. Verificações realizadas com dados de demonstração:

- Dashboard OWNER, navegação para Agenda e abertura do formulário.
- Criação de agendamento com confirmação; registro apareceu na lista e houve aviso de sucesso.
- Abertura do atendimento, confirmação de cancelamento e status Cancelado na lista.
- Troca para BARBER: nome e agenda próprios, sem navegação financeira ou administrativa.
- Troca para CLIENT: dashboard próprio e assinatura de cortes.
- Viewport de celular de 390 × 844: navegação inferior e campo de chat visíveis, conteúdo com scroll natural.
- Chat CLIENT: sugestão preenche o campo; envio mostra indisponibilidade da demonstração, sem inventar uma resposta de IA.
- Console da prévia: nenhum erro ou warning nos fluxos inspecionados.

Após a inspeção foram melhoradas a identificação acessível dos modais, a legibilidade dos rótulos e a atualização do input de data. Os testes e o build são repetidos após alterações de código.

Na retomada, esses ajustes foram conferidos no build final: selecionar 14/09 atualizou imediatamente os horários; um agendamento de demonstração foi criado e cancelado com confirmação. No chat CLIENT em 390 × 844, `scrollWidth` e largura da tela foram ambos 390 px, sem overflow horizontal. A mensagem de indisponibilidade apareceu corretamente e o console não registrou erros ou warnings. O viewport temporário foi restaurado ao final.

## Auditoria final de segurança

- A quarta migration associa cada conversa ao papel original, bloqueando acesso a histórico de escopo anterior após mudança de papel. O teste exercita uma mudança OWNER → BARBER, incluindo leitura de mensagens e tentativa de editar o escopo.
- As 15 tabelas do aplicativo têm RLS habilitada; nenhum procedimento do schema público pode ser executado por `anon`.
- A API consulta Supabase Auth para validar o token, e a suíte testa rejeição de JWT forjado, além de ausência de token.
- Rotas administrativas rejeitam BARBER antes de qualquer mutação. Regras SQL continuam aplicáveis mesmo em acesso direto ao Supabase.
- Leitura de contexto da IA usa JWT do usuário; service role fica restrita à persistência depois de verificar a conversa. O acesso é verificado novamente após aguardar a resposta do provedor.
- O bundle público foi inspecionado e não contém `AI_API_KEY`, `AI_API_URL` nem `SUPABASE_SERVICE_ROLE_KEY`.
- Nenhuma credencial real foi encontrada/configurada no projeto. `.env.example` contém campos vazios e a porta local.

## Limites desta validação

Não foram fornecidas credenciais de Supabase nem IA. Não foram criados usuários reais, aplicadas migrations remotas, enviados e-mails, feitas cobranças ou geradas respostas de provedor. PGlite usa um esquema `auth` controlado pelo teste; não simula todo o serviço Supabase Auth. A suíte Playwright está escrita, mas não foi executada pela CLI neste ambiente; a inspeção de navegador acima foi realizada pelas ferramentas integradas.

O SQL é testado de verdade, inclusive tentativas negadas; concorrência de múltiplas conexões, carga, backups e dispositivos físicos permanecem pendentes.
