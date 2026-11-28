import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Wallet } from 'lucide-react';
import { supabase } from './supabase';

type Run = { id:string; payroll_month:string; total_gross:number; total_deductions:number; total_net:number };
type Item = { id:string; staff_member_id:string; base_salary:number; allowances:number; deductions:number; advance_deduction:number; net_pay:number; payment_status:string; staff?:{full_name:string} };
const money=(v:number)=>new Intl.NumberFormat('sw-TZ',{style:'currency',currency:'TZS',maximumFractionDigits:0}).format(Number(v||0));

export default function AccountantPayrollModule() {
 const [schoolId,setSchoolId]=useState(''); const [month,setMonth]=useState(new Date().toISOString().slice(0,7)+'-01');
 const [profiles,setProfiles]=useState<any[]>([]); const [runs,setRuns]=useState<Run[]>([]); const [items,setItems]=useState<Item[]>([]);
 const [runId,setRunId]=useState(''); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
 async function load(id?:string) {
  if(!schoolId)return; setLoading(true);setError('');
  try {
   const [p,r]=await Promise.all([
    supabase!.from('staff_salary_profiles').select('staff_member_id,base_salary').eq('school_id',schoolId).eq('is_active',true),
    supabase!.from('monthly_payroll_runs').select('id,payroll_month,total_gross,total_deductions,total_net').eq('school_id',schoolId).order('payroll_month',{ascending:false})
   ]);
   if(p.error)throw p.error;if(r.error)throw r.error;setProfiles(p.data||[]);setRuns(r.data||[]);
   const chosen=id||runId||(r.data||[]).find((x:any)=>x.payroll_month===month)?.id||'';setRunId(chosen);
   if(chosen){const q=await supabase!.from('monthly_payroll_items').select('id,staff_member_id,base_salary,allowances,deductions,advance_deduction,net_pay,payment_status,school_staff_directory(full_name)').eq('school_id',schoolId).eq('payroll_run_id',chosen);
    if(q.error)throw q.error;setItems((q.data||[]).map((x:any)=>({...x,staff:Array.isArray(x.school_staff_directory)?x.school_staff_directory[0]:x.school_staff_directory})));
   } else setItems([]);
  }catch(e){setError(e instanceof Error?e.message:'Imeshindikana kupakia payroll.')}finally{setLoading(false)}
 }
 useEffect(()=>{let stop=false;(async()=>{try{const q=await supabase!.rpc('get_my_school_for_staff');if(q.error)throw q.error;const s=Array.isArray(q.data)?q.data[0]:q.data;if(!s?.id)throw new Error('Akaunti haijaunganishwa na shule.');if(!stop)setSchoolId(s.id)}catch(e){if(!stop){setError(e instanceof Error?e.message:'Hitilafu');setLoading(false)}}})();return()=>{stop=true}},[]);
 useEffect(()=>{if(schoolId)void load()},[schoolId]);
 async function generate(){
  if(!profiles.length){setError('Msimamizi wa shule anatakiwa kuweka mishahara ya msingi kwanza.');return}
  setBusy(true);setError('');setMessage('');
  try{
   const existing=await supabase!.from('monthly_payroll_runs').select('id').eq('school_id',schoolId).eq('payroll_month',month).maybeSingle();if(existing.error)throw existing.error;if(existing.data)throw new Error('Payroll ya mwezi huu tayari ipo.');
   const user=await supabase!.auth.getUser();
   const created=await supabase!.from('monthly_payroll_runs').insert({school_id:schoolId,payroll_month:month,created_by:user.data.user?.id}).select('id').single();if(created.error)throw created.error;
   const staff=await supabase!.from('school_staff_directory').select('id').eq('school_id',schoolId).eq('status','Active').in('id',profiles.map(x=>x.staff_member_id));if(staff.error)throw staff.error;
   const ids=(staff.data||[]).map((x:any)=>x.id);
   const adj=await supabase!.from('staff_salary_adjustments').select('staff_member_id,adjustment_type,amount').eq('school_id',schoolId).eq('is_active',true).lte('effective_from',month).or('effective_until.is.null,effective_until.gte.'+month);if(adj.error)throw adj.error;
   const rows=profiles.filter(p=>ids.includes(p.staff_member_id)).map(p=>{const a=(adj.data||[]).filter((x:any)=>x.staff_member_id===p.staff_member_id);const allowance=a.filter((x:any)=>x.adjustment_type==='allowance').reduce((n:number,x:any)=>n+Number(x.amount),0);const deduction=a.filter((x:any)=>x.adjustment_type==='deduction').reduce((n:number,x:any)=>n+Number(x.amount),0);return{school_id:schoolId,payroll_run_id:created.data.id,staff_member_id:p.staff_member_id,base_salary:Number(p.base_salary),allowances:allowance,deductions:deduction,advance_deduction:0,net_pay:Math.max(0,Number(p.base_salary)+allowance-deduction)}});
   if(!rows.length)throw new Error('Hakuna watumishi hai wenye mshahara uliowekwa.');
   const ins=await supabase!.from('monthly_payroll_items').insert(rows);if(ins.error)throw ins.error;
   const gross=rows.reduce((n,x)=>n+x.base_salary+x.allowances,0),ded=rows.reduce((n,x)=>n+x.deductions,0),net=rows.reduce((n,x)=>n+x.net_pay,0);
   const upd=await supabase!.from('monthly_payroll_runs').update({total_gross:gross,total_deductions:ded,total_net:net}).eq('id',created.data.id);if(upd.error)throw upd.error;
   setRunId(created.data.id);setMessage('Payroll ya mwezi imetengenezwa. Hakiki kabla ya kurekodi malipo.');await load(created.data.id);
  }catch(e){setError(e instanceof Error?e.message:'Imeshindikana kutengeneza payroll.')}finally{setBusy(false)}
 }
 async function paid(item:Item,method:string){
  setBusy(true);setError('');try{const q=await supabase!.from('monthly_payroll_items').update({payment_status:'paid',paid_at:new Date().toISOString(),payment_method:method,updated_at:new Date().toISOString()}).eq('id',item.id).eq('payment_status','unpaid');if(q.error)throw q.error;setMessage('Malipo yamerekodiwa.');await load(runId)}catch(e){setError(e instanceof Error?e.message:'Imeshindikana kurekodi malipo.')}finally{setBusy(false)}
 }
 const paidCount=items.filter(x=>x.payment_status==='paid').length;
 return <section className="panel module-panel">
  <div className="module-icon"><Wallet size={25}/></div><h2>Malipo ya Watumishi</h2>
  <p className="muted">Mishahara hulipwa kila mwezi. Mhasibu anaweza kutengeneza payroll na kurekodi malipo kwa watumishi wenye mshahara uliowekwa.</p>
  {error&&<div className="notice" role="alert">{error}</div>}{message&&<div className="notice">{message}</div>}
  <div className="form-grid" style={{marginTop:16,alignItems:'end'}}><label>Mwezi wa malipo<input type="month" value={month.slice(0,7)} onChange={e=>{setMonth(e.target.value+'-01');setRunId('');setItems([])}}/></label><button className="primary" disabled={busy||loading||!profiles.length} onClick={generate}>+ Tengeneza Payroll</button></div>
  {!loading&&!profiles.length&&<div className="notice" style={{marginTop:12}}>Hakuna mishahara iliyowekwa. Msimamizi wa shule anatakiwa kuweka mshahara wa msingi wa kila mtumishi kwanza.</div>}
  <div className="stats-grid" style={{marginTop:18}}><div className="stat-card"><span>Jumla ya mshahara</span><strong>{money(items.reduce((n,x)=>n+Number(x.base_salary)+Number(x.allowances),0))}</strong></div><div className="stat-card"><span>Makato</span><strong>{money(items.reduce((n,x)=>n+Number(x.deductions)+Number(x.advance_deduction),0))}</strong></div><div className="stat-card"><span>Net pay</span><strong>{money(items.reduce((n,x)=>n+Number(x.net_pay),0))}</strong></div><div className="stat-card"><span>Waliolipwa</span><strong>{paidCount}/{items.length}</strong></div></div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'22px 0 10px'}}><h3>Historia ya Payroll</h3><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Sasisha</button></div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>{runs.map(r=><button key={r.id} className={runId===r.id?'primary':'secondary'} onClick={()=>{setMonth(r.payroll_month);void load(r.id)}}>{new Date(r.payroll_month+'T00:00:00').toLocaleDateString('sw-TZ',{month:'long',year:'numeric'})}</button>)}</div>
  {loading?<p>Inapakia...</p>:items.length?<div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:650,borderCollapse:'collapse'}}><thead><tr>{['Mtumishi','Mshahara','Posho','Makato','Net pay','Hali','Malipo'].map(x=><th key={x} style={{textAlign:'left',padding:10}}>{x}</th>)}</tr></thead><tbody>{items.map(x=><tr key={x.id}><td style={{padding:10}}>{x.staff?.full_name||'Mtumishi'}</td><td style={{padding:10}}>{money(x.base_salary)}</td><td style={{padding:10}}>{money(x.allowances)}</td><td style={{padding:10}}>{money(Number(x.deductions)+Number(x.advance_deduction))}</td><td style={{padding:10,fontWeight:700}}>{money(x.net_pay)}</td><td style={{padding:10}}>{x.payment_status==='paid'?'Imelipwa':'Haijalipwa'}</td><td style={{padding:10}}>{x.payment_status==='paid'?<CheckCircle2 color="green"/>:<select disabled={busy} defaultValue="" onChange={e=>{if(e.target.value)void paid(x,e.target.value)}}><option value="" disabled>Lipa kupitia...</option><option value="cash">Taslimu</option><option value="bank">Benki</option><option value="mobile_money">Mobile money</option><option value="cheque">Cheque</option></select>}</td></tr>)}</tbody></table></div>:<p className="muted">Hakuna payroll ya mwezi huu iliyotengenezwa.</p>}
  <p className="muted" style={{marginTop:14}}>Mshahara wa msingi na posho/makato ya kudumu husanidiwa na msimamizi. Mhasibu anaweza kurekodi njia ya malipo; mabadiliko ya viwango vya mishahara yanalindwa.</p>
 </section>
}