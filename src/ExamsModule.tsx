import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type Level = 'Primary' | 'Ordinary Secondary' | 'Advanced Secondary';

type School = {
  id: string;
  school_name: string;
};

type SchoolClass = {
  id: string;
  school_id: string;
  class_name: string;
  education_level: Level;
};

type Stream = {
  id: string;
  class_id: string;
  stream_name: string;
};

type Subject = {
  id: string;
  school_id: string;
  subject_code: string | null;
  subject_name: string;
  education_level: Level;
};

type ExamSubject = {
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  max_marks: number;
};

type Exam = {
  id: string;
  school_id: string;
  class_id: string;
  stream_id: string | null;
  exam_name: string;
  exam_type: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  exam_subjects: ExamSubject[];
};

const levels: Level[] = [
  'Primary',
  'Ordinary Secondary',
  'Advanced Secondary',
];

const examTypes = [
  'Monthly Test',
  'Midterm Examination',
  'Terminal Examination',
  'Annual Examination',
  'Mock Examination',
  'Pre-National Examination',
  'National Examination',
  'Other',
];

const today = new Date().toISOString().slice(0, 10);

const initialForm = {
  school_id: '',
  exam_name: '',
  exam_type: 'Monthly Test',
  academic_year: new Date().getFullYear().toString(),
  education_level: 'Primary' as Level,
  class_id: '',
  stream_id: '',
  start_date: today,
  end_date: today,
};

const styles = `
.exam-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  color: #1e293b;
  font-family: inherit;
  font-size: 14px;
}
.exam-page * { box-sizing: border-box; }
.exam-heading {
  display:flex; justify-content:space-between; align-items:center;
  flex-wrap:wrap; gap:12px; margin-bottom:22px;
}
.exam-heading h2 { font-size:24px; font-weight:750; margin:0; }
.exam-heading p { color:#64748b; margin:6px 0 0; }
.exam-count {
  background:#eff6ff; color:#1d4ed8; padding:9px 15px;
  border-radius:9px; font-weight:700;
}
.exam-panel {
  background:white; border:1px solid #e2e8f0; border-radius:13px;
  padding:20px; margin-bottom:24px;
  box-shadow:0 2px 8px rgba(15,23,42,.04);
}
.exam-panel h3 { font-size:19px; font-weight:750; margin:0 0 18px; }
.exam-grid {
  display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
  gap:17px;
}
.exam-field { display:flex; flex-direction:column; gap:7px; min-width:0; }
.exam-field label { font-weight:650; color:#334155; font-size:13px; }
.exam-input {
  display:block; width:100%; min-width:0; height:43px;
  border:1px solid #cbd5e1; border-radius:8px;
  padding:9px 11px; background:white; color:#0f172a;
  font:inherit; outline:none;
}
.exam-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px #dbeafe; }
.exam-input:disabled { background:#f1f5f9; color:#94a3b8; }
.exam-divider { border:0; border-top:1px solid #e2e8f0; margin:23px 0; }
.exam-subject-list { display:grid; grid-template-columns:1fr; gap:12px; }
.exam-subject {
  border:1px solid #e2e8f0; border-radius:10px; padding:14px;
  background:#fff;
}
.exam-subject.selected { border-color:#93c5fd; background:#f8fbff; }
.exam-subject-check {
  display:flex; align-items:center; gap:10px;
  font-weight:700; cursor:pointer; color:#1e293b;
}
.exam-subject-check input { width:18px; height:18px; accent-color:#2563eb; }
.exam-subject-code { color:#64748b; font-size:12px; font-weight:400; }
.exam-subject-fields {
  display:grid; grid-template-columns:repeat(4,minmax(0,1fr));
  gap:12px; margin-top:15px;
}
.exam-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:20px; }
.exam-btn {
  border:0; border-radius:8px; padding:11px 17px;
  font:inherit; font-weight:700; cursor:pointer;
}
.exam-btn:disabled { opacity:.6; cursor:not-allowed; }
.exam-primary { background:#1d4ed8; color:white; }
.exam-secondary { background:#f1f5f9; color:#334155; }
.exam-danger { background:#fff1f2; color:#be123c; }
.exam-edit { background:#eff6ff; color:#1d4ed8; }
.exam-alert {
  border-radius:9px; padding:12px 14px; margin-bottom:15px;
  overflow-wrap:anywhere;
}
.exam-error { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
.exam-success { background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; }
.exam-muted {
  background:#f8fafc; color:#64748b; border:1px dashed #cbd5e1;
  border-radius:9px; padding:16px;
}
.exam-search { width:100%; max-width:360px; }
.exam-list-head {
  display:flex; align-items:center; justify-content:space-between;
  flex-wrap:wrap; gap:12px; margin-bottom:14px;
}
.exam-list-head h3 { font-size:19px; font-weight:750; margin:0; }
.exam-cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.exam-card {
  background:white; border:1px solid #e2e8f0;
  border-radius:12px; padding:16px; min-width:0;
}
.exam-card h4 { font-size:16px; font-weight:750; margin:0; overflow-wrap:anywhere; }
.exam-card p { color:#64748b; margin:6px 0; }
.exam-card-meta {
  display:grid; grid-template-columns:1fr 1fr; gap:10px;
  background:#f8fafc; padding:12px; border-radius:8px; margin-top:12px;
}
.exam-card-meta small { display:block; color:#64748b; margin-bottom:4px; }
.exam-tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.exam-tag { background:#f1f5f9; border-radius:6px; padding:5px 8px; font-size:12px; }
.exam-status { background:#eff6ff; color:#1d4ed8; padding:5px 9px; border-radius:20px; font-size:12px; }
@media(max-width:700px) {
  .exam-grid { grid-template-columns:1fr; }
  .exam-subject-fields { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .exam-cards { grid-template-columns:1fr; }
  .exam-panel { padding:15px; }
  .exam-heading h2 { font-size:21px; }
}
@media(max-width:380px) {
  .exam-subject-fields { grid-template-columns:1fr; }
  .exam-card-meta { grid-template-columns:1fr; }
}
`;

