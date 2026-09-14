# Arquitetura e limites de confiança

## Caminho de uma solicitação

Browser → API `/api` com Bearer token → Supabase `auth.getUser(token)` → membership ativa no tenant selecionado → operação com o JWT do usuário → RLS/RPC no PostgreSQL.

`X-Barbershop-Id` é um seletor, nunca uma autorização. A API valida UUID e verifica membership obtida do banco. `role`, preço, duração, plano, quota e contexto analítico enviados pelo frontend não são aceitos nos contratos. Não são utilizados `user_metadata` ou claims editáveis pelo cliente para conceder papéis.

## Modelo de dados

| Entidade | Responsabilidade |
|---|---|
| barbershops | Tenant e fuso horário |
| memberships | Usuário, papel e estado ativo no tenant |
| services | Catálogo com preço em centavos e duração |
| customers | Cadastro mínimo; vínculo opcional ao usuário autenticado |
| business_hours | Expediente por dia da semana |
| appointments | Agenda com preço/duração congelados na criação |
| client_subscriptions | Saldo e validade do plano de cortes |
| payments | Recebimento manual, único por atendimento |
| invitations | Token aleatório de uso único, papel limitado e expiração |
| audit_events | Eventos críticos com autor e alvo |
| saas_subscriptions / plan_features | Plano do tenant e recursos configuráveis |
| assistant_conversations / assistant_messages | Histórico privado por tenant e usuário |
| assistant_usage | Contadores diários e por minuto com bloqueio de linha |

As referências de agenda usam chaves estrangeiras compostas `(barbershop_id, id)`. Não basta um UUID existir em outra barbearia. Todas as tabelas do aplicativo têm RLS; grants limitam operações e colunas. Mutação de papéis, planos, agenda, recebimentos, saldo e auditoria ocorre apenas por funções específicas ou administração confiável.

## Matriz de acesso

| Recurso | OWNER | BARBER | CLIENT |
|---|---|---|---|
| Agenda | Toda a barbearia | Somente agenda própria | Somente agendamentos próprios |
| Clientes | Cadastros da barbearia | Nome de clientes já atendidos/agendados consigo | Próprio cadastro |
| Serviços / expediente | Leitura e gestão autorizada | Leitura | Leitura |
| Equipe | Gerencia convites | Profissionais e próprio vínculo | Profissionais e próprio vínculo |
| Financeiro / auditoria | Permitido | Negado | Negado |
| Planos de cortes | Registra e consulta | Negado | Consulta os próprios |
| Plano SaaS | Consulta | Consulta do estado do tenant | Consulta do estado do tenant |
| Conversas de IA | Apenas próprias | Apenas próprias | Apenas próprias |

Um OWNER não pode ler conversas privadas de outros usuários. A função SECURITY DEFINER de cada operação revalida `auth.uid()` e membership. Funções usam `search_path = ''`, nomes totalmente qualificados e grants explícitos; execução padrão para PUBLIC/anon é revogada.

Conversas também armazenam `scope_role`, atribuído no banco por trigger e não editável pelo usuário. Se o papel mudar, a RLS oculta conversas e mensagens do papel anterior. A API revalida o acesso depois de aguardar o provedor, antes de persistir ou devolver a resposta. Conversas anteriores à quarta migration ficam em `LEGACY`, inacessíveis, pois não há como inferir com segurança seu escopo original.

## Agenda e valores

- `book_appointment` busca serviço ativo, profissional ativo e cliente no mesmo tenant. Aceita de agora até 60 dias, dentro do expediente.
- Um advisory lock por tenant/profissional serializa criações concorrentes. A função testa interseção dos intervalos antes de inserir; não existe grant de INSERT direto para usuários.
- `available_slots` gera intervalos de 15 minutos e retorna somente horários, sem revelar dados de outros clientes.
- Alterações de status bloqueiam a linha, validam o papel, restringem transições e registram auditoria. CLIENT só cancela até duas horas antes; BARBER só atua na própria agenda. Não há reabertura de atendimento concluído.
- Ao concluir, há uma única baixa de corte em assinatura ativa e válida. Repetir a transição falha.
- `record_payment` é exclusivo do OWNER, usa o preço congelado no atendimento concluído e bloqueia recebimentos repetidos. Não se comunica com gateway de pagamento.
- `weekly_revenue` agrega todos os pagamentos da semana no banco. Listagens do workspace têm recorte de 30 dias passados e até 500 registros; não são relatórios contábeis completos.

## IA

`POST /api/assistant` valida mensagem/conversa, consulta o plano real, aplica quota durável, lê o contexto com RLS e chama um endpoint HTTPS configurado no servidor. Somente a persistência das mensagens utiliza service role, com IDs obtidos de conversa autorizada. Não há service role no caminho de consulta analítica.

BARBER não recebe totais financeiros, assinaturas nem lista administrativa de clientes. CLIENT recebe apenas seu recorte. OWNER recebe a receita agregada da semana e dados operacionais do próprio tenant. Os recortes e limitações são enviados junto ao contexto; a IA deve declarar falta de dados. Nenhuma resposta é apresentada como execução de uma ação.

`shared/domain.ts` contém uma allowlist inicial de ações de navegação. Não há ferramentas destrutivas no adaptador. Para adicionar ações no futuro:

1. Persistir uma proposta com tipo, tenant, ator, expiração, estado e chave de idempotência.
2. Resolver alvos e valores no servidor com o JWT do ator.
3. Exibir a operação concreta ao usuário para confirmar.
4. Revalidar a permissão e o estado atual na execução, em transação.
5. Exigir confirmação explícita para cancelar, excluir, desativar, cobrar, renovar ou alterar dado crítico; escrever auditoria e bloquear replay.

Não usar um `confirmed: true` vindo de conteúdo gerado pela IA como autorização humana. As rotas operacionais atuais exigem esse campo apenas como contrato de UI e não são ferramentas acessíveis ao modelo.

## Decisões de implantação

- Fonte DM Sans hospedada no próprio build; sem dependência de Google Fonts em tempo de execução.
- API e frontend na mesma origem; sem CORS permissivo. Cabeçalhos de segurança via Helmet. Conteúdo do chat é texto escapado pelo React, sem HTML arbitrário.
- Segredos somente em `.env` local ou cofre de implantação. `.env` e caches são ignorados.
- Servidor local usa loopback. Publicação, TLS, backups, observabilidade, política de retenção e checkout de planos devem ser configurados antes de produção.
- Nenhum projeto antigo foi consultado ou reutilizado. Todos os arquivos produzidos para esta entrega ficam na nova pasta.
