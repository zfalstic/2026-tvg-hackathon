import { useState, useMemo } from 'react'
import { calculateStressScore, generate24HourForecast, scoreToLevel } from './stressEngine'
import './App.css'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatHour(h) {
  if (h === 0)  return '12am'
  if (h < 12)   return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

// ─── Gauge ────────────────────────────────────────────────────────────────────
// Semi-circle SVG gauge. pathLength=100 so strokeDasharray maps directly to score.
// Arc: M 10,100 A 90,90 0 1,1 190,100  →  upper semicircle, left→top→right.
function StressGauge({ score }) {
  const { label, color } = scoreToLevel(score)

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 200 115" width="100%">
        {/* Track */}
        <path
          d="M 10,100 A 90,90 0 1,1 190,100"
          fill="none"
          stroke="#1e2535"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d="M 10,100 A 90,90 0 1,1 190,100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${score} 100`}
          style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s ease' }}
        />
        {/* Score */}
        <text
          x="100" y="82"
          textAnchor="middle"
          fontSize="44"
          fontWeight="700"
          fill={color}
          style={{ transition: 'fill 0.4s ease' }}
        >
          {score}
        </text>
        {/* Level label */}
        <text x="100" y="100" textAnchor="middle" fontSize="11" fill="#4b5563" letterSpacing="2">
          {label.toUpperCase()}
        </text>
        {/* End markers */}
        <text x="10"  y="113" textAnchor="middle" fontSize="9" fill="#374151">0</text>
        <text x="190" y="113" textAnchor="middle" fontSize="9" fill="#374151">100</text>
      </svg>
    </div>
  )
}

// ─── 24-Hour Forecast Chart ───────────────────────────────────────────────────
function ForecastChart({ forecast, currentHour }) {
  return (
    <div className="forecast-bars">
      {forecast.map((score, hour) => {
        const { color } = scoreToLevel(score)
        const showLabel = hour % 6 === 0
        return (
          <div key={hour} className={`bar-col${hour === currentHour ? ' current-hour' : ''}`}>
            <div className="bar-inner">
              <div className="bar-fill" style={{ height: `${score}%`, background: color }} />
            </div>
            <div className="bar-label">{showLabel ? formatHour(hour) : ''}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Slider ───────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, unit, onChange }) {
  return (
    <div className="input-row">
      <div className="input-label">
        <span>{label}</span>
        <strong>{value}{unit}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
const now = new Date()

export default function App() {
  const [inputs, setInputs] = useState({
    temperature: 72,
    humidity:    50,
    hour:        now.getHours(),
    dayOfWeek:   now.getDay(),
    windSpeed:   8,
    cloudCover:  30,
    evAdoption:  'medium',
  })

  const set = key => val => setInputs(prev => ({ ...prev, [key]: val }))

  const score    = useMemo(() => calculateStressScore(inputs),    [inputs])
  const forecast = useMemo(() => generate24HourForecast(inputs), [inputs])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Grid Stress Copilot</h1>
        <p>Predict high-risk grid stress periods from weather &amp; time signals</p>
      </header>

      <main className="app-main">
        {/* ── Left: inputs ── */}
        <div className="panel inputs-panel">
          <h2>Conditions</h2>

          <Slider label="Temperature" value={inputs.temperature} min={-10} max={120} unit="°F" onChange={set('temperature')} />
          <Slider label="Humidity"    value={inputs.humidity}    min={0}   max={100} unit="%"  onChange={set('humidity')} />
          <Slider label="Wind Speed"  value={inputs.windSpeed}   min={0}   max={60}  unit=" mph" onChange={set('windSpeed')} />
          <Slider label="Cloud Cover" value={inputs.cloudCover}  min={0}   max={100} unit="%" onChange={set('cloudCover')} />

          <div className="input-row">
            <div className="input-label">
              <span>Hour of Day</span>
              <strong>{formatHour(inputs.hour)}</strong>
            </div>
            <input
              type="range" min={0} max={23}
              value={inputs.hour}
              onChange={e => set('hour')(Number(e.target.value))}
            />
          </div>

          <div className="select-row">
            <label>Day of Week</label>
            <select value={inputs.dayOfWeek} onChange={e => set('dayOfWeek')(Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>

          <div className="select-row">
            <label>EV Adoption</label>
            <select value={inputs.evAdoption} onChange={e => set('evAdoption')(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* ── Right: gauge ── */}
        <div className="panel gauge-panel">
          <h2>Grid Stress Index</h2>
          <StressGauge score={score} />
        </div>
      </main>

      {/* ── Bottom: 24h forecast ── */}
      <section className="forecast-section">
        <h2>24-Hour Forecast — stress by hour (weather held constant)</h2>
        <ForecastChart forecast={forecast} currentHour={inputs.hour} />
      </section>
    </div>
  )
}
