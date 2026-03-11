import React, { useState, useMemo, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area } from "recharts";
import { Users, TrendingUp, AlertTriangle, ArrowLeft, DollarSign, Activity, Shield, MessageSquare, Clock, ChevronRight, ArrowUpRight, ArrowDownRight, Minus, RefreshCw, ExternalLink, Globe, Mail } from "lucide-react";
import './App.css';

const WEBHOOK_URL = process.env.REACT_APP_WEBHOOK_URL || "";
const API_KEY = process.env.REACT_APP_API_KEY || "";

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const countryFlag = seg => {
  const map = {
    'Chile':'🇨🇱','Argentina':'🇦🇷','México':'🇲🇽','Mexico':'🇲🇽','Colombia':'🇨🇴',
    'Perú':'🇵🇪','Peru':'🇵🇪','Brasil':'🇧🇷','Brazil':'🇧🇷','Uruguay':'🇺🇾',
    'España':'🇪🇸','Venezuela':'🇻🇪','Ecuador':'🇪🇨','Bolivia':'🇧🇴','Paraguay':'🇵🇾',
    'Costa Rica':'🇨🇷','Panamá':'🇵🇦','Panama':'🇵🇦','Guatemala':'🇬🇹',
    'Honduras':'🇭🇳','El Salvador':'🇸🇻','Nicaragua':'🇳🇮','República Dominicana':'🇩🇴',
  };
  return map[seg] || '🌎';
};

function parseClient(c) {
  const t = c.convos?.trend || [0,0,0,0,0,0,0,0];
  const conv_w0=num(t[7]);const conv_w1=num(t[6]);const conv_w2=num(t[5]);const conv_w3=num(t[4]);
  const conv_w4=num(t[3]);const conv_w5=num(t[2]);const conv_w6=num(t[1]);const conv_w7=num(t[0]);
  const avg4=(conv_w0+conv_w1+conv_w2+conv_w3)/4;
  const avgP4=(conv_w4+conv_w5+conv_w6+conv_w7)/4;
  const owners=num(c.contacts?.owner);const sAdmins=num(c.contacts?.superAdmin);
  const admins=num(c.contacts?.admin);const agents=num(c.contacts?.agent);
  const npsG=c.nps?.global!==null&&c.nps?.global!==undefined?num(c.nps.global):null;
  const npsPrev=c.nps?.prevGlobal!==null&&c.nps?.prevGlobal!==undefined?num(c.nps.prevGlobal):null;
  const mrr=num(c.mrr);const totalConvos=num(c.convos?.used);const convoPct=num(c.convos?.pctChange);
  const convoLimit=c.convos?.limit?num(c.convos.limit):c.convos?.total?num(c.convos.total):null;
  const ownerEmail=c.ownerEmail||c.contacts?.ownerEmail||null;
  return{...c,mrr,mrrPrev:num(c.mrrPrev),npsG,npsPrev,npsComments:c.npsComments||[],
    owners,sAdmins,admins,agents,totalUsers:num(c.totalUsers),
    trend:t.map(num),totalConvos,convoPct,avg4,avgP4,convoLimit,ownerEmail,
    billDate:c.billDate||'N/A',payStatus:c.payStatus||'Al día',
    failedPayments:num(c.failedPayments),daysInVambe:num(c.daysInVambe),
    teamMembers:c.teamMembers||'Sin asignar',csm:c.csm||'Sin asignar',
    plan:c.plan||'N/A',segment:c.segment||'N/A'};
}

function calcHealth(c){
  let s=0;
  const convoRatio=c.totalConvos>0?Math.min(c.totalConvos/5000,1):0;
  s+=convoRatio*25;
  if(c.npsG!==null)s+=Math.min((c.npsG/10)*25,25);else s+=12;
  const mt=(c.owners>0?1:0)+(c.sAdmins>0?1:0)+(c.admins>0?1:0)+(c.agents>0?1:0);
  s+=(mt/4)*20;
  if(c.convoPct>=10)s+=15;else if(c.convoPct>=0)s+=10;else if(c.convoPct>=-20)s+=5;
  if(c.payStatus==='Al día')s+=10;else if(c.payStatus==='Pendiente')s+=5;
  s+=Math.min(c.totalUsers/50*10,10);
  return Math.round(Math.min(s,100));
}

const riskLevel=h=>h>=70?"low":h>=45?"medium":"high";
const adoptCat=h=>h>=70?"Power User":h>=45?"Underutilizer":"Critical Support";

