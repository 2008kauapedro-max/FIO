# FIO — atualização para aplicar e testar

Base: main f5aef19, preservando o hardening e o botão Google anteriores. Este pacote contém somente os arquivos novos/alterados desta etapa, sem segredos, banco, dependências ou build. Não foi publicado automaticamente.

## Aplicar sem perder alterações

Extraia o ZIP em uma pasta separada, não diretamente sobre o projeto. Abra PowerShell nessa pasta:

    & .\APLICAR.ps1 -Projeto 'C:\Users\Kwai\Downloads\finalfio1'

O aplicador confere TODOS os arquivos antes de copiar, aceita diferenças LF/CRLF e cria backup dos substituídos ao lado do projeto. Se detectar conteúdo diferente da base e da versão nova, para antes de escrever. Envie a lista para mesclarmos; não substitua à força. Arquivos fora do pacote são preservados.

## Validar e aplicar banco

    cd C:\Users\Kwai\Downloads\finalfio1
    npm run verify
    if ($LASTEXITCODE -ne 0) { throw 'Validacao falhou. Nao publique.' }
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Revise o diff.' }
    npx supabase db push --dry-run
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao conferir banco.' }

A nova migration é 20260922213913_billing_changes_and_support.sql. As migrations anteriores de segurança já foram aplicadas conforme sua saída. Se aparecerem outras pendências inesperadas, confira antes de seguir.

    npx supabase db push
    if ($LASTEXITCODE -ne 0) { throw 'Migration falhou. Nao publique.' }
    npx supabase migration list
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao conferir migrations.' }

Não precisa repetir login/link se o CLI continua conectado. Não apague histórico nem use migration repair para contornar erro.

## Publicar

VS Code → Controle do Código-Fonte → revise arquivos → mensagem “Finaliza tutorial, suporte e gestao de assinaturas” → Confirmar e Sincronizar. Aguarde o deploy correspondente na Vercel ficar READY.

Alternativa:

    git add .
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar arquivos.' }
    git commit -m 'Finaliza tutorial, suporte e gestao de assinaturas'
    if ($LASTEXITCODE -ne 0) { throw 'Confira a mensagem do commit.' }
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Push falhou. Nao use force.' }
    git log -1 --oneline

Se aparecer nothing to commit, confira se já commitou. Aviso LF/CRLF sozinho não é falha. Não adicione .env nem backups de credenciais.

Após READY:

    node scripts/smoke.mjs https://usefio.vercel.app
    if ($LASTEXITCODE -ne 0) { throw 'Smoke falhou. Envie a saida.' }

## Alterações entregues

- Google abaixo de Entrar e das opções de cadastro/recuperação; logo colorida preservada; botão destravado ao voltar do OAuth.
- Tutorial com destaque, próximo/voltar/pular, perfil clicável, planos e feedback. Reabrir em Ajuda e suporte. Conclusão por usuário/barbearia/papel neste navegador.
- Dashboard sem linha decorativa, acesso aos detalhes, atendimentos sem texto cortado e miniaturas da identidade visual.
- Assistente aceita trial PRO válido; restrições FREE e isolamento mantidos.
- Recuperação de senha por e-mail com CAPTCHA. Responsável consulta e-mail do barbeiro e compartilha recuperação; nenhuma senha existente é exibida.
- Platform: novas barbearias, contato do responsável, mensagem WhatsApp combinada para revisão/envio MANUAL, caixa de feedback, detalhes focados em resumo/equipe/atividade.
- Histórico oculta eventos técnicos rotineiros por padrão sem apagar auditoria. Encerrar alerta explica que não corrige a causa. Copiloto entende o seguimento sobre planos sem buscar “delas” como nome; nomes incomuns não são prova de fraude.
- Consulta/reenvio/cancelamento de cobrança inicial pendente. Cancelar contratação nunca paga preserva trial/free.
- Troca de assinatura ativa via SyncPay com compatibilidade e confirmação; registro persistente contra repetição incerta. Upgrade só libera o novo acesso após comprovar o pagamento exato da diferença. Downgrade aguarda aplicação pelo provedor.

## Validação e limites

189 testes automatizados passaram, incluindo isolamento SQL, bloqueios de cobrança, papéis, prova do pagamento da diferença e IA no trial. TypeScript e build passaram. Avisos do Zod e de tamanho do bundle não impediram o build.

Nenhum pagamento real, migration em produção ou deploy deste pacote foi realizado nesta etapa. A instalação do navegador de testes falhou e o navegador remoto não acessou o servidor local: a revisão visual desktop/mobile ainda precisa ser feita. As fixtures experience-* usam dados sintéticos.

