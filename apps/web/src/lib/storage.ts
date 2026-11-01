import { parseGraph, type Graph } from '@graphear/core';
export type LocalDiagram = { id: string; graph: Graph; updatedAt: string };
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('graphear', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('diagrams', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error('This browser could not open local storage. Export your diagram to keep a copy.'),
      );
  });
export async function listLocal(): Promise<LocalDiagram[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('diagrams', 'readonly');
    const request = transaction.objectStore('diagrams').getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as LocalDiagram[])
          .map((d) => ({ ...d, graph: parseGraph(d.graph) }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    request.onerror = () => reject(new Error('Saved diagrams could not be read.'));
    transaction.oncomplete = () => db.close();
  });
}
export async function saveLocal(graph: Graph, id?: string) {
  const db = await database();
  const diagram = {
    id: id ?? crypto.randomUUID(),
    graph: parseGraph(graph),
    updatedAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('diagrams', 'readwrite');
    transaction.objectStore('diagrams').put(diagram);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(new Error('Local storage is full or unavailable. Export your diagram instead.'));
    };
  });
  return diagram;
}
export async function deleteLocal(id: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('diagrams', 'readwrite');
    transaction.objectStore('diagrams').delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(new Error('The diagram could not be removed.'));
    };
  });
}
export function download(name: string, content: string | Blob, type = 'application/json') {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const filename = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'diagram';
