/** Exibe somente a situação confirmada pela SyncPay. Nunca infere estorno por HTTP 200. */
export type RefundStatusDisplay={label:string;finished:boolean;success:boolean};
export function refundStatusDisplay(status:string):RefundStatusDisplay{
 const value=status.trim().toLowerCase();
 if(['completed','refunded','succeeded','success'].includes(value))return {label:'Reembolso concluído pela SyncPay',finished:true,success:true};
 if(['rejected','denied','failed','cancelled','canceled'].includes(value))return {label:'Reembolso não concluído. Procure o suporte.',finished:true,success:false};
 if(['requested','pending','created','queued'].includes(value))return {label:'Reembolso solicitado. Aguardando análise ou processamento.',finished:false,success:false};
 if(['approved','processing','in_progress'].includes(value))return {label:'Reembolso em processamento pela SyncPay.',finished:false,success:false};
 return {label:'Acompanhe a atualização da solicitação junto ao suporte FIO.',finished:false,success:false};
}
