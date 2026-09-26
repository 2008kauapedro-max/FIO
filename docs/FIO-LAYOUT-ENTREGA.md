# FIO — entrega da interface mobile

Base: `FIO-LAYOUT-20260925-225800.zip`. Os 176 arquivos do arquivo enviado foram comparados por SHA-256 com o projeto local antes das edições: todos correspondiam. O README contém descrições antigas de financeiro; o pedido atual e o código do ZIP prevaleceram. Não houve publicação.

## Aplicação

1. Faça uma cópia de segurança do projeto atual.
2. Extraia o ZIP desta entrega na raiz do projeto baseado no ZIP original, mantendo as pastas `src`, `tests` e `docs`. Substitua os arquivos com o mesmo nome.
3. Execute `npm run typecheck`, `npm test` e `npm run build`.
4. Confira uma prévia na sua hospedagem, com as variáveis já configuradas. Depois de aprovar, publique pelo fluxo habitual do projeto. Esta entrega não executa deploy.

Não há arquivos antigos a excluir, migrations, novas dependências ou mudanças necessárias nas variáveis de ambiente. O ZIP não contém `.env`, credenciais, `node_modules`, build, instalador ou scripts de patch. `tests` e `docs` são evidências e suporte; a aplicação continua entrando por `src/main.tsx`.

## Mudanças

| Área | Resultado |
| --- | --- |
| Navegação | Início, Agenda, Assistente e Mais no celular. Sem direito ao assistente, o terceiro item é Serviços. Configurações tem item próprio com ícone e nome. Menu respeita os perfis e recursos do plano; foco fica dentro dele, Escape fecha e o conteúdo atrás fica inativo. |
| Configurações | Perfil, barbearia e plano para o dono, acessos e segurança. Atalhos para equipe, aparência e ajuda. Grupos quebram em linhas no celular; desktop mantém painel lateral. Voltar retorna ao início do perfil. |
| Agenda | Lista ordenada pelo horário, dia anterior/próximo, Hoje e filtro de profissional para o dono. Horário, nome, serviço, profissional e status em texto. Status continua visível em 320 px; detalhes concentram as ações. |
| Agendamento | Serviço antes do profissional, data e horários com alvos de toque de 44 px. Resumo de serviço, duração, profissional e data antes de confirmar. Estado sem horários disponível. Nenhum pagamento de serviço foi acrescentado. |
| Assistentes | Uma região central de rolagem; cabeçalho compacto; compositor na base. Layout usa flex e VisualViewport em vez de subtrair alturas divergentes. Nova conversa, histórico, processamento, indisponibilidade e tentativa novamente. Reenvio não duplica a mensagem do usuário; resposta não força rolagem se ele subiu para ler. APIs e permissões permanecem separadas do Copiloto administrativo. |
| Base visual | Estilos antigos do chat removidos e consolidados. Tipografia, campos e áreas de toque ajustados nas áreas revisadas. Fundo do espaço acompanha o tema; logos e temas preservados. |
| Feed | Lista de profissionais quebra em linhas; removida margem negativa que vazava 6 px em 320 px. |
| Acesso | CAPTCHA usa o tamanho compacto oficial em telas estreitas; removido CSS que forçava iframe de 300 px. Verificação e callbacks preservados. |
| Tutorial | Passo de configurações aponta ao item explícito. Regra de apresentação para contas novas preservada. |
| Plano FIO | Comparação lado a lado quando a largura comporta cartões legíveis; empilhamento no celular estreito. Preços, SyncPay e contratação desativada do Plus preservados. |

Não foram alterados servidor, banco, autenticação, permissões, integrações, webhooks, preços ou regras de disponibilidade/cancelamento. A correção funcional restrita é evitar duplicação visual no reenvio do assistente.

## Inventário e abrangência

Revisão de código e navegação: login/cadastro/recuperação/verificação, início por perfil, agenda/detalhes/agendamento, serviços/clientes/equipe, pacotes, Feed/comunicação, assistentes/histórico, planos, configurações/suporte, página pública, modais e tutorial. Telas sem problema observado foram preservadas. O administrador mantém suas rotas e componentes separados, incluindo seu Copiloto; não foi redesenhado.

## Evidências e testes

