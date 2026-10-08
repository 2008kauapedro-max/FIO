import type { LegalDocument } from './legal.js';

/**
 * Conteúdo informativo dos métodos de pagamento e direitos do cliente.
 * Não habilita Pix Automático nem cartão e não altera APIs do provedor.
 * A disponibilidade de métodos/taxas/prazos deve ser confirmada antes do lançamento.
 */
const EMAIL='usefiooficial@gmail.com';
const UPDATED='08 de outubro de 2026';

export const REFUND_POLICY:LegalDocument={
 title:'Política de Cancelamento e Reembolso',updated:UPDATED,contactEmail:EMAIL,
 intro:[
  'Esta Política apresenta como cancelar assinaturas do FIO, como pedir a devolução de valores, o que acontece com as renovações e de que modo acompanhamos solicitações.',
  'Ela deve ser lida junto aos Termos de Uso, à Política de Privacidade e ao resumo da contratação. Nenhuma disposição afasta direitos obrigatórios previstos na legislação brasileira.'
 ],sections:[
  {title:'1. Diferença entre cancelamento e reembolso',bullets:[
   'Cancelamento da assinatura: encerra as renovações futuras, conforme a confirmação do provedor de pagamento, e não implica automaticamente devolução de parcelas ou cobranças anteriores.',
   'Reembolso: solicitação de devolução de uma cobrança já realizada, sujeita às regras legais e às condições da operação, nunca apenas à exibição de um botão.',
   'Revogação de autorização bancária: no Pix Automático, interrompe a permissão de novos débitos; é distinta da administração contratual da assinatura no FIO.'
  ]},
  {title:'2. Como consultar sua situação no aplicativo',paragraphs:[
   'Abra Plano FIO, acesse Minha assinatura e selecione Consultar reembolso. O sistema consulta os registros de contratação e pagamento para apresentar as informações disponíveis; o cliente não informa por conta própria se está dentro ou fora do prazo.',
   'Uma indicação automática de elegibilidade não substitui as verificações finais da cobrança, da identidade, do contrato e da confirmação do prestador de pagamento. Se houver divergência, procure o suporte.'
  ]},
  {title:'3. Prazo de arrependimento nas contratações online',paragraphs:[
   'Quando aplicável o Código de Defesa do Consumidor, o art. 49 prevê arrependimento em sete dias contados da assinatura do contrato ou do recebimento do produto ou serviço, em contratos celebrados fora do estabelecimento comercial. O exercício regular desse direito não deve gerar ônus ao consumidor.',
   'A aplicação a uma contratação empresarial ou a uma renovação específica pode depender das circunstâncias. O FIO não usa o término da janela inicial como motivo para recusar automaticamente outras devoluções legalmente devidas.'
  ]},
  {title:'4. Após o prazo inicial de sete dias',bullets:[
   'Ainda é possível solicitar o cancelamento de futuras renovações.',
   'Cobranças em duplicidade, pagamentos indevidos, cobrança após cancelamento efetivo, falhas relevantes do serviço e outras situações protegidas por lei podem justificar análise e devolução.',
   'A análise não deve presumir que todos os pedidos feitos depois de sete dias são improcedentes nem exigir renúncia a direitos.'
  ]},
  {title:'5. Como solicitar um reembolso',bullets:[
   'Quando disponível, utilize a opção Solicitar reembolso no próprio painel. A tela deve identificar o plano, a cobrança, o valor, o meio de pagamento e o motivo legal ou contratual da solicitação.',
   'Se a solicitação automática não estiver disponível, utilize Ajuda e suporte ou escreva para '+EMAIL+'. Não é necessário compartilhar senha bancária, código de cartão ou dados completos do cartão.',
   'O FIO deve registrar o recebimento e oferecer um número de protocolo ou outro comprovante verificável. Uma solicitação recebida não é sinônimo de dinheiro devolvido.'
  ]},
  {title:'6. O que acontece com a assinatura durante a devolução',paragraphs:[
   'Antes de confirmar um reembolso que encerre o período contratado, o FIO deve informar claramente se os recursos pagos serão encerrados, preservando os dados que devam ser conservados.',
   'Se o reembolso representar desistência da assinatura, a interrupção das próximas cobranças deverá ser solicitada e reconciliada com o provedor. Erros ou demoras não autorizam mostrar o cancelamento como concluído antes de confirmação.'
  ]},
  {title:'7. Pix e Pix Automático',paragraphs:[
   'Pagamentos Pix devem ter eventual devolução vinculada à operação original, por mecanismo suportado pelo participante e pelo provedor. Após o pedido, haverá confirmação de processamento e conclusão. Não prometemos que a devolução seja instantânea.',
   'No Pix Automático, quando essa modalidade estiver habilitada no FIO, pedir o cancelamento contratual deverá impedir novas cobranças e providenciar a revogação da autorização de recorrência segundo o fluxo do banco e do provedor. A revogação não estorna por si só pagamentos anteriores.',
   'A modalidade de Pix atualmente integrada ao FIO usa QR Code e deve ser distinguida de Pix Automático até que exista autorização bancária recorrente funcional.'
  ]},
  {title:'8. Cartão de crédito e compras parceladas',paragraphs:[
   'Uma compra anual parcelada é diferente de mensalidades recorrentes. Cancelar a renovação do plano não elimina automaticamente as parcelas de uma compra anual já aprovada.',
   'Quando houver reembolso aprovado, o estorno será solicitado pelo fluxo do adquirente/provedor. O lançamento de crédito ou compensação de parcelas aparece conforme as regras do emissor do cartão e os ciclos de fatura; o FIO deve comunicar o status real, sem garantir uma data fixa não confirmada.',
   'O estorno deve considerar o total efetivamente pago e as condições legais; taxas de serviços de pagamento não podem ser usadas para reduzir valores cuja restituição integral seja exigida por lei.'
  ]},
  {title:'9. Taxas e custos',paragraphs:[
   'Eventuais taxas de parcelamento e outros acréscimos de preço deverão ser apresentados antes de contratar, com o valor total e as parcelas. Não haverá taxa de solicitação de arrependimento quando esse direito for aplicável.',
   'Custos cobrados do FIO pelo provedor são matéria da relação comercial entre as empresas e não afastam direitos do cliente.'
  ]},
  {title:'10. Prazos e acompanhamento',paragraphs:[
   'O FIO deve confirmar o recebimento da solicitação prontamente. O processamento e o efetivo crédito dependem da modalidade, da instituição financeira e do provedor; a interface deve distinguir solicitado, em análise, processando e concluído.',
   'Quando houver prazo efetivamente informado pelo provedor para a operação específica, ele deve ser mostrado na tela ou no comprovante, indicando sua fonte. Se o prazo não estiver disponível, o FIO deverá informar essa limitação e oferecer acompanhamento.'
  ]},
  {title:'11. Falhas de cobrança e tolerância',paragraphs:[
   'Se uma renovação não for confirmada, o contrato poderá prever uma tolerância de acesso aos recursos pagos. A configuração pretendida para as novas modalidades é de até 48 horas após o vencimento, desde que tecnicamente implementada e informada no resumo do plano.',
   'Terminado o período aplicável, recursos pagos poderão ser suspensos, sem exclusão automática dos dados da barbearia. Cancelamento voluntário e atraso de renovação são situações diferentes.'
  ]},
  {title:'12. Comprovantes, privacidade e resolução de conflitos',paragraphs:[
   'O FIO deve manter registros proporcionais e seguros sobre versões dos termos aceitos, cobrança, data, estado do pedido, respostas do provedor e atendimento. O acesso fica restrito às pessoas autorizadas e aos prazos legais de conservação.',
   'Para solicitações e esclarecimentos, utilize '+EMAIL+'. O cliente também conserva todos os meios legais de defesa de seus direitos. Consulte os Termos de Uso e a Política de Privacidade.'
  ]}
 ]
};

