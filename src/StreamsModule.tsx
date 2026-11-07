
import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

type School = {
  id: string;
  school_name: string;
};

type SchoolClass = {
  id: string;
  class_name: string;
  education_level: string;
  sort_order: number;
};

type Stream = {
  id: string;
  class_id: string;
  stream_name: string;
};

export default function StreamsModule() {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [streamName, setStreamName] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (schoolId) {
      loadClasses(schoolId);
    } else {
      setClasses([]);
      setStreams([]);
      setClassId('');
    }
  }, [schoolId]);

  useEffect(() => {
    if (classes.length > 0) {
      loadStreams(classes.map((item) => item.id));
    } else {
      setStreams([]);
    }
  }, [classes]);

  async function loadSchools() {
    const { data, error } = await supabase
      .from('schools')
      .select('id, school_name')
      .order('school_name');

    if (error) {
      setMessage(error.message);
      return;
    }

    setSchools(data || []);

    if (data?.length) {
      setSchoolId(data[0].id);
    }
  }

  async function loadClasses(id: string) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, class_name, education_level, sort_order')
      .eq('school_id', id)
      .order('sort_order');

    if (error) {
      setMessage(error.message);
      return;
    }

    setClasses(data || []);
  }

  async function loadStreams(classIds: string[]) {
    if (!classIds.length) {
      setStreams([]);
      return;
    }

    const { data, error } = await supabase
      .from('streams')
      .select('id, class_id, stream_name')
      .in('class_id', classIds)
      .order('stream_name');

    if (error) {
      setMessage(error.message);
      return;
    }

    setStreams(data || []);
  }

  function resetForm() {
    setStreamName('');
    setClassId('');
    setEditingId(null);
  }

  async function saveStream(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    if (!classId || !streamName.trim()) {
      setMessage('Chagua darasa na ingiza jina la mkondo.');
      return;
    }

    const duplicate = streams.some(
      (item) =>
        item.class_id === classId &&
        item.stream_name.toLowerCase() === streamName.trim().toLowerCase() &&
        item.id !== editingId
    );

    if (duplicate) {
      setMessage('Mkondo huu tayari upo kwenye darasa hili.');
      return;
    }

    setLoading(true);

    const result = editingId
      ? await supabase
          .from('streams')
          .update({
            class_id: classId,
            stream_name: streamName.trim(),
          })
          .eq('id', editingId)
      : await supabase.from('streams').insert({
          class_id: classId,
          stream_name: streamName.trim(),
        });

    setLoading(false);

    if (result.error) {
      setMessage('Imeshindikana kuhifadhi: ' + result.error.message);
      return;
    }

    setMessage(editingId ? 'Mkondo umebadilishwa.' : 'Mkondo umeongezwa.');
    resetForm();

    if (classes.length) {
      await loadStreams(classes.map((item) => item.id));
    }
  }

  function editStream(item: Stream) {
    setEditingId(item.id);
    setClassId(item.class_id);
    setStreamName(item.stream_name);
    setMessage('');
  }

  async function deleteStream(id: string) {
    const confirmed = window.confirm('Una uhakika unataka kufuta mkondo huu?');
    if (!confirmed) return;

    const { error } = await supabase.from('streams').delete().eq('id', id);

    if (error) {
      setMessage('Imeshindikana kufuta: ' + error.message);
      return;
    }

    setMessage('Mkondo umefutwa.');

    if (classes.length) {
      await loadStreams(classes.map((item) => item.id));
    }
  }

  const filteredStreams = streams.filter((item) => {
    const className =
      classes.find((c) => c.id === item.class_id)?.class_name || '';

    return (
      item.stream_name.toLowerCase().includes(search.toLowerCase()) ||
      className.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Usimamizi wa Mikondo</h1>
        <p className="text-gray-500">
          Sajili, hariri na simamia mikondo ya madarasa.
        </p>
      </div>

      {message && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? 'Hariri Mkondo' : 'Sajili Mkondo Mpya'}
        </h2>

        <form onSubmit={saveStream} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Shule</label>
            <select
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value);
                resetForm();
              }}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Chagua shule</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.school_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Darasa</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Chagua darasa</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.class_name} ({item.education_level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Jina la Mkondo
            </label>
            <input
              value={streamName}
              onChange={(e) => setStreamName(e.target.value)}
              placeholder="Mfano: A, B, C"
              className="w-full rounded-lg border p-3"
              required
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-700 px-5 py-3 text-white disabled:opacity-50"
            >
              {loading
                ? 'Inahifadhi...'
                : editingId
                  ? 'Hifadhi Mabadiliko'
                  : 'Sajili Mkondo'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-5 py-3"
              >
                Ghairi
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Mikondo Iliyosajiliwa</h2>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
            Jumla: {filteredStreams.length}
          </span>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tafuta mkondo au darasa..."
          className="mb-4 w-full rounded-lg border p-3"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">Na.</th>
                <th className="p-3">Darasa</th>
                <th className="p-3">Mkondo</th>
                <th className="p-3">Vitendo</th>
              </tr>
            </thead>
            <tbody>
              {filteredStreams.map((item, index) => (
                <tr key={item.id} className="border-b">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3">
                    {classes.find((c) => c.id === item.class_id)?.class_name}
                  </td>
                  <td className="p-3 font-medium">{item.stream_name}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => editStream(item)}
                        className="rounded bg-amber-100 px-3 py-2 text-amber-800"
                      >
                        Hariri
                      </button>
                      <button
                        onClick={() => deleteStream(item.id)}
                        className="rounded bg-red-100 px-3 py-2 text-red-700"
                      >
                        Futa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredStreams.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">
                    Hakuna mikondo iliyosajiliwa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