- TypeScript da interface e compilação TypeScript do servidor: passaram.
- Vitest: **13 arquivos, 192 testes passaram**, incluindo regras de negócio, segurança, planos e integrações com fixtures.
- Build Vite: passou. Avisos: pacote principal acima de 500 kB e comentários de otimização do Zod; não são falhas de compilação.
- Playwright com Microsoft Edge headless: **85 verificações passaram** na rodada completa. Resultados individuais em `layout-evidence/results.json`. Sem exceções `pageerror` nessa rodada.
- Matriz de agenda/configurações/chat: 320, 360, 390, 430, 768, 1366 e 1440 px, claro e escuro. Verificações de largura e compositor visível acima da navegação.
- Três perfis, navegação por Mais até Configurações; barbearia não aparece para funcionário/cliente.
- Nomes extensos, 30 atendimentos, lista vazia, detalhes, agendamento com resumo e confirmação fictícia.
- Chat vazio, erro, reenvio, histórico longo, nova conversa e preservação de posição de leitura durante resposta.
- Tela curta 390×480, paisagem 740×360 e texto a 150% em configurações/chat.
- Inventário das demais áreas em 320 px nos dois temas, grupos de configurações, sete alvos do tutorial sem sobreposição e página pública com resposta fictícia.
- Capturas reais do navegador em `layout-evidence/`: agenda, configurações e assistente a 390 e 1440 px nos dois temas; detalhes em 320 px, agendamento, erro no chat e página pública.
- Após inspeção visual, ajuste adicional dos horários e checkbox validado separadamente em `booking-results.json`.

Reproduzir: em um terminal, `node node_modules/vite/bin/vite.js --config tests/fixtures/experience-vite.config.ts`; em outro, `node tests/layout-browser.mjs`. Requer Microsoft Edge instalado. A configuração usa `envDir:false` e substitui a API por dados de teste. Nenhum pagamento, mensagem a cliente ou escrita em produção é necessário.

## Limitações reais

Os testes são em navegador desktop com diferentes viewports, não aparelhos reais nem um teclado virtual real. VisualViewport está implementado, mas não comprova comportamento de Safari/iOS, Android ou PWA. Não foram executados login Google, desafio CAPTCHA real, entrega de e-mail, upload real, IA real, cobrança real ou todas as combinações de plano/perfil/estado em cada largura. O painel administrativo foi inspecionado no código; não houve nova execução completa de seus fluxos. A revisão não é uma auditoria completa de acessibilidade ou de console de terceiros.

No aparelho: abra agenda, configurações e assistente nos dois temas; toque no campo, digite várias linhas, abra/feche teclado, gire o aparelho e alterne entre navegador e PWA. Confirme que Enviar fica acima do teclado, não existe vazio abaixo e o último conteúdo pode ser alcançado. Teste o CAPTCHA e o login Google com uma conta de teste. No chat, suba no histórico enquanto chega uma resposta e confira que sua leitura é mantida.

## Referências

- [Fresha — criar agendamentos](https://www.fresha.com/help-center/knowledge-base/calendar/260-create-appointments-1): documentação operacional com exemplos desktop/mobile, seleção de cliente/serviço e revisão antes de salvar. Aproveitado o resumo de confirmação e organização das escolhas. As imagens são identificadas pela central como screenshots de produto; uma delas falhou ao carregar e não houve inspeção visual completa de todas as imagens.
- [Square — visualização e filtros da agenda](https://squareup.com/help/us/en/article/8442-set-up-calendar-view-filters-for-appointments): guia operacional que inclui visualização em lista no aplicativo, filtros e sinais de status. Apoia a escolha de lista cronológica para o FIO mobile; essa é uma decisão de design, não prova de superioridade universal.
- [Square — configurações](https://squareup.com/help/us/en/article/5351-manage-your-square-appointments-account-settings) e [equipe](https://squareup.com/help/us/en/article/5350-create-staff-member-profiles-for-square-appointments): agrupamento por tarefa e permissões. Consulta documental, sem acesso autenticado aos produtos.
- [ChatGPT — uso do chat](https://help.openai.com/en/articles/12677804-what-is-chatgpt-faq): referência documental secundária de conversa e entrada. A referência visual principal do chat foi a captura do Copiloto FIO fornecida pelo usuário e seu código local, sem copiar identidade de terceiros.
- [Cloudflare — tamanhos do Turnstile](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/): formato compacto oficial, 150×140 px, para evitar corte em formulários estreitos.

Não foram utilizados mockups conceituais como evidência de funcionamento, nem imagens, marcas ou textos de terceiros na interface.
