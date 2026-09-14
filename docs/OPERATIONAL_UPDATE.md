# Atualização operacional — agenda, assinatura e comunicação

Esta rodada mantém Feed, texturas e PWA e acrescenta a base que faltava para o core operacional antes das credenciais externas.

## Agenda

O estado agora é `scheduled → confirmed → in_service → completed`, com `cancelled` e `no_show`. OWNER/BARBER fazem transições operacionais; CLIENT só cancela dentro da janela permitida. O banco também bloqueia o mesmo cliente em dois profissionais no mesmo intervalo.

## Assinaturas

O uso de assinatura passou a ser explícito no agendamento. Um atendimento avulso não consome saldo. Se a assinatura for escolhida, o banco vincula uma assinatura ativa do mesmo tenant e o consumo acontece somente ao concluir, com registro único em `subscription_usage`. Atendimento coberto por assinatura não aceita recebimento avulso.

Foi criada a base de catálogo `subscription_plans`, além de emissão a partir de plano e cancelamento seguro. A interface atual continua aceitando o registro manual legado e pode ser evoluída para priorizar o catálogo.

## Comunicação

OWNER ganhou a área Comunicação para criar rascunhos e publicar avisos internos. A publicação gera notificações privadas para o público selecionado dentro do tenant. WhatsApp, e-mail e push externo continuam propositalmente desacoplados até a escolha dos provedores.

## Configuração

Veja `docs/NEXT_SETUP.md`. Supabase e IA já têm variáveis de ambiente documentadas; secrets não são incluídos no ZIP.

## Validação

Esta extensão foi revisada estaticamente, mas a instalação de dependências no ambiente de empacotamento expirou antes de completar. Portanto rode `npm ci`, `npm run typecheck`, `npm run build` e `npm test` localmente antes de considerar esta extensão validada. Não foi alterado o relatório histórico para fingir uma execução que não ocorreu.
