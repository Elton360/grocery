import { plural } from '../../../shared/format.js'
import { useConvergeStatus } from '../hooks/useConvergeStatus.js'
import { Link } from './Link.jsx'

/** Converge button + run status: runs headless Claude Code on the backend, proposals wait on the Review page. */
export function ConvergeBar({ onFinished }) {
  const { status: st, waiting, error, start } = useConvergeStatus(onFinished)
  const review = waiting > 0 && (
    <>
      {' '}
      {plural(waiting, 'proposal')} waiting for review.{' '}
      <Link to="/review">Review proposals</Link>
    </>
  )
  let text = null
  if (error)
    text = (
      <span className="err">Could not reach converge: {error.message}</span>
    )
  else if (!st) text = null
  else if (st.state === 'running') {
    text = `Converge running… ${st.elapsed || 0}s (Claude is reading your pending items)`
  } else if (st.state === 'finished') text = <>Converge finished.{review}</>
  else if (st.state === 'failed') {
    text = (
      <span className="err">
        Converge failed: {st.error || `exit code ${st.returncode}`}. See{' '}
        {st.log || 'the run log'}.
      </span>
    )
  } else if (st.state === 'unavailable')
    text = <span className="err">{st.message}</span>
  else text = st.message || review || null

  return (
    <>
      <button
        className="primary"
        onClick={start}
        disabled={st?.state === 'running'}
        title="Ask Claude to propose how pending items join your list"
      >
        Converge
      </button>
      {text && <p className="sub converge-status">{text}</p>}
    </>
  )
}
