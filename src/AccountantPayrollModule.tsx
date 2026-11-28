import { Wallet, ShieldCheck } from 'lucide-react';

export default function AccountantPayrollModule() {
  return (
    <section className="panel module-panel">
      <div className="module-icon"><Wallet size={25} /></div>
      <h2>Malipo ya Watumishi</h2>
      <p className="muted">Sehemu ya kusimamia mishahara, makato na malipo ya wafanyakazi wa shule.</p>
      <div className="notice" style={{ marginTop: 18 }}>
        <b>Sehemu hii inasubiri kuunganishwa na mfumo wa mishahara.</b>
        <p style={{ marginBottom: 0 }}>Orodha ya watumishi tayari inaweza kuonekana kwenye menyu ya Watumishi. Kabla ya kurekodi malipo, mfumo utawekewa taarifa za mshahara wa msingi, makato, salary advance, vipindi vya malipo na uthibitisho wa malipo.</p>
      </div>
      <div className="module-meta" style={{ marginTop: 16 }}>
        <ShieldCheck size={18} />
        <span>Mhasibu ataruhusiwa kurekodi malipo; kubadilisha mshahara wa msingi na kufuta malipo kutahitaji ruhusa ya msimamizi.</span>
      </div>
    </section>
  );
}