## Testar nesta ordem

1. Login por e-mail e CAPTCHA; sair/entrar. Google abre escolha de conta, retorna ao FIO; voltar do Google libera botão.
2. OWNER em trial acessa IA com provedor operacional; FREE não ganha recurso pago; contas de outra barbearia não veem dados.
3. Tutorial no computador e celular: próximo, voltar do formulário, pular, reabrir; destaque de perfil, plano e feedback. Tutorial não envia mensagem sozinho.
4. Enviar sugestão identificável e verificar a caixa Platform. WhatsApp abre texto para revisar, sem envio automático.
5. Cobrança antiga: conferir plano/ciclo/valor. Se não é a desejada, cancelar pendente, conferir trial preservado, escolher plano/ciclo. Pix inicial expirado: gerar novo pela cobrança existente.
6. PRIMEIRO pagamento real: gerar a cobrança desejada, conferir recebedor/valor no banco e pagar uma única vez. Atualizar cobrança; confirmar ativo, vencimento e recursos. Conferir webhook na SyncPay e resultado no FIO: consultar pode reconciliar mesmo se webhook falhou, então testar ambos.
7. DEPOIS, já pago: escolher outro plano, conferir condições e confirmar uma vez. Upgrade mantém acesso anterior até pagar a diferença. Atualizar, sair/entrar e conferir novo acesso. Downgrade deve respeitar próximo ciclo.
8. Conferir ausência de assinatura duplicada. BARBER/CLIENT não alteram cobrança. Plano de uma barbearia não libera outra.
9. Foto, identidade visual, agenda, clientes, perfil, recuperação de senha: salvar/recarregar com contas separadas.

## Painéis externos e erros

- CAPTCHA já configurado por você; não trocar as chaves por causa deste pacote.
- Google unsupported_provider: habilitar Google no Supabase com OAuth Client ID/Secret do Google Cloud. Callback do projeto: https://wpnkouothzwjfcqajcpr.supabase.co/auth/v1/callback. Autorizar redirects do FIO usados pelo código. Alterar botão não habilita o provider.
- SyncPay: as variáveis já aparecem na Vercel; não duplicar. Diagnóstico local: node scripts/check-syncpay.mjs. Ele usa .env local, NÃO as variáveis da Vercel, e não cria cobranças.
- SYNCPAY_PLAN_INCOMPATIBLE: os planos precisam pertencer ao mesmo produto e método. Peça à SyncPay a vinculação dos planos FIO ao mesmo produto mantendo tokens existentes. A criação antiga de planos não garante isso. Conferir na conta antes do upgrade real; não cancelar assinaturas pagas para contornar.
- SYNCPAY_ACCOUNT_PENDING: recorrência depende de liberação pela SyncPay. SYNCPAY_AUTH_ERROR: conferir credenciais/permissões Production; redeploy após mudar variável.
- SYNCPAY_CHANGE_UNCERTAIN: não repetir, apagar registro ou liberar acesso manual sem conferir o provedor. Timeout/retorno incompleto e upgrade sem cobrança positiva exigem conciliação administrativa; não há liberação automática nesses casos.
- Troca bloqueada com cobrança pendente/atraso. Reenvio automático cobre contratação inicial e atraso; Pix de diferença de upgrade expirado exige suporte/conciliação.
- A tela de senha usa recuperação por e-mail. Política efetiva de reautenticação também depende do Supabase Auth; mudança de UI sozinha não bloqueia chamadas diretas ao Auth.
- Push depende de VAPID/permissão; a tela explica ausência. Envio push não foi ativado.
- Assistente permanece limitado às ferramentas/permissões existentes, sem SQL livre ou alterações arbitrárias por conversa.
- Termos/privacidade preservam textos iniciais; identificação do prestador, cancelamento/reembolso e retenção dependem das definições comerciais.

## Aviso bancário no Pix

Não é possível garantir ausência ou esconder alertas emitidos pelo banco. Subconta individualizada não garante eliminá-los. Confirme com a SyncPay cadastro aprovado, recebedor exibido, vínculo do recebimento ao seu negócio e eventuais restrições. Se surgir alerta, interrompa e investigue com provedor/banco; não oriente cliente a ignorá-lo.

Referências:
https://blog.syncpayments.com.br/ajuda/trocar-plano-assinatura-api/
https://www.bcb.gov.br/estabilidadefinanceira/pix-seguranca