export default function ExamsModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [form, setForm] = useState(initialForm);
  const [selectedSubjects, setSelectedSubjects] = useState<ExamSubject[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const availableClasses = useMemo(
    () => classes.filter(c =>
      c.school_id === form.school_id &&
      c.education_level === form.education_level
    ),
    [classes, form.school_id, form.education_level]
  );

  const availableStreams = useMemo(
    () => streams.filter(s => s.class_id === form.class_id),
    [streams, form.class_id]
  );

  const availableSubjects = useMemo(
    () => subjects.filter(s =>
      s.school_id === form.school_id &&
      s.education_level === form.education_level
    ),
    [subjects, form.school_id, form.education_level]
  );

  const filteredExams = useMemo(() => {
    const term = search.toLowerCase().trim();
    return exams.filter(e => {
      const className = classes.find(c => c.id === e.class_id)?.class_name || '';
      return !term ||
        e.exam_name.toLowerCase().includes(term) ||
        e.academic_year.toLowerCase().includes(term) ||
        className.toLowerCase().includes(term);
    });
  }, [exams, search, classes]);

  function errorMessage(err: unknown) {
    const item = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [
      item?.message || String(err),
      item?.details ? `Maelezo: ${item.details}` : '',
      item?.hint ? `Kidokezo: ${item.hint}` : '',
      item?.code ? `Code: ${item.code}` : '',
    ].filter(Boolean).join('\n');
  }

  async function loadData() {
    if (!supabase) {
      setError('Supabase haijaunganishwa.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const results = await Promise.all([
        supabase.from('schools').select('id,school_name').order('school_name'),
        supabase.from('classes')
          .select('id,school_id,class_name,education_level')
          .order('sort_order'),
        supabase.from('streams').select('id,class_id,stream_name'),
        supabase.from('subjects')
          .select('id,school_id,subject_code,subject_name,education_level')
          .order('subject_name'),
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
      ]);

      for (const result of results) {
        if (result.error) throw result.error;
      }

      setSchools((results[0].data || []) as School[]);
      setClasses((results[1].data || []) as SchoolClass[]);
      setStreams((results[2].data || []) as Stream[]);
      setSubjects((results[3].data || []) as Subject[]);

      const examRows = (results[4].data || []) as Omit<Exam, 'exam_subjects'>[];

      if (examRows.length) {
        const { data, error: detailError } = await supabase
          .from('exam_subjects')
          .select('exam_id,subject_id,exam_date,start_time,end_time,max_marks')
          .in('exam_id', examRows.map(e => e.id));

        if (detailError) throw detailError;

        setExams(examRows.map(e => ({
          ...e,
          exam_subjects: (data || [])
            .filter(d => d.exam_id === e.id)
            .map(d => ({
              subject_id: d.subject_id,
              exam_date: d.exam_date,
              start_time: d.start_time || '',
              end_time: d.end_time || '',
              max_marks: Number(d.max_marks || 100),
            })),
        })));
      } else {
        setExams([]);
      }
    } catch (err) {
      setError(`Imeshindikana kupakia taarifa: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function changeLevel(value: Level) {
    setForm(p => ({ ...p, education_level: value, class_id: '', stream_id: '' }));
    setSelectedSubjects([]);
  }

  function toggleSubject(subject: Subject, checked: boolean) {
    setSelectedSubjects(previous => checked
      ? [...previous, {
          subject_id: subject.id,
          exam_date: form.start_date,
          start_time: '',
          end_time: '',
          max_marks: 100,
        }]
      : previous.filter(s => s.subject_id !== subject.id)
    );
  }

  function updateSubject(
    id: string,
    key: keyof ExamSubject,
    value: string | number
  ) {
    setSelectedSubjects(previous => previous.map(s =>
      s.subject_id === id ? { ...s, [key]: value } : s
    ));
  }

  function resetForm() {
    setForm(initialForm);
    setSelectedSubjects([]);
    setEditingId(null);
  }

  async function saveExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setError('');
    setMessage('');

    if (!form.school_id || !form.class_id) {
      setError('Chagua shule na darasa.');
      return;
    }

    if (!selectedSubjects.length) {
      setError('Chagua angalau somo moja.');
      return;
    }

    if (form.end_date < form.start_date) {
      setError('Tarehe ya mwisho haiwezi kuwa kabla ya tarehe ya mwanzo.');
      return;
    }

    for (const s of selectedSubjects) {
      if (s.exam_date < form.start_date || s.exam_date > form.end_date) {
        setError('Tarehe ya kila somo lazima iwe ndani ya muda wa mtihani.');
        return;
      }
      if (s.start_time && s.end_time && s.end_time <= s.start_time) {
        setError('Muda wa kumaliza somo lazima uwe baada ya muda wa kuanza.');
        return;
      }
      if (!s.max_marks || s.max_marks <= 0) {
        setError('Alama za juu lazima ziwe zaidi ya sifuri.');
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        school_id: form.school_id,
        class_id: form.class_id,
        stream_id: form.stream_id || null,
        exam_name: form.exam_name.trim(),
        exam_type: form.exam_type,
        academic_year: form.academic_year.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        status: 'Planned',
      };

      let examId = editingId;

      if (editingId) {
        const { error: updateError } = await supabase
          .from('exams')
          .update(payload)
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('exams')
          .insert(payload)
          .select('id')
          .single();

        if (insertError) throw insertError;
        examId = data.id;
      }

      if (!examId) throw new Error('ID ya mtihani haikupatikana.');

      if (editingId) {
        const { error: deleteError } = await supabase
          .from('exam_subjects')
          .delete()
          .eq('exam_id', examId);

        if (deleteError) throw deleteError;
      }

      const rows = selectedSubjects.map(s => ({
        exam_id: examId,
        subject_id: s.subject_id,
        exam_date: s.exam_date,
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        max_marks: s.max_marks,
      }));

      const { error: detailError } = await supabase
        .from('exam_subjects')
        .insert(rows);

      if (detailError) throw detailError;

      setMessage(editingId ? 'Mtihani umehaririwa kikamilifu.' : 'Mtihani umehifadhiwa kikamilifu.');
      resetForm();
      await loadData();
    } catch (err) {
      setError(`Imeshindikana kuhifadhi mtihani: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function editExam(exam: Exam) {
    const cls = classes.find(c => c.id === exam.class_id);

    setEditingId(exam.id);
    setForm({
      school_id: exam.school_id,
      exam_name: exam.exam_name,
      exam_type: exam.exam_type,
      academic_year: exam.academic_year,
      education_level: cls?.education_level || 'Primary',
      class_id: exam.class_id,
      stream_id: exam.stream_id || '',
      start_date: exam.start_date,
      end_date: exam.end_date,
    });
    setSelectedSubjects(exam.exam_subjects || []);
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteExam(exam: Exam) {
    if (!supabase) return;

    if (!window.confirm(`Una uhakika unataka kufuta mtihani "${exam.exam_name}"?`)) {
      return;
    }

    setError('');
    setMessage('');

    const { error: deleteError } = await supabase
      .from('exams')
      .delete()
      .eq('id', exam.id);

    if (deleteError) {
      setError(`Imeshindikana kufuta mtihani: ${errorMessage(deleteError)}`);
      return;
    }

    setMessage('Mtihani umefutwa.');
    await loadData();
  }

  function className(id: string) {
    return classes.find(c => c.id === id)?.class_name || 'Darasa';
  }

  function streamName(id: string | null) {
    return id ? streams.find(s => s.id === id)?.stream_name || '' : '';
  }

  function subjectName(id: string) {
    return subjects.find(s => s.id === id)?.subject_name || 'Somo';
  }

  return (
    <div className="exam-page">
      <style>{styles}</style>

      <div className="exam-heading">
        <div>
          <h2>Usimamizi wa Mitihani</h2>
          <p>Sajili na simamia ratiba za mitihani ya shule.</p>
        </div>
        <div className="exam-count">Mitihani: {exams.length}</div>
      </div>

      {error && <div className="exam-alert exam-error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
      {message && <div className="exam-alert exam-success">{message}</div>}

      <form className="exam-panel" onSubmit={saveExam}>
        <h3>{editingId ? 'Hariri Mtihani' : 'Sajili Mtihani Mpya'}</h3>

        <div className="exam-grid">
          <div className="exam-field">
            <label>Shule</label>
            <select
              className="exam-input"
              required
              value={form.school_id}
              onChange={e => {
                setForm(p => ({
                  ...p,
                  school_id: e.target.value,
                  class_id: '',
                  stream_id: '',
                }));
                setSelectedSubjects([]);
              }}
            >
              <option value="">Chagua shule</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}
            </select>
          </div>

          <div className="exam-field">
            <label>Jina la mtihani</label>
            <input
              className="exam-input"
              required
              value={form.exam_name}
              onChange={e => setForm(p => ({ ...p, exam_name: e.target.value }))}
              placeholder="Mfano: Mtihani wa Muhula wa Kwanza"
            />
          </div>

          <div className="exam-field">
            <label>Aina ya mtihani</label>
            <select
              className="exam-input"
              value={form.exam_type}
              onChange={e => setForm(p => ({ ...p, exam_type: e.target.value }))}
            >
              {examTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="exam-field">
            <label>Mwaka wa masomo</label>
            <input
              className="exam-input"
              required
              value={form.academic_year}
              onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))}
              placeholder="Mfano: 2026"
            />
          </div>

          <div className="exam-field">
            <label>Ngazi ya elimu</label>
            <select
              className="exam-input"
              value={form.education_level}
              onChange={e => changeLevel(e.target.value as Level)}
            >
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="exam-field">
            <label>Darasa</label>
            <select
              className="exam-input"
              required
              value={form.class_id}
              onChange={e => setForm(p => ({ ...p, class_id: e.target.value, stream_id: '' }))}
            >
              <option value="">Chagua darasa</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>

          <div className="exam-field">
            <label>Mkondo (Stream)</label>
            <select
              className="exam-input"
              disabled={!form.class_id}
              value={form.stream_id}
              onChange={e => setForm(p => ({ ...p, stream_id: e.target.value }))}
            >
              <option value="">Madarasa yote / bila mkondo</option>
              {availableStreams.map(s => <option key={s.id} value={s.id}>{s.stream_name}</option>)}
            </select>
          </div>

          <div className="exam-field">
            <label>Tarehe ya kuanza</label>
            <input
              className="exam-input"
              type="date"
              required
              value={form.start_date}
              onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
            />
          </div>

          <div className="exam-field">
            <label>Tarehe ya mwisho</label>
            <input
              className="exam-input"
              type="date"
              required
              min={form.start_date}
              value={form.end_date}
              onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
            />
          </div>
        </div>

        <hr className="exam-divider" />

        <h3>Masomo ya mtihani</h3>
        <p style={{ color: '#64748b', marginTop: -10, marginBottom: 15 }}>
          Chagua masomo kisha weka tarehe, muda na alama za kila somo.
        </p>

        {!form.school_id || !form.class_id ? (
          <div className="exam-muted">Chagua shule na darasa kwanza ili kuona masomo.</div>
        ) : availableSubjects.length === 0 ? (
          <div className="exam-muted">
            Hakuna masomo yaliyosajiliwa kwa ngazi hii ya elimu katika shule hii.
          </div>
        ) : (
          <div className="exam-subject-list">
            {availableSubjects.map(subject => {
              const detail = selectedSubjects.find(s => s.subject_id === subject.id);
              return (
                <div className={`exam-subject ${detail ? 'selected' : ''}`} key={subject.id}>
                  <label className="exam-subject-check">
                    <input
                      type="checkbox"
                      checked={Boolean(detail)}
                      onChange={e => toggleSubject(subject, e.target.checked)}
                    />
                    <span>
                      {subject.subject_name}
                      {subject.subject_code && (
                        <span className="exam-subject-code"> ({subject.subject_code})</span>
                      )}
                    </span>
                  </label>

                  {detail && (
                    <div className="exam-subject-fields">
                      <div className="exam-field">
                        <label>Tarehe</label>
                        <input
                          className="exam-input"
                          type="date"
                          required
                          min={form.start_date}
                          max={form.end_date}
                          value={detail.exam_date}
                          onChange={e => updateSubject(subject.id, 'exam_date', e.target.value)}
                        />
                      </div>

                      <div className="exam-field">
                        <label>Muda wa kuanza</label>
                        <input
                          className="exam-input"
                          type="time"
                          value={detail.start_time}
                          onChange={e => updateSubject(subject.id, 'start_time', e.target.value)}
                        />
                      </div>

                      <div className="exam-field">
                        <label>Muda wa kumaliza</label>
                        <input
                          className="exam-input"
                          type="time"
                          value={detail.end_time}
                          onChange={e => updateSubject(subject.id, 'end_time', e.target.value)}
                        />
                      </div>

                      <div className="exam-field">
                        <label>Alama za juu</label>
                        <input
                          className="exam-input"
                          type="number"
                          min="1"
                          required
                          value={detail.max_marks}
                          onChange={e => updateSubject(subject.id, 'max_marks', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="exam-actions">
          <button className="exam-btn exam-primary" type="submit" disabled={saving}>
            {saving ? 'Inahifadhi...' : editingId ? 'Hifadhi Mabadiliko' : 'Sajili Mtihani'}
          </button>
          <button className="exam-btn exam-secondary" type="button" onClick={resetForm}>
            Futa Fomu
          </button>
          {editingId && (
            <button className="exam-btn exam-secondary" type="button" onClick={resetForm}>
              Ghairi Kuhariri
            </button>
          )}
        </div>
      </form>

      <section>
        <div className="exam-list-head">
          <h3>Orodha ya Mitihani</h3>
          <input
            className="exam-input exam-search"
            placeholder="Tafuta mtihani au darasa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="exam-muted">Inapakia taarifa...</div>
        ) : filteredExams.length === 0 ? (
          <div className="exam-muted">Hakuna mitihani iliyosajiliwa.</div>
        ) : (
          <div className="exam-cards">
            {filteredExams.map(exam => (
              <article className="exam-card" key={exam.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <h4>{exam.exam_name}</h4>
                    <p>{exam.exam_type} • {exam.academic_year}</p>
                    <p>
                      {className(exam.class_id)}
                      {exam.stream_id ? ` • ${streamName(exam.stream_id)}` : ''}
                    </p>
                  </div>
                  <span className="exam-status">{exam.status}</span>
                </div>

                <div className="exam-card-meta">
                  <div>
                    <small>Tarehe ya kuanza</small>
                    <strong>{exam.start_date}</strong>
                  </div>
                  <div>
                    <small>Tarehe ya mwisho</small>
                    <strong>{exam.end_date}</strong>
                  </div>
                </div>

                <p style={{ marginTop: 14, fontWeight: 700 }}>
                  Masomo ({exam.exam_subjects.length})
                </p>
                <div className="exam-tags">
                  {exam.exam_subjects.map(s => (
                    <span className="exam-tag" key={s.subject_id}>
                      {subjectName(s.subject_id)}
                    </span>
                  ))}
                </div>

                <div className="exam-actions">
                  <button className="exam-btn exam-edit" type="button" onClick={() => editExam(exam)}>
                    Hariri
                  </button>
                  <button className="exam-btn exam-danger" type="button" onClick={() => void deleteExam(exam)}>
                    Futa
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
     }
