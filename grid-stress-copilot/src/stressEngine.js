/**
 * Grid Stress Engine
 *
 * Deterministic rule-based scoring. Returns 0-100.
 *   0-30:  Low    (green)
 *  30-60:  Moderate (yellow)
 *  60-80:  High   (orange)
 * 80-100:  Critical (red)
 *
 * Inputs:
 *   temperature  – °F
 *   humidity     – 0-100
 *   hour         – 0-23
 *   dayOfWeek    – 0 (Sun) to 6 (Sat)
 *   windSpeed    – mph
 *   cloudCover   – 0-100
 *   evAdoption   – 'low' | 'medium' | 'high'
 */

// ─── helpers ────────────────────────────────────────────────────────────────

function lerp(value, inMin, inMax, outMin, outMax) {
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)))
  return outMin + t * (outMax - outMin)
}

// ─── sub-scores ─────────────────────────────────────────────────────────────

/**
 * Temperature stress — handles both heat and cold.
 * Max 35 pts. AC load is nonlinear; cold also stresses grid (heating + EV).
 */
function tempScore(temperature, humidity) {
  let score = 0

  if (temperature >= 75) {
    // Heat stress — nonlinear ramp
    if (temperature < 85)       score = lerp(temperature, 75, 85, 5, 15)
    else if (temperature < 95)  score = lerp(temperature, 85, 95, 15, 28)
    else if (temperature < 105) score = lerp(temperature, 95, 105, 28, 33)
    else                        score = 33 + lerp(temperature, 105, 115, 0, 2)

    // Humidity amplifier: heat index effect kicks in above 80°F
    if (temperature > 80) {
      const humidityBonus = lerp(humidity, 30, 90, 0, 5)
      score += humidityBonus
    }
  } else if (temperature <= 40) {
    // Cold stress — heating load + EV range anxiety
    if (temperature > 32)       score = lerp(temperature, 32, 40, 15, 8)
    else if (temperature > 10)  score = lerp(temperature, 10, 32, 30, 15)
    else                        score = 30 + lerp(temperature, -10, 10, 5, 0)
  } else {
    // Comfort zone: 40–75°F — minimal load
    score = lerp(temperature, 40, 75, 5, 1)
  }

  return Math.min(35, score)
}

/**
 * Time-of-day stress.
 * Max 30 pts. Captures the duck curve: solar drops at 4-7pm just as
 * residential demand peaks after workday commute.
 */
function timeScore(hour) {
  // Define anchor points [hour, score]
  const curve = [
    [0, 3], [4, 2], [6, 8], [9, 14], [12, 16],
    [15, 20], [17, 30], [19, 22], [21, 12], [23, 5],
  ]

  for (let i = 0; i < curve.length - 1; i++) {
    const [h0, s0] = curve[i]
    const [h1, s1] = curve[i + 1]
    if (hour >= h0 && hour < h1) {
      return lerp(hour, h0, h1, s0, s1)
    }
  }
  return curve[curve.length - 1][1]
}

/**
 * Day-of-week modifier.
 * Max 8 pts. Weekdays carry industrial and commercial load; weekends don't.
 */
function dayScore(dayOfWeek) {
  if (dayOfWeek === 0) return 2  // Sunday
  if (dayOfWeek === 6) return 4  // Saturday
  return 8                        // Mon–Fri
}

/**
 * Wind relief — negative contribution.
 * Wind increases generation supply and reduces cooling demand slightly.
 * Range: -10 to 0.
 */
function windScore(windSpeed) {
  if (windSpeed < 5)  return 0
  if (windSpeed < 15) return lerp(windSpeed, 5, 15, 0, -5)
  if (windSpeed < 25) return lerp(windSpeed, 15, 25, -5, -8)
  return -10
}

/**
 * Solar depletion score.
 * Max 12 pts. Only relevant during solar generation hours (8am–6pm).
 * Heavy cloud cover eliminates solar supply just as demand may be rising.
 */
function solarScore(hour, cloudCover) {
  if (hour < 8 || hour >= 18) return 0
  // Solar potential peaks at noon, tapers toward edges of window
  const solarPotential = lerp(
    Math.abs(hour - 13), 0, 5, 1.0, 0.2
  )
  return lerp(cloudCover, 0, 100, 0, 12) * solarPotential
}

/**
 * EV charging pressure.
 * Max 15 pts. Peaks in the 5–8pm commute arrival window.
 * Cold weather adds a range-anxiety top-off multiplier.
 * Monday gets a slight bump from weekend depletion.
 */
function evScore(hour, dayOfWeek, temperature, evAdoption) {
  const adoptionMultiplier = { low: 0.4, medium: 1.0, high: 2.2 }[evAdoption] ?? 1.0

  // Charging pressure curve — peaks at 6pm
  let chargingPressure = 0
  if (hour >= 17 && hour < 20) {
    chargingPressure = lerp(hour, 17, 20, 8, 2)
  } else if (hour >= 7 && hour < 9) {
    // Precondition pulse: EVs warm/cool cabin while plugged in before departure
    chargingPressure = lerp(hour, 7, 9, 3, 1)
  }

  // Cold range anxiety: below 40°F, drivers charge more aggressively
  const coldMultiplier = temperature < 40
    ? 1 + lerp(temperature, -10, 40, 0.6, 0)
    : 1.0

  // Monday depletion bump
  const mondayMultiplier = dayOfWeek === 1 ? 1.15 : 1.0

  return Math.min(15, chargingPressure * adoptionMultiplier * coldMultiplier * mondayMultiplier)
}

// ─── public API ─────────────────────────────────────────────────────────────

export function calculateStressScore({ temperature, humidity, hour, dayOfWeek, windSpeed, cloudCover, evAdoption }) {
  const score =
    tempScore(temperature, humidity) +
    timeScore(hour) +
    dayScore(dayOfWeek) +
    windScore(windSpeed) +
    solarScore(hour, cloudCover) +
    evScore(hour, dayOfWeek, temperature, evAdoption)

  return Math.min(100, Math.max(0, Math.round(score)))
}

/**
 * Returns an array of 24 stress scores (one per hour, 0–23),
 * holding all weather inputs constant and stepping through the clock.
 */
export function generate24HourForecast(inputs) {
  return Array.from({ length: 24 }, (_, hour) =>
    calculateStressScore({ ...inputs, hour })
  )
}

/**
 * Maps a score to a severity label and color.
 */
export function scoreToLevel(score) {
  if (score < 30) return { label: 'Low',      color: '#22c55e' }
  if (score < 60) return { label: 'Moderate', color: '#eab308' }
  if (score < 80) return { label: 'High',     color: '#f97316' }
  return               { label: 'Critical',  color: '#ef4444' }
}
