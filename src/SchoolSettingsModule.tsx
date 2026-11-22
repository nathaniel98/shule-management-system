import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type School = { id: string; school_name: string; email?: string | null; phone?: string | null; address?: string | null };
type Branding = { school_id: string; logo_path: string | null; letterhead_path: string | null };
const field: React.CSSProperties = { width:'100%', boxSizing:'border-box', padding:12, border:'1px solid #cbd5e1', borderRadius:9, fontSize:15 };
const card: React.CSSProperties = { background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'clamp(14px,3vw,22px)', minWidth:0 };

export default function SchoolSettingsModule({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [schools,setSchools]=useState<School[]>([]);
  const [schoolId,setSchoolId]=useState('');
  const [branding,setBranding]=useState<Branding|null>(null);
  const [logo,setLogo]=useState<File|null>(null);
  const [letterhead,setLetterhead]=useState<File|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const selected=schools.find(s=>s.id===schoolId);
  const url=(p:string|null|undefined)=>p&&supabase?supabase.storage.from('school-branding').getPublicUrl(p).data.publicUrl:'';

  useEffect(()=>{ void loadSchools(); },[isSuperAdmin]);
  useEffect(()=>{ if(schoolId) void loadBranding(schoolId); },[schoolId]);

  async function loadSchools(){
    if(!supabase){setError('Supabase haijaunganishwa.');setLoading(false);return;}
    setLoading(true);setError('');
    try {
      if(isSuperAdmin){
        const {data,error}=await supabase.from('schools').select('id,school_name,email,phone,address').order('school_name');
        if(error) throw error;
        const list=(data||[]) as School[];setSchools(list);
        if(list.length)setSchoolId(old=>old&&list.some(s=>s.id===old)?old:list[0].id);
      } else {
        const {data,error}=await supabase.rpc('get_my_school');if(error)throw error;
        const own=(Array.isArray(data)?data[0]:data) as School|null;
        if(!own?.id)throw new Error('Akaunti hii haijaunganishwa na shule hai.');
        setSchools([own]);setSchoolId(own.id);
      }
    } catch(e){setError((e as Error).message);} finally{setLoading(false);}
  }
  async function loadBranding(id:string){
    if(!supabase)return;
    const {data,error}=await supabase.from('school_branding').select('school_id,logo_path,letterhead_path').eq('school_id',id).maybeSingle();
    if(error){setError(error.message);setBranding(null);return;}
    setBranding((data as Branding|null)||{school_id:id,logo_path:null,letterhead_path:null});setLogo(null);setLetterhead(null);
  }
  function validate(file:File|null){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type))throw new Error('Tumia picha ya PNG, JPG, WEBP au SVG.');
    if(file.size>5*1024*1024)throw new Error('Picha isizidi MB 5.');
  }
  async function upload(file:File,kind:'logo'|'letterhead'){
    if(!supabase||!schoolId)throw new Error('Shule haijachaguliwa.');
    validate(file);
    const ext=file.name.split('.').pop()?.toLowerCase()||'png';
    const path=schoolId+'/'+kind+'-'+Date.now()+'.'+ext;
    const {error}=await supabase.storage.from('school-branding').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
    if(error)throw error;return path;
  }
  async function save(){
    if(!supabase||!schoolId)return;
    setSaving(true);setError('');setMessage('');
    try{
      validate(logo);validate(letterhead);
      let logoPath=branding?.logo_path||null, letterPath=branding?.letterhead_path||null;
      if(logo)logoPath=await upload(logo,'logo');
      if(letterhead)letterPath=await upload(letterhead,'letterhead');
      const {error}=await supabase.from('school_branding').upsert({school_id:schoolId,logo_path:logoPath,letterhead_path:letterPath,updated_at:new Date().toISOString()},{onConflict:'school_id'});
      if(error)throw error;
      setBranding({school_id:schoolId,logo_path:logoPath,letterhead_path:letterPath});setLogo(null);setLetterhead(null);
      setMessage('Nembo na Letterhead zimehifadhiwa kikamilifu.');
    }catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }
  if(loading)return <section style={card}>Inapakia mipangilio ya shule...</section>;
  const uploadField=(label:string,onPick:(f:File|null)=>void)=> <label style={{display:'grid',gap:8,fontWeight:650}}>{label}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={field} onChange={e=>onPick(e.target.files?.[0]||null)}/><small style={{color:'#64748b',fontWeight:400}}>PNG, JPG, WEBP au SVG; kiwango cha juu MB 5.</small></label>;
  return <section style={{display:'grid',gap:16,minWidth:0}}><div style={card}>
    <h2 style={{marginTop:0,color:'#173b5e'}}>Mipangilio ya Shule</h2>
    <p style={{color:'#64748b'}}>Pakia nembo na Letterhead vitakavyoonekana kwenye ripoti rasmi za shule. {isSuperAdmin?'Super Admin anaweza kuchagua shule yoyote.':'Mipangilio hii itaathiri shule yako pekee.'}</p>
    {error&&<div role="alert" style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:9,marginBottom:12}}>{error}</div>}
    {message&&<div role="status" style={{padding:12,background:'#dcfce7',color:'#166534',borderRadius:9,marginBottom:12}}>{message}</div>}
    {isSuperAdmin&&<label style={{display:'grid',gap:8,marginBottom:16,fontWeight:650}}>Chagua shule<select value={schoolId} onChange={e=>setSchoolId(e.target.value)} style={field}><option value="">Chagua shule</option>{schools.map(s=><option key={s.id} value={s.id}>{s.school_name}</option>)}</select></label>}
    {selected&&<><div style={{padding:13,borderRadius:10,background:'#f1f5f9',marginBottom:16}}><strong>{selected.school_name}</strong><div style={{color:'#64748b',fontSize:13,marginTop:5}}>{[selected.address,selected.phone,selected.email].filter(Boolean).join(' • ')||'Anwani na mawasiliano hayajawekwa.'}</div></div>
      <div style={{display:'grid',gap:20}}>
        <div style={{display:'grid',gap:10}}><strong>Logo / Nembo ya shule</strong>{url(branding?.logo_path)&&<img src={url(branding?.logo_path)} alt="Logo ya shule" style={{width:112,height:112,objectFit:'contain',border:'1px solid #e2e8f0',borderRadius:10,padding:8}}/>}{uploadField('Pakia logo mpya',setLogo)}{logo&&<small>{logo.name}</small>}</div>
        <div style={{display:'grid',gap:10}}><strong>Letterhead / Kichwa rasmi cha shule</strong>{url(branding?.letterhead_path)&&<img src={url(branding?.letterhead_path)} alt="Letterhead ya shule" style={{width:'100%',maxHeight:150,objectFit:'contain',border:'1px solid #e2e8f0',borderRadius:10,padding:8}}/>}{uploadField('Pakia picha ya Letterhead',setLetterhead)}{letterhead&&<small>{letterhead.name}</small>}</div>
      </div>
      <button type="button" disabled={saving||(!logo&&!letterhead)} onClick={()=>void save()} style={{marginTop:20,border:0,borderRadius:9,padding:'12px 18px',background:'#173b5e',color:'#fff',fontWeight:700,opacity:saving ? 0.65 : 1}}>{saving?'Inahifadhi...':'Hifadhi Mipangilio'}</button>
    </>}
  </div></section>;
}