export const PAYMENT_CONDITIONS:LegalDocument={
 title:'Condições de Pagamento e Renovação',updated:UPDATED,contactEmail:EMAIL,
 intro:[
  'Este documento explica como o FIO apresenta preços, realiza cobranças, confirma pagamentos, renova ou encerra planos e informa custos de parcelamento.',
  'Nem toda modalidade descrita está necessariamente habilitada. A existência deste documento não representa oferta de Pix Automático ou cartão: o meio disponível será aquele efetivamente mostrado e validado no checkout.'
 ],sections:[
  {title:'1. Resumo obrigatório antes de contratar',bullets:[
   'Nome e funcionalidades do plano, período contratado, preço-base e preço total.',
   'Periodicidade e data prevista de cobrança, quando houver recorrência.',
   'Modalidade selecionada, número de parcelas, valor unitário e acréscimos, quando houver cartão parcelado.',
   'Instruções de renovação, cancelamento, reembolso e eventuais limitações de acesso.',
   'Identificação do fornecedor do FIO e do prestador de serviços de pagamento quando aplicável.'
  ]},
  {title:'2. Formas de pagamento',paragraphs:[
   'A integração Pix por QR Code existente exige uma transação individual e não equivale a autorizar débitos recorrentes na conta.',
   'O Pix Automático exige solicitação de autorização e aceite específico no banco do pagador, nos limites e condições da recorrência. Só poderá ser oferecido no FIO após implementação e habilitação operacional.',
   'Cartão recorrente e cartão parcelado são operações diferentes; cada uma exige integração segura e condições expressas de pagamento. A aprovação do cartão depende do emissor.'
  ]},
  {title:'3. Planos mensais e anuais',paragraphs:[
   'O plano mensal dá direito ao período mensal contratado e poderá ter renovação automática quando o meio de pagamento e as autorizações necessárias estiverem habilitados.',
   'O plano anual dá direito ao período anual contratado. Se for oferecido parcelamento, o cliente deverá ver o número de parcelas e o preço total antes da compra. Pagar parcelas não significa que exista uma nova assinatura mensal.'
  ]},
  {title:'4. Cobrança autorizada e confirmação',paragraphs:[
   'O FIO não deve considerar uma cobrança concluída com base apenas em comprovante enviado, clique em Já paguei ou retorno visual do checkout. A liberação depende de estado confirmado pelo provedor em canal seguro.',
   'O cliente pode conferir a situação de sua assinatura no painel. Em caso de divergência, o FIO deverá conciliar os registros antes de gerar nova cobrança, para evitar duplicidade.'
  ]},
  {title:'5. Taxas, juros e custo do parcelamento',paragraphs:[
   'Antes da confirmação do cartão parcelado, o checkout deve exibir valor do plano, quantidade de parcelas, valor de cada parcela, eventuais acréscimos e valor total. O preço final não deve mudar sem apresentação e consentimento do cliente.',
   'Tarifas bancárias por atraso de fatura, quando aplicáveis, pertencem à relação do titular com o emissor do cartão e não são automaticamente receita do FIO.',
   'Não há uma taxa única de cartão presumida neste documento; a cobrança deve usar somente as condições reais e atuais confirmadas pelo provedor e exibidas antes do pagamento.'
  ]},
  {title:'6. Pagamento recusado ou não confirmado',paragraphs:[
   'A não aprovação de uma renovação pode suspender recursos pagos após a tolerância contratada. A política proposta para novas modalidades prevê até 48 horas de tolerância depois do vencimento; sua aplicação exige implantação no backend e comunicação adequada.',
   'O FIO poderá sugerir regularização sem divulgar ao cliente, de forma vexatória ou sem necessidade, o motivo bancário específico da falha.'
  ]},
  {title:'7. Renovação e cancelamento',paragraphs:[
   'A renovação automática depende da autorização contratual e de pagamento aplicável. O cliente deve encontrar um caminho claro para cancelar novas cobranças.',
   'Cancelar renovação futura não devolve automaticamente quantias pagas ou parcelas pendentes de compra anual. Para devolução de valores, consulte a Política de Cancelamento e Reembolso.'
  ]},
  {title:'8. Documentos, segurança e suporte',paragraphs:[
   'O cliente deverá poder consultar e conservar a versão dos termos e o resumo da contratação. A confirmação do recebimento de pedidos de cancelamento ou arrependimento deve ser disponibilizada pelo serviço.',
   'Nunca envie ao suporte senha bancária, CVV, token bancário ou foto completa do cartão. Dúvidas: '+EMAIL+'.'
  ]}
 ]
};

