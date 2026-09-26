# FIO — agenda e assinaturas do aplicativo

## Como colocar no seu projeto

1. Faça uma cópia de segurança da pasta `finalfio1`.
2. Extraia este ZIP. Copie as pastas `src`, `server`, `shared`, `supabase` e `tests` para dentro de `C:\Users\Kwai\Downloads\finalfio1`. Aceite substituir os arquivos com o mesmo nome. Mescle as pastas: não apague as pastas existentes. O ZIP contém somente arquivos alterados ou novos, não o projeto completo.
3. No terminal do projeto, valide:

```powershell
cd "C:\Users\Kwai\Downloads\finalfio1"
npm run verify
if ($LASTEXITCODE -ne 0) { throw "A validação falhou. Pare aqui e envie o erro." }
```

4. Atualize o banco uma vez. Esta etapa desativa as antigas funções de financeiro; copiar arquivos não modifica o banco remoto.

```powershell
npx supabase db push --dry-run
if ($LASTEXITCODE -ne 0) { throw "A prévia do banco falhou. Pare aqui." }
```

A nova migração desta entrega é `20260925163907_retire_shop_finance.sql`. Se a prévia mostrar outras migrações que você não reconhece, envie a saída antes de aplicar. Se mostrar somente essa migração:

```powershell
npx supabase db push
if ($LASTEXITCODE -ne 0) { throw "A atualização do banco falhou. Pare aqui." }
```

5. Publique os arquivos atualizados pelo fluxo da Vercel que você já usa. Abra `https://usefio.vercel.app` depois da publicação. Substituir arquivos no computador não atualiza o site publicado.

Não há instalador `.ps1`, pasta de patch ou dependência nova nesta entrega. Seus arquivos `.env` e as configurações de login/CAPTCHA ficam no projeto atual.

## O que mudou

- Financeiro das barbearias removido da navegação, tela inicial, painel administrativo por barbearia, API e contexto do assistente.
- Tela inicial mostra a agenda do dia. Próximos atendimentos incluem os confirmados e os que estão em andamento.
- O agendamento termina na confirmação do horário, sem Pix, depósito de 50%, retenção por falta ou reembolso pelo FIO.
- Valores de serviços e pacotes continuam no catálogo como informação. O pagamento dos serviços é combinado diretamente com a barbearia, fora do FIO.
- Pacotes de cortes continuam com validade, quantidade restante e desconto de um corte ao concluir o atendimento. Agendamento não equivale a pagamento.
- SyncPay permanece exclusivamente nas assinaturas das barbearias no FIO. Preços vigentes do PRO/PREMIUM, teste do PRO e webhooks foram mantidos.
- Quatro cartões de planos, dois por linha no celular e quatro em telas largas. Recursos adicionais ficam em “Ver recursos”.
- Antigos recebimentos ficam preservados no banco, sem acesso pelas contas do aplicativo ou API. As funções antigas de recebimento/relatório são removidas. Migrações históricas ficam intactas.

## Plus — proposta para revisão, contratação bloqueada

Conforme sua escolha de revisar a proposta antes da ativação, o Plus aparece como “Em breve”. O servidor também bloqueia cobrança desse plano. Os limites sugeridos abaixo não estão liberados em contas reais.

| Plano | Semanal | Mensal | Anual |
| --- | ---: | ---: | ---: |
| FREE | Grátis | Grátis | Grátis |
| PRO — preço atual | R$ 39,90 | R$ 119,90 | R$ 1.249,90 |
| PLUS — proposta | R$ 49,90 | R$ 149,90 | R$ 1.599,90 |
| PREMIUM — preço atual | R$ 59,90 | R$ 179,90 | R$ 1.899,90 |

Proposta do Plus: até 3.000 clientes, responsável + 10 profissionais, 80 serviços, 8 pacotes de cortes, feed, comunicação e FIO IA. A cota de IA do Plus também precisa ser definida na aprovação. Depois da revisão, a ativação exige implementar esses limites no banco e habilitar o plano no fluxo de assinatura; não basta retirar o botão desativado.

## Validação realizada

- TypeScript: aprovado.
- 192 testes automatizados: aprovados, incluindo banco com todas as migrações, isolamento entre barbearias e desconto dos cortes.
- Compilação de cliente e servidor: aprovada.
- 14 testes de navegador: aprovados no desktop e no celular.
- Cartões conferidos entre 320 e 1440 pixels; temas claro/escuro; criação de agendamento sem pagamento; checkout SaaS simulado; Pix pendente/vencido; Plus bloqueado.
- Nenhum pagamento real foi realizado e nenhum banco/site de produção foi alterado nesta revisão.
- Avisos existentes de comentários do Zod e tamanho de bundle não impediram a compilação.

## Depois de publicar

Confira na sua conta: agenda, novo agendamento, cancelamento/falta/conclusão, pacotes de cortes e tela Plano FIO. Para testar cobrança, use somente o fluxo de assinatura do próprio FIO. Login, CAPTCHA e assistentes mantêm as implementações que estavam no ZIP enviado.
