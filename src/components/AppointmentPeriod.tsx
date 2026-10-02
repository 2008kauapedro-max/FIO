import {useEffect,useState} from 'react';
import type {Appointment} from '../../shared/domain';
import type {WorkspaceProps} from '../pages/Workspace';
import {dayKey} from '../pages/Workspace';
import {api} from '../lib/api';
import {Field} from './ui';
type Period={total:number;completed:number;cancelled:number;noShow:number;items:Appointment[]};
const statusLabel={scheduled:'Agendado',confirmed:'Confirmado',in_service:'Em atendimento',completed:'Concluído',cancelled:'Cancelado',no_show:'Falta'} as const;
export function AppointmentPeriod(p:WorkspaceProps&{professional:string;onSelect:(a:Appointment)=>void}){
 const zone=p.data.shop.timezone;
 const [month,setMonth]=useState(dayKey(new Date().toISOString(),zone).slice(0,7)),[value,setValue]=useState<Period|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;setError('');setValue(null);if(!/^\d{4}-\d{2}$/.test(month))return;
  const from=month+'-01',to=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
  const items=p.data.appointments.filter(a=>dayKey(a.starts_at,zone).startsWith(month)&&(!p.professional||a.barber_id===p.professional));
  const request=p.demo?Promise.resolve({total:items.length,completed:items.filter(a=>a.status==='completed').length,cancelled:items.filter(a=>a.status==='cancelled').length,noShow:items.filter(a=>a.status==='no_show').length,items}):api<Period>(`/appointments/period?from=${from}&to=${to}${p.professional?`&barberId=${p.professional}`:''}`,p.data.shop.id);
  void request.then(v=>{if(alive)setValue(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};
 },[month,p.professional,p.demo,p.data.appointments,p.data.shop.id,zone]);
 return <section className="period-summary"><div className="section-title"><h2>Movimentação do mês</h2><Field label="Período"><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></Field></div>{error?<p role="alert">{error}</p>:!value?<p role="status">Consultando período…</p>:<><dl className="period-counts">{[['Agendamentos',value.total],['Concluídos',value.completed],['Cancelamentos',value.cancelled],['Faltas',value.noShow]].map(([label,count])=><div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl><details><summary>Ver agendamentos do mês</summary>{value.total>value.items.length&&<p>Exibindo {value.items.length} de {value.total}. Os totais incluem todo o período.</p>}<div className="period-list">{value.items.map(a=><button key={a.id} className={`period-appointment period-${a.status}`} onClick={()=>p.onSelect(a)}><span><strong>{new Date(a.starts_at).toLocaleString('pt-BR',{timeZone:zone,dateStyle:'short',timeStyle:'short'})}</strong><small>{p.data.services.find(s=>s.id===a.service_id)?.name??'Serviço'} · {p.data.team.find(t=>t.user_id===a.barber_id)?.display_name??'Profissional'}</small></span><span className={`status ${a.status}`}>{statusLabel[a.status]}</span></button>)}{!value.total&&<p>Nenhum agendamento neste período.</p>}</div></details></>}</section>;
}