export const PIX_AUTOMATICO_GUIDE:LegalDocument={
 title:'Pix Automático — Entenda a Autorização',updated:UPDATED,contactEmail:EMAIL,
 intro:[
  'Pix Automático permite que uma cobrança recorrente autorizada pelo pagador seja debitada conforme as condições confirmadas no aplicativo do banco.',
  'IMPORTANTE: o Pix por QR Code atualmente integrado ao FIO não é Pix Automático. Este guia descreve a modalidade a ser oferecida somente depois que a integração bancária e a conta recebedora estiverem habilitadas.'
 ],sections:[
  {title:'1. O que será apresentado antes de autorizar',bullets:[
   'Plano, valor de cada pagamento, periodicidade, vencimentos previstos, duração e condições de renovação.',
   'Identificação do recebedor, condições de uso do serviço e instruções de cancelamento.',
   'Eventuais limites, regras de tentativa e informações adicionais exibidas pelo banco antes do aceite.'
  ]},
  {title:'2. A autorização é feita no banco',paragraphs:[
   'O cliente deverá confirmar a autorização no ambiente oficial do banco. Marcar a caixa dos Termos de Uso do FIO, isoladamente, não concede autorização de débito.',
   'A autorização só será apresentada como ativa depois da confirmação legítima do banco/provedor. Caso não seja autorizada, nenhuma recorrência deverá ser presumida.'
  ]},
  {title:'3. O que acontece em cada vencimento',paragraphs:[
   'Quando a autorização estiver ativa, o provedor e o banco poderão processar a cobrança recorrente dentro das condições aprovadas. O cliente não precisará criar um Pix manual a cada ciclo.',
   'Se a cobrança falhar, o FIO aguardará confirmação ou regularização dentro da tolerância comunicada, sem tratar uma tentativa de débito como pagamento realizado.'
  ]},
  {title:'4. Como interromper novas cobranças',paragraphs:[
   'O cliente poderá cancelar a assinatura pelo painel do FIO e gerenciar a autorização do Pix Automático no banco. A plataforma deverá solicitar o encerramento da recorrência ao provedor e verificar a confirmação antes de informar conclusão.',
   'O cancelamento da autorização cancela a permissão para novos débitos vinculados à recorrência. Cobranças já concluídas e solicitações de reembolso seguem regras próprias.'
  ]},
  {title:'5. Devolução, direitos e dados',paragraphs:[
   'Para reembolso, o cliente poderá consultar o status da cobrança e exercer os direitos aplicáveis conforme a Política de Cancelamento e Reembolso. Não garantimos devolução instantânea até que o prestador confirme o estorno.',
   'O FIO não pede senha do banco ou dados de acesso. Informações da autorização e das transações são tratadas conforme a Política de Privacidade e a atuação das instituições de pagamento.'
  ]}
 ]
};

