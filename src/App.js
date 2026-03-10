import React, { useState, useMemo, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area } from "recharts";
import { Users, TrendingUp, AlertTriangle, ArrowLeft, DollarSign, Activity, Shield, MessageSquare, Clock, ChevronRight, ArrowUpRight, ArrowDownRight, Minus, RefreshCw, ExternalLink, Globe } from "lucide-react";
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
  return{...c,mrr,mrrPrev:num(c.mrrPrev),npsG,npsPrev,npsComments:c.npsComments||[],
    owners,sAdmins,admins,agents,totalUsers:num(c.totalUsers),
    trend:t.map(num),totalConvos,convoPct,avg4,avgP4,convoLimit,
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

// Tooltip wrapper
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

const HealthBar=({score,tooltip})=>{
  const c=score>=70?"bg-emerald-500":score>=45?"bg-amber-500":"bg-red-500";
  const bar=<div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${c} transition-all`} style={{width:`${score}%`}}/></div>;
  if(!tooltip)return bar;
  return<Tip text={tooltip}>{bar}</Tip>;
};

function AlertsPanel({clients}){
  const alerts=[];
  clients.forEach(c=>{
    if(c.convoPct<=-60)alerts.push({c,type:"critical",msg:`Convos cayeron ${Math.abs(c.convoPct).toFixed(0)}% (4 sem)`,p:1});
    if(c.payStatus==="Atrasado")alerts.push({c,type:"critical",msg:`Pago atrasado (${c.failedPayments} intentos fallidos)`,p:1});
    if(c.totalConvos===0&&c.daysInVambe>30)alerts.push({c,type:"critical",msg:"0 conversaciones en 4 semanas",p:1});
    if(c.convoPct<=-30&&c.convoPct>-60)alerts.push({c,type:"warning",msg:`Convos bajaron ${Math.abs(c.convoPct).toFixed(0)}%`,p:2});
    if(c.npsG!==null&&c.npsG<=5)alerts.push({c,type:"warning",msg:`NPS bajo: ${c.npsG}`,p:2});
    if(c.csm==="Sin asignar"&&c.mrr>=1000)alerts.push({c,type:"warning",msg:`${c.mrr.toLocaleString()} MRR sin CSM asignado`,p:2});
    if(c.convoPct>=50&&c.totalConvos>500)alerts.push({c,type:"positive",msg:`Convos crecieron ${c.convoPct.toFixed(0)}%`,p:4});
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
          <span className="text-xs">{icons[a.type]} </span><span className="text-xs font-semibold text-gray-800">{a.c.name}</span>
          <span className="text-xs text-gray-500"> · </span><span className="text-xs text-gray-600">{a.msg}</span>
          <span className="text-xs text-gray-400"> · ${a.c.mrr.toLocaleString()}/mes</span>
        </div>
      ))}</div>
    </div>
  );
}

// Client focus card shown when a client is selected in portfolio view
function ClientFocusCard({client:c, onDetail}){
  const h=calcHealth(c);
  const flag=countryFlag(c.segment);
  const convoText=c.convoLimit?`${c.totalConvos.toLocaleString()} / ${c.convoLimit.toLocaleString()}`:`${c.totalConvos.toLocaleString()}`;
  return(
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{c.name}</h2>
            <Badge type={adoptCat(h)} tooltip={adoptCat(h)==="Power User"?"Alta adopción y uso consistente":adoptCat(h)==="Underutilizer"?"Uso por debajo del potencial":"Requiere intervención urgente del CSM"}>{adoptCat(h)}</Badge>
            <Badge type={c.payStatus} tooltip="Estado del pago mensual">{c.payStatus}</Badge>
          </div>
          <p className="text-xs text-gray-500">{c.plan} · CSM: {c.csm}</p>
        </div>
        <Tip text="Health Score: puntaje 0–100 que mide la salud general del cliente basado en uso, NPS, equipo, pago y tendencia">
          <div className="text-right cursor-default">
            <div className={`text-4xl font-black ${h>=70?"text-emerald-600":h>=45?"text-amber-500":"text-red-600"}`}>{h}</div>
            <p className="text-xs text-gray-400">Health</p>
          </div>
        </Tip>
      </div>

      {/* Main metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        <Tip text="País de origen del cliente">
          <div className="bg-white/80 rounded-lg p-2.5 text-center cursor-default w-full">
            <p className="text-xs text-gray-500">País</p>
            <p className="text-xl mt-0.5">{flag}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{c.segment}</p>
          </div>
        </Tip>
        <Tip text="Monthly Recurring Revenue: ingreso mensual recurrente del cliente">
          <div className="bg-white/80 rounded-lg p-2.5 text-center cursor-default w-full">
            <p className="text-xs text-gray-500">MRR</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">${c.mrr.toLocaleString()}</p>
            <p className="text-xs text-gray-400">/mes</p>
          </div>
        </Tip>
        <Tip text="Total de usuarios activos registrados en la cuenta">
          <div className="bg-white/80 rounded-lg p-2.5 text-center cursor-default w-full">
            <p className="text-xs text-gray-500">Usuarios</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{c.totalUsers}</p>
            <p className="text-xs text-gray-400">activos</p>
          </div>
        </Tip>
        <Tip text="Días transcurridos desde que el cliente se unió a Vambe">
          <div className="bg-white/80 rounded-lg p-2.5 text-center cursor-default w-full">
            <p className="text-xs text-gray-500">Días en Vambe</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{c.daysInVambe}</p>
            <p className="text-xs text-gray-400">días</p>
          </div>
        </Tip>
        <Tip text={c.convoLimit?"Conversaciones usadas sobre el límite del plan en las últimas 4 semanas":"Total de conversaciones en las últimas 4 semanas"}>
          <div className="bg-white/80 rounded-lg p-2.5 text-center cursor-default w-full">
            <p className="text-xs text-gray-500">Convos (4 sem)</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{convoText}</p>
            <Delta value={c.convoPct} suffix="%" size="xs"/>
          </div>
        </Tip>
        <Tip text="Net Promoter Score: satisfacción del cliente de 0 a 10">
          <div className="bg-white/80 rounded-lg p-2.5 text-center cursor-default w-full">
            <p className="text-xs text-gray-500">NPS</p>
            <p className={`text-lg font-bold mt-0.5 ${c.npsG===null?"text-gray-300":c.npsG>=8?"text-emerald-600":c.npsG>=6?"text-amber-500":"text-red-600"}`}>{c.npsG!==null?c.npsG:"—"}</p>
            <p className="text-xs text-gray-400">/10</p>
          </div>
        </Tip>
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

  // When a client is selected, filter everything to that client only
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
          <p className="text-sm text-gray-500 mt-0.5">
            {selClient?`Viendo: ${selClient.name}`:`${p.length} cuentas Corporate · ${csm==="Todos"?"Todos los CSMs":csm}`}
          </p>
        </div>
      </div>

      {/* Filters bar */}
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

      {/* Selected client focus card */}
      {selClient&&<ClientFocusCard client={selClient} onDetail={onDetail}/>}

      {/* KPIs — reflect only the current view (all or single client) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI icon={Activity} label="Health Promedio" value={`${avgH}/100`} color="text-emerald-600" tooltip="Promedio del Health Score de los clientes visibles. 70+ verde, 45–69 amarillo, <45 rojo"/>
        <KPI icon={DollarSign} label="MRR Total" value={`$${totalMRR.toLocaleString()}`} sub={`${p.length} cuenta${p.length!==1?"s":""}`} color="text-blue-600" tooltip="Monthly Recurring Revenue total de los clientes visibles"/>
        <KPI icon={AlertTriangle} label="Revenue at Risk" value={`$${rar.toLocaleString()}`} sub={`${atRisk.length} cuenta${atRisk.length!==1?"s":""}`} color="text-red-600" tooltip="MRR de clientes con Health Score menor a 45 (riesgo alto de churn)"/>
        <KPI icon={MessageSquare} label="NPS Promedio" value={avgNPS} sub={`${npsClients.length} respuesta${npsClients.length!==1?"s":""}`} color="text-violet-600" tooltip="Net Promoter Score promedio. 8–10: Promotores, 6–7: Neutros, 0–5: Detractores"/>
        <KPI icon={Users} label="Sin CSM" value={noCSM.length} sub={`$${noCSM.reduce((s,c)=>s+c.mrr,0).toLocaleString()} MRR`} color="text-amber-600" tooltip="Clientes sin Customer Success Manager asignado"/>
      </div>

      {/* Alerts + Adoption matrix — hidden when viewing single client (already in focus card) */}
      {!selClient&&<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><AlertsPanel clients={p}/></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <Tip text="Distribución de clientes según nivel de adopción del producto">
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

      {/* Alerts for single client */}
      {selClient&&<AlertsPanel clients={p}/>}

      {/* Clients table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Clientes ({sorted.length})</h3>
          {!selClient&&<select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="risk">Mayor riesgo</option><option value="convoDrop">Mayor caída convos</option><option value="mrr">Mayor MRR</option>
          </select>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <Tip text="Health Score 0–100: combina uso, NPS, multi-threading, tendencia y pago"><th className="px-4 py-3 font-medium cursor-default">Health</th></Tip>
              <Tip text="Monthly Recurring Revenue"><th className="px-4 py-3 font-medium cursor-default">MRR</th></Tip>
              <Tip text="Net Promoter Score (0–10)"><th className="px-4 py-3 font-medium cursor-default">NPS</th></Tip>
              <Tip text="Variación % de conversaciones vs periodo anterior"><th className="px-4 py-3 font-medium cursor-default">Convos Δ</th></Tip>
              <th className="px-4 py-3 font-medium">Usuarios</th>
              <th className="px-4 py-3 font-medium">Pago</th>
              <Tip text="Categoría según Health Score: Power User ≥70, Underutilizer 45–69, Critical Support <45"><th className="px-4 py-3 font-medium cursor-default">Categoría</th></Tip>
            </tr></thead>
            <tbody>{sorted.map(c=>{const h=calcHealth(c);return(
              <tr key={c.id} onClick={()=>onDetail(c)} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${c.id===selId?"bg-blue-50/50":""}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 truncate max-w-48">{countryFlag(c.segment)} {c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.csm==="Sin asignar"?"⚠ "+c.csm:c.csm} · {c.segment}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-6">{h}</span>
                    <div className="w-14"><HealthBar score={h}/></div>
                  </div>
                </td>
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

function DeepDive({client:c,onBack}){
  const[tab,setTab]=useState("resumen");
  const h=calcHealth(c);const cat=adoptCat(h);
  const flag=countryFlag(c.segment);
  const mt=(c.owners>0?1:0)+(c.sAdmins>0?1:0)+(c.admins>0?1:0)+(c.agents>0?1:0);
  const trendData=c.trend.map((v,i)=>({week:`S${i+1}`,conv:num(v)}));
  const convoText=c.convoLimit?`${c.totalConvos.toLocaleString()} / ${c.convoLimit.toLocaleString()}`:`${c.totalConvos.toLocaleString()}`;
  const radarData=[
    {m:"Convos",v:Math.min(c.totalConvos/5000*100,100)},{m:"NPS",v:c.npsG!==null?c.npsG*10:50},
    {m:"Multi-thread",v:mt*25},{m:"Usuarios",v:Math.min(c.totalUsers/50*100,100)},
    {m:"Tendencia",v:Math.min(Math.max(50+c.convoPct,0),100)},{m:"Pago",v:c.payStatus==="Al día"?100:c.payStatus==="Pendiente"?50:0}
  ];
  const dx=h>=70&&(c.npsG===null||c.npsG>=7)?{l:"Estable / Expansión",cl:"text-emerald-700 bg-emerald-50 border-emerald-200",I:TrendingUp,d:"Buena adopción. Oportunidad de upsell o caso de éxito."}
    :h>=45?{l:"Monitorear",cl:"text-amber-700 bg-amber-50 border-amber-200",I:Activity,d:"Uso moderado. Profundizar adopción y engagement."}
    :{l:"Riesgo — Acción Inmediata",cl:"text-red-700 bg-red-50 border-red-200",I:AlertTriangle,d:"Baja adopción o señales negativas. Intervención urgente."};
  const tabs=[{id:"resumen",l:"Resumen"},{id:"nps",l:"NPS"},{id:"uso",l:"Uso & Convos"},{id:"equipo",l:"Equipo"}];

  return(
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} className="text-gray-600"/></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{flag} {c.name}</h1>
            <Badge type={cat} tooltip={cat==="Power User"?"Alta adopción y uso consistente":cat==="Underutilizer"?"Uso por debajo del potencial":"Requiere intervención urgente del CSM"}>{cat}</Badge>
          </div>
          <p className="text-sm text-gray-500">{c.plan} · {c.segment} · CSM: {c.teamMembers}</p>
        </div>
        <a href={c.backofficeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-2"><ExternalLink size={12}/>Backoffice</a>
        <Tip text="Health Score 0–100: combina conversaciones, NPS, equipo, tendencia y estado de pago">
          <div className="text-right cursor-default">
            <div className={`text-3xl font-black ${h>=70?"text-emerald-600":h>=45?"text-amber-500":"text-red-600"}`}>{h}</div>
            <p className="text-xs text-gray-400">Health</p>
          </div>
        </Tip>
      </div>

      <div className={`rounded-xl border p-4 flex items-start gap-3 ${dx.cl}`}><dx.I size={20} className="mt-0.5 flex-shrink-0"/><div><p className="font-semibold text-sm">{dx.l}</p><p className="text-xs mt-1 opacity-80">{dx.d}</p></div></div>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-colors ${tab===t.id?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>{t.l}</button>)}</div>

      {tab==="resumen"&&<div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI icon={DollarSign} label="MRR" value={`$${c.mrr.toLocaleString()}`} sub={`Factura: ${c.billDate}`} color="text-blue-600" tooltip="Monthly Recurring Revenue: ingreso mensual del cliente"/>
          <KPI icon={Shield} label="Pago" value={c.payStatus} sub={c.failedPayments>0?`${c.failedPayments} intentos fallidos`:c.plan} color={c.payStatus==="Al día"?"text-emerald-600":"text-red-600"} tooltip="Estado del pago mensual del cliente"/>
          <KPI icon={MessageSquare} label="Convos (4 sem)" value={convoText} delta={c.convoPct} deltaSuffix="%" color="text-cyan-600" tooltip={c.convoLimit?"Conversaciones usadas / límite del plan en las últimas 4 semanas":"Total de conversaciones procesadas en las últimas 4 semanas"}/>
          <KPI icon={Users} label="Usuarios Totales" value={c.totalUsers} sub={`${c.daysInVambe} días en Vambe`} color="text-violet-600" tooltip="Número de usuarios activos en la cuenta"/>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Tip text="Visualización multidimensional de la salud del cliente en 6 ejes">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 cursor-default">Radar de Salud</h3>
            </Tip>
            <ResponsiveContainer width="100%" height={220}><RadarChart data={radarData}><PolarGrid stroke="#e5e7eb"/><PolarAngleAxis dataKey="m" tick={{fontSize:10,fill:"#6b7280"}}/><PolarRadiusAxis angle={30} domain={[0,100]} tick={false}/><Radar dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2}/></RadarChart></ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Tip text="Evolución de conversaciones semana a semana en las últimas 8 semanas">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 cursor-default">Tendencia Conversaciones (8 sem)</h3>
            </Tip>
            <ResponsiveContainer width="100%" height={220}><AreaChart data={trendData}><XAxis dataKey="week" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Area type="monotone" dataKey="conv" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2}/></AreaChart></ResponsiveContainer>
          </div>
        </div>
      </div>}

      {tab==="nps"&&<div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <Tip text="Net Promoter Score global de la cuenta (0–10). 8–10: Promotor, 6–7: Neutro, 0–5: Detractor">
              <h3 className="text-sm font-semibold text-gray-700 cursor-default">NPS Global</h3>
            </Tip>
            <div className="text-right">
              <div className={`text-2xl font-black ${c.npsG===null?"text-gray-300":c.npsG>=8?"text-emerald-600":c.npsG>=6?"text-amber-500":"text-red-600"}`}>{c.npsG!==null?c.npsG:"Sin datos"}</div>
              {c.npsPrev!==null&&<Delta value={c.npsG-c.npsPrev} suffix=" pts" size="xs"/>}
            </div>
          </div>
          {c.npsG===null?<p className="text-sm text-gray-400 py-4">Este cliente aún no ha respondido la encuesta NPS.</p>
          :<div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-700">Score: {c.npsG}/10</p><p className="text-xs text-gray-500 mt-1">Prev: {c.npsPrev!==null?c.npsPrev:"Primera respuesta"}</p></div>}
        </div>
        {c.npsComments.length>0&&<div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Comentarios</h3>
          <div className="space-y-2">{c.npsComments.map((cm,i)=><div key={i} className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-700">"{cm}"</p></div>)}</div>
        </div>}
      </div>}

      {tab==="uso"&&<div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI icon={MessageSquare} label="Convos (4 sem)" value={convoText} delta={c.convoPct} deltaSuffix="%" color="text-blue-600" tooltip={c.convoLimit?"Usadas / límite del plan":"Total de conversaciones en las últimas 4 semanas"}/>
          <KPI icon={Activity} label="Prom Semanal" value={Math.round(c.avg4).toLocaleString()} sub={`Prev: ${Math.round(c.avgP4).toLocaleString()}`} color="text-cyan-600" tooltip="Promedio de conversaciones por semana en las últimas 4 semanas vs las 4 anteriores"/>
          <KPI icon={Clock} label="Días en Vambe" value={c.daysInVambe} color="text-violet-600" tooltip="Días desde que el cliente activó su cuenta en Vambe"/>
          <KPI icon={Globe} label="País" value={`${flag} ${c.segment}`} sub={c.clientSize} color="text-gray-600" tooltip="País de operación del cliente"/>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <Tip text="Número de conversaciones procesadas cada semana durante las últimas 8 semanas">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 cursor-default">Conversaciones por Semana</h3>
          </Tip>
          <ResponsiveContainer width="100%" height={250}><BarChart data={trendData}><XAxis dataKey="week" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Bar dataKey="conv" fill="#6366f1" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
        </div>
      </div>}

      {tab==="equipo"&&<div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <Tip text="Multi-threading: qué tan distribuido está el uso entre distintos roles. Más roles activos = menor riesgo de dependencia de una sola persona">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 cursor-default">Multi-threading Score</h3>
          </Tip>
          <div className="grid grid-cols-4 gap-3">
            {[
              {r:"Owner",v:c.owners,tip:"Dueños de la cuenta con acceso total"},
              {r:"Super Admin",v:c.sAdmins,tip:"Administradores con permisos avanzados"},
              {r:"Admin",v:c.admins,tip:"Administradores estándar"},
              {r:"Agente",v:c.agents,tip:"Usuarios que operan conversaciones"}
            ].map(ct=>(
              <Tip key={ct.r} text={ct.tip}>
                <div className={`p-3 rounded-lg border text-center cursor-default w-full ${ct.v>0?"bg-blue-50 border-blue-200":"bg-gray-50 border-gray-200"}`}>
                  <p className="text-lg font-bold text-gray-800">{ct.v}</p><p className="text-xs text-gray-500">{ct.r}</p>
                </div>
              </Tip>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">{mt}/4 roles activos · {c.totalUsers} usuarios totales. {mt<3?"⚠ Riesgo de concentración.":"✓ Buena cobertura."}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Equipo Vambe</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">CSM / Success:</span><span className="font-medium">{c.teamMembers}</span></div>
            {c.onboarder&&<div className="flex justify-between text-sm"><span className="text-gray-500">Onboarder:</span><span className="font-medium">{c.onboarder}</span></div>}
            {c.seller&&<div className="flex justify-between text-sm"><span className="text-gray-500">Seller:</span><span className="font-medium">{c.seller}</span></div>}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Contacto del Cliente</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Email:</span><span className="font-medium">{c.email}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Teléfono:</span><span className="font-medium">{c.phone}</span></div>
          </div>
        </div>
      </div>}
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
      <div className="max-w-6xl mx-auto">
        {detail?<DeepDive client={detail} onBack={()=>setDetail(null)}/>
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
