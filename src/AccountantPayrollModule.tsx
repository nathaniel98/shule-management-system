import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Wallet } from 'lucide-react';
import { supabase } from './supabase';

type Run = { id:string; payroll_month:string; total_gross:number; total_deductions:number; total_net:number };
type Advance = {id:string;staff_member_id:string;amount:number;repaid_amount:number;monthly_deduction:number;status:string;advance_date:string;staff?:{full_name:string}};
type Item = { id:string; staff_member_id:string; base_salary:number; allowances:number; deductions:number; advance_deduction:number; net_pay:number; payment_status:string; staff?:{full_name:string} };
const money=(v:number)=>new Intl.NumberFormat('sw-TZ',{style:'currency',currency:'TZS',maximumFractionDigits:0}).format(Number(v||0));

export default function AccountantPayrollModule() {
 const [schoolId,setSchoolId]=useState(''); const [month,setMonth]=useState(new Date().toISOString().slice(0,7)+'-01');
 const [advances,setAdvances]=useState<Advance[]>([]); const [advanceMember,setAdvanceMember]=useState(''); const [advanceAmount,setAdvanceAmount]=useState(''); const [advanceMonthly,setAdvanceMonthly]=useState(''); const [advanceDate,setAdvanceDate]=useState(new Date().toISOString().slice(0,10));
 const [profiles,setProfiles]=useState<any[]>([]); const [runs,setRuns]=useState<Run[]>([]); const [items,setItems]=useState<Item[]>([]);
 const [runId,setRunId]=useState(''); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
 async function load(id?:string) {
  if(!schoolId)return; setLoading(true);setError('');
  try {
   const [p,r,a]=await Promise.all([
    supabase!.from('staff_salary_profiles').select('staff_member_id,base_salary,school_staff_directory(full_name)').eq('school_id',schoolId).eq('is_active',true),
    supabase!.from('monthly_payroll_runs').select('id,payroll_month,total_gross,total_deductions,total_net').eq('school_id',schoolId).order('payroll_month',{ascending:false}),
    supabase!.from('staff_salary_advances').select('id,staff_member_id,amount,repaid_amount,monthly_deduction,status,advance_date,school_staff_directory(full_name)').eq('school_id',schoolId).order('advance_date',{ascending:false})
   ]);
   if(p.error)throw p.error;if(r.error)throw r.error;if(a.error)throw a.error;setProfiles(p.data||[]);setRuns(r.data||[]);setAdvances((a.data||[]).map((x:any)=>({...x,staff:Array.isArray(x.school_staff_directory)?x.school_staff_directory[0]:x.school_staff_directory})));
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
   const generated=await supabase!.rpc('generate_monthly_staff_payroll',{p_school_id:schoolId,p_payroll_month:month});
   if(generated.error)throw generated.error;
   setRunId(generated.data);setMessage('Payroll imetengenezwa. Makato ya salary advance yamezingatiwa. Hakiki kabla ya kurekodi malipo.');await load(generated.data);
  }catch(e){setError(e instanceof Error?e.message:'Imeshindikana kutengeneza payroll.')}finally{setBusy(false)}
 }
 async function createAdvance(e:React.FormEvent){
  e.preventDefault();if(!schoolId||!advanceMember||Number(advanceAmount)<=0||Number(advanceMonthly)<=0)return;
  setBusy(true);setError('');setMessage('');
  try{const q=await supabase!.from('staff_salary_advances').insert({school_id:schoolId,staff_member_id:advanceMember,amount:Number(advanceAmount),monthly_deduction:Number(advanceMonthly),advance_date:advanceDate,notes:'Salary advance'});if(q.error)throw q.error;setAdvanceAmount('');setAdvanceMonthly('');setMessage('Salary advance imesajiliwa. Itakatwa kwenye payroll inayofuata.');await load(runId||undefined)}
  catch(e){setError(e instanceof Error?e.message:'Imeshindikana kusajili salary advance.')}finally{setBusy(false)}
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
  <h3 style={{marginTop:24}}>Salary Advance / Mikopo ya Watumishi</h3>
  <p className="muted">Sajili kiasi cha mkopo na makato ya kila mwezi. Mfumo utakata kiasi kilichokubaliwa, bila kuzidi salio la deni au mshahara unaobaki baada ya makato mengine.</p>
  <form onSubmit={createAdvance} className="form-grid" style={{marginTop:12}}>
   <label>Mtumishi<select required value={advanceMember} onChange={e=>setAdvanceMember(e.target.value)}><option value="">Chagua mtumishi</option>{profiles.map(p=><option key={p.staff_member_id} value={p.staff_member_id}>{(p.school_staff_directory as any)?.full_name||'Mtumishi'}</option>)}</select></label>
   <label>Kiasi cha mkopo (TSh)<input type="number" min="1" step="1000" required value={advanceAmount} onChange={e=>setAdvanceAmount(e.target.value)} /></label>
   <label>Makato ya kila mwezi (TSh)<input type="number" min="1" step="1000" required value={advanceMonthly} onChange={e=>setAdvanceMonthly(e.target.value)} /></label>
   <label>Tarehe ya mkopo<input type="date" required value={advanceDate} onChange={e=>setAdvanceDate(e.target.value)} /></label>
   <button className="primary" disabled={busy||!advanceMember||!advanceAmount||!advanceMonthly}>Sajili Salary Advance</button>
  </form>
  <div style={{overflowX:'auto',marginTop:14}}><table style={{width:'100%',minWidth:600,borderCollapse:'collapse'}}><thead><tr>{['Mtumishi','Mkopo','Imelipwa','Salio','Makato/mwezi','Hali'].map(x=><th key={x} style={{textAlign:'left',padding:9}}>{x}</th>)}</tr></thead><tbody>{advances.map(a=><tr key={a.id}><td style={{padding:9}}>{a.staff?.full_name||'Mtumishi'}</td><td style={{padding:9}}>{money(Number(a.amount))}</td><td style={{padding:9}}>{money(Number(a.repaid_amount))}</td><td style={{padding:9}}>{money(Number(a.amount)-Number(a.repaid_amount))}</td><td style={{padding:9}}>{money(Number(a.monthly_deduction))}</td><td style={{padding:9}}>{a.status==='active'?'Inaendelea':a.status==='settled'?'Imemalizika':'Imefutwa'}</td></tr>)}{!advances.length&&<tr><td colSpan={6} style={{padding:12,textAlign:'center'}}>Hakuna salary advance iliyosajiliwa.</td></tr>}</tbody></table></div>
  <div className="stats-grid" style={{marginTop:18}}><div className="stat-card"><span>Jumla ya mshahara</span><strong>{money(items.reduce((n,x)=>n+Number(x.base_salary)+Number(x.allowances),0))}</strong></div><div className="stat-card"><span>Makato</span><strong>{money(items.reduce((n,x)=>n+Number(x.deductions)+Number(x.advance_deduction),0))}</strong></div><div className="stat-card"><span>Net pay</span><strong>{money(items.reduce((n,x)=>n+Number(x.net_pay),0))}</strong></div><div className="stat-card"><span>Waliolipwa</span><strong>{paidCount}/{items.length}</strong></div></div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'22px 0 10px'}}><h3>Historia ya Payroll</h3><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Sasisha</button></div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>{runs.map(r=><button key={r.id} className={runId===r.id?'primary':'secondary'} onClick={()=>{setMonth(r.payroll_month);void load(r.id)}}>{new Date(r.payroll_month+'T00:00:00').toLocaleDateString('sw-TZ',{month:'long',year:'numeric'})}</button>)}</div>
  {loading?<p>Inapakia...</p>:items.length?<div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:650,borderCollapse:'collapse'}}><thead><tr>{['Mtumishi','Mshahara','Posho','Makato','Net pay','Hali','Malipo'].map(x=><th key={x} style={{textAlign:'left',padding:10}}>{x}</th>)}</tr></thead><tbody>{items.map(x=><tr key={x.id}><td style={{padding:10}}>{x.staff?.full_name||'Mtumishi'}</td><td style={{padding:10}}>{money(x.base_salary)}</td><td style={{padding:10}}>{money(x.allowances)}</td><td style={{padding:10}}>{money(Number(x.deductions)+Number(x.advance_deduction))}</td><td style={{padding:10,fontWeight:700}}>{money(x.net_pay)}</td><td style={{padding:10}}>{x.payment_status==='paid'?'Imelipwa':'Haijalipwa'}</td><td style={{padding:10}}>{x.payment_status==='paid'?<CheckCircle2 color="green"/>:<select disabled={busy} defaultValue="" onChange={e=>{if(e.target.value)void paid(x,e.target.value)}}><option value="" disabled>Lipa kupitia...</option><option value="cash">Taslimu</option><option value="bank">Benki</option><option value="mobile_money">Mobile money</option><option value="cheque">Cheque</option></select>}</td></tr>)}</tbody></table></div>:<p className="muted">Hakuna payroll ya mwezi huu iliyotengenezwa.</p>}
  <p className="muted" style={{marginTop:14}}>Mshahara wa msingi na posho/makato ya kudumu husanidiwa na msimamizi. Mhasibu anaweza kurekodi njia ya malipo; mabadiliko ya viwango vya mishahara yanalindwa.</p>
 </section>
}