export const CARD_GUIDE:LegalDocument={
 title:'Cartão de Crédito — Recorrência e Parcelamento',updated:UPDATED,contactEmail:EMAIL,
 intro:[
  'Uma assinatura mensal no cartão e uma compra anual parcelada são contratos financeiros diferentes. Este guia explica ambos para evitar confusões na contratação e no cancelamento.',
  'IMPORTANTE: a disponibilidade de cartão na SyncPay dependerá da habilitação da conta e da validação da API/checkout. Este guia não torna o método disponível por si só.'
 ],sections:[
  {title:'1. Cartão para mensalidades recorrentes',paragraphs:[
   'Quando habilitada e autorizada, a recorrência mensal cobra o valor contratado em cada período, enquanto a assinatura permanecer ativa. O cliente deverá ver valor, data prevista, cancelamento e condições de falha antes de autorizar.',
   'A reprovação de uma renovação não significa, por si, que o plano anual parcelado foi cancelado.'
  ]},
  {title:'2. Plano anual em até 12 parcelas, quando disponível',paragraphs:[
   'No parcelamento de uma compra anual, o cartão autoriza uma operação correspondente à compra do ano, sujeita ao limite e às regras do emissor. As parcelas são lançadas em faturas segundo as condições da compra.',
   'O checkout deverá exibir a quantidade de parcelas efetivamente permitida (se 12 estiver habilitado, até 12), valor por parcela, custos adicionais e valor total. Não são garantidas condições de 12 vezes para todo cartão.'
  ]},
  {title:'3. Como funcionam os encargos',paragraphs:[
   'O custo do parcelamento pode ser suportado pelo comprador ou pelo vendedor, conforme o contrato do provedor e a modalidade ofertada. O FIO deverá informar a configuração realmente utilizada e o total antes de solicitar pagamento.',
   'Encargos por atraso da fatura, se houver, são administrados pelo banco emissor conforme a relação com o titular do cartão.'
  ]},
  {title:'4. Acesso e final do plano anual',paragraphs:[
   'Depois da aprovação de uma compra anual válida, o FIO libera o período anual contratado. O pagamento das parcelas à emissora não representa 12 compras ou mensalidades separadas.',
   'Ao término do período anual, a renovação deve observar as condições autorizadas. Se depender de nova compra, não deverá ocorrer cobrança sem nova confirmação.'
  ]},
  {title:'5. Cancelamento, reembolso e estorno',paragraphs:[
   'Cancelar a renovação futura não faz desaparecer parcelas de compra anual já aprovada. O estorno da compra, quando devido, deverá ser encaminhado pelo fluxo real do prestador de pagamentos.',
   'Créditos e ajustes de parcelas podem aparecer em uma ou mais faturas conforme o emissor. O FIO deve informar o estágio real do processo e não garantir prazo específico sem confirmação.',
   'O direito de arrependimento e outros direitos obrigatórios permanecem preservados. Consulte a Política de Cancelamento e Reembolso.'
  ]},
  {title:'6. Proteção dos dados do cartão',paragraphs:[
   'O processamento deve ocorrer em ambiente ou componentes seguros do prestador de pagamentos. O FIO não deve solicitar número completo do cartão, CVV ou dados de segurança por e-mail, chat ou suporte.',
   'Registros de cobrança podem ser mantidos para conciliação e obrigações legais, segundo a Política de Privacidade.'
  ]}
 ]
};

