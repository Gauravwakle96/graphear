import { useState } from 'react';
import type { LearningSession } from '../../lib/learning-api';
import { Citations } from './StudyViews';
function itemKey(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
export function StudyChecklist({
  session,
  onSource,
}: {
  session: LearningSession;
  onSource: (id: string) => void;
}) {
  const key = 'graphear-checklist:' + session.id;
  const [section, setSection] = useState(0),
    [done, setDone] = useState<string[]>(() => {
      try {
        const v = JSON.parse(localStorage.getItem(key) ?? '[]');
        return Array.isArray(v) ? v.filter((id) => typeof id === 'string').slice(0, 400) : [];
      } catch {
        return [];
      }
    });
  const sections = session.analysis?.notes.detailed ?? [],
    items = sections[section]?.items ?? [];
  const completed = items.filter((item) => done.includes(itemKey(item.text))).length;
  function toggle(id: string) {
    const next = done.includes(id) ? done.filter((v) => v !== id) : [...done, id].slice(-400);
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Tracking still works in memory. */
    }
  }
  return (
    <section className="study-checklist">
      <h2>Track your next steps</h2>
      <p>
        Choose a note section to use as a learning or process checklist. For applications, verify
        requirements and deadlines against the official source.
      </p>
      <label>
        Checklist section
        <select
          aria-label="Checklist section"
          value={section}
          onChange={(e) => setSection(Number(e.target.value))}
        >
          {sections.map((s, i) => (
            <option key={i} value={i}>
              {s.heading}
            </option>
          ))}
        </select>
      </label>
      <p role="status">
        {completed} of {items.length} points completed
      </p>
      <progress max={Math.max(1, items.length)} value={completed} aria-label="Checklist progress" />
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <label className="checklist-point">
              <input
                type="checkbox"
                checked={done.includes(itemKey(item.text))}
                onChange={() => toggle(itemKey(item.text))}
              />
              <span>
                {item.text}
                {item.origin !== 'source' && (
                  <span className="badge warning">
                    {item.origin === 'additional'
                      ? 'Additional explanation'
                      : 'Uncertain interpretation'}
                  </span>
                )}
              </span>
            </label>
            <Citations ids={item.evidence} sources={session.sources} onSource={onSource} />
          </li>
        ))}
      </ul>
      <p className="muted">
        Checklist progress is saved on this device. It does not submit an application or certify
        eligibility.
      </p>
    </section>
  );
}