const Tip=({text,children})=>(
  <div className="relative group inline-flex items-center w-full">
    {children}
    {text&&<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg w-max max-w-xs text-center leading-tight">
      {text}<div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"/>
    </div>}
  </div>
);

const Delta=({value,suffix="",size="sm",invert=false})=>{
  const v=Number(value);const pos=invert?v<=0:v>=0;const zero=v===0;
  const sz=size==="xs"?"text-xs":"text-sm";
  if(zero||!Number.isFinite(v))return<span className={`${sz} text-gray-400 flex items-center gap-0.5`}><Minus size={size==="xs"?10:12}/>—</span>;
  return<span className={`${sz} font-medium flex items-center gap-0.5 ${pos?"text-emerald-600":"text-red-600"}`}>{pos?<ArrowUpRight size={size==="xs"?10:12}/>:<ArrowDownRight size={size==="xs"?10:12}/>}{v>0?"+":""}{typeof value==='number'?value.toFixed(1):value}{suffix}</span>;
};

const Badge=({type,children,tooltip})=>{
  const c={low:"bg-emerald-100 text-emerald-700",medium:"bg-amber-100 text-amber-700",high:"bg-red-100 text-red-700","Power User":"bg-emerald-100 text-emerald-700",Underutilizer:"bg-amber-100 text-amber-700","Critical Support":"bg-red-100 text-red-700","Al día":"bg-emerald-100 text-emerald-700",Pendiente:"bg-amber-100 text-amber-700",Atrasado:"bg-red-100 text-red-700"};
  const el=<span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${c[type]||"bg-gray-100 text-gray-600"}`}>{children}</span>;
  if(!tooltip)return el;
  return<Tip text={tooltip}>{el}</Tip>;
};

const KPI=({icon:Icon,label,value,sub,delta,deltaSuffix="",color="text-blue-600",tooltip})=>(
  <Tip text={tooltip}>
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 w-full cursor-default">
      <div className={`p-2 rounded-lg bg-gray-50 ${color}`}><Icon size={18}/></div>
      <div className="flex-1"><p className="text-xs text-gray-500 font-medium">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5"><p className="text-lg font-bold text-gray-900">{value}</p>
          {delta!==undefined&&delta!==null&&<Delta value={delta} suffix={deltaSuffix} size="xs"/>}</div>
        {sub&&<p className="text-xs text-gray-400 mt-0.5">{sub}</p>}</div>
    </div>
  </Tip>
);

const HealthBar=({score})=>{
  const c=score>=70?"bg-emerald-500":score>=45?"bg-amber-500":"bg-red-500";
  return<div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${c} transition-all`} style={{width:`${score}%`}}/></div>;
};

function AlertsPanel({clients}){
  const alerts=[];
  clients.forEach(c=>{
    if(c.convoPct<=-60)alerts.push({c,type:"critical",msg:`Conversaciones cayeron ${Math.abs(c.convoPct).toFixed(0)}% (4 sem)`,p:1});
    if(c.payStatus==="Atrasado")alerts.push({c,type:"critical",msg:`Pago atrasado (${c.failedPayments} intentos fallidos)`,p:1});
    if(c.totalConvos===0&&c.daysInVambe>30)alerts.push({c,type:"critical",msg:"0 conversaciones en 4 semanas",p:1});
    if(c.convoPct<=-30&&c.convoPct>-60)alerts.push({c,type:"warning",msg:`Conversaciones bajaron ${Math.abs(c.convoPct).toFixed(0)}%`,p:2});
    if(c.npsG!==null&&c.npsG<=5)alerts.push({c,type:"warning",msg:`NPS bajo: ${c.npsG}`,p:2});
    if(c.csm==="Sin asignar"&&c.mrr>=1000)alerts.push({c,type:"warning",msg:`$${c.mrr.toLocaleString()} MRR sin CSM asignado`,p:2});
    if(c.convoPct>=50&&c.totalConvos>500)alerts.push({c,type:"positive",msg:`Conversaciones crecieron ${c.convoPct.toFixed(0)}%`,p:4});
  });
  alerts.sort((a,b)=>a.p-b.p);
  if(!alerts.length)return null;
  const colors={critical:"border-l-red-500 bg-red-50",warning:"border-l-amber-500 bg-amber-50",positive:"border-l-emerald-500 bg-emerald-50"};
  const icons={critical:"🔴",warning:"🟡",positive:"🟢"};
  return(
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <Tip text="Variaciones significativas que requieren atención del CSM">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 cursor-default">Alertas y Varianzas ({alerts.length})</h3>
      </Tip>
      <div className="space-y-2 max-h-56 overflow-y-auto">{alerts.slice(0,12).map((a,i)=>(
        <div key={i} className={`border-l-4 rounded-r-lg px-3 py-2 ${colors[a.type]}`}>
          <span className="text-xs">{icons[a.type]} </span>
          <span className="text-xs font-semibold text-gray-800">{a.c.name}</span>
          <span className="text-xs text-gray-500"> · </span>
          <span className="text-xs text-gray-600">{a.msg}</span>
          <span className="text-xs text-gray-400"> · ${a.c.mrr.toLocaleString()}/mes</span>
        </div>
      ))}</div>
    </div>
  );
}

