import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

type Receipt = {
  receipt_number: string;
  payment_date: string;
  payment_method: string;
  amount_paid: number;
  student_name: string;
  admission_no: string;
  school_name: string;
  total_fees: number;
  total_paid: number;
  balance: number;
};

function VerifyReceiptPage() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const receiptNumber = new URLSearchParams(window.location.search).get('receipt')?.trim();
    if (!receiptNumber) {
      setError('Namba ya risiti haijawekwa.');
      setLoading(false);
      return;
    }
    if (!supabase) {
      setError('Huduma ya uthibitishaji haipatikani kwa sasa.');
      setLoading(false);
      return;
    }
    supabase.rpc('verify_fee_receipt', { p_receipt_number: receiptNumber })
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError) setError('Imeshindikana kuthibitisha risiti. Jaribu tena baadaye.');
        else if (!data) setError('Risiti hii haipo kwenye kumbukumbu za shule.');
        else setReceipt(data as Receipt);
      })
      .catch(() => { if (active) setError('Hitilafu ya muunganisho.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const money = (value: number) => 'TSh ' + new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(value || 0));

  return (
    <main style={{ maxWidth: 560, margin: '32px auto', padding: 20, fontFamily: 'Arial,sans-serif', color: '#172b3d' }}>
      <section style={{ border: '1px solid #dbe3ea', borderRadius: 14, padding: 22, boxShadow: '0 8px 28px rgba(15,23,42,.08)' }}>
        <h1 style={{ marginTop: 0, color: '#173b5e' }}>Uthibitishaji wa Risiti</h1>
        {loading ? <p>Inathibitisha risiti...</p> : error ? <p role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : receipt ? (
          <>
            <p style={{ color: '#15803d', fontWeight: 700 }}>✓ RISITI HALALI — IMEPOKELEWA KWENYE KUMBUKUMBU ZA SHULE</p>
            <h2>{receipt.school_name}</h2>
            <p><b>Namba ya risiti:</b> {receipt.receipt_number}</p>
            <p><b>Tarehe:</b> {receipt.payment_date}</p>
            <p><b>Mwanafunzi:</b> {receipt.student_name}</p>
            <p><b>Namba ya usajili:</b> {receipt.admission_no}</p>
            <p><b>Njia ya malipo:</b> {receipt.payment_method}</p>
            <hr />
            <p><b>Kiasi kilicholipwa kwa risiti hii:</b> {money(receipt.amount_paid)}</p>
            <p><b>Jumla ya ada:</b> {money(receipt.total_fees)}</p>
            <p><b>Jumla iliyolipwa:</b> {money(receipt.total_paid)}</p>
            <p><b>Salio:</b> {money(receipt.balance)}</p>
            <small>Uthibitishaji huu unasoma kumbukumbu za malipo za shule; hauonyeshi wala kubadilisha taarifa za akaunti.</small>
          </>
        ) : null}
      </section>
    </main>
  );
}

export default VerifyReceiptPage;
