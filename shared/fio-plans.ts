import type { Plan } from './domain.js';

export type BillingCycle = 'weekly'|'monthly'|'annual';
export interface FioPlanDefinition {
 code: Plan|'PLUS';
 name: string;
 eyebrow: string;
 description: string;
 recommended?: boolean;
 proposal?: boolean;
 trialDays?: number;
 prices: Record<BillingCycle, number|null>;
 highlights: string[];
}

export const FIO_PLAN_CATALOG: FioPlanDefinition[] = [
 {
  code:'FREE',name:'FIO FREE',eyebrow:'PARA COMEÇAR',description:'Agenda sem mensalidade.',
  prices:{weekly:0,monthly:0,annual:0},
  highlights:['Até 100 clientes','Responsável + 1 profissional','Até 8 serviços','Agenda e página pública']
 },
 {
  code:'PRO',name:'FIO PRO',eyebrow:'RECOMENDADO',description:'Mais recursos para o dia a dia.',recommended:true,trialDays:14,
  prices:{weekly:3990,monthly:11990,annual:124990},
  highlights:['Até 1.500 clientes','Até 5 profissionais + responsável','Até 40 serviços','Até 3 pacotes de cortes','Feed, comunicação e FIO IA']
 },
 {
  code:'PLUS',name:'FIO PLUS',eyebrow:'EM PREPARAÇÃO',description:'Opção intermediária em preparação.',proposal:true,
  prices:{weekly:4990,monthly:14990,annual:159990},
  highlights:['Proposta: até 3.000 clientes','Até 10 profissionais + responsável','Até 80 serviços','Até 8 pacotes de cortes','Feed, comunicação e FIO IA']
 },
 {
  code:'PREMIUM',name:'FIO PREMIUM',eyebrow:'MAIS CAPACIDADE',description:'Mais capacidade para crescer.',
  prices:{weekly:5990,monthly:17990,annual:189990},
  highlights:['Clientes e equipe sem cota','Até 15 pacotes de cortes','Serviços sem cota numérica','Feed e comunicação ampliados','Mais consultas à FIO IA','Suporte pelo formulário do FIO']
 }
];

export const BILLING_LABELS:Record<BillingCycle,string>={weekly:'Semanal',monthly:'Mensal',annual:'Anual'};
export const billingSuffix=(cycle:BillingCycle)=>cycle==='weekly'?'/ semana':cycle==='monthly'?'/ mês':'/ ano';
export const findFioPlan=(plan:Plan)=>FIO_PLAN_CATALOG.find(item=>item.code===plan)??FIO_PLAN_CATALOG[0];
