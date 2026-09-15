# Pendências do FIO

Este projeto implementa uma primeira versão funcional do core. A lista separa configuração externa, integrações ainda não exercitadas e funcionalidades não implementadas. Nenhum item abaixo é apresentado como pronto.

## Configuração externa necessária

- [ ] Criar/conectar projeto Supabase e preencher `.env`. Não foram fornecidos URL nem segredos.
- [ ] Aplicar as cinco migrations no Supabase de destino. Elas foram executadas em PostgreSQL embarcado nos testes, não em um projeto remoto.
- [ ] Configurar confirmação de e-mail, SMTP, URLs de login e recuperação no Supabase Auth.
- [ ] Criar contas reais OWNER/BARBER/CLIENT e completar onboarding, convites e recuperação com e-mail.
- [ ] Configurar provedor de IA HTTPS, modelo, chave e service role do servidor. Testar uma resposta real e sua persistência.
- [ ] Ativar PRO em um tenant de teste por administração confiável do banco. O frontend não pode alterar o plano SaaS.
- [ ] Revisar o MASTER BUILD PROMPT completo caso exista outro documento. Nesta conversa só estava disponível o trecho de identidade visual, mobile e IA; não é possível afirmar conformidade com requisitos não recebidos.

## Core a expandir

- [ ] Interface para editar expediente, exceções, feriados, pausas e férias por profissional. O banco já suporta expediente semanal da barbearia, inicialmente segunda–sábado, 09h–19h.
- [ ] Reagendamento transacional, no-show, intervalos entre atendimentos e prevenção de múltiplos agendamentos simultâneos do mesmo cliente em profissionais diferentes.
- [ ] Paginação e busca no servidor. Listas de clientes, assinaturas e agenda carregam até 500 registros; a agenda cobre os últimos 30 dias e futuros registros. Exibir aviso específico de truncamento no workspace.
- [ ] Gestão completa de equipe: desativação/reativação com confirmação, revogação de convite, transferência de responsabilidade e múltiplos papéis por usuário.
- [ ] Associar um cliente cadastrado pelo OWNER a uma conta que se registra posteriormente, mediante verificação. O cadastro manual atual não é vinculado automaticamente pelo nome.
- [ ] Edição e arquivamento de clientes com política de retenção e confirmação. Não há exclusão destrutiva no core atual.
- [ ] UI de arquivamento/reativação de serviços (a API já aceita `active`).
- [x] Identificar cliente nas listas administrativas de assinaturas pelo vínculo `client_id` retornado pelo banco.
- [ ] Renovação/cancelamento de plano de cortes com confirmação, catálogo de planos, elegibilidade por serviço e regras de consumo/refundo. O modelo atual considera cada atendimento concluído como um corte.
- [ ] Diferenciar pagamentos cobertos por assinatura dos avulsos, estornos, comissões, caixa e conciliação. O recebimento atual é manual e explícito; não é integração de cobrança.
- [ ] Exibir na lista financeira quais atendimentos já receberam pagamento, em vez de depender somente da rejeição de duplicidade no banco.
- [ ] Relatórios completos por período, serviço, profissional, recorrência e exportação. Apenas o total semanal recebido possui agregação completa no servidor.
- [ ] Cliente: exibir data junto à hora do próximo encontro quando ele ocorrer em outro dia.

## Planos SaaS e integrações

- [ ] Checkout, portal de cobrança, webhooks assinados, idempotência e estados de inadimplência do plano SaaS.
- [ ] Quotas não relacionadas à IA: limites de equipe, serviços, armazenamento e agendamentos por plano.
- [ ] Notificações, lembretes, campanhas e integração com canais de mensagem. O feed de fotos já está implementado; mensagens a terceiros ainda não são enviadas.
- [ ] Backups, restauração, logs estruturados sem dados pessoais, métricas, alertas e limites gerais de tráfego na infraestrutura.
- [ ] Hospedagem e domínio HTTPS. O projeto permanece local.

## Evolução da IA

