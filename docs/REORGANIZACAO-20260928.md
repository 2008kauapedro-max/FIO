# FIO — entrega de 28/09/2026

Implementação feita sobre `FIO-PARA-REORGANIZAR-20260928-130314.zip`, na cópia isolada `fio-reorganizacao-20260928`. O trabalho anterior foi preservado. Nenhum deploy ou comando de migração foi executado em produção.

## O que mudou

- Início do cliente com identidade da barbearia, ação de agendar, profissionais, serviços, contato e próximos horários. Avisos de instalação deixaram de cobrir o conteúdo. O link da barbearia mantém o fluxo de cliente; contas da equipe não entram na gestão por esse link.
- Agendamento em quatro etapas: profissional/sem preferência, serviço, dia e horário, revisão. Voltar preserva as escolhas; trocar os critérios invalida o horário anterior. A confirmação informa o profissional atribuído.
- Atribuição automática considera profissionais ativos, serviços habilitados, expediente da barbearia, faixas individuais, pausas, bloqueios, duração e reservas. O critério é a menor duração total de atendimentos naquele dia local, com UUID como desempate estável. Clientes existentes continuam com as regras anteriores até o responsável configurar as restrições individuais.
- Criação e remarcação compartilham um bloqueio transacional por barbearia. A confirmação revalida a disponibilidade; o banco impede sobreposição de profissional e cliente. A remarcação mantém o profissional e o serviço; para trocar esses itens, cancele e faça uma nova reserva.
- Agenda diária consultada no servidor; resumo mensal com total, concluídos, cancelamentos e faltas, respeitando RLS e filtro de profissional. O total considera todo o período; a lista de detalhes mostra até 500 registros e informa quando existe esse limite. Não há conclusão automática pelo relógio.
- Configurações em categorias por perfil, com voltar e retorno ao topo. Responsável configura faixas da equipe, serviços realizados e bloqueios. Sem faixas individuais, vale o expediente da barbearia; com faixas, apenas os intervalos definidos ficam disponíveis. Alterações não cancelam reservas existentes.
- Falhas de IA não são substituídas por respostas locais. O chat apresenta erro e permite repetir; o servidor registra apenas categoria/status sanitizados da falha. Os limites atuais de IA aparecem na página do plano quando retornados pelo banco.
- Web Push por dispositivo, conta e barbearia; preferências, fila transacional, deduplicação, tentativas limitadas, desativação de endpoints 404/410, descarte de fila técnica com mais de sete dias, lembretes de até 24 horas, avisos internos e links autenticados para o agendamento. Conteúdo da tela bloqueada é genérico.
- Financeiro de cortes continua removido. SyncPay continua somente para assinatura do software. Benefícios/pacotes de cortes continuam sem processamento de pagamento pelo FIO.

## Validação executada

| Verificação | Resultado e ambiente |
|---|---|
| `npm run verify` | Aprovado: TypeScript, 210 testes em 17 arquivos, Vite e compilação do servidor |
| Navegador | 190 verificações acumuladas + 12 recapturas das telas afetadas; Edge, 360/390/430/1440 px, APIs e sessões sintéticas |
| Cadastro/login | 12 cenários aprovados: cadastro pelo link, identidade, navegação/reload, callback Google simulado e portal público, nas quatro larguras |
| Link de notificação | 4 cenários aprovados: login preserva o destino e abre os detalhes autorizados |
| Conta da equipe em link de cliente | 4 cenários aprovados: gestão não é aberta por esse caminho |
| Banco isolado | Todas as migrações aplicadas em PGlite nos testes; RLS, permissões, cotas, estados, cancelamento, remarcação, duração de 45/90 minutos, fuso, pausas, bloqueios e fila de notificações |
| Concorrência real | PostgreSQL 18.4 portátil, duas conexões TCP independentes, somente `127.0.0.1:55439`; três cenários aprovados: espera de lock e rejeição de sobreposição, atribuições automáticas distintas e conflito de cliente entre profissionais |
| Provedor de IA | Contratos HTTP com respostas simuladas: 401 e resposta inválida não persistem uma resposta fictícia; teste visual de erro e repetição |
| Push | RPCs reais no banco isolado; transporte simulado valida payload discreto e expiração 410. Nenhuma entrega a aparelho físico foi alegada |

