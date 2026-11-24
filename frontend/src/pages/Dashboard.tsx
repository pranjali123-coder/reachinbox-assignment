import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmailRow, User } from '../types';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { EmailTable } from '../components/EmailTable';
import { ComposeModal } from '../components/ComposeModal';

export function Dashboard({ user, onLogout }: { user: User; onLogout:()=>void }) { const [tab,setTab]=useState('scheduled'); const [rows,setRows]=useState<EmailRow[]>([]); const [compose,setCompose]=useState(false); const [loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const r=await api.get(`/emails/${tab}`);setRows(r.data)}finally{setLoading(false)}}; useEffect(()=>{load()},[tab]);
 return <div className="flex min-h-screen"><Sidebar tab={tab} setTab={setTab}/><main className="min-w-0 flex-1"><Topbar user={user} onLogout={onLogout}/><section className="p-5 md:p-8"><div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-2xl font-bold">{tab==='scheduled'?'Scheduled Emails':'Sent Emails'}</h1><p className="mt-1 text-sm text-slate-500">{tab==='scheduled'?'Emails waiting for their scheduled send time.':'History of sent and failed emails.'}</p></div><div className="flex gap-2"><a href="http://localhost:4000/admin/queues" target="_blank" className="rounded-xl border bg-white px-4 py-2 text-sm font-medium">BullMQ</a><a href="http://localhost:4000/api/slack/connect" className="rounded-xl border bg-white px-4 py-2 text-sm font-medium">{user.slackConnected?'Slack connected':'Connect Slack'}</a><button onClick={()=>setCompose(true)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">+ Compose New Email</button></div></div>{loading?<div className="rounded-2xl border bg-white p-12 text-center text-slate-500">Loading...</div>:<EmailTable rows={rows} empty={tab==='scheduled'?'No scheduled emails yet.':'No sent emails yet.'}/>}</section></main>{compose&&<ComposeModal onClose={()=>setCompose(false)} onDone={load}/>}</div> }
