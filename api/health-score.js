import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } 
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const indexQuery = `
      WITH all_clients AS (
        SELECT sv.client_id, sv.current_mrr, sv.first_payment_at, sv.category AS plan_category,
          u.email, CONCAT_WS(' ', u.first_name, u.last_name) AS client_name,
          COALESCE(NULLIF(u.phone, ''), 'N/A') AS client_phone, ctm.client_origin_country,
          ctm.success_transition_date, ctm.client_size, ctm.industry,
          ctm.client_business_vertical AS vertical, ctm.is_in_success
        FROM subscription_v2 sv
        JOIN "user" u ON sv.client_id = u.id
        JOIN client_team_management ctm ON sv.client_id = ctm.client_id
        WHERE sv.is_active = TRUE AND sv.canceled_at IS NULL AND sv.category NOT IN ('FREE', 'FREE_TRIAL', 'IRIS')
      ),
      loyalty AS (
        SELECT DISTINCT ON (client_id) client_id, new_value AS loyalty_index, reason AS loyalty_reason, created_at AS loyalty_date
        FROM client_health_metric_history
        WHERE metric_id = 'b0ea51e1-0c8f-4c61-a0cf-ab9a8fccc33d'
        ORDER BY client_id, created_at DESC
      ),
      csat_ob AS (
        SELECT DISTINCT ON (group_id) group_id AS client_id, score AS csat_ob_score, responded_at AS csat_ob_date
        FROM survey_response
        WHERE survey_id = '71d6bcb9-9aae-4351-b9ad-b75afb799ad2' AND group_id IS NOT NULL AND group_id != ''
        ORDER BY group_id, responded_at DESC
      ),
      nps_scores AS (
        SELECT DISTINCT ON (group_id) group_id AS client_id, score AS nps_score, responded_at AS nps_date
        FROM survey_response
        WHERE survey_id = '12b66d33-8f91-4b7b-8789-26d1e49de98d' AND group_id IS NOT NULL AND group_id != ''
        ORDER BY group_id, responded_at DESC
      ),
      mrr_inicial AS (
        SELECT DISTINCT ON (client_id) client_id, amount AS first_mrr
        FROM subscription_history
        WHERE type = 'CREATED' AND new_category NOT IN ('FREE', 'FREE_TRIAL', 'IRIS')
        ORDER BY client_id, created_at ASC
      ),
      churn_history AS (
        SELECT client_id, COUNT(*) AS veces_churneado
        FROM subscription_history
        WHERE type = 'CANCELED' AND new_category = 'FREE'
        GROUP BY client_id
      ),
      morosidad AS (
        SELECT sub.client_id, MAX(spa.created_at) AS ultima_factura_morosa,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(spa.created_at))) / 86400) AS dias_morosidad
        FROM subscription_payment_activity spa
        JOIN subscription_v2 sub ON spa.subscription_id = sub.id
        WHERE spa.status IN ('FAILED', 'SUSPENDED')
        GROUP BY sub.client_id
      ),
      cs_team AS (
        SELECT ctm.client_id,
          STRING_AGG(DISTINCT COALESCE(u_bo.first_name || ' ' || u_bo.last_name, 'Sin asignar'), ' / ') AS team_members,
          MIN(u_bo.email) AS csm_email, MIN(u_bo.first_name || ' ' || u_bo.last_name) AS csm_name
        FROM client_team_management ctm
        LEFT JOIN client_team_management_backoffice_allowed_user ctm_bau ON ctm_bau.client_team_management_id = ctm.id
        LEFT JOIN backoffice_allowed_user bau ON bau.id = ctm_bau.backoffice_allowed_user_id
        LEFT JOIN "user" u_bo ON u_bo.id = bau.user_id
        GROUP BY ctm.client_id
      )
      SELECT ac.client_id, ac.client_name, ac.email, ac.client_phone, COALESCE(ac.client_origin_country, 'Sin país') AS country,
        ac.plan_category, ac.current_mrr, ac.client_size, ac.industry, ac.vertical, ac.is_in_success, ac.first_payment_at,
        loy.loyalty_index, loy.loyalty_reason, loy.loyalty_date, cob.csat_ob_score, cob.csat_ob_date, ns.nps_score, ns.nps_date,
        mi.first_mrr, ROUND((ac.current_mrr - COALESCE(mi.first_mrr, ac.current_mrr))::numeric, 2) AS mrr_var,
        CASE WHEN mor.client_id IS NOT NULL THEN TRUE ELSE FALSE END AS es_moroso,
        COALESCE(mor.dias_morosidad, 0) AS dias_morosidad, COALESCE(ch.veces_churneado, 0) AS cant_churn,
        cst.team_members, cst.csm_name, cst.csm_email
      FROM all_clients ac
      LEFT JOIN loyalty loy       ON ac.client_id = loy.client_id
      LEFT JOIN csat_ob cob       ON ac.client_id = cob.client_id
      LEFT JOIN nps_scores ns     ON ac.client_id = ns.client_id
      LEFT JOIN mrr_inicial mi    ON ac.client_id = mi.client_id
      LEFT JOIN churn_history ch  ON ac.client_id = ch.client_id
      LEFT JOIN morosidad mor     ON ac.client_id = mor.client_id
      LEFT JOIN cs_team cst       ON ac.client_id = cst.client_id
      WHERE ac.is_in_success = TRUE
      ORDER BY ac.current_mrr DESC;
    `;

    const momentumQuery = `
      WITH latest_active_sub AS (
        SELECT DISTINCT ON (s.client_id) s.client_id, s.id AS subscription_id, s.category AS subscription_category, s.current_mrr
        FROM subscription_v2 s
        WHERE s.is_active = TRUE AND s.canceled_at IS NULL AND s.category NOT IN ('FREE', 'FREE_TRIAL', 'IRIS')
        ORDER BY s.client_id, s.updated_at DESC NULLS LAST, s.created_at DESC
      ),
      conv_limit AS (
        SELECT DISTINCT ON (siv.subscription_id) siv.subscription_id, siv.included_amount AS conversations_limit
        FROM subscription_item_v2 siv
        WHERE siv.type = 'CONVERSATIONS'
        ORDER BY siv.subscription_id, siv.created_at DESC
      ),
      period_recent AS (
        SELECT client_id, SUM(total_conversations) AS convs_recent
        FROM conversation_history
        WHERE period_type = 'daily' AND date::date > CURRENT_DATE - INTERVAL '30 days' AND date::date <= CURRENT_DATE
        GROUP BY client_id
      ),
      period_prev AS (
        SELECT client_id, SUM(total_conversations) AS convs_prev
        FROM conversation_history
        WHERE period_type = 'daily' AND date::date > CURRENT_DATE - INTERVAL '45 days' AND date::date <= CURRENT_DATE - INTERVAL '15 days'
        GROUP BY client_id
      ),
      last_paid AS (
        SELECT subscription_id, MAX(created_at) AS last_paid_at
        FROM subscription_payment_activity
        WHERE status = 'PAID'
        GROUP BY subscription_id
      ),
      pago_rechazado AS (
        SELECT DISTINCT sub.client_id
        FROM subscription_payment_activity spa
        JOIN subscription_v2 sub ON sub.id = spa.subscription_id
        LEFT JOIN last_paid lp ON lp.subscription_id = spa.subscription_id
        WHERE spa.status = 'FAILED' AND (lp.last_paid_at IS NULL OR spa.created_at > lp.last_paid_at)
      ),
      csat_vambe AS (
        SELECT las.client_id, ROUND(AVG(tf.value)::numeric, 2) AS csat_vambe_30d, COUNT(tf.id) AS csat_respuestas_30d
        FROM ticket_feedback tf
        JOIN ticket_v2 tv ON tv.id = tf.ticket_id
        JOIN stage s ON s.id = tv.current_stage_id
        JOIN ai_contact ac ON ac.id = tv.ai_contact_id
        JOIN (
          SELECT DISTINCT ON (client_id) client_id, id AS subscription_id
          FROM subscription_v2
          WHERE is_active = TRUE AND canceled_at IS NULL AND category NOT IN ('FREE', 'FREE_TRIAL', 'IRIS')
          ORDER BY client_id, updated_at DESC
        ) las ON las.client_id = (
          SELECT u.id FROM "user" u WHERE regexp_replace(u.phone, '\\D', '', 'g') = ac.platform_contact_unique_id AND u.email NOT ILIKE '%vambe%' ORDER BY u.created_at ASC LIMIT 1
        )
        WHERE s.pipeline_id = '0e2dbc8f-9bbb-4175-9b82-5b1a2a60998a' AND tf.type = 'csat' AND tf.responded_at >= CURRENT_DATE - INTERVAL '30 days' AND tf.responded_at IS NOT NULL
        GROUP BY las.client_id
      )
      SELECT las.client_id, ROUND(COALESCE(pr.convs_recent, 0)::numeric / NULLIF(cl.conversations_limit, 0), 2) AS proyeccion_sobre_limite,
        CASE WHEN COALESCE(pp.convs_prev, 0) < 10 THEN NULL ELSE ROUND(LEAST(GREATEST((COALESCE(pr.convs_recent, 0) - COALESCE(pp.convs_prev, 0))::numeric / pp.convs_prev * 100, -100), 500), 1) END AS variacion_pct,
        CASE WHEN rp.client_id IS NOT NULL THEN 1 ELSE 0 END AS pago_rechazado,
        cv.csat_vambe_30d, cv.csat_respuestas_30d
      FROM latest_active_sub las
      JOIN "user" u ON u.id = las.client_id
      LEFT JOIN client_team_management ctm ON ctm.client_id = las.client_id
      LEFT JOIN conv_limit cl ON cl.subscription_id = las.subscription_id
      LEFT JOIN period_recent pr ON pr.client_id = las.client_id
      LEFT JOIN period_prev pp ON pp.client_id = las.client_id
      LEFT JOIN pago_rechazado rp ON rp.client_id = las.client_id
      LEFT JOIN csat_vambe cv ON cv.client_id = las.client_id
      WHERE ctm.is_in_success = TRUE AND las.subscription_id IS NOT NULL
      ORDER BY proyeccion_sobre_limite DESC NULLS LAST;
    `;

    const [indexRes, momentumRes, phRes] = await Promise.all([
      pool.query(indexQuery),
      pool.query(momentumQuery),
      fetch('https://us.posthog.com/api/projects/118801/query', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': 'Bearer phx_L7UveXqJHqNCC6G5TSMQscoARNxkVnwvXpRwEsNfy4BCzEG3'
        },
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: "WITH daily_30 AS (SELECT person.properties.group_id AS group_id, toDate(timestamp) AS activity_date FROM events WHERE event = '$pageview' AND person.properties.group_id IS NOT NULL AND person.properties.group_id != '' AND NOT endsWith(person.properties.email, '@vambe.ai') AND properties.$pathname = '/pipeline' AND timestamp >= today() - toIntervalDay(30) GROUP BY person.properties.group_id, activity_date), last_use AS (SELECT person.properties.group_id AS group_id, dateDiff('day', max(toDate(timestamp)), today()) AS days_since_last_use FROM events WHERE event = '$pageview' AND person.properties.group_id IS NOT NULL AND person.properties.group_id != '' AND NOT endsWith(person.properties.email, '@vambe.ai') AND properties.$pathname = '/pipeline' AND timestamp >= today() - toIntervalYear(1) GROUP BY person.properties.group_id), summary_30 AS (SELECT group_id, count() AS days_active_last_30 FROM daily_30 GROUP BY group_id) SELECT l.group_id, coalesce(s.days_active_last_30, 0) AS days_active_last_30, l.days_since_last_use FROM last_use l LEFT JOIN summary_30 s ON l.group_id = s.group_id ORDER BY l.days_since_last_use ASC LIMIT 10000"
          },
          name: "pipeline activity last 30 days"
        })
      })
    ]);

    const indexData = indexRes.rows;
    const momentumData = momentumRes.rows;
    const phData = await phRes.json();

    const indexMap  = new Map();
    const momPgMap  = new Map();
    const momPhMap  = new Map();

    indexData.forEach(d => { if (d.client_id) indexMap.set(d.client_id, d); });
    momentumData.forEach(d => { if (d.client_id) momPgMap.set(d.client_id, d); });
    
    if (phData.results && Array.isArray(phData.results)) {
      for (const row of phData.results) {
        const gId = row[0];
        if (gId) {
          momPhMap.set(gId, { group_id: gId, days_active_last_30: row[1], days_since_last_use: row[2] });
        }
      }
    }

    const allClientIds = new Set([...indexMap.keys(), ...momPgMap.keys(), ...momPhMap.keys()]);

    function daysSince(date) {
      if (!date) return Infinity;
      const d = (date instanceof Date) ? date : new Date(date);
      if (isNaN(d.getTime())) return Infinity;
      return Math.floor((Date.now() - d.getTime()) / 86400000);
    }

    function calcIndex(row) {
      if (!row) return { index_score:null, freshness:null, loyalty_value:null, loyalty_reason:null, feedback_value:null, feedback_source:null };
      let loyaltyValue = null;
      const loyaltyRaw = row.loyalty_index;
      if (loyaltyRaw && typeof loyaltyRaw === 'string' && loyaltyRaw.startsWith('L')) {
        loyaltyValue = parseInt(loyaltyRaw.replace('L', ''));
        if (isNaN(loyaltyValue)) loyaltyValue = null;
      }
      const npsVal  = row.nps_score  !== null && row.nps_score  !== '' ? parseFloat(row.nps_score)  : null;
      const csatVal = row.csat_ob_score !== null && row.csat_ob_score !== '' ? parseFloat(row.csat_ob_score) : null;
      const npsDate  = row.nps_date  ? new Date(row.nps_date)  : null;
      const csatDate = row.csat_ob_date ? new Date(row.csat_ob_date) : null;
      let feedbackValue = null, feedbackDate = null, feedbackSource = null;

      if (npsVal !== null && csatVal !== null) {
        if (csatDate && npsDate && csatDate > npsDate) { feedbackValue = csatVal * 2; feedbackDate = csatDate; feedbackSource = 'CSAT Onboarding'; } 
        else { feedbackValue = npsVal; feedbackDate = npsDate; feedbackSource = 'NPS'; }
      } else if (npsVal !== null) { feedbackValue = npsVal; feedbackDate = npsDate; feedbackSource = 'NPS'; } 
        else if (csatVal !== null) { feedbackValue = csatVal * 2; feedbackDate = csatDate; feedbackSource = 'CSAT Onboarding'; }

      let indexScore = null;
      if (loyaltyValue !== null && feedbackValue !== null) indexScore = (loyaltyValue * 2) * 0.6 + feedbackValue * 0.4;
      else if (loyaltyValue !== null) indexScore = loyaltyValue * 2;
      else if (feedbackValue !== null) indexScore = feedbackValue;
      
      if (indexScore !== null) indexScore = Math.round(indexScore * 10) / 10;
      const loyaltyDate = row.loyalty_date ? new Date(row.loyalty_date) : null;
      const mostRecentDate = [loyaltyDate, feedbackDate].filter(d => d && !isNaN(d.getTime())).sort((a,b) => b-a)[0] || null;

      let freshness = null;
      if (mostRecentDate) {
        const dias = daysSince(mostRecentDate);
        if (dias <= 30) freshness = 'verde';
        else if (dias <= 60) freshness = 'amarillo';
        else freshness = 'rojo';
      } else if (indexScore !== null) {
        freshness = 'sin_fecha';
      }

      return { index_score: indexScore, freshness, loyalty_value: loyaltyValue, loyalty_reason: row.loyalty_reason || null, feedback_value: feedbackValue !== null ? Math.round(feedbackValue * 10) / 10 : null, feedback_source: feedbackSource };
    }

    const W_DA = 40/75, W_VA = 20/75, W_PR = 15/75;
    function normDA(x) { return x == null ? 0 : Math.min(x/28, 1.0); }
    function normVA(x) { if (x==null) return 0.5; return 0.5 + 0.5*Math.tanh(Math.max(-50,Math.min(50,x))/25); }
    function normPR(x) { if (x==null) return 0; if (x===0) return 0; if (x<=0.3) return x*0.5; if (x<=0.7) return 0.15+(x-0.3)*(0.45/0.4); if (x<=1.2) return 0.6+(x-0.7)*(0.4/0.5); return 1.0; }
    function penPago(f) { return (f===1||f==='1') ? 0.35 : 1.0; }
    function penDays(d) { if (d==null) return 0.15; if (d===0) return 1; if (d<=2) return 0.95; if (d<=7) return 0.75; if (d<=14) return 0.5; if (d<=30) return 0.3; return 0.15; }

    const MOM_SYM = {5:'↑↑',4:'↑',3:'→',2:'↓',1:'↓↓'};
    const MOM_LBL = {5:'Acelerando fuerte',4:'Creciendo',3:'Estable',2:'Decayendo',1:'Caída crítica'};

    function calcMomentum(pg, ph) {
      if (!pg && !ph) return { momentum_score:null, momentum_symbol:null, momentum_label:null, momentum_raw:null, days_active_30:null, variacion_pct:null, proyeccion_sobre_limite:null, pago_rechazado:0, days_since_last_use:null };
      const vaPct = pg?.variacion_pct != null ? parseFloat(pg.variacion_pct) : null;
      const prLim = pg?.proyeccion_sobre_limite != null ? parseFloat(pg.proyeccion_sobre_limite) : null;
      const pagoR = pg ? pg.pago_rechazado : 0;
      const da30  = ph ? parseInt(ph.days_active_last_30) : null;
      const dslu  = ph ? parseInt(ph.days_since_last_use) : null;

      const base = (normDA(da30)*W_DA) + (normVA(vaPct)*W_VA) + (normPR(prLim)*W_PR);
      const pen  = penPago(pagoR) * penDays(dslu);
      const raw  = base * pen;
      const score = raw>=0.8?5 : raw>=0.6?4 : raw>=0.4?3 : raw>=0.2?2 : 1;

      return { momentum_score: score, momentum_symbol: MOM_SYM[score], momentum_label: MOM_LBL[score], momentum_raw: Math.round(raw*1000)/1000, days_active_30: da30, variacion_pct: vaPct !== null ? Math.round(vaPct*10)/10 : null, proyeccion_sobre_limite: prLim !== null ? Math.round(prLim*100)/100 : null, pago_rechazado: pagoR === 1 || pagoR === '1' ? 1 : 0, days_since_last_use: dslu };
    }

    const PLAN_NAMES = { 'STARTER':'Starter','GROWTH':'Growth','PROFESSIONAL':'Professional', 'ENTERPRISE':'Enterprise','ENTERPRISE_PLUS':'Enterprise Plus' };

    const filterCsm = req.query.csm || null;
    const clients = [];

    for (const clientId of allClientIds) {
      const idxRow = indexMap.get(clientId);
      const pgRow  = momPgMap.get(clientId);
      const phRow  = momPhMap.get(clientId);

      if (!idxRow) continue; 

      const csmName = (idxRow.csm_name || '').trim() || 'Sin asignar';
      if (filterCsm && !csmName.toLowerCase().includes(filterCsm.toLowerCase())) continue;

      const idx = calcIndex(idxRow);
      const mom = calcMomentum(pgRow, phRow);

      clients.push({
        client_id:    clientId,
        client_name:  (idxRow.client_name || '').trim() || idxRow.email,
        email:        idxRow.email,
        phone:        idxRow.client_phone !== 'N/A' ? idxRow.client_phone : null,
        country:      idxRow.country || 'Sin país',
        plan:         PLAN_NAMES[idxRow.plan_category] || idxRow.plan_category,
        plan_category: idxRow.plan_category,
        mrr:          Number(idxRow.current_mrr) || 0,
        client_size:  idxRow.client_size || null,
        industry:     idxRow.industry || null,
        vertical:     idxRow.vertical || null,
        csm:          csmName,
        csm_email:    idxRow.csm_email || null,
        team_members: idxRow.team_members || 'Sin asignar',
        first_mrr:    idxRow.first_mrr ? Number(idxRow.first_mrr) : null,
        mrr_var:      idxRow.mrr_var ? Number(idxRow.mrr_var) : 0,
        es_moroso:    idxRow.es_moroso || false,
        dias_morosidad: Number(idxRow.dias_morosidad) || 0,
        cant_churn:   Number(idxRow.cant_churn) || 0,
        index_score:     idx.index_score,
        freshness:       idx.freshness,
        loyalty_value:   idx.loyalty_value,
        loyalty_reason:  idx.loyalty_reason,
        feedback_value:  idx.feedback_value,
        feedback_source: idx.feedback_source,
        ...mom,
      });
    }

    clients.sort((a, b) => b.mrr - a.mrr);

    const csmSet = new Set(clients.map(c => c.csm).filter(Boolean));
    const csmList = [...csmSet].filter(n => n !== 'Sin asignar').sort();

    const withIdx = clients.filter(c => c.index_score !== null);
    const withMom = clients.filter(c => c.momentum_score !== null);
    const critical = clients.filter(c => (c.index_score !== null && c.index_score <= 4) || (c.momentum_score !== null && c.momentum_score <= 1));

    const summary = {
      totalClients:  clients.length,
      totalMRR:      clients.reduce((s, c) => s + c.mrr, 0),
      avgIndex:      withIdx.length ? Math.round(withIdx.reduce((s,c) => s+c.index_score, 0)/withIdx.length*10)/10 : null,
      avgMomentum:   withMom.length ? Math.round(withMom.reduce((s,c) => s+c.momentum_score, 0)/withMom.length*10)/10 : null,
      clientsAtRisk: critical.length,
      revenueAtRisk: critical.reduce((s, c) => s + c.mrr, 0),
      csmList,
      generatedAt:   new Date().toISOString(),
    };

    return res.status(200).json({ summary, clients });

  } catch (error) {
    console.error('Error procesando Health Score:', error);
    return res.status(500).json({ error: error.message });
  }
}