As imagens e relatórios estão em `docs/reorganization-evidence`. `resultado.html` abre a galeria. Dados das capturas são fictícios. A revisão incluiu os quatro perfis; o administrador manteve seu painel existente, cuja navegação, configurações e Copiloto foram verificados.

O build terminou com avisos não bloqueantes: comentários de anotação de uma dependência Zod e chunk principal acima de 500 kB (aproximadamente 168 kB gzip). Não foram ocultados aumentando limites do bundler.

## Migração

Aplicar **uma nova migração**, após backup do banco e revisão:

`supabase/migrations/20260928160742_reliable_scheduling_and_notifications.sql`

Ela cria regras/horários/bloqueios da equipe, dispositivos e fila técnica de Push, RPCs de agenda e notificações. Adiciona `appointment_id` às notificações. A implementação anterior de reserva é movida para o schema privado e chamada pela nova função pública, preservando validações e histórico. Não exclui clientes, atendimentos, contratos nem pagamentos históricos. Não altere migrações antigas já aplicadas.

Com o projeto Supabase **já vinculado ao projeto correto**, confira no terminal:

```powershell
npx supabase migration list --linked
npx supabase db push --dry-run
```

Confira o projeto e todas as migrações listadas antes de executar por sua decisão `npx supabase db push`. Se aparecerem migrações antigas inesperadas, pare e confira o histórico. O script de aplicação de arquivos não executa migração nem deploy.

## Configuração externa pendente

### Web Push

No servidor, configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (por exemplo, `mailto:suporte@seu-dominio`). Gere um par estável com `npx web-push generate-vapid-keys --json`; guarde a chave privada somente no servidor. O endpoint autenticado retorna apenas a chave pública. Reutilize o par existente caso o Push administrativo já esteja em uso.

Mantenha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no servidor. Após build/migração, execute `npm run push:dispatch` no ambiente protegido. Agende esse comando aproximadamente a cada minuto no serviço que hospeda o processo. Um processo Node/worker ou agendador externo é necessário: o pacote não configura um cron na sua conta. Não exponha o dispatcher como endpoint público sem autenticação.

