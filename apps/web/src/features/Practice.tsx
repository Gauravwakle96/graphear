import { useState } from 'react';
import { Wrench, ArrowRight, CheckCircle2, BookOpen } from 'lucide-react';
import {
  analyzeGraph,
  createQuestions,
  checkAnswer,
  type Graph,
  type Question,
} from '@graphear/core';
import { Button } from '../components/ui';
function Exercise({ question }: { question: Question }) {
  const [answer, setAnswer] = useState(''),
    [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null);
  return (
    <form
      className="exercise"
      onSubmit={(e) => {
        e.preventDefault();
        setFeedback(checkAnswer(question, answer));
      }}
    >
      <h3>{question.prompt}</h3>
      <fieldset>
        <legend className="sr-only">Choose your answer</legend>
        {question.options.map((option) => (
          <label className="answer-option" key={option.value}>
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={answer === option.value}
              onChange={(e) => {
                setAnswer(e.target.value);
                setFeedback(null);
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={!answer}>
        Check answer
      </Button>
      {feedback && (
        <div
          className={`exercise-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}
          role="status"
        >
          <strong>
            {feedback.correct ? 'Correct connection.' : 'Take another look at the path.'}
          </strong>
          <p>{feedback.explanation}</p>
        </div>
      )}
    </form>
  );
}
export function Practice({
  graph,
  onMission,
  onReview,
}: {
  graph: Graph;
  onMission: () => void;
  onReview: () => void;
}) {
  const questions = createQuestions(graph),
    pending = analyzeGraph(graph).pendingReview;
  return (
    <section className="practice-page">
      <div className="page-heading">
        <div>
          <h1>Learn by following the path</h1>
          <p>Practice with checked connections, then repair a diagram yourself.</p>
        </div>
        <BookOpen size={33} aria-hidden="true" />
      </div>
      <section className="repair-mission">
        <div className="mission-copy">
          <Wrench size={27} aria-hidden="true" />
          <h2>A missing path to approval</h2>
          <p>
            A scholarship flowchart has lost one connection. Restore the path from document
            verification to approval while preserving the eligibility decisions.
          </p>
          <span className="quiet-tag">Authored learning example · synthetic</span>
        </div>
        <Button variant="primary" icon={ArrowRight} onClick={onMission}>
          Start repair mission
        </Button>
      </section>
      <div className="practice-heading">
        <h2>Explore “{graph.title}”</h2>
        <p>Answers are calculated from this diagram's structure.</p>
      </div>
      {pending > 0 ? (
        <div className="notice">
          <p>Review the {pending} unconfirmed items before using this diagram for practice.</p>
          <Button onClick={onReview}>Review this diagram</Button>
        </div>
      ) : questions.length ? (
        <div className="exercises">
          {questions.map((question) => (
            <Exercise key={question.id + question.answer} question={question} />
          ))}
        </div>
      ) : (
        <div className="empty-library">
          <CheckCircle2 size={32} aria-hidden="true" />
          <p>Add a decision or reachable outcome to generate path questions.</p>
        </div>
      )}
      <p className="fine-print">
        These exercises check graph understanding. No learning improvement claim is made without a
        user study.
      </p>
    </section>
  );
}
