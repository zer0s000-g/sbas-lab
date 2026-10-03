import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, CircleSlash, XCircle } from 'lucide-react'
import { HudPanel } from '@/hud/HudFrame'
import { HudButton, Segmented } from '@/hud/Controls'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { examPlan, gradeExam, gradeQuiz, overall, PASS_MARK, type ExamPlan } from '@/assessment/assessment'
import { findLmsApi, LmsSession } from '@/lms/scorm'
import { FAILURES, type FailureId } from '@/journey/failures'
import type { JourneyEngine } from '@/journey/engine'
import { OBJECTIVES, QUESTIONS } from '@/scenarios/essp/questions'
import { cn } from '@/lib/utils'
import { useSources } from '../sources/store'
import { useAssessment } from './assessmentStore'
import { useExamLock } from './examLock'

type Tab = 'quiz' | 'exam' | 'result'
const label = (id: FailureId) => FAILURES.find((f) => f.id === id)?.label ?? id
const response = (id: FailureId) => FAILURES.find((f) => f.id === id)?.crewAtc ?? ''

function Mark({ ok }: { ok: boolean | null }) {
  if (ok === null)
    return (
      <span className="hud-label inline-flex items-center gap-1 text-muted-foreground">
        <CircleSlash className="size-3.5" aria-hidden /> Not answered
      </span>
    )
  return ok ? (
    <span className="hud-label inline-flex items-center gap-1 text-success">
      <CheckCircle2 className="size-3.5" aria-hidden /> Right
    </span>
  ) : (
    <span className="hud-label inline-flex items-center gap-1 text-destructive">
      <XCircle className="size-3.5" aria-hidden /> Not right
    </span>
  )
}

function Choice<T extends string | number>({ name, legend, options, value, onChange, disabled }: { name: string; legend: string; options: { value: T; text: string }[]; value: T | null; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <fieldset className="mt-2">
      <legend className="text-[13px] leading-5 font-medium text-foreground">{legend}</legend>
      <RadioGroup value={value === null ? '' : String(value)} onValueChange={(v) => onChange(options.find((o) => String(o.value) === v)!.value)} disabled={disabled} className="mt-1.5 gap-1">
        {options.map((o) => {
          const id = `${name}-${o.value}`
          return (
            <label key={id} htmlFor={id} className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-[3px] px-1 py-1.5 text-[12.5px] leading-5 text-foreground/90 hover:bg-foreground/5">
              <RadioGroupItem id={id} value={String(o.value)} className="mt-0.5" />
              <span>{o.text}</span>
            </label>
          )
        })}
      </RadioGroup>
    </fieldset>
  )
}

/**
 * The ESSP-SAS assessment: a quiz on EGNOS and its operation, and an exam that hides a
 * failure in the journey for the learner to find and handle. Results stay in this
 * browser and, when the page is launched from a learning management system, are
 * reported to it with SCORM.
 */