function ClientFocusCard({client:c,onDetail}){
  const h=calcHealth(c);
  const flag=countryFlag(c.segment);
  const convoText=c.convoLimit?`${c.totalConvos.toLocaleString()} / ${c.convoLimit.toLocaleString()}`:`${c.totalConvos.toLocaleString()}`;
  return(
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{flag} {c.name}</h2>
            <Badge type={adoptCat(h)} tooltip={adoptCat(h)==="Power User"?"Alta adopción y uso consistente":adoptCat(h)==="Underutilizer"?"Uso por debajo del potencial":"Requiere intervención urgente del CSM"}>{adoptCat(h)}</Badge>
            <Badge type={c.payStatus} tooltip="Estado del pago mensual">{c.payStatus}</Badge>
          </div>
          <p className="text-xs text-gray-500">{c.plan} · CSM: {c.csm}</p>
          {c.ownerEmail&&<p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Mail size={10}/>{c.ownerEmail}</p>}
        </div>
        <Tip text="Health Score 0–100: combina uso, NPS, equipo, pago y tendencia">
          <div className="text-right cursor-default">
            <div className={`text-4xl font-black ${h>=70?"text-emerald-600":h>=45?"text-amber-500":"text-red-600"}`}>{h}</div>
            <p className="text-xs text-gray-400">Health</p>
          </div>
        </Tip>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        {[
          {l:"País",v:<>{flag}<br/><span className="text-xs font-semibold text-gray-700">{c.segment}</span></>,tip:"País de operación"},
          {l:"MRR",v:`$${c.mrr.toLocaleString()}`,sub:"/mes",tip:"Monthly Recurring Revenue"},
          {l:"Usuarios",v:c.totalUsers,sub:"activos",tip:"Usuarios activos en la cuenta"},
          {l:"Días en Vambe",v:c.daysInVambe,tip:"Días desde la activación de la cuenta"},
          {l:"Conversaciones",v:convoText,delta:c.convoPct,tip:c.convoLimit?"Usadas / límite del plan (4 sem)":"Total (4 sem)"},
          {l:"NPS",v:c.npsG!==null?c.npsG:"—",sub:"/10",tip:"Net Promoter Score global"},
        ].map(m=>(
          <Tip key={m.l} text={m.tip}>
            <div className="bg-white/80 rounded-lg p-2.5 text-center cursor-default w-full">
              <p className="text-xs text-gray-500">{m.l}</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{m.v}</p>
              {m.sub&&<p className="text-xs text-gray-400">{m.sub}</p>}
              {m.delta!==undefined&&<Delta value={m.delta} suffix="%" size="xs"/>}
            </div>
          </Tip>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4">
        <button onClick={()=>onDetail(c)} className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800">Ver 360° completo <ChevronRight size={16}/></button>
        <a href={c.backofficeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"><ExternalLink size={14}/>Backoffice</a>
      </div>
    </div>
  );
}

function Portfolio({clients,onDetail,csm,setCsm,csmList,selId,setSelId}){
  const[sortBy,setSortBy]=useState("risk");
  const csmClients=useMemo(()=>csm==="Todos"?clients:clients.filter(c=>(c.teamMembers||'').toLowerCase().includes(csm.toLowerCase())),[clients,csm]);
  const selClient=useMemo(()=>csmClients.find(c=>c.id===selId)||null,[csmClients,selId]);
  const p=useMemo(()=>selClient?[selClient]:csmClients,[selClient,csmClients]);
  const sorted=useMemo(()=>[...p].sort((a,b)=>{
    if(sortBy==="risk")return calcHealth(a)-calcHealth(b);
    if(sortBy==="mrr")return b.mrr-a.mrr;
    if(sortBy==="convoDrop")return a.convoPct-b.convoPct;
    return 0;
  }),[p,sortBy]);

  const avgH=p.length?Math.round(p.reduce((s,c)=>s+calcHealth(c),0)/p.length):0;
  const totalMRR=p.reduce((s,c)=>s+c.mrr,0);
  const npsClients=p.filter(c=>c.npsG!==null&&c.npsG>0);
  const avgNPS=npsClients.length?(npsClients.reduce((s,c)=>s+c.npsG,0)/npsClients.length).toFixed(1):"—";
  const atRisk=p.filter(c=>riskLevel(calcHealth(c))==="high");
  const rar=atRisk.reduce((s,c)=>s+c.mrr,0);
  const noCSM=p.filter(c=>c.csm==="Sin asignar");
  const adoptionMatrix=[
    {name:"Power Users",count:p.filter(c=>adoptCat(calcHealth(c))==="Power User").length,color:"#10b981"},
    {name:"Underutilizers",count:p.filter(c=>adoptCat(calcHealth(c))==="Underutilizer").length,color:"#f59e0b"},
    {name:"Critical Support",count:p.filter(c=>adoptCat(calcHealth(c))==="Critical Support").length,color:"#ef4444"}
  ];

  return(
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{selClient?`Viendo: ${selClient.name}`:`${p.length} cuentas · ${csm==="Todos"?"Todos los CSMs":csm}`}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={csm} onChange={e=>{setCsm(e.target.value);setSelId(null);}} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="Todos">Todos los CSMs</option>
          {csmList.map(c=><option key={c} value={c}>{c}</option>)}
          <option value="Sin asignar">Sin asignar</option>
        </select>
        <div className="h-6 w-px bg-gray-200"/>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button onClick={()=>setSelId(null)} className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${selId===null?"bg-gray-900 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Todos</button>
          {csmClients.slice(0,20).map(c=>{const h=calcHealth(c);return(
            <button key={c.id} onClick={()=>setSelId(selId===c.id?null:c.id)} className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border ${selId===c.id?"bg-blue-600 text-white border-blue-600":`bg-white text-gray-700 ${h>=70?"border-emerald-300":h>=45?"border-amber-300":"border-red-300"} hover:bg-gray-50`}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${h>=70?"bg-emerald-500":h>=45?"bg-amber-500":"bg-red-500"}`}/>{c.name}
            </button>
          );})}
        </div>
      </div>

      {selClient&&<ClientFocusCard client={selClient} onDetail={onDetail}/>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI icon={Activity} label="Health Promedio" value={`${avgH}/100`} color="text-emerald-600" tooltip="Promedio del Health Score. 70+ verde, 45–69 amarillo, <45 rojo"/>
        <KPI icon={DollarSign} label="MRR Total" value={`$${totalMRR.toLocaleString()}`} sub={`${p.length} cuenta${p.length!==1?"s":""}`} color="text-blue-600" tooltip="Monthly Recurring Revenue total"/>
        <KPI icon={AlertTriangle} label="Revenue at Risk" value={`$${rar.toLocaleString()}`} sub={`${atRisk.length} cuenta${atRisk.length!==1?"s":""}`} color="text-red-600" tooltip="MRR de clientes con Health Score menor a 45 (riesgo alto de churn)"/>
        <KPI icon={MessageSquare} label="NPS Promedio" value={avgNPS} sub={`${npsClients.length} respuesta${npsClients.length!==1?"s":""}`} color="text-violet-600" tooltip="Net Promoter Score promedio. 8–10: Promotores, 6–7: Neutros, 0–5: Detractores"/>
        <KPI icon={Users} label="Sin CSM" value={noCSM.length} sub={`$${noCSM.reduce((s,c)=>s+c.mrr,0).toLocaleString()} MRR`} color="text-amber-600" tooltip="Clientes sin Customer Success Manager asignado"/>
      </div>

      {!selClient&&<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><AlertsPanel clients={p}/></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <Tip text="Distribución de clientes según nivel de adopción">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 cursor-default">Matriz de Adopción</h3>
          </Tip>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart><Pie data={adoptionMatrix} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={4}>
              {adoptionMatrix.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip formatter={(v,n)=>[`${v}`,n]}/></PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">{adoptionMatrix.map(a=>(
            <div key={a.name} className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:a.color}}/><span className="text-gray-600">{a.name}</span><span className="ml-auto font-semibold">{a.count}</span></div>
          ))}</div>
        </div>
      </div>}

      {selClient&&<AlertsPanel clients={p}/>}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Clientes ({sorted.length})</h3>
          {!selClient&&<select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="risk">Mayor riesgo</option><option value="convoDrop">Mayor caída</option><option value="mrr">Mayor MRR</option>
          </select>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium">MRR</th>
              <th className="px-4 py-3 font-medium">NPS</th>
              <th className="px-4 py-3 font-medium">Convos Δ</th>
              <th className="px-4 py-3 font-medium">Usuarios</th>
              <th className="px-4 py-3 font-medium">Pago</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
            </tr></thead>
            <tbody>{sorted.map(c=>{const h=calcHealth(c);return(
              <tr key={c.id} onClick={()=>onDetail(c)} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${c.id===selId?"bg-blue-50/50":""}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 truncate max-w-48">{countryFlag(c.segment)} {c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.csm==="Sin asignar"?"⚠ "+c.csm:c.csm} · {c.segment}</p>
                </td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="font-bold text-gray-800 w-6">{h}</span><div className="w-14"><HealthBar score={h}/></div></div></td>
                <td className="px-4 py-3 font-medium">${c.mrr.toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`font-bold ${c.npsG===null?"text-gray-300":c.npsG>=8?"text-emerald-600":c.npsG>=6?"text-amber-600":"text-red-600"}`}>{c.npsG!==null?c.npsG:"—"}</span></td>
                <td className="px-4 py-3"><Delta value={c.convoPct} suffix="%" size="xs"/></td>
                <td className="px-4 py-3 text-gray-600">{c.totalUsers}</td>
                <td className="px-4 py-3"><Badge type={c.payStatus}>{c.payStatus}</Badge></td>
                <td className="px-4 py-3"><Badge type={adoptCat(h)}>{adoptCat(h)}</Badge></td>
              </tr>
            );})}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── NPS helpers ────────────────────────────────────────────────────────────
function filterNPSByPeriod(entries, period) {
  if(!entries||!entries.length)return{current:[],previous:[]};
  const now=new Date();
  let cutCurrent, cutPrev;
  if(period==='hoy'){
    cutCurrent=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    cutPrev=new Date(cutCurrent);cutPrev.setDate(cutPrev.getDate()-1);
  }else if(period==='semana'){
    cutCurrent=new Date(now);cutCurrent.setDate(now.getDate()-now.getDay());cutCurrent.setHours(0,0,0,0);
    cutPrev=new Date(cutCurrent);cutPrev.setDate(cutPrev.getDate()-7);
  }else if(period==='mes'){
    cutCurrent=new Date(now.getFullYear(),now.getMonth(),1);
    cutPrev=new Date(now.getFullYear(),now.getMonth()-1,1);
  }else{
    cutCurrent=new Date(now.getFullYear(),0,1);
    cutPrev=new Date(now.getFullYear()-1,0,1);
  }
  const current=entries.filter(e=>new Date(e.date)>=cutCurrent);
  const previous=entries.filter(e=>new Date(e.date)>=cutPrev&&new Date(e.date)<cutCurrent);
  return{current,previous};
}

function NPSSection({client:c}){
  const[npsRole,setNpsRole]=useState("global");
  const[npsPeriod,setNpsPeriod]=useState("mes");

  const npsByRole=c.nps?.byRole||{};
  const roleEntries={
    global:[],
    owner:npsByRole.owner||[],
    superAdmin:npsByRole.superAdmin||[],
    admin:npsByRole.admin||[],
    agent:npsByRole.agent||[],
  };

  const npsRoles=[
    {id:"global",label:"Global"},
    {id:"owner",label:"Owner"},
    {id:"superAdmin",label:"Super Admin"},
    {id:"admin",label:"Admin"},
    {id:"agent",label:"Agente"},
  ];
  const periodLabels={hoy:"hoy",semana:"esta semana",mes:"este mes","año":"este año"};

  const{current:filteredCurrent,previous:filteredPrev}=filterNPSByPeriod(roleEntries[npsRole],npsPeriod);
  const last10=filteredCurrent.slice(-10).reverse();
  const avgCurrent=filteredCurrent.length?(filteredCurrent.reduce((s,e)=>s+num(e.score),0)/filteredCurrent.length):null;
  const avgPrev=filteredPrev.length?(filteredPrev.reduce((s,e)=>s+num(e.score),0)/filteredPrev.length):null;
  const npsDelta=(avgCurrent!==null&&avgPrev!==null)?avgCurrent-avgPrev:null;

  return(
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <Tip text="Net Promoter Score: satisfacción del cliente de 0 a 10. 8–10 Promotor, 6–7 Neutro, 0–5 Detractor">
          <h3 className="text-sm font-semibold text-gray-700 cursor-default">NPS</h3>
        </Tip>
        <select value={npsPeriod} onChange={e=>setNpsPeriod(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="hoy">Hoy</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="año">Este año</option>
        </select>
      </div>

      {/* Global big score + role pills */}
      <div className="flex items-start gap-6 mb-5">
        <Tip text="NPS global de toda la cuenta">
          <div className="text-center cursor-default flex-shrink-0">
            <div className={`text-6xl font-black leading-none ${c.npsG===null?"text-gray-200":c.npsG>=8?"text-emerald-500":c.npsG>=6?"text-amber-500":"text-red-500"}`}>
              {c.npsG!==null?c.npsG:"—"}
            </div>
            <p className="text-xs text-gray-400 mt-1">Global</p>
            {c.npsPrev!==null&&c.npsG!==null&&<Delta value={c.npsG-c.npsPrev} suffix=" pts" size="xs"/>}
          </div>
        </Tip>
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-2">Ver por rol de usuario</p>
          <div className="flex flex-wrap gap-2">
            {npsRoles.map(r=>(
              <button key={r.id} onClick={()=>setNpsRole(r.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${npsRole===r.id?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                {r.label}
                {r.id!=="global"&&roleEntries[r.id].length>0&&<span className="ml-1 opacity-60">({roleEntries[r.id].length})</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Role content */}
      {npsRole==="global"?(
        <div>
          {c.npsG===null?(
            <p className="text-sm text-gray-400 py-4 text-center">Sin datos de NPS para esta cuenta.</p>
          ):(
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                <p className="text-sm text-gray-700">Score actual: <span className="font-bold">{c.npsG}/10</span></p>
                {c.npsPrev!==null&&<div className="text-right"><p className="text-xs text-gray-400">Período anterior: {c.npsPrev}</p></div>}
              </div>
              {c.npsComments.length>0&&(
                <div className="space-y-2 mt-3">
                  <p className="text-xs font-medium text-gray-500">Comentarios recientes</p>
                  {c.npsComments.slice(0,5).map((cm,i)=>(
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">"{cm}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ):(
        <div>
          {roleEntries[npsRole].length===0?(
            <div className="py-8 text-center border border-dashed border-gray-200 rounded-lg">
              <p className="text-sm text-gray-400">Sin respuestas de {npsRoles.find(r=>r.id===npsRole)?.label} en {periodLabels[npsPeriod]}.</p>
              <p className="text-xs text-gray-300 mt-1.5">Requiere campo <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">nps.byRole.{npsRole}</code> en el webhook</p>
            </div>
          ):(
            <div className="space-y-3">
              {/* Period summary */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-400">Promedio {periodLabels[npsPeriod]}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-2xl font-bold ${avgCurrent!==null&&avgCurrent>=8?"text-emerald-600":avgCurrent!==null&&avgCurrent>=6?"text-amber-500":"text-red-600"}`}>
                      {avgCurrent!==null?avgCurrent.toFixed(1):"—"}
                    </span>
                    {npsDelta!==null&&<Delta value={npsDelta} suffix=" pts" size="xs"/>}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400">{filteredCurrent.length} respuesta{filteredCurrent.length!==1?"s":""}</p>
                  {avgPrev!==null&&<p className="text-xs text-gray-300">Período anterior: {avgPrev.toFixed(1)}</p>}
                </div>
              </div>
              {/* Last 10 entries */}
              <p className="text-xs font-medium text-gray-500 mt-2">Últimas {Math.min(last10.length,10)} entradas</p>
              <div className="space-y-2">
                {last10.map((entry,i)=>(
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className={`text-lg font-black w-7 flex-shrink-0 ${num(entry.score)>=8?"text-emerald-600":num(entry.score)>=6?"text-amber-500":"text-red-500"}`}>{entry.score}</span>
                    <div className="flex-1 min-w-0">
                      {entry.userName&&<p className="text-xs font-semibold text-gray-700">{entry.userName}</p>}
                      {entry.comment&&<p className="text-xs text-gray-500 mt-0.5 italic">"{entry.comment}"</p>}
                      {entry.date&&<p className="text-xs text-gray-300 mt-1">{new Date(entry.date).toLocaleDateString('es-CL')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeepDive({client:c,onBack}){
  const h=calcHealth(c);
  const cat=adoptCat(h);
  const flag=countryFlag(c.segment);
  const trendData=c.trend.map((v,i)=>({week:`S${i+1}`,conv:num(v)}));
  const convoText=c.convoLimit?`${c.totalConvos.toLocaleString()} / ${c.convoLimit.toLocaleString()}`:`${c.totalConvos.toLocaleString()}`;

  const dx=h>=70&&(c.npsG===null||c.npsG>=7)
    ?{l:"Estable / Expansión",cl:"text-emerald-700 bg-emerald-50 border-emerald-200",I:TrendingUp,d:"Buena adopción. Oportunidad de upsell o caso de éxito."}
    :h>=45?{l:"Monitorear",cl:"text-amber-700 bg-amber-50 border-amber-200",I:Activity,d:"Uso moderado. Profundizar adopción y engagement."}
    :{l:"Riesgo — Acción Inmediata",cl:"text-red-700 bg-red-50 border-red-200",I:AlertTriangle,d:"Baja adopción o señales negativas. Intervención urgente."};

  return(
    <div className="space-y-4">
      {/* Compact header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"><ArrowLeft size={18} className="text-gray-600"/></button>
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <h1 className="text-xl font-bold text-gray-900">{flag} {c.name}</h1>
          <Badge type={cat} tooltip={cat==="Power User"?"Alta adopción y uso consistente":cat==="Underutilizer"?"Uso por debajo del potencial":"Requiere intervención urgente del CSM"}>{cat}</Badge>
          <Badge type={c.payStatus} tooltip="Estado del pago mensual">{c.payStatus}</Badge>
        </div>
        <Tip text="Health Score 0–100: combina conversaciones, NPS, equipo, tendencia y pago">
          <div className={`text-2xl font-black cursor-default flex-shrink-0 ${h>=70?"text-emerald-600":h>=45?"text-amber-500":"text-red-600"}`}>{h}<span className="text-sm font-normal text-gray-400 ml-1">hs</span></div>
        </Tip>
        <a href={c.backofficeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-2 flex-shrink-0"><ExternalLink size={12}/>Backoffice</a>
      </div>

      {/* Status banner */}
      <div className={`rounded-xl border p-3 flex items-center gap-3 ${dx.cl}`}>
        <dx.I size={16} className="flex-shrink-0"/>
        <p className="text-sm font-semibold">{dx.l}</p>
        <p className="text-xs opacity-75 ml-1">{dx.d}</p>
      </div>

      {/* 2-column layout: 1/3 sidebar + 2/3 content */}
      <div className="grid grid-cols-3 gap-4 items-start">

        {/* ── LEFT SIDEBAR 1/3 ── */}
        <div className="col-span-1 space-y-3">

          {/* Client data */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datos del Cliente</p>
            <div className="space-y-3">
              <Tip text="País de operación del cliente">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">País</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{flag} {c.segment}</p>
                </div>
              </Tip>
              {c.ownerEmail&&<Tip text="Email del dueño principal de la cuenta">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">Email Owner</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5 break-all">{c.ownerEmail}</p>
                </div>
              </Tip>}
              <Tip text="Monthly Recurring Revenue: ingreso mensual del cliente">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">MRR</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">${c.mrr.toLocaleString()}<span className="text-xs text-gray-400 font-normal">/mes</span></p>
                </div>
              </Tip>
              <Tip text="Plan contratado y estado del pago">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">Plan / Pago</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-semibold text-gray-800">{c.plan}</p>
                    <Badge type={c.payStatus}>{c.payStatus}</Badge>
                  </div>
                  {c.failedPayments>0&&<p className="text-xs text-red-500 mt-0.5">{c.failedPayments} intentos fallidos</p>}
                </div>
              </Tip>
              <Tip text="Días transcurridos desde que el cliente activó su cuenta en Vambe">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">Días en Vambe</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{c.daysInVambe} <span className="text-xs text-gray-400 font-normal">días</span></p>
                </div>
              </Tip>
              <Tip text="Número de usuarios activos registrados en la cuenta">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">Usuarios</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{c.totalUsers} <span className="text-xs text-gray-400 font-normal">activos</span></p>
                </div>
              </Tip>
              <Tip text={c.convoLimit?"Conversaciones usadas sobre el límite del plan en las últimas 4 semanas":"Total de conversaciones procesadas en las últimas 4 semanas"}>
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">Conversaciones (4 sem)</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{convoText}</p>
                  <Delta value={c.convoPct} suffix="%" size="xs"/>
                </div>
              </Tip>
            </div>
          </div>

          {/* Equipo Vambe */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Equipo Vambe</p>
            <div className="space-y-3">
              <Tip text="Customer Success Manager responsable de la cuenta">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">Success / CSM</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{c.teamMembers}</p>
                </div>
              </Tip>
              {c.onboarder&&<Tip text="Responsable del proceso de onboarding del cliente">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">Onboarder</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{c.onboarder}</p>
                </div>
              </Tip>}
              {c.seller&&<Tip text="Ejecutivo de ventas que cerró la cuenta">
                <div className="cursor-default w-full">
                  <p className="text-xs text-gray-400">Seller</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{c.seller}</p>
                </div>
              </Tip>}
            </div>
          </div>

          {/* Contacto cliente */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contacto Cliente</p>
            <div className="space-y-3">
              {c.email&&<div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 break-all">{c.email}</p>
              </div>}
              {c.phone&&<div>
                <p className="text-xs text-gray-400">Teléfono</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{c.phone}</p>
              </div>}
              {!c.email&&!c.phone&&<p className="text-xs text-gray-400">Sin datos de contacto</p>}
            </div>
          </div>
        </div>

        {/* ── RIGHT CONTENT 2/3 ── */}
        <div className="col-span-2 space-y-4">

          {/* NPS section */}
          <NPSSection client={c}/>

          {/* Logins placeholder */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <Tip text="Cantidad de veces que los usuarios han iniciado sesión en la plataforma">
                <h3 className="text-sm font-semibold text-gray-700 cursor-default">Logins</h3>
              </Tip>
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Pendiente de datos</span>
            </div>
            <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
              <p className="text-sm text-gray-400">Sin datos de logins disponibles aún.</p>
              <p className="text-xs text-gray-300 mt-1.5">Requiere campo <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">logins</code> en el webhook</p>
              <p className="text-xs text-gray-300 mt-0.5">Ejemplo: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">{'{"daily": 12, "weekly": 54, "monthly": 210}'}</code></p>
            </div>
          </div>

          {/* Functions success rate placeholder */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <Tip text="Total de funciones ejecutadas por el bot y porcentaje de ejecuciones exitosas">
                <h3 className="text-sm font-semibold text-gray-700 cursor-default">Tasa de Éxito de Funciones</h3>
              </Tip>
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Pendiente de datos</span>
            </div>
            <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
              <p className="text-sm text-gray-400">Sin datos de funciones disponibles aún.</p>
              <p className="text-xs text-gray-300 mt-1.5">Requiere campos <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">functions.total</code> y <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">functions.successRate</code></p>
              <p className="text-xs text-gray-300 mt-0.5">Ejemplo: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">{'{"total": 340, "successRate": 94.2}'}</code></p>
            </div>
          </div>

          {/* Trend chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <Tip text="Evolución del número de conversaciones semana a semana en las últimas 8 semanas">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 cursor-default">Tendencia de Conversaciones (8 semanas)</h3>
            </Tip>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <XAxis dataKey="week" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:11}}/>
                <Tooltip/>
                <Area type="monotone" dataKey="conv" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}

function App(){
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[detail,setDetail]=useState(null);
  const[csm,setCsm]=useState("Todos");
  const[selId,setSelId]=useState(null);

  const fetchData=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const headers=API_KEY?{"x-api-key":API_KEY}:{};
      const res=await fetch(WEBHOOK_URL,{headers});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      let json=await res.json();
      if(Array.isArray(json))json=json[0];
      setData(json);
    }catch(e){setError(e.message);}
    setLoading(false);
  },[]);

  useEffect(()=>{fetchData();},[fetchData]);

  const clients=useMemo(()=>{
    if(!data?.clients)return[];
    return data.clients.map(parseClient);
  },[data]);

  const csmList=useMemo(()=>data?.summary?.csmList||[],[data]);

  if(loading)return<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="flex items-center gap-3 text-gray-500"><RefreshCw size={20} className="animate-spin"/>Cargando datos...</div></div>;
  if(error)return<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md"><p className="text-red-700 font-medium">Error: {error}</p><button onClick={fetchData} className="mt-3 text-sm text-red-600 underline">Reintentar</button></div></div>;
  if(!clients.length)return<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Sin datos</p></div>;

  return(
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6" style={{fontFamily:"system-ui,-apple-system,sans-serif"}}>
      <div className={`mx-auto ${detail?"max-w-7xl":"max-w-6xl"}`}>
        {detail
          ?<DeepDive client={detail} onBack={()=>setDetail(null)}/>
          :<Portfolio clients={clients} onDetail={c=>{setDetail(c);setSelId(c.id);}} csm={csm} setCsm={setCsm} csmList={csmList} selId={selId} setSelId={setSelId}/>}
        <div className="flex items-center justify-center gap-4 mt-6">
          <p className="text-xs text-gray-300">Generado: {data?.summary?.generatedAt?new Date(data.summary.generatedAt).toLocaleString('es-CL'):'—'}</p>
          <button onClick={()=>{setDetail(null);fetchData();}} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><RefreshCw size={10}/>Refrescar</button>
        </div>
      </div>
    </div>
  );
}

export default App;
