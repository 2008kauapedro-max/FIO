import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {Dashboard,Agenda,Subscriptions} from '../../src/pages/Workspace';
import {demoData} from '../../src/lib/demo';
import type {Role} from '../../shared/domain';
import '../../src/styles.css';
function Fixture(){
 const role=(new URLSearchParams(location.search).get('role')??'OWNER') as Role;
 const [data,setData]=useState(()=>demoData(role));
 const [notice,setNotice]=useState('');
 const props={data,demo:true,base:'/owner',refresh:async()=>{},notify:setNotice,updateDemo:setData};
 return <MemoryRouter initialEntries={['/owner']}><main style={{maxWidth:900,margin:'auto',padding:20}}><Routes><Route path="/owner" element={<Dashboard {...props}/>}/><Route path="/owner/agenda" element={<Agenda {...props}/>}/><Route path="/owner/assinaturas" element={<Subscriptions {...props}/>}/></Routes>{notice&&<p role="status">{notice}</p>}</main></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