- [ ] Propostas de ações persistidas e confirmáveis, idempotência, auditoria e revalidação de autorização na execução.
- [ ] Consultas analíticas tipadas sob demanda, sem enviar toda a listagem ao modelo. O contexto atual é uma projeção restrita e declara seu recorte.
- [ ] Consultar horários livres via ferramenta somente de leitura; atualmente a IA orienta abrir a agenda e não calcula disponibilidade com base em dados incompletos.
- [ ] Streaming, cancelamento de requisição pelo usuário, edição do título de conversa e política de retenção/exclusão do histórico.
- [ ] Paginação do histórico (lista de até 50 conversas; tela exibe até 200 mensagens; provedor recebe últimas 12).
- [ ] Renderização Markdown acessível para respostas estruturadas; por enquanto o conteúdo usa texto seguro com quebras de linha, sem HTML.
- [ ] Avaliações de qualidade/alucinação/prompt injection com o modelo escolhido, orçamento de tokens, latência e limites de custo por tenant.
- [ ] Reconciliação/reembolso de quota após falha de provedor e recuperação idempotente se a resposta for gerada mas a gravação falhar.

## Validação antes de produção

- [ ] Rodar cenários E2E com Supabase Auth real e o provedor de IA configurado. A prévia validada usa demonstração.
- [ ] Executar Playwright CLI em ambiente que permita os processos do navegador. Os cenários estão em `tests/e2e`; nesta sessão houve verificação de interface pelo navegador integrado, sem execução dessa suíte CLI.
- [ ] Testar concorrência real com múltiplas conexões PostgreSQL. PGlite comprovou SQL/RLS/regras, mas usa uma única conexão e não reproduz carga concorrente de produção.
- [ ] Testar `supabase db reset`/migrações em Docker e ambiente de staging; não havia uma instância configurada nesta sessão.
- [ ] Revisar RLS e privilégios com auditor independente antes de receber dados reais.
- [ ] Testar teclado virtual, leitor de tela, zoom de 200%, Safari/iOS e Android físicos. Viewport mobile foi inspecionado; não houve dispositivo físico.
- [ ] Política de privacidade, termos, retenção, exportação de dados e atendimento a solicitações de titulares adequados à operação real.

## Concluído nesta entrega

- [x] Projeto novo, sem reutilizar FIO anterior; todas as alterações dentro da pasta autorizada.
- [x] Core, rotas de três perfis, visual monocromático, texturas FIO e navegação mobile.
- [x] Autenticação integrada, memberships, RLS, FKs compostas e RPCs protegidas.
- [x] Agenda, serviços, clientes, convites, planos de cortes, recebimentos manuais e feed de fotos para equipe/clientes.
- [x] Assistente reutilizável, API real, contexto por perfil, quotas persistidas e feature gating configurável.
- [x] Histórico de IA vinculado ao papel de criação; mudança de papel bloqueia conversas anteriores e o servidor revalida acesso após a resposta do provedor.
- [x] Typecheck, build de frontend e compilação do backend.
- [x] Testes executados com migrations reais e cenários de segurança.
- [x] Verificação visual e de fluxos no navegador integrado; documentação de limitações.
- [ ] Reexecutar a suíte completa após a migration do Feed em ambiente com dependências instaladas. A suíte agora também cobre autorização de publicação e isolamento do feed.
- [x] Pacote de distribuição preparado com código, migrations, builds e documentação; sem `.env`, dependências instaladas ou caches.

- [x] PWA básica instalável: manifest, ícones, service worker, cache do shell e atualização automática do worker.
- [ ] Validar instalação PWA em Android/iOS físicos e estratégia de atualização em produção após deploy real.
- [x] Feed privado por tenant com upload em bucket privado, leitura por membros, publicação OWNER/BARBER e exclusão pelo autor ou OWNER.

## Rodada operacional 006/007

- [x] Fluxo de agenda expandido: scheduled → confirmed → in_service → completed, além de cancelled/no_show.
- [x] Bloqueio de sobreposição do próprio cliente em profissionais diferentes.
- [x] Assinatura agora é escolhida explicitamente no agendamento; atendimento avulso não consome corte.
- [x] Consumo de assinatura é atômico e idempotente via `subscription_usage`.
- [x] Atendimento coberto por assinatura não pode receber pagamento avulso duplicado.
- [x] Catálogo de `subscription_plans` e RPCs de emissão/cancelamento preparados no backend.
- [x] Fundação de campanhas + notificações internas por tenant; OWNER pode criar rascunho e publicar no app.
- [ ] Integrações externas de comunicação (WhatsApp/e-mail/push) continuam dependentes de provedor/credenciais.
- [ ] Checkout/webhook do plano SaaS continua dependente do gateway escolhido.
