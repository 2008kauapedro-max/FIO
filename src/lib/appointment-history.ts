import type { Appointment } from '../../shared/domain';

export type HistoryAppointment=Appointment&{customer_name:string;service_name:string};

const statusNames:Record<Appointment['status'],string>={
 scheduled:'Agendado',confirmed:'Confirmado',in_service:'Em atendimento',
 completed:'Finalizado',cancelled:'Cancelado',no_show:'Não compareceu'
};

function safeCell(value:string|number){
 // CSV de Excel: strings iniciadas com fórmula jamais devem ser executadas.
 let content=String(value).replace(/\r|\n/g,' ');
 if(/^[\s\t]*[=+@-]/.test(content))content=`'${content}`;
 return `"${content.replace(/"/g,'""')}"`;
}

export function historyToCsv(items:HistoryAppointment[],timeZone:string){
 const heading=['Data','Hora','Cliente','Serviço','Situação','Valor (R$)'];
 const rows=items.map(item=>{
  const when=new Date(item.starts_at);
  const date=new Intl.DateTimeFormat('pt-BR',{timeZone,day:'2-digit',month:'2-digit',year:'numeric'}).format(when);
  const time=new Intl.DateTimeFormat('pt-BR',{timeZone,hour:'2-digit',minute:'2-digit'}).format(when);
  return [date,time,item.customer_name,item.service_name,statusNames[item.status],(item.price_cents/100).toFixed(2).replace('.',',')];
 });
 return [heading,...rows].map(row=>row.map(safeCell).join(';')).join('\r\n')+'\r\n';
}