export const CUSTOMER_RIGHTS:LegalDocument={
 title:'Seus Direitos ao Contratar o FIO',updated:UPDATED,contactEmail:EMAIL,
 intro:[
  'Aqui você encontra, em linguagem simples, as principais informações para tomar decisões sobre sua assinatura e entender como contestar cobranças e exercer seus direitos.',
  'Esta página é informativa. Ela não substitui os Termos de Uso, a Política de Privacidade, o contrato específico nem os direitos assegurados pela legislação brasileira.'
 ],sections:[
  {title:'1. Saber exatamente o que está comprando',paragraphs:[
   'Antes de pagar, confira o plano escolhido, os recursos, o período, o preço total, a frequência dos pagamentos e qualquer taxa. Se for compra parcelada, o total e as parcelas deverão aparecer com clareza.'
  ]},
  {title:'2. Consultar e conservar as condições',paragraphs:[
   'Os documentos públicos ficam acessíveis pelo checkout e pelas páginas legais do FIO. A contratação deve oferecer resumo e confirmação. Caso encontre informação contraditória, não confirme a compra e procure o suporte.'
  ]},
  {title:'3. Cancelar futuras cobranças',paragraphs:[
   'Você poderá solicitar cancelamento da renovação na área da assinatura. O FIO deve acompanhar o resultado junto ao provedor. No Pix Automático, a autorização também pode ser gerenciada pelo seu banco.'
  ]},
  {title:'4. Pedir devolução de valores',paragraphs:[
   'A tela de reembolso verifica automaticamente a elegibilidade inicial a partir dos registros do sistema. Se o prazo inicial de sete dias houver terminado, isso não elimina direitos por cobranças indevidas ou outras causas legais.',
   'Uma solicitação não representa estorno concluído. A conclusão e a forma de crédito dependem da modalidade e devem ser acompanhadas pelo FIO.'
  ]},
  {title:'5. Entender o fim do período pago',paragraphs:[
   'Quando a renovação não for confirmada, recursos pagos poderão ser suspensos conforme a tolerância informada no plano. Os dados não serão automaticamente apagados por causa de uma cobrança vencida.'
  ]},
  {title:'6. Privacidade e atendimento',paragraphs:[
   'Você pode consultar como seus dados são tratados e pedir esclarecimentos ou exercer os direitos previstos na LGPD por meio da Política de Privacidade.',
   'Para dúvidas, cancelamentos, cobranças ou direitos de privacidade, utilize o suporte do FIO ou '+EMAIL+'.'
  ]}
 ]
};