Use HTTPS, service worker publicado na raiz, manifest e ícones válidos. O usuário precisa abrir Configurações → Notificações e ativar no dispositivo. No iPhone/iPad, Web Push exige iOS/iPadOS 16.4+ e o app adicionado à Tela de Início, com permissão iniciada por ação do usuário. Em Android/navegadores compatíveis, depende das permissões do navegador e do sistema. Foco, bateria, conectividade e políticas do aparelho podem atrasar ou impedir avisos. Não há garantia de entrega idêntica ao WhatsApp. [Documentação WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

**Pendente de teste real:** autorização no aparelho, entrega com o aplicativo fechado, clique após sessão expirada e condições de bateria/Foco. O código, a fila e os testes locais estão entregues; VAPID e agendador não foram configurados em produção.

### IA, autenticação e cobrança

- Configure/revise `AI_API_URL` HTTPS, `AI_API_KEY` e `AI_MODEL` para o endpoint compatível com chat completions usado pelo servidor. Credenciais não foram acessadas nem validadas contra um provedor real. Consulte o log `fio.assistant.provider_failed` para categoria/status, sem registrar chaves ou conversas.
- Supabase Auth/Google, CAPTCHA, URLs de redirecionamento e envio real de e-mail precisam de uma verificação no seu ambiente. Os fluxos de UI e contratos foram testados com Auth simulado, e RLS com PostgreSQL isolado.
- SyncPay não recebeu alteração de preços, contratos ou cobrança. Não houve pagamento real, webhook real nem mudança na conta externa.
- Teclado virtual, PWA instalada e notificações em Android/iOS físicos continuam pendentes; redimensionamento e rolagem foram verificados no navegador de desktop com dimensões móveis.

## Planos e custos

Os preços existentes do ZIP foram mantidos e continuam centralizados em `shared/fio-plans.ts`, usado pela interface e pelo servidor de cobrança. As permissões existentes continuam no servidor/banco. Nenhuma assinatura existente foi migrada para outro preço.

| Plano | Mensal | Público / capacidade | IA |
|---|---:|---|---|
| Free | R$ 0 | Começo da operação; 100 clientes, 1 profissional + responsável, 8 serviços; agenda e página pública | Desativada |
| Pro | R$ 119,90 | Pequena equipe; 1.500 clientes, 5 profissionais + responsável, 40 serviços, 3 pacotes; feed e comunicação | Padrão atual: 100 consultas/dia e 10/min por usuário |
| Plus — proposta bloqueada | R$ 149,90 propostos | Faixa intermediária proposta: 3.000 clientes, 10 profissionais + responsável, 80 serviços, 8 pacotes | Proposta de 250/dia por usuário; não ativa |
| Premium | R$ 179,90 | Contrato/capacidade atuais preservados; 15 pacotes, feed, comunicação e suporte pelo formulário | Padrão atual: 500/dia e 20/min por usuário |

Os limites de IA são configuráveis no banco; a tela mostra os valores retornados para o plano atual. Tentativas enviadas ao provedor consomem cota mesmo que o provedor falhe. Limite por usuário não é um teto de custo total da barbearia: mais usuários podem consumir mais. Não há garantia de margem.

O banco atual não impõe cota numérica de clientes/equipe/serviços ao Premium. Isso foi preservado para não alterar contratos; a chamada promocional de uso ilimitado foi retirada. Definir uma nova cota comercial exige validar os contratos e custos, com regra explícita de preservação dos clientes existentes. **Plus não está contratável**: faltam faturas reais, perfil de consumo de IA e validação comercial antes de habilitar plano/permissões/mapeamento SyncPay. Os números da proposta não são cobrados.

Referências públicas consultadas em 28/09/2026:

- [Booksy Brasil](https://biz.booksy.com/pt-br/precos): R$ 99,99/mês + impostos e R$ 20 por agenda adicional. O conjunto de recursos difere do FIO; não é comparação idêntica.
- [Supabase](https://supabase.com/pricing): Pro a partir de US$ 25/mês, com franquias e cobrança por excedentes/recursos adicionais. Não corresponde a uma fatura confirmada deste projeto.
- [Vercel](https://vercel.com/pricing): Pro com valor de referência de US$ 20/mês, além de consumo conforme o plano. É cenário de hospedagem, não confirmação do serviço contratado pelo FIO.

Como cenário ilustrativo, Supabase Pro + Vercel Pro partem de US$ 45/mês antes de excedentes, impostos, câmbio, IA, serviços adicionais e taxas de cobrança. Dividir esse total pelo número de barbearias pagantes apenas estima o custo fixo por barbearia. O custo de IA depende de modelo, tokens e volume; não foi inventado valor por consulta. Web Push adiciona trabalho de servidor/fila e tráfego, sem taxa fixa por notificação presumida aqui. A taxa real da SyncPay deve ser obtida do contrato da sua conta.

## Referências de interface

As imagens fornecidas orientaram a ordem das etapas e a navegação compacta. Também foram consultadas páginas oficiais com exemplos visuais:

- [Fresha — criar agendamentos](https://www.fresha.com/help-center/knowledge-base/calendar/260-create-appointments-1): seleção de serviço/profissional, disponibilidade e revisão.
- [Booksy — página oficial com telas de agenda móvel e painel](https://biz.booksy.com/pt-br/precos): agenda por profissional e hierarquia de informações.
- [Square — filtros de calendário](https://squareup.com/help/us/en/article/8442-set-up-calendar-view-filters-for-appointments): filtros de equipe e visualização de agenda.

Foram usados padrões de organização, sem copiar marcas, fotos ou textos de concorrentes. O calendário do agendamento usa o seletor de data nativo do navegador/dispositivo.

## Limites conhecidos

O PostgreSQL real de teste foi a versão 18.4; a versão/configuração do Supabase de produção não foi consultada. Antes de publicar, aplique a migração no ambiente de validação habitual do projeto. Não é necessário criar outro projeto para aplicar os arquivos. O teste concorrente usa uma instalação portátil temporária, que não está no pacote final; o script registra o cenário reproduzível e recusa conexão remota por construção.

Os totais mensais são completos dentro do RLS, mas o bootstrap do painel e o contexto da IA são recortes limitados. O contexto declara esse limite para evitar inferência de totais. A lista mensal possui limite de 500 detalhes; não foi implementada paginação adicional nesta entrega.

Não há arquivos removidos do projeto atual nesta atualização. A lista exata de arquivos adicionados/alterados e os hashes ficam em `manifest.json` e `ARQUIVOS.md` na raiz da entrega.
