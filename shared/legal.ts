export type LegalSection={
 title:string;
 paragraphs?:string[];
 bullets?:string[];
};

export type LegalDocument={
 title:string;
 updated:string;
 intro:string[];
 sections:LegalSection[];
 contactEmail:string;
};

export const PRIVACY_POLICY:LegalDocument={
 title:'Política de Privacidade do FIO',
 updated:'08 de outubro de 2026',
 contactEmail:'usefiooficial@gmail.com',
 intro:[
  'Esta Política explica de forma transparente como o FIO trata dados pessoais durante o uso da plataforma de gestão, agenda, página pública, aplicativos, suporte, cobrança e recursos relacionados.',
  'O FIO procura limitar o tratamento ao necessário para cada finalidade e não vende dados pessoais.'
 ],
 sections:[
  {
   title:'1. Identificação e papéis de tratamento',
   paragraphs:[
    'FIO é a marca utilizada para disponibilização da plataforma. Nas operações em que o próprio FIO decide a finalidade e os meios essenciais do tratamento, o responsável pela operação é Pedro Kauã. O canal de privacidade é usefiooficial@gmail.com.',
    'Para dados de conta, autenticação, segurança da plataforma, contratação dos planos FIO, suporte e administração do próprio serviço, o FIO atua como controlador.',
    'Quando uma barbearia cadastra ou utiliza dados de seus próprios clientes, profissionais e atendimentos para administrar a própria operação, a barbearia normalmente define a finalidade comercial desse tratamento e o FIO presta o serviço tecnológico como operador, sem utilizar esses dados para criar uma finalidade comercial independente.'
   ]
  },
  {
   title:'2. Dados tratados, finalidade e base legal',
   bullets:[
    'Conta e autenticação — e-mail, identificador da conta, nome, telefone informado, papel de acesso, informações de sessão e dados necessários à recuperação da conta. Finalidade: criar, autenticar, recuperar e proteger o acesso. Bases aplicáveis: execução de contrato ou procedimentos relacionados ao contrato (art. 7º, V, da LGPD) e, para segurança e prevenção de abuso, legítimo interesse quando cabível (art. 7º, IX).',
    'Barbearia e equipe — nome do estabelecimento, identidade visual, contatos, endereço informado, profissionais, serviços, horários e configurações. Finalidade: entregar as funções de gestão contratadas. Base aplicável: execução do serviço e do contrato.',
    'Clientes e agenda — nome, telefone, vínculo de conta quando existente, agendamentos, histórico de atendimento, avaliações, pacotes e informações necessárias à agenda. Finalidade: permitir à barbearia organizar e prestar seus atendimentos. Nessa operação, a base legal do tratamento perante o cliente deve ser definida pela barbearia controladora; o FIO trata os dados para executar as funções solicitadas.',
    'Cobrança do FIO — plano, ciclo, valor, identificadores da assinatura no provedor, situação da cobrança e datas relacionadas. Finalidade: criar, confirmar, conciliar, cancelar e dar suporte à assinatura. Base aplicável: execução do contrato e, quando necessário, cumprimento de obrigação legal ou exercício regular de direitos.',
    'CPF ou CNPJ informado no checkout — utilizado para identificar o pagador perante a SyncPay. O número é enviado ao provedor para processamento da contratação e não é armazenado pelo FIO em seu banco de aplicação.',
    'Suporte, auditoria e segurança — mensagens enviadas ao suporte, identificadores técnicos de requisição e eventos de auditoria necessários. Finalidade: responder solicitações, investigar falhas, prevenir abuso, manter a segurança e exercer direitos. Bases aplicáveis: execução do serviço e legítimo interesse, conforme a finalidade concreta.',
    'Assistente de IA — mensagens enviadas ao assistente, histórico necessário à conversa e uma projeção limitada dos dados autorizados para o papel do usuário. Finalidade: responder ao pedido feito dentro do recurso de IA. Base aplicável: execução do serviço solicitado. O FIO não envia ao provedor chaves privadas ou credenciais da plataforma como parte normal dessa funcionalidade.',
    'Notificações push — endpoint e chaves técnicas fornecidas pelo navegador/dispositivo, além das preferências escolhidas. Finalidade: entregar notificações solicitadas. A permissão pode ser revogada no dispositivo ou no FIO.'
   ]
  },
  {
   title:'3. Fornecedores e compartilhamento',
   bullets:[
    'Supabase — autenticação, banco de dados, armazenamento e recursos de infraestrutura relacionados ao backend.',
    'Vercel — hospedagem e execução da aplicação web e do backend publicado.',
    'SyncPay — processamento das assinaturas e cobranças Pix dos planos pagos do FIO e, quando habilitadas, outras modalidades de pagamento expressamente apresentadas na contratação.',
    'Cloudflare Turnstile — proteção contra automação abusiva e bots em fluxos de autenticação.',
    'Google — quando o usuário escolhe Entrar com Google; também poderá ser utilizado para envio dos e-mails transacionais caso o SMTP Gmail seja habilitado.',
    'Groq — processamento das solicitações enviadas ao recurso de inteligência artificial, dentro do contexto limitado preparado pelo servidor.',
    'Serviço de push do navegador ou sistema operacional — necessário para entregar notificações quando o usuário habilita esse recurso.'
   ],
   paragraphs:[
    'Esses fornecedores recebem somente os dados necessários às respectivas funções. Alguns também tratam informações conforme seus próprios termos e políticas quando atuam como controladores independentes de determinadas operações.'
   ]
  },
  {
   title:'4. Retenção, cancelamento e exclusão',
   bullets:[
    'Dados de conta, perfil, barbearia e operação permanecem enquanto a conta ou o espaço estiver ativo e enquanto forem necessários para a prestação do serviço.',
    'Cancelar um plano pago não apaga automaticamente a conta nem os registros operacionais da barbearia.',
    'Mensagens e histórico do Assistente permanecem associados à conta enquanto o histórico correspondente for mantido no serviço, podendo ser incluídos em um pedido verificado de exclusão.',
    'Registros de cobrança mantidos pelo FIO, como identificadores do provedor, estado da assinatura e datas, são preservados enquanto necessários à execução do contrato, conciliação, prevenção de fraude, cumprimento de obrigações ou exercício de direitos. O CPF/CNPJ digitado no checkout não é salvo no banco da aplicação.',
    'Dados de suporte e auditoria são mantidos pelo período necessário para tratar a solicitação, investigar incidentes, prevenir abuso e resguardar direitos.',
    'Quando o tratamento terminar ou um pedido válido de exclusão for concluído, os dados serão eliminados ou anonimizados dentro dos limites técnicos, salvo quando sua conservação for permitida ou exigida pela legislação aplicável.'
   ],
   paragraphs:[
    'A exclusão permanente não é tratada como um simples botão sem verificação. O titular pode solicitar o procedimento por usefiooficial@gmail.com. O FIO poderá confirmar a identidade e o vínculo com a conta antes de executar uma exclusão irreversível.'
   ]
  },
  {
   title:'5. Transferências internacionais',
   paragraphs:[
    'Alguns fornecedores de infraestrutura, autenticação, segurança, pagamento ou inteligência artificial podem processar dados em outros países. Quando houver transferência internacional, o FIO utiliza fornecedores e mecanismos compatíveis com as hipóteses admitidas pela legislação de proteção de dados aplicável.'
   ]
  },
  {
   title:'6. Direitos do titular',
   bullets:[
    'Confirmação da existência de tratamento e acesso aos dados;',
    'Correção de dados incompletos, inexatos ou desatualizados;',
    'Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;',
    'Portabilidade, quando aplicável e conforme regulamentação;',
    'Informações sobre compartilhamentos;',
    'Revogação de consentimento quando o tratamento depender de consentimento;',
    'Exclusão dos dados tratados com consentimento, observadas as hipóteses legais de conservação.'
   ],
   paragraphs:[
    'Para exercer esses direitos, escreva para usefiooficial@gmail.com. Quando o FIO estiver atuando apenas como operador de dados administrados pela barbearia, a solicitação poderá precisar ser encaminhada ou coordenada com a própria barbearia controladora.'
   ]
  },
  {
   title:'7. Segurança',
   paragraphs:[
    'O FIO utiliza separação de acesso por papel e barbearia, políticas de acesso no banco, validação de entrada, segredos mantidos no servidor, limitação de requisições, CAPTCHA em autenticação, cabeçalhos de segurança e registros de auditoria. Nenhum sistema conectado à internet pode prometer risco zero, mas o FIO adota medidas destinadas a reduzir acesso indevido, vazamento, alteração e abuso.'
   ]
  },
  {
   title:'8. Armazenamento no navegador',
   paragraphs:[
    'O FIO utiliza armazenamento local ou de sessão para manter autenticação, preferência de permanência da sessão, idioma, tema e contexto necessário ao aplicativo. Esses dados podem permanecer no navegador até expirarem, serem substituídos, ocorrer logout ou o usuário limpar os dados do navegador.'
   ]
  },
  {
   title:'9. Alterações e contato',
   paragraphs:[
    'Esta Política poderá ser atualizada quando o serviço, os fornecedores ou as regras aplicáveis mudarem de forma relevante. A data da versão vigente aparece no início do documento.',
    'Canal de privacidade e proteção de dados: usefiooficial@gmail.com.'
   ]
  }
 ]
};

