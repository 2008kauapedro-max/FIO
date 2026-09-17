import type { Plan } from './domain.js';

export type BillingCycle = 'weekly'|'monthly'|'annual';

export interface FioPlanDefinition {
 code: Plan;
 name: string;
 eyebrow: string;
 description: string;
 recommended?: boolean;
 trialDays?: number;
 prices: Record<BillingCycle, number|null>;
 highlights: string[];
}

export const FIO_PLAN_CATALOG: FioPlanDefinition[] = [
 {
  code:'FREE',name:'FIO FREE',eyebrow:'COMECE SEM CUSTO',description:'O essencial para organizar a operação e conhecer o FIO.',
  prices:{weekly:null,monthly:0,annual:null},
  highlights:['Até 100 clientes','Responsável + 1 profissional','Até 8 serviços','Agenda e página pública','Financeiro básico dos últimos 30 dias']
 },
 {
  code:'PRO',name:'FIO PRO',eyebrow:'PARA CRESCER',description:'Gestão completa para a barbearia vender, acompanhar e atender melhor.',recommended:true,trialDays:14,
  prices:{weekly:3990,monthly:11990,annual:124990},
  highlights:['Até 1.500 clientes','Responsável + até 5 profissionais','Até 40 serviços','Até 3 planos para clientes','Feed, comunicação e FIO IA','Relatórios completos e impressão','Pagamentos integrados quando a SyncPay for conectada']
 },
 {
  code:'PREMIUM',name:'FIO PREMIUM',eyebrow:'MÁXIMO CONTROLE',description:'Mais liberdade, escala e análise para operações que já estão crescendo.',
  prices:{weekly:5990,monthly:17990,annual:189990},
  highlights:['Clientes, equipe e serviços sem limite comercial pequeno','Até 15 planos para clientes','Feed e comunicação ampliados','FIO IA com limite ampliado','Relatórios e análises avançadas','Gestão de indicações e desempenho da equipe','Recursos premium de operação e suporte']
 }
];

export const BILLING_LABELS:Record<BillingCycle,string>={weekly:'Semanal',monthly:'Mensal',annual:'Anual'};
export const billingSuffix=(cycle:BillingCycle)=>cycle==='weekly'?'/ semana':cycle==='monthly'?'/ mês':'/ ano';
export const findFioPlan=(plan:Plan)=>FIO_PLAN_CATALOG.find(item=>item.code===plan)??FIO_PLAN_CATALOG[0];
