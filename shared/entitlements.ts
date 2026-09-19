import type { Plan } from './domain.js';

export type FioFeature='assistant'|'feed'|'communication'|'client_plans';

export const FIO_FEATURES:Record<Plan,Record<FioFeature,boolean>>={
 FREE:{assistant:false,feed:false,communication:false,client_plans:false},
 PRO:{assistant:true,feed:true,communication:true,client_plans:true},
 PREMIUM:{assistant:true,feed:true,communication:true,client_plans:true}
};

export function planAllows(plan:Plan,feature:FioFeature){return Boolean(FIO_FEATURES[plan]?.[feature]);}
