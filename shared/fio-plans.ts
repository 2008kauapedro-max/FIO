import type { Plan } from './domain.js';

export type BillingCycle = 'weekly'|'monthly'|'annual';
export const SALE_BILLING_CYCLES = ['monthly','annual'] as const satisfies readonly BillingCycle[];

export interface FioPlanGroup {
 title:string;
 items:string[];
}

export interface FioPlanDefinition {
 code: Plan;
 name: string;
 eyebrow: string;
 description: string;
 recommended?: boolean;
 proposal?: boolean;
 trialDays?: number;
 prices: Record<BillingCycle, number|null>;
 highlights: string[];
 groups: FioPlanGroup[];
}

export const FIO_PLAN_CATALOG: FioPlanDefinition[] = [
 {
  code:'FREE',name:'FIO FREE',eyebrow:'PARA COMEÃ‡AR',description:'O essencial para organizar seus primeiros agendamentos.',
  prices:{weekly:0,monthly:0,annual:0},
  highlights:['AtÃ© 85 clientes','ResponsÃ¡vel + 1 profissional'],
  groups:[
   {title:'CAPACIDADE',items:['AtÃ© 85 clientes','ResponsÃ¡vel + 1 profissional','AtÃ© 8 serviÃ§os']},
   {title:'AGENDA',items:['Agenda online','Agendamento dos clientes','Modo barbeiro solo']},
   {title:'EXPERIÃŠNCIA',items:['PÃ¡gina bÃ¡sica de agendamento','Logo da barbearia','App/PWA com identidade FIO']}
  ]
 },
 {
  code:'PRO',name:'FIO PRO',eyebrow:'RECOMENDADO',description:'Para barbearias que querem crescer com presenÃ§a digital e comunicaÃ§Ã£o.',recommended:true,trialDays:14,
  prices:{weekly:null,monthly:14990,annual:149900},
  highlights:['AtÃ© 450 clientes','AtÃ© 5 profissionais + responsÃ¡vel'],
  groups:[
   {title:'CAPACIDADE',items:['AtÃ© 450 clientes','AtÃ© 5 profissionais + responsÃ¡vel','AtÃ© 40 serviÃ§os','AtÃ© 3 pacotes de cortes']},
   {title:'PRESENÃ‡A DIGITAL',items:['Mini site personalizado','App/PWA com identidade da barbearia','Logo, capa, fundo e cores']},
   {title:'COMUNICAÃ‡ÃƒO',items:['Feed da barbearia','Campanhas e comunicaÃ§Ã£o','Pacotes/planos de cortes']},
   {title:'INTELIGÃŠNCIA',items:['Assistente FIO','100 consultas de IA por usuÃ¡rio/dia']}
  ]
 },
 {
  code:'PREMIUM',name:'FIO PREMIUM',eyebrow:'PARA OPERAÃ‡Ã•ES MAIORES',description:'Mais capacidade para equipes e carteiras de clientes maiores.',
  prices:{weekly:null,monthly:24990,annual:249900},
  highlights:['AtÃ© 2.000 clientes','AtÃ© 10 profissionais + responsÃ¡vel'],
  groups:[
   {title:'CAPACIDADE',items:['AtÃ© 2.000 clientes','AtÃ© 10 profissionais + responsÃ¡vel','AtÃ© 80 serviÃ§os','AtÃ© 15 pacotes de cortes']},
   {title:'PRESENÃ‡A DIGITAL',items:['Mini site personalizado','App/PWA com identidade da barbearia','Logo, capa, fundo e cores']},
   {title:'COMUNICAÃ‡ÃƒO',items:['Feed da barbearia','Campanhas e comunicaÃ§Ã£o','Pacotes/planos de cortes']},
   {title:'INTELIGÃŠNCIA',items:['Assistente FIO','500 consultas de IA por usuÃ¡rio/dia']}
  ]
 }
];

export const BILLING_LABELS:Record<BillingCycle,string>={weekly:'Semanal',monthly:'Mensal',annual:'Anual'};
export const billingSuffix=(cycle:BillingCycle)=>cycle==='weekly'?'/ semana':cycle==='monthly'?'/ mÃªs':'/ ano';
export const findFioPlan=(plan:Plan)=>FIO_PLAN_CATALOG.find(item=>item.code===plan)??FIO_PLAN_CATALOG[0];