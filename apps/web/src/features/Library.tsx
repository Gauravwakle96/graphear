import { useState, useEffect, useMemo, useCallback } from 'react';
import { FolderOpen, Search, Trash2, RefreshCw, Plus, Monitor, Cloud } from 'lucide-react';
import { type Graph } from '@graphear/core';
import { listLocal, deleteLocal, type LocalDiagram } from '../lib/storage';
import {
  listRemote,
  getRemote,
  deleteRemote,
  type RemoteSummary,
  type RemoteDiagram,
} from '../lib/api';
import { Button, IconButton, Dialog } from '../components/ui';
type Item = {
  id: string;
  title: string;
  description: string;
  steps: number;
  connections: number;
  updatedAt: string;
  storage: 'device' | 'workspace';
  local?: LocalDiagram;
  remote?: RemoteSummary;
};
export function Library({
  onOpen,
  onNew,
}: {
  onOpen: (
    graph: Graph,
    saved?: { storage: 'device' | 'workspace'; id: string; revision?: number; shareToken?: string },
  ) => void;
  onNew: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('recent'),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState<Item | null>(null),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([listLocal(), listRemote()]);
    const next: Item[] = [];
    if (results[0].status === 'fulfilled')
      for (const d of results[0].value)
        next.push({
          id: d.id,
          title: d.graph.title,
          description: d.graph.description,
          steps: d.graph.nodes.length,
          connections: d.graph.edges.length,
          updatedAt: d.updatedAt,
          storage: 'device',
          local: d,
        });
    else
      setError(
        'Local saved diagrams could not be read. Export your current diagram to keep a copy.',
      );
    if (results[1].status === 'fulfilled')
      for (const d of results[1].value) next.push({ ...d, storage: 'workspace', remote: d });
    else
      setError(
        (previous) =>
          previous ||
          'The private workspace is unavailable. Diagrams saved on this device are still available.',
      );
    setItems(next);
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const visible = useMemo(
    () =>
      items
        .filter((d) => (d.title + ' ' + d.description).toLowerCase().includes(search.toLowerCase()))
        .toSorted((a, b) =>
          sort === 'title'
            ? a.title.localeCompare(b.title)
            : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [items, search, sort],
  );
  const open = async (item: Item) => {
    setBusy(true);
    try {
      if (item.local) onOpen(item.local.graph, { storage: 'device', id: item.id });
      else {
        const d: RemoteDiagram = await getRemote(item.id);
        onOpen(d.graph, {
          storage: 'workspace',
          id: d.id,
          revision: d.revision,
          shareToken: d.shareToken,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The diagram could not open.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="library-page">
      <div className="page-heading">
        <div>
          <h1>Your diagram library</h1>
          <p>Open a saved diagram and pick up where you left off.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={onNew}>
          New diagram
        </Button>
      </div>
      <div className="library-toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search saved diagrams</span>
          <input
            type="search"
            placeholder="Search diagrams"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="sort-field">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recently saved</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
        <IconButton
          icon={RefreshCw}
          label="Refresh saved diagrams"
          onClick={() => void refresh()}
          disabled={loading}
        />
      </div>
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
      {loading ? (
        <div className="loading-lines" role="status">
          Loading saved diagrams…
        </div>
      ) : visible.length ? (
        <div className="library-list">
          {visible.map((item) => (
            <article className="library-row" key={`${item.storage}-${item.id}`}>
              <div className="library-symbol">
                {item.storage === 'device' ? (
                  <Monitor size={23} aria-hidden="true" />
                ) : (
                  <Cloud size={23} aria-hidden="true" />
                )}
              </div>
              <button className="library-open" onClick={() => void open(item)} disabled={busy}>
                <h2>{item.title}</h2>
                <p>
                  {item.steps} steps · {item.connections} connections ·{' '}
                  {item.storage === 'device' ? 'On this device' : 'Private workspace'}
                </p>
                <span>
                  Saved{' '}
                  {new Date(item.updatedAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </button>
              <IconButton
                icon={Trash2}
                label={`Delete ${item.title} from ${item.storage === 'device' ? 'this device' : 'private workspace'}`}
                onClick={() => setDeleting(item)}
              />
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-library">
          <FolderOpen size={46} aria-hidden="true" />
          <h2>{search ? 'No matching diagrams' : 'A place for your next discovery'}</h2>
          <p>
            {search
              ? 'Try another title or clear your search.'
              : 'Save a diagram from the workspace to find it here. You can keep it on this device or in your private workspace.'}
          </p>
          <Button onClick={onNew}>Create a diagram</Button>
        </div>
      )}
      <p className="library-privacy">
        Device saves stay in this browser. Private workspace saves use a guest session; keep a JSON
        export as a portable backup.
      </p>
      <Dialog
        open={!!deleting}
        title="Delete saved diagram?"
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
      >
        <p>
          Remove “{deleting?.title}” from{' '}
          {deleting?.storage === 'device' ? 'this device' : 'your private workspace'}? Any published
          link for this saved copy will also be removed.
        </p>
        <div className="dialog-actions">
          <Button onClick={() => setDeleting(null)} disabled={busy}>
            Keep diagram
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!deleting) return;
              setBusy(true);
              try {
                if (deleting.storage === 'device') await deleteLocal(deleting.id);
                else await deleteRemote(deleting.id);
                setItems((current) =>
                  current.filter((i) => !(i.id === deleting.id && i.storage === deleting.storage)),
                );
                setDeleting(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Deletion failed.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Deleting…' : 'Delete saved copy'}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
