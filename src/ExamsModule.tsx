import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './supabase';

type EducationLevel =
  | 'Primary'
  | 'Ordinary Secondary'
  | 'Advanced Secondary';

type School = {
  id: string;
  school_name: string;
};

type SchoolClass = {
  id: string;
  school_id: string;
  class_name: string;
  education_level: EducationLevel;
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
  education_level: EducationLevel;
};

type ExamSubject = {
  id?: string;
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
  exam_subjects?: ExamSubject[];
};

const levels: EducationLevel[] = [
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

const emptyForm = {
  school_id: '',
  exam_name: '',
  exam_type: 'Monthly Test',
  academic_year: new Date().getFullYear().toString(),
  education_level: 'Primary' as EducationLevel,
  class_id: '',
  stream_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date().toISOString().slice(0, 10),
};

export default function ExamsModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedSubjects, setSelectedSubjects] = useState<ExamSubject[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const availableClasses = useMemo(
    () =>
      classes.filter(
        (item) =>
          item.school_id === form.school_id &&
          item.education_level === form.education_level,
      ),
    [classes, form.school_id, form.education_level],
  );

  const availableStreams = useMemo(
    () => streams.filter((item) => item.class_id === form.class_id),
    [streams, form.class_id],
  );

  const availableSubjects = useMemo(
    () =>
      subjects.filter(
        (item) =>
          item.school_id === form.school_id &&
          item.education_level === form.education_level,
      ),
    [subjects, form.school_id, form.education_level],
  );

  const filteredExams = useMemo(() => {
    const term = search.toLowerCase().trim();

    return exams.filter((exam) => {
      const className =
        classes.find((item) => item.id === exam.class_id)?.class_name || '';
      return (
        !term ||
        exam.exam_name.toLowerCase().includes(term) ||
        exam.academic_year.toLowerCase().includes(term) ||
        className.toLowerCase().includes(term)
      );
    });
  }, [exams, search, classes]);

  async function loadData() {
    if (!supabase) {
      setError('Supabase haijaunganishwa. Angalia environment variables.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [schoolResult, classResult, streamResult, subjectResult, examResult] =
        await Promise.all([
          supabase.from('schools').select('id,school_name').order('school_name'),
          supabase
            .from('classes')
            .select('id,school_id,class_name,education_level')
            .order('sort_order'),
          supabase.from('streams').select('id,class_id,stream_name'),
          supabase
            .from('subjects')
            .select('id,school_id,subject_code,subject_name,education_level')
            .order('subject_name'),
          supabase.from('exams').select('*').order('created_at', {
            ascending: false,
          }),
        ]);

      const firstError =
        schoolResult.error ||
        classResult.error ||
        streamResult.error ||
        subjectResult.error ||
        examResult.error;

      if (firstError) throw firstError;

      setSchools((schoolResult.data || []) as School[]);
      setClasses((classResult.data || []) as SchoolClass[]);
      setStreams((streamResult.data || []) as Stream[]);
      setSubjects((subjectResult.data || []) as Subject[]);

      const examRows = (examResult.data || []) as Exam[];

      if (examRows.length) {
        const { data: details, error: detailError } = await supabase
          .from('exam_subjects')
          .select('*')
          .in(
            'exam_id',
            examRows.map((item) => item.id),
          );

        if (detailError) throw detailError;

        setExams(
          examRows.map((exam) => ({
            ...exam,
            exam_subjects: (details || [])
              .filter((detail) => detail.exam_id === exam.id)
              .map((detail) => ({
                id: detail.id,
                subject_id: detail.subject_id,
                exam_date: detail.exam_date,
                start_time: detail.start_time || '',
                end_time: detail.end_time || '',
                max_marks: Number(detail.max_marks || 100),
              })),
          })),
        );
      } else {
        setExams([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Imeshindikana kupakia taarifa.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function updateForm<K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function changeLevel(value: EducationLevel) {
    setForm((previous) => ({
      ...previous,
      education_level: value,
      class_id: '',
      stream_id: '',
    }));
    setSelectedSubjects([]);
  }

  function toggleSubject(subject: Subject, checked: boolean) {
    if (checked) {
      setSelectedSubjects((previous) => [
        ...previous,
        {
          subject_id: subject.id,
          exam_date: form.start_date,
          start_time: '',
          end_time: '',
          max_marks: 100,
        },
      ]);
    } else {
      setSelectedSubjects((previous) =>
        previous.filter((item) => item.subject_id !== subject.id),
      );
    }
  }

  function updateSubject(
    subjectId: string,
    key: keyof ExamSubject,
    value: string | number,
  ) {
    setSelectedSubjects((previous) =>
      previous.map((item) =>
        item.subject_id === subjectId ? { ...item, [key]: value } : item,
      ),
    );
  }

  function resetForm() {
    setForm(emptyForm);
    setSelectedSubjects([]);
    setEditingId(null);
  }

  async function saveExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) return;

    setError('');
    setMessage('');

    if (!form.school_id) {
      setError('Chagua shule.');
      return;
    }

    if (!form.class_id) {
      setError('Chagua darasa.');
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

    for (const item of selectedSubjects) {
      if (item.end_time && item.start_time && item.end_time <= item.start_time) {
        setError('Muda wa kumaliza somo lazima uwe baada ya muda wa kuanza.');
        return;
      }
      if (!item.max_marks || item.max_marks <= 0) {
        setError('Alama za juu lazima ziwe zaidi ya sifuri.');
        return;
      }
      if (item.exam_date < form.start_date || item.exam_date > form.end_date) {
        setError('Tarehe za masomo lazima ziwe ndani ya muda wa mtihani.');
        return;
      }
    }

    setSaving(true);

    try {
      const examPayload = {
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

      let savedExamId = editingId;

      if (editingId) {
        const { error: updateError } = await supabase
          .from('exams')
          .update(examPayload)
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('exams')
          .insert(examPayload)
          .select('id')
          .single();

        if (insertError) throw insertError;
        savedExamId = data.id;
      }

      if (!savedExamId) throw new Error('Namba ya mtihani haikupatikana.');

      if (editingId) {
        const { error: deleteError } = await supabase
          .from('exam_subjects')
          .delete()
          .eq('exam_id', savedExamId);

        if (deleteError) throw deleteError;
      }

      const detailRows = selectedSubjects.map((item) => ({
        exam_id: savedExamId,
        subject_id: item.subject_id,
        exam_date: item.exam_date,
        start_time: item.start_time || null,
        end_time: item.end_time || null,
        max_marks: item.max_marks,
      }));

      const { error: detailInsertError } = await supabase
        .from('exam_subjects')
        .insert(detailRows);

      if (detailInsertError) throw detailInsertError;

      setMessage(editingId ? 'Mtihani umehaririwa.' : 'Mtihani umehifadhiwa.');
      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Imeshindikana kuhifadhi mtihani.',
      );
    } finally {
      setSaving(false);
    }
  }

  function editExam(exam: Exam) {
    const examClass = classes.find((item) => item.id === exam.class_id);

    setEditingId(exam.id);
    setForm({
      school_id: exam.school_id,
      exam_name: exam.exam_name,
      exam_type: exam.exam_type,
      academic_year: exam.academic_year,
      education_level: examClass?.education_level || 'Primary',
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

    const confirmed = window.confirm(
      `Una uhakika unataka kufuta mtihani "${exam.exam_name}"?`,
    );

    if (!confirmed) return;

    setError('');
    setMessage('');

    const { error: deleteError } = await supabase
      .from('exams')
      .delete()
      .eq('id', exam.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage('Mtihani umefutwa.');
    await loadData();
  }

  function classLabel(classId: string) {
    return classes.find((item) => item.id === classId)?.class_name || 'Darasa';
  }

  function streamLabel(streamId: string | null) {
    if (!streamId) return '';
    return streams.find((item) => item.id === streamId)?.stream_name || '';
  }

  function subjectLabel(subjectId: string) {
    return subjects.find((item) => item.id === subjectId)?.subject_name || 'Somo';
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usimamizi wa Mitihani</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sajili, panga na simamia ratiba za mitihani ya shule.
          </p>
        </div>
        <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          Mitihani: {exams.length}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <form
        onSubmit={saveExam}
        className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-900">
            {editingId ? 'Hariri Mtihani' : 'Sajili Mtihani Mpya'}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Ghairi
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Shule
            <select
              required
              className={inputClass}
              value={form.school_id}
              onChange={(e) => {
                updateForm('school_id', e.target.value);
                setForm((previous) => ({
                  ...previous,
                  school_id: e.target.value,
                  class_id: '',
                  stream_id: '',
                }));
                setSelectedSubjects([]);
              }}
            >
              <option value="">Chagua shule</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.school_name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Jina la mtihani
            <input
              required
              className={inputClass}
              placeholder="Mfano: Mtihani wa Muhula wa Kwanza"
              value={form.exam_name}
              onChange={(e) => updateForm('exam_name', e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Aina ya mtihani
            <select
              className={inputClass}
              value={form.exam_type}
              onChange={(e) => updateForm('exam_type', e.target.value)}
            >
              {examTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Mwaka wa masomo
            <input
              required
              className={inputClass}
              value={form.academic_year}
              onChange={(e) => updateForm('academic_year', e.target.value)}
              placeholder="Mfano: 2026"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Ngazi ya elimu
            <select
              className={inputClass}
              value={form.education_level}
              onChange={(e) => changeLevel(e.target.value as EducationLevel)}
            >
              {levels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Darasa
            <select
              required
              className={inputClass}
              value={form.class_id}
              onChange={(e) => {
                updateForm('class_id', e.target.value);
                updateForm('stream_id', '');
              }}
            >
              <option value="">Chagua darasa</option>
              {availableClasses.map((item) => (
                <option key={item.id} value={item.id}>{item.class_name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Mkondo (Stream)
            <select
              className={inputClass}
              value={form.stream_id}
              onChange={(e) => updateForm('stream_id', e.target.value)}
              disabled={!form.class_id}
            >
              <option value="">Madarasa yote / bila mkondo</option>
              {availableStreams.map((item) => (
                <option key={item.id} value={item.id}>{item.stream_name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Tarehe ya kuanza
            <input
              required
              type="date"
              className={inputClass}
              value={form.start_date}
              onChange={(e) => updateForm('start_date', e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Tarehe ya mwisho
            <input
              required
              type="date"
              min={form.start_date}
              className={inputClass}
              value={form.end_date}
              onChange={(e) => updateForm('end_date', e.target.value)}
            />
          </label>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="mb-3">
            <h4 className="font-semibold text-gray-900">Masomo ya mtihani</h4>
            <p className="text-xs text-gray-500">
              Chagua masomo kisha weka tarehe, muda na alama za kila somo.
            </p>
          </div>

          {!form.school_id || !form.class_id ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              Chagua shule na darasa kwanza ili kuona masomo.
            </p>
          ) : availableSubjects.length === 0 ? (
            <p className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              Hakuna masomo yaliyosajiliwa kwa ngazi hii ya elimu katika shule hii.
            </p>
          ) : (
            <div className="space-y-3">
              {availableSubjects.map((subject) => {
                const selected = selectedSubjects.some(
                  (item) => item.subject_id === subject.id,
                );
                const detail = selectedSubjects.find(
                  (item) => item.subject_id === subject.id,
                );

                return (
                  <div key={subject.id} className="rounded-lg border border-gray-200 p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => toggleSubject(subject, e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                      {subject.subject_name}
                      {subject.subject_code && (
                        <span className="text-xs font-normal text-gray-500">
                          ({subject.subject_code})
                        </span>
                      )}
                    </label>

                    {selected && detail && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="space-y-1 text-xs text-gray-600">
                          Tarehe
                          <input
                            type="date"
                            required
                            className={inputClass}
                            min={form.start_date}
                            max={form.end_date}
                            value={detail.exam_date}
                            onChange={(e) =>
                              updateSubject(subject.id, 'exam_date', e.target.value)
                            }
                          />
                        </label>
                        <label className="space-y-1 text-xs text-gray-600">
                          Muda wa kuanza
                          <input
                            type="time"
                            className={inputClass}
                            value={detail.start_time}
                            onChange={(e) =>
                              updateSubject(subject.id, 'start_time', e.target.value)
                            }
                          />
                        </label>
                        <label className="space-y-1 text-xs text-gray-600">
                          Muda wa kumaliza
                          <input
                            type="time"
                            className={inputClass}
                            value={detail.end_time}
                            onChange={(e) =>
                              updateSubject(subject.id, 'end_time', e.target.value)
                            }
                          />
                        </label>
                        <label className="space-y-1 text-xs text-gray-600">
                          Alama za juu
                          <input
                            type="number"
                            min="1"
                            required
                            className={inputClass}
                            value={detail.max_marks}
                            onChange={(e) =>
                              updateSubject(
                                subject.id,
                                'max_marks',
                                Number(e.target.value),
                              )
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? 'Inahifadhi...' : editingId ? 'Hifadhi Mabadiliko' : 'Sajili Mtihani'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Futa Fomu
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold text-gray-900">Orodha ya Mitihani</h3>
          <input
            className={`${inputClass} sm:max-w-xs`}
            placeholder="Tafuta mtihani au darasa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="rounded-lg bg-white p-6 text-center text-sm text-gray-500">
            Inapakia taarifa...
          </p>
        ) : filteredExams.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            Hakuna mitihani iliyosajiliwa.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredExams.map((exam) => (
              <article
                key={exam.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">{exam.exam_name}</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      {exam.exam_type} • {exam.academic_year}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">
                      {classLabel(exam.class_id)}
                      {exam.stream_id ? ` • ${streamLabel(exam.stream_id)}` : ''}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {exam.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Tarehe ya kuanza</p>
                    <p className="font-medium text-gray-800">{exam.start_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tarehe ya mwisho</p>
                    <p className="font-medium text-gray-800">{exam.end_date}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold text-gray-500">
                    MASOMO ({exam.exam_subjects?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(exam.exam_subjects || []).map((item) => (
                      <span
                        key={item.subject_id}
                        className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700"
                      >
                        {subjectLabel(item.subject_id)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => editExam(exam)}
                    className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    Hariri
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteExam(exam)}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
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