export function AssessmentPanel({ engine, index = '11' }: { engine: JourneyEngine; index?: string }) {
  const [tab, setTab] = useState<Tab>('quiz')
  const { quizAnswers, quizChecked, lastExam, setAnswer, checkQuiz, retryQuiz, saveExam } = useAssessment()
  const setLocked = useExamLock((s) => s.setLocked)
  const showSources = useSources((s) => s.show)
  const [running, setRunning] = useState<ExamPlan | null>(null)
  const [what, setWhat] = useState<FailureId | null>(null)
  const [action, setAction] = useState<FailureId | null>(null)

  const quiz = quizChecked ? gradeQuiz(QUESTIONS, quizAnswers) : null
  const lastPlan = useMemo(() => (lastExam ? examPlan(lastExam.seed, FAILURES) : null), [lastExam])
  const exam = lastExam && lastPlan ? gradeExam(lastPlan, lastExam.what, lastExam.action) : null
  const total = overall(quiz, exam, QUESTIONS.length)

  // Report to the LMS, when the page runs inside one.
  const lms = useRef<LmsSession | null>(null)
  const [lmsState, setLmsState] = useState<'none' | 'connected' | 'reported' | 'error'>('none')
  useEffect(() => {
    const found = typeof window !== 'undefined' ? findLmsApi(window as unknown as Parameters<typeof findLmsApi>[0]) : null
    if (!found) return
    lms.current = new LmsSession(found)
    setLmsState('connected')
    const end = () => lms.current?.finish()
    window.addEventListener('pagehide', end)
    return () => {
      window.removeEventListener('pagehide', end)
      end()
    }
  }, [])
  useEffect(() => {
    if (!lms.current || (!quiz && !exam)) return
    setLmsState(lms.current.report({ raw: total.raw, max: total.max, status: total.status }) ? 'reported' : 'error')
  }, [quiz?.correct, exam?.correct, total.raw, total.max, total.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // A running exam is abandoned (and its failure mended) if the panel goes away.
  useEffect(() => () => setLocked(false), [setLocked])

  const startExam = () => {
    const plan = examPlan((Date.now() % 2_000_000_000) + 1, FAILURES)
    for (const f of FAILURES) engine.setFailure(f.id, false)
    engine.jumpTo(plan.phase)
    engine.setFailure(plan.failure, true)
    engine.play()
    setWhat(null)
    setAction(null)
    setRunning(plan)
    setLocked(true)
  }
  const submitExam = () => {
    if (!running) return
    engine.setFailure(running.failure, false)
    saveExam({ seed: running.seed, what, action })
    setRunning(null)
    setLocked(false)
    setTab('result')
  }

  return (
    <HudPanel index={index} title="Assessment">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'quiz', label: 'Quiz', ariaLabel: 'Quiz' },
          { value: 'exam', label: 'Exam', ariaLabel: 'Exam' },
          { value: 'result', label: 'Result', ariaLabel: 'Result' },
        ]}
      />

      {tab === 'quiz' && (
        <div className="mt-2">
          <p className="text-[12.5px] leading-5 text-muted-foreground">{QUESTIONS.length} questions. Every answer rests on the claims listed under Sources.</p>
          {QUESTIONS.map((q, i) => (
            <div key={q.id} className="border-b border-hud-line pb-2 last:border-b-0">
              <Choice name={q.id} legend={`${i + 1}. ${q.prompt}`} options={q.options.map((text, k) => ({ value: k, text }))} value={quizAnswers[i] ?? null} onChange={(a) => setAnswer(i, a)} disabled={quizChecked} />
              {quiz && (
                <div className="mt-1 flex flex-col gap-1 text-[12px] leading-4">
                  <Mark ok={quiz.marks[i]} />
                  <p className="text-foreground/85">{q.explain}</p>
                  <button type="button" className="hud-label self-start normal-case underline-offset-2 hover:text-foreground hover:underline" onClick={() => showSources(q.claims)}>
                    Sources · {q.claims.length} claims
                  </button>
                </div>
              )}
            </div>
          ))}
          {quiz ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="hud-value text-[13px] text-foreground">
                {quiz.correct} / {quiz.max} right
              </p>
              <HudButton onClick={retryQuiz}>Try again</HudButton>
            </div>
          ) : (
            <HudButton variant="solid" className="mt-2 w-full" onClick={checkQuiz}>
              Check my answers
            </HudButton>
          )}
        </div>
      )}

      {tab === 'exam' && (
        <div className="mt-2 text-[12.5px] leading-5 text-foreground/90">
          {!running ? (
            <>
              <p>The exam jumps to the final approach at Nice and breaks one thing, chosen at random. Watch the panels, the map and the cockpit, then say what failed and what the crew and the controller do. Break something is locked meanwhile.</p>
              <HudButton variant="solid" className="mt-2 w-full" onClick={startExam}>
                Start the exam
              </HudButton>
            </>
          ) : (
            <>
              <p className="hud-label text-brass">Exam running · something has failed</p>
              <Choice name="exam-what" legend="1. What failed?" options={running.whatOptions.map((id) => ({ value: id, text: label(id) }))} value={what} onChange={setWhat} />
              <Choice name="exam-action" legend="2. What do the crew and the controller do?" options={running.actionOptions.map((id) => ({ value: id, text: response(id) }))} value={action} onChange={setAction} />
              <HudButton variant="solid" className="mt-2 w-full" onClick={submitExam}>
                Hand in the exam
              </HudButton>
            </>
          )}
        </div>
      )}

      {tab === 'result' && (
        <div className="mt-2 flex flex-col gap-2 text-[12.5px] leading-5">
          <p className={cn('hud-value text-[15px]', total.status === 'passed' ? 'text-success' : total.status === 'failed' ? 'text-destructive' : 'text-foreground')}>
            {total.raw} / {total.max} · {total.status === 'incomplete' ? 'Incomplete: do the quiz and the exam' : total.status === 'passed' ? 'Passed' : 'Not passed yet'}
          </p>
          <p className="text-muted-foreground">Pass mark {Math.round(PASS_MARK * 100)} % of the quiz and exam points together.</p>
          <p>Quiz: {quiz ? `${quiz.correct} / ${quiz.max}` : 'not checked yet'}.</p>
          {exam && lastPlan ? (
            <div>
              <p>Exam: {exam.correct} / 2.</p>
              <p className="mt-1 flex flex-wrap items-center gap-2">
                What failed: <Mark ok={lastExam!.what === null ? null : exam.whatRight} /> It was <strong className="font-medium">{label(lastPlan.failure)}</strong>.
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2">
                What the crew and ATC do: <Mark ok={lastExam!.action === null ? null : exam.actionRight} />
              </p>
              <p className="mt-1 text-foreground/85">{FAILURES.find((f) => f.id === lastPlan.failure)?.notice}</p>
            </div>
          ) : (
            <p>Exam: not taken yet.</p>
          )}
          <p className="hud-label normal-case" aria-live="polite">
            {lmsState === 'none' ? 'Not launched from a learning management system: results stay in this browser.' : lmsState === 'error' ? 'The learning management system did not accept the result.' : lmsState === 'reported' ? 'Result sent to your learning management system (SCORM).' : 'Connected to your learning management system (SCORM).'}
          </p>
          <details className="mt-1">
            <summary className="hud-label cursor-pointer">Learning objectives</summary>
            <ul className="mt-1 list-disc pl-5 text-foreground/85">
              {OBJECTIVES.map((o) => (
                <li key={o.id}>{o.text}</li>
              ))}
            </ul>
            <p className="mt-1 text-[11.5px] text-muted-foreground">This page’s own objectives; a training organisation maps them to its syllabus.</p>
          </details>
        </div>
      )}
    </HudPanel>
  )
}