export const TERMS_OF_USE:LegalDocument={
 title:'Termos de Uso do FIO',
 updated:'08 de outubro de 2026',
 contactEmail:'usefiooficial@gmail.com',
 intro:[
  'Estes Termos regulam o acesso e o uso do FIO. Ao criar uma conta, administrar uma barbearia ou contratar um plano pago, o usuário concorda com as regras aplicáveis ao recurso utilizado.',
  'A identificação do responsável pela operação e as regras de tratamento de dados estão detalhadas na Política de Privacidade do FIO.'
 ],
 sections:[
  {
   title:'1. Conta e acesso',
   bullets:[
    'Cada pessoa deve utilizar sua própria conta e proteger senha, e-mail, códigos de confirmação e dispositivos autenticados.',
    'O responsável pela barbearia administra os acessos da equipe e deve conceder somente as permissões necessárias.',
    'É proibido tentar acessar conta, barbearia, painel, dado ou função sem autorização.'
   ]
  },
  {
   title:'2. Responsabilidade da barbearia',
   paragraphs:[
    'A barbearia é responsável pelas informações comerciais que publica, pelos serviços, valores e horários que oferece e pela legitimidade do tratamento dos dados de seus próprios clientes e profissionais.',
    'O FIO fornece a ferramenta tecnológica e aplica controles de acesso, mas não substitui as obrigações comerciais, fiscais, trabalhistas ou de proteção de dados da barbearia.'
   ]
  },
  {
   title:'3. Planos, teste e recursos',
   bullets:[
    'Os recursos e limites dos planos disponíveis, incluindo FREE, SOLO, SOLO PREMIUM, PRO e PREMIUM quando aplicáveis à modalidade da barbearia, são os exibidos no produto no momento da contratação.',
    'Quando disponível para a barbearia elegível, o teste do PRO dura 14 dias e pode ser usado uma única vez por barbearia.',
    'Recursos pagos podem ficar indisponíveis quando a assinatura expira, é cancelada, suspensa ou não possui confirmação de pagamento válida.',
    'Dados já existentes não são tratados como autorização para ultrapassar limites de criação definidos pelo plano.'
   ]
  },
  {
   title:'4. Cobrança, Pix, cancelamento e reembolso',
   bullets:[
    'As novas contratações pagas são oferecidas nos ciclos mensal e anual mostrados no checkout.',
    'A cobrança Pix atualmente integrada ao FIO é processada pela SyncPay. Novas modalidades, como Pix Automático e cartão, só poderão ser oferecidas após integração e liberação operacionais. O FIO somente libera planos pagos após confirmação válida da cobrança pelo provedor.',
    'O usuário deve conferir valor e recebedor no aplicativo do banco antes de pagar qualquer Pix.',
    'O cancelamento de renovações futuras deverá ser solicitado ao provedor e acompanhado até a confirmação. No Pix Automático, quando habilitado, também deve ser encerrada a autorização de recorrência; cancelar não significa apagar dados ou reembolsar automaticamente valores anteriores.',
    'Nas contratações online em que o direito de arrependimento for aplicável, o fluxo do FIO permite solicitar reembolso integral da primeira contratação dentro da janela de 7 dias. Após esse período, o cancelamento não gera automaticamente devolução do período já pago, sem prejuízo de direitos previstos em lei.'
   ]
  },
  {
   title:'5. Uso permitido',
   bullets:[
    'Não usar o FIO para fraude, abuso, spam, invasão, engenharia reversa destinada a contornar controles, acesso indevido ou atividade ilícita.',
    'Não tentar manipular papéis, preços, pagamentos, limites, webhooks, tokens, identificadores ou dados de outra barbearia.',
    'Não enviar ao suporte ou ao Assistente senhas, códigos de confirmação, chaves privadas ou dados bancários desnecessários.'
   ]
  },
  {
   title:'6. Disponibilidade e alterações',
   paragraphs:[
    'O FIO busca manter o serviço disponível e íntegro, mas pode realizar manutenção, correções de segurança e mudanças necessárias à operação. Não é prometida disponibilidade ininterrupta.',
    'Mudanças materiais nos planos, valores ou termos aplicáveis a uma nova contratação devem ser apresentadas antes da respectiva contratação ou renovação quando exigido.'
   ]
  },
  {
   title:'7. Propriedade intelectual',
   paragraphs:[
    'A contratação concede direito de uso da plataforma conforme o plano, sem transferir propriedade sobre o software, identidade FIO, código, componentes ou demais ativos do serviço. Conteúdo e marcas pertencentes à barbearia continuam sob responsabilidade de seus respectivos titulares.'
   ]
  },
  {
   title:'8. Encerramento, dados e suporte',
   paragraphs:[
    'Cancelar a assinatura, sair da conta e solicitar exclusão de dados são operações diferentes. Pedidos de privacidade e exclusão devem seguir a Política de Privacidade.',
    'Suporte e assuntos de privacidade podem ser encaminhados para usefiooficial@gmail.com.'
   ]
  },
  {
   title:'9. Lei aplicável',
   paragraphs:[
    'Estes Termos são interpretados conforme a legislação brasileira. Direitos obrigatórios do consumidor e demais normas aplicáveis permanecem preservados.'
   ]
  }
 ]
};
