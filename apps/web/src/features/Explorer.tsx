import {
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Volume2,
  VolumeX,
  GitBranch,
  Flag,
  CheckCircle2,
} from 'lucide-react';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { outgoing, incoming, describeNode, startNode, type Graph } from '@graphear/core';
import { Button, IconButton } from '../components/ui';
export function Explorer({
  graph,
  selectedId,
  path,
  onWalk,
  onBack,
  onSelect,
}: {
  graph: Graph;
  selectedId: string;
  path: string[];
  onWalk: (id: string) => void;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const node = graph.nodes.find((n) => n.id === selectedId) ?? startNode(graph);
  const edges = outgoing(graph, node.id);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterTraversal = useRef(false);
  useLayoutEffect(() => {
    if (!focusAfterTraversal.current) return;
    focusAfterTraversal.current = false;
    stepHeading.current?.focus();
  }, [selectedId, path]);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update);
      window.speechSynthesis.cancel();
    };
  }, []);
  const speak = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(describeNode(graph, node.id));
    utterance.rate = rate;
    utterance.voice =
      voices.find((v) => v.name === voiceName) ??
      voices.find((v) => v.lang.startsWith('en')) ??
      null;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };
  return (
    <aside className="explorer-panel" aria-label="Accessible diagram explorer">
      <div className="panel-heading">
        <h2>Explore the path</h2>
        <span className="quiet-tag">
          {path.length} {path.length === 1 ? 'step' : 'steps'} visited
        </span>
      </div>
      <p className="panel-intro">Choose a branch to move through the diagram.</p>
      <div className="selected-step">
        <h3 ref={stepHeading} tabIndex={-1}>
          {node.label}
        </h3>
        <div className="step-kind">
          {node.type === 'end' ? (
            <Flag size={17} aria-hidden="true" />
          ) : (
            <GitBranch size={17} aria-hidden="true" />
          )}
          <span>
            {node.type === 'end'
              ? 'Outcome'
              : node.type === 'decision'
                ? 'Decision'
                : 'Current step'}
          </span>
        </div>
        <p>
          {node.review === 'confirmed' ? (
            <>
              <CheckCircle2 size={14} aria-hidden="true" /> Structure confirmed
            </>
          ) : (
            'This step needs source review'
          )}
        </p>
      </div>
      <div className="branch-list">
        {edges.length ? (
          edges.map((edge) => {
            const target = graph.nodes.find((n) => n.id === edge.target)!;
            return (
              <button
                key={edge.id}
                className="branch-button"
                onClick={() => {
                  focusAfterTraversal.current = true;
                  onWalk(target.id);
                }}
              >
                <span>
                  <strong>{edge.label || 'Continue'}</strong>
                  <span>{target.label}</span>
                  {edge.review !== 'confirmed' && <small>Connection needs review</small>}
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            );
          })
        ) : (
          <div className="path-end">
            <Flag size={24} aria-hidden="true" />
            <p>
              {node.type === 'end'
                ? 'You reached an outcome.'
                : 'No connection continues from this step.'}
            </p>
            <Button variant="ghost" onClick={() => onSelect(startNode(graph).id)}>
              Return to start
            </Button>
          </div>
        )}
      </div>
      <div className="explorer-actions">
        <Button icon={ArrowLeft} disabled={path.length < 2} onClick={onBack}>
          Back a step
        </Button>
        <IconButton
          icon={RotateCcw}
          label="Restart from the beginning"
          onClick={() => onSelect(startNode(graph).id)}
        />
      </div>
      <section className="path-history" aria-label="Your current path">
        <h3>Your path</h3>
        <ol>
          {path.map((id, index) => (
            <li key={`${id}-${index}`}>
              <button onClick={() => onSelect(id)}>
                {graph.nodes.find((n) => n.id === id)?.label ?? id}
              </button>
            </li>
          ))}
        </ol>
      </section>
      {incoming(graph, node.id).length > 0 && (
        <details className="incoming">
          <summary>Connections into this step</summary>
          <ul>
            {incoming(graph, node.id).map((edge) => (
              <li key={edge.id}>
                {graph.nodes.find((n) => n.id === edge.source)?.label}
                {edge.label ? ` — ${edge.label}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      <section className="narration" aria-label="Optional spoken description">
        <div className="panel-heading">
          <h3>Listen to this step</h3>
          <IconButton
            icon={speaking ? VolumeX : Volume2}
            label={speaking ? 'Stop narration' : 'Read current step aloud'}
            disabled={!('speechSynthesis' in window)}
            onClick={() => {
              if (speaking) {
                window.speechSynthesis.cancel();
                setSpeaking(false);
              } else speak();
            }}
          />
        </div>
        <p>Optional narration. Keep it off when using your screen reader.</p>
        <label htmlFor="speech-rate">
          Speech speed <span>{rate.toFixed(1)}×</span>
        </label>
        <input
          id="speech-rate"
          type="range"
          min="0.6"
          max="1.6"
          step="0.1"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        />
        {voices.length > 0 && (
          <label className="field">
            Voice
            <select value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
              <option value="">System English voice</option>
              {voices.map((v) => (
                <option key={v.name + v.lang} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
    </aside>
  );
}
