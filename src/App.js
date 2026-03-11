import React, { useState, useMemo, useEffect, useCallback } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { Users, AlertTriangle, ArrowLeft, DollarSign, Activity, MessageSquare, ArrowUpRight, ArrowDownRight, Minus, RefreshCw, ExternalLink } from "lucide-react";
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

// Country-based color themes for the left panel header
const countryTheme = seg => {
  const themes = {
    'Chile':              { header:'bg-red-700',    dot:'bg-red-400'   },
    'México':             { header:'bg-green-700',  dot:'bg-green-400' },
    'Mexico':             { header:'bg-green-700',  dot:'bg-green-400' },
    'Argentina':          { header:'bg-sky-700',    dot:'bg-sky-400'   },
    'Colombia':           { header:'bg-yellow-600', dot:'bg-yellow-300'},
    'Perú':               { header:'bg-red-800',    dot:'bg-red-400'   },
    'Peru':               { header:'bg-red-800',    dot:'bg-red-400'   },
    'Brasil':             { header:'bg-green-600',  dot:'bg-green-300' },
    'Uruguay':            { header:'bg-blue-600',   dot:'bg-blue-300'  },
    'España':             { header:'bg-orange-600', dot:'bg-orange-300'},
    'Venezuela':          { header:'bg-red-600',    dot:'bg-red-300'   },
    'Ecuador':            { header:'bg-yellow-500', dot:'bg-yellow-300'},
    'Bolivia':            { header:'bg-red-700',    dot:'bg-red-400'   },
    'Paraguay':           { header:'bg-red-700',    dot:'bg-red-400'   },
    'Costa Rica':         { header:'bg-blue-700',   dot:'bg-blue-400'  },
    'Panamá':             { header:'bg-blue-600',   dot:'bg-blue-300'  },
    'Guatemala':          { header:'bg-blue-700',   dot:'bg-blue-400'  },
  };
  return themes[seg] || { header:'bg-indigo-700', dot:'bg-indigo-400' };
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
  return<span className={`${sz} font-medium flex items-center gap-0.5 ${pos?"text-emerald-400":"text-red-400"}`}>{pos?<ArrowUpRight size={size==="xs"?10:12}/>:<ArrowDownRight size={size==="xs"?10:12}/>}{v>0?"+":""}{typeof value==='number'?value.toFixed(1):value}{suffix}</span>;
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

// Metric block for the left sidebar
const Block=({label,value,sub,extra,tooltip})=>(
  <Tip text={tooltip}>
    <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 cursor-default w-full">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
      {sub&&<p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {extra&&<div className="mt-0.5">{extra}</div>}
    </div>
  </Tip>
);

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

// ─── NPS helpers ─────────────────────────────────────────────────────────────
function filterNPSByPeriod(entries,period){
  if(!entries||!entries.length)return{current:[],previous:[]};
  const now=new Date();
  let cutCurrent,cutPrev;
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
  return{
    current:entries.filter(e=>new Date(e.date)>=cutCurrent),
    previous:entries.filter(e=>new Date(e.date)>=cutPrev&&new Date(e.date)<cutCurrent),
  };
}

function NPSSection({client:c}){
  const[npsRole,setNpsRole]=useState("global");
  const[npsPeriod,setNpsPeriod]=useState("mes");
  const npsByRole=c.nps?.byRole||{};
  const roleEntries={global:[],owner:npsByRole.owner||[],superAdmin:npsByRole.superAdmin||[],admin:npsByRole.admin||[],agent:npsByRole.agent||[]};
  const npsRoles=[{id:"global",label:"Global"},{id:"owner",label:"Owner"},{id:"superAdmin",label:"Super Admin"},{id:"admin",label:"Admin"},{id:"agent",label:"Agente"}];
  const periodLabels={hoy:"hoy",semana:"esta semana",mes:"este mes","año":"este año"};
  const{current:filteredCurrent,previous:filteredPrev}=filterNPSByPeriod(roleEntries[npsRole],npsPeriod);
  const last10=filteredCurrent.slice(-10).reverse();
  const avgCurrent=filteredCurrent.length?(filteredCurrent.reduce((s,e)=>s+num(e.score),0)/filteredCurrent.length):null;
  const avgPrev=filteredPrev.length?(filteredPrev.reduce((s,e)=>s+num(e.score),0)/filteredPrev.length):null;
  const npsDelta=(avgCurrent!==null&&avgPrev!==null)?avgCurrent-avgPrev:null;

  return(
    <div className="bg-white rounded-xl border border-gray-200 p-5">
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

      {/* Global big + role pills */}
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
          <p className="text-xs text-gray-400 mb-2">Filtrar por rol</p>
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

      {/* Content */}
      {npsRole==="global"?(
        <div>
          {c.npsG===null
            ?<p className="text-sm text-gray-400 py-4 text-center">Sin datos de NPS para esta cuenta.</p>
            :<div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                <p className="text-sm text-gray-700">Score: <span className="font-bold">{c.npsG}/10</span></p>
                {c.npsPrev!==null&&<p className="text-xs text-gray-400">Anterior: {c.npsPrev}</p>}
              </div>
              {c.npsComments.length>0&&<div className="space-y-2 mt-3">
                <p className="text-xs font-medium text-gray-500">Comentarios recientes</p>
                {c.npsComments.slice(0,5).map((cm,i)=>(
                  <div key={i} className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-700">"{cm}"</p></div>
                ))}
              </div>}
            </div>
          }
        </div>
      ):(
        <div>
          {roleEntries[npsRole].length===0?(
            <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
              <p className="text-sm text-gray-400">Sin respuestas de {npsRoles.find(r=>r.id===npsRole)?.label} en {periodLabels[npsPeriod]}.</p>
              <p className="text-xs text-gray-300 mt-1.5">Requiere campo <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">nps.byRole.{npsRole}</code> en el webhook</p>
            </div>
          ):(
            <div className="space-y-3">
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
                  {avgPrev!==null&&<p className="text-xs text-gray-300">Anterior: {avgPrev.toFixed(1)}</p>}
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500">Últimas {Math.min(last10.length,10)} entradas</p>
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

// ─── Combined charts section ─────────────────────────────────────────────────
function ChartsSection({client:c}){
  const[activeChart,setActiveChart]=useState("conversaciones");
  const trendData=c.trend.map((v,i)=>({week:`S${i+1}`,conv:num(v)}));
  const charts=[
    {id:"conversaciones",label:"Conversaciones"},
    {id:"logins",label:"Logins"},
    {id:"funciones",label:"Tasa de Éxito"},
  ];
  return(
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Horizontal selector */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-5">
        {charts.map(ch=>(
          <button key={ch.id} onClick={()=>setActiveChart(ch.id)}
            className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-colors whitespace-nowrap ${activeChart===ch.id?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
            {ch.label}
          </button>
        ))}
      </div>

      {activeChart==="conversaciones"&&(
        <div>
          <Tip text="Evolución del número de conversaciones semana a semana en las últimas 8 semanas">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 cursor-default">Tendencia de conversaciones (8 semanas)</p>
          </Tip>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Tip text="Total de conversaciones procesadas en las últimas 4 semanas">
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 cursor-default w-full">
                <p className="text-xs text-gray-400">Conversaciones (4 sem)</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{c.convoLimit?`${c.totalConvos.toLocaleString()} / ${c.convoLimit.toLocaleString()}`:c.totalConvos.toLocaleString()}</p>
                <Delta value={c.convoPct} suffix="%" size="xs"/>
              </div>
            </Tip>
            <Tip text="Promedio de conversaciones por semana en las últimas 4 semanas">
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 cursor-default w-full">
                <p className="text-xs text-gray-400">Prom. semanal</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{Math.round(c.avg4).toLocaleString()}</p>
                <p className="text-xs text-gray-400">Ant: {Math.round(c.avgP4).toLocaleString()}</p>
              </div>
            </Tip>
            <Tip text="Variación porcentual vs las 4 semanas anteriores">
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 cursor-default w-full">
                <p className="text-xs text-gray-400">Variación</p>
                <div className="mt-0.5"><Delta value={c.convoPct} suffix="%" size="sm"/></div>
              </div>
            </Tip>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <XAxis dataKey="week" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip/>
              <Area type="monotone" dataKey="conv" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeChart==="logins"&&(
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Logins</p>
          <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-xl">
            <span className="text-3xl mb-2 block">🔐</span>
            <p className="text-sm text-gray-400">Sin datos de logins disponibles aún.</p>
            <p className="text-xs text-gray-300 mt-2">Requiere campo <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">logins</code> en el webhook</p>
            <p className="text-xs text-gray-300 mt-1">Ej: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">{'{"daily":12,"weekly":54,"monthly":210}'}</code></p>
          </div>
        </div>
      )}

      {activeChart==="funciones"&&(
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Tasa de Éxito de Funciones</p>
          <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-xl">
            <span className="text-3xl mb-2 block">⚙️</span>
            <p className="text-sm text-gray-400">Sin datos de funciones disponibles aún.</p>
            <p className="text-xs text-gray-300 mt-2">Requiere campos <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">functions.total</code> y <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">functions.successRate</code></p>
            <p className="text-xs text-gray-300 mt-1">Ej: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">{'{"total":340,"successRate":94.2}'}</code></p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DeepDive ────────────────────────────────────────────────────────────────
function DeepDive({client:c,onBack}){
  const h=calcHealth(c);
  const cat=adoptCat(h);
  const flag=countryFlag(c.segment);
  const theme=countryTheme(c.segment);
  const convoText=c.convoLimit?`${c.totalConvos.toLocaleString()} / ${c.convoLimit.toLocaleString()}`:c.totalConvos.toLocaleString();

  return(
    <div className="space-y-4">
      {/* Minimal back bar */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"><ArrowLeft size={18} className="text-gray-600"/></button>
        <span className="text-sm text-gray-400">Volver al portfolio</span>
        <div className="flex-1"/>
        <a href={c.backofficeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-2"><ExternalLink size={12}/>Backoffice</a>
      </div>

      {/* 4-column grid: 1/4 sidebar + 3/4 content */}
      <div className="grid grid-cols-4 gap-4 items-start">

        {/* ── LEFT SIDEBAR 1/4 ── */}
        <div className="col-span-1 space-y-3">

          {/* Colored header block: country color, name, health, badges */}
          <div className={`${theme.header} rounded-xl overflow-hidden`}>
            {/* Country strip */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{flag}</span>
                <Tip text="Health Score 0–100: combina conversaciones, NPS, equipo, tendencia y pago">
                  <div className="text-right cursor-default">
                    <span className={`text-3xl font-black text-white`}>{h}</span>
                    <p className="text-xs text-white/60 leading-none">hs</p>
                  </div>
                </Tip>
              </div>
              <p className="text-white/70 text-xs font-medium mb-1">{flag} {c.segment}</p>
              <h2 className="text-white font-bold text-base leading-tight">{c.name}</h2>
            </div>
            {/* Badges */}
            <div className="px-4 pb-4 flex flex-wrap gap-1.5">
              <Badge type={cat} tooltip={cat==="Power User"?"Alta adopción y uso consistente":cat==="Underutilizer"?"Uso por debajo del potencial":"Requiere intervención urgente del CSM"}>{cat}</Badge>
              <Badge type={c.payStatus} tooltip="Estado del pago mensual">{c.payStatus}</Badge>
            </div>
          </div>

          {/* Data blocks */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Cliente</p>
            {c.ownerEmail&&<Block label="Email Owner" value={c.ownerEmail} tooltip="Email del dueño principal de la cuenta"/>}
            <Block label="MRR" value={`$${c.mrr.toLocaleString()}`} sub={`${c.plan} · Factura: ${c.billDate}`} tooltip="Monthly Recurring Revenue mensual"/>
            <Block label="Días en Vambe" value={`${c.daysInVambe} días`} tooltip="Días desde la activación de la cuenta"/>
            <Block label="Usuarios" value={`${c.totalUsers} activos`} tooltip="Usuarios activos registrados en la cuenta"/>
            <Block
              label="Conversaciones (4 sem)"
              value={convoText}
              extra={<Delta value={c.convoPct} suffix="%" size="xs"/>}
              tooltip={c.convoLimit?"Usadas / límite del plan en las últimas 4 semanas":"Total procesadas en las últimas 4 semanas"}
            />
            {c.npsG!==null&&<Block
              label="NPS Global"
              value={`${c.npsG}/10`}
              extra={c.npsPrev!==null?<Delta value={c.npsG-c.npsPrev} suffix=" pts" size="xs"/>:null}
              tooltip="Net Promoter Score global de la cuenta"
            />}
          </div>

          {/* Equipo Vambe */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Equipo Vambe</p>
            <Block label="Success / CSM" value={c.teamMembers} tooltip="Customer Success Manager asignado a la cuenta"/>
            {c.onboarder&&<Block label="Onboarder" value={c.onboarder} tooltip="Responsable del proceso de onboarding"/>}
            {c.seller&&<Block label="Seller" value={c.seller} tooltip="Ejecutivo de ventas que cerró la cuenta"/>}
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Contacto</p>
            {c.email&&<Block label="Email" value={c.email}/>}
            {c.phone&&<Block label="Teléfono" value={c.phone}/>}
            {!c.email&&!c.phone&&<p className="text-xs text-gray-400 px-1">Sin datos de contacto</p>}
          </div>
        </div>

        {/* ── RIGHT CONTENT 3/4 ── */}
        <div className="col-span-3 space-y-4">
          <NPSSection client={c}/>
          <ChartsSection client={c}/>
        </div>
      </div>
    </div>
  );
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
function Portfolio({clients,onDetail,csm,setCsm,csmList,selId,setSelId}){
  const[sortBy,setSortBy]=useState("risk");
  const csmClients=useMemo(()=>csm==="Todos"?clients:clients.filter(c=>(c.teamMembers||'').toLowerCase().includes(csm.toLowerCase())),[clients,csm]);
  const p=csmClients;
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
    {name:"Critical Support",count:p.filter(c=>adoptCat(calcHealth(c))==="Critical Support").length,color:"#ef4444"},
  ];

  return(
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{p.length} cuentas · {csm==="Todos"?"Todos los CSMs":csm}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={csm} onChange={e=>{setCsm(e.target.value);setSelId(null);}} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="Todos">Todos los CSMs</option>
          {csmList.map(c=><option key={c} value={c}>{c}</option>)}
          <option value="Sin asignar">Sin asignar</option>
        </select>
        <div className="h-6 w-px bg-gray-200"/>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {p.slice(0,25).map(c=>{const h=calcHealth(c);return(
            <button key={c.id} onClick={()=>onDetail(c)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border bg-white text-gray-700 ${h>=70?"border-emerald-300 hover:bg-emerald-50":h>=45?"border-amber-300 hover:bg-amber-50":"border-red-300 hover:bg-red-50"}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${h>=70?"bg-emerald-500":h>=45?"bg-amber-500":"bg-red-500"}`}/>
              {countryFlag(c.segment)} {c.name}
            </button>
          );})}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI icon={Activity} label="Health Promedio" value={`${avgH}/100`} color="text-emerald-600" tooltip="Promedio del Health Score. 70+ verde, 45–69 amarillo, <45 rojo"/>
        <KPI icon={DollarSign} label="MRR Total" value={`$${totalMRR.toLocaleString()}`} sub={`${p.length} cuentas`} color="text-blue-600" tooltip="Monthly Recurring Revenue total del portfolio"/>
        <KPI icon={AlertTriangle} label="Revenue at Risk" value={`$${rar.toLocaleString()}`} sub={`${atRisk.length} cuentas`} color="text-red-600" tooltip="MRR de clientes con Health Score menor a 45"/>
        <KPI icon={MessageSquare} label="NPS Promedio" value={avgNPS} sub={`${npsClients.length} respuestas`} color="text-violet-600" tooltip="Net Promoter Score promedio del portfolio"/>
        <KPI icon={Users} label="Sin CSM" value={noCSM.length} sub={`$${noCSM.reduce((s,c)=>s+c.mrr,0).toLocaleString()} MRR`} color="text-amber-600" tooltip="Cuentas sin Customer Success Manager asignado"/>
      </div>

      {/* Alerts + Adoption */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Clientes ({sorted.length})</h3>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="risk">Mayor riesgo</option>
            <option value="convoDrop">Mayor caída</option>
            <option value="mrr">Mayor MRR</option>
          </select>
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
              <tr key={c.id} onClick={()=>onDetail(c)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
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

// ─── App ──────────────────────────────────────────────────────────────────────
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
          ?<DeepDive client={detail} onBack={()=>{setDetail(null);setSelId(null);}}/>
          :<Portfolio clients={clients} onDetail={c=>{setDetail(c);setSelId(c.id);}} csm={csm} setCsm={setCsm} csmList={csmList} selId={selId} setSelId={setSelId}/>}
        <div className="flex items-center justify-center gap-4 mt-6">
          <p className="text-xs text-gray-300">Generado: {data?.summary?.generatedAt?new Date(data.summary.generatedAt).toLocaleString('es-CL'):'—'}</p>
          <button onClick={()=>{setDetail(null);setSelId(null);fetchData();}} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><RefreshCw size={10}/>Refrescar</button>
        </div>
      </div>
    </div>
  );
}

export default App;
