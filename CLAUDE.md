# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the 2026 TVG hacks project repository. Currently in initial setup phase.

---

## Prompt

Grid Stress Alert Copilot 

Predicts high-risk grid stress periods from weather/time inputs and suggests actions like shifting load or reducing noncritical usage.

Blow this idea up,  brainstorm what would go into it and how a system like this could be integrated

This is a genuinely useful idea — grid stress is a real problem that's getting worse with EV adoption, heat pump proliferation, and aging infrastructure. Let me break down what a full system like this would look like.

## What "Grid Stress" Actually Means

Before building the system, you need a clear definition of what you're predicting. Grid stress manifests as:

- **Frequency deviation** (normal is 60Hz in the US — stress pushes it below ~59.95Hz)
- **Voltage sag** on distribution lines
- **Reserve margin compression** — how close total generation is to peak demand
- **Transmission congestion** — bottlenecks between regions
- **Rolling brownout/blackout risk** — when utilities start considering demand response events

The copilot would need to map weather and behavioral signals to these underlying phenomena rather than just a vague "stress score."

---

## Input Layer — What You're Feeding It

**Weather signals** are the most powerful predictors:
- Temperature (especially heat index and apparent temp — AC load is nonlinear)
- Humidity (compounds AC demand)
- Wind speed (affects both demand *and* wind generation supply)
- Cloud cover (affects solar generation)
- Rate of temperature change (a rapid morning warm-up spikes demand differently than a gradual one)
- Multi-day forecast (back-to-back hot nights prevent thermal mass cooling, ratcheting baseline demand upward)

**Time signals:**
- Hour of day (duck curve dynamics — solar drops off at 4-7pm just as residential demand peaks)
- Day of week (industrial load drops on weekends)
- Seasonal calendar (summer peak season vs. shoulder months)
- Holidays (commercial load collapses, residential stays elevated)
- Local events (Super Bowl Sunday, major sporting events cause synchronous load spikes when people turn on TVs simultaneously)

**Grid state signals** (if you can get them):
- Real-time pricing from ISOs like CAISO, ERCOT, PJM, MISO — LMP (Locational Marginal Pricing) spikes are a leading indicator of stress
- Frequency data (Grid Watch APIs, EIA data)
- Current reserve margins published by ISOs
- Active demand response events from utilities

**Behavioral/contextual signals:**
- EV charging patterns in the service area
- Industrial customer schedules
- School and university calendars
- Construction activity

---

## The Prediction Engine

This is where it gets interesting architecturally. You'd want a multi-horizon prediction system:

**72-hour lookahead** — medium-term planning, powered by weather forecasts + historical load curves. This is where you tell a factory "Tuesday afternoon looks bad, consider shifting your production run to Tuesday night."

**24-hour lookahead** — higher confidence, more actionable. Utilities already do this internally. Your system democratizes that signal.

**4-hour lookahead** — near-real-time, integrating current grid frequency and pricing. This is where you push alerts to building automation systems and smart devices.

**Real-time (15-min)** — reactive mode, integrating actual ISO pricing and frequency deviation to trigger immediate actions.

The model itself could be a gradient-boosted ensemble (XGBoost/LightGBM work extremely well for tabular time-series like this) trained on historical ISO data, weather records, and confirmed stress events. You'd want separate models per ISO zone since ERCOT, CAISO, and PJM have fundamentally different grid topologies and generation mixes.

---

## The Action Suggestion Layer

This is what makes it a *copilot* rather than just a dashboard. Actions need to be segmented by user type:

**For residential users:**
- Pre-cool your home 2 hours before the predicted peak (thermal storage in the building mass)
- Delay dishwasher, laundry, EV charging until after 9pm
- Raise thermostat setpoint by 2°F during the 4-7pm window
- Notifications tied to smart home platforms (ecobee, Nest, SmartThings)

**For commercial building operators:**
- Demand limiting strategies — shed non-critical HVAC zones
- Lighting dimming schedules
- Load shifting for refrigeration pre-cooling
- Coordination with on-site battery storage dispatch
- Automated integration with BMS (Building Management Systems) via BACnet/Modbus

**For industrial facilities:**
- Production schedule optimization around predicted stress windows
- Compressor/chiller staging recommendations
- Curtailable load identification (which processes can pause vs. which can't)
- Demand charge management (avoiding new peak kW that sets your billing demand for 12 months)

**For utilities/grid operators:**
- Early warning to pre-position spinning reserves
- Demand response program activation recommendations
- Predictive maintenance flags (transformers under sustained thermal stress)

---

## Integration Architecture

This is where the real engineering challenge lives.

**Data ingestion layer:**
- ISO/RTO APIs: CAISO OASIS, ERCOT Data API, PJM Data Miner, MISO API — all public but messy
- Weather: Tomorrow.io or NOAA APIs for forecast data, with sub-hourly resolution
- Smart meter data: Utility AMI (Advanced Metering Infrastructure) systems via Green Button Connect
- Building systems: REST APIs to BMS platforms, or direct integration with Niagara Framework

**Alert delivery:**
- Push notifications (mobile app)
- Webhook integrations into building automation
- Direct API calls to smart thermostats (ecobee API, Google Home API)
- SCADA integration for industrial customers
- Email/SMS for simpler use cases

**Feedback loop:**
- Did the action actually get taken? (compliance tracking)
- What was the load reduction achieved?
- Model retraining on outcomes

---

## Monetization and Business Model Angles

A few different ways this could live in the world:

**Demand Response as a Service** — aggregate the load flexibility of many customers and bid it into ISO demand response markets. You essentially become a virtual power plant operator. ERCOT and PJM pay well for this. This is what companies like Voltus and OhmConnect have built.

**Utility white-label** — sell the prediction and recommendation engine to utilities who want to offer it to their customers under their own brand as a grid engagement tool.

**C&I (Commercial & Industrial) SaaS** — charge facility managers a monthly fee to avoid demand charges and participate in curtailment programs. The ROI story is concrete: a large commercial facility can save $50-200K/year in demand charges alone.

**Consumer app with utility partnerships** — the OhmConnect model: utilities pay you to reduce load, you share some of that payment with consumers as cash or bill credits.

---

## What Makes This Hard

**Data access** is the real moat/barrier. ISO APIs are public but inconsistent and often delayed. Utility AMI data requires Green Button agreements and utility cooperation. Real-time building data requires hardware integrations.

**Geographic fragmentation** — the US has 66 balancing authorities with different market rules, pricing structures, and data formats. A system that works perfectly for ERCOT (Texas) needs significant rearchitecting for NYISO.

**Prediction error asymmetry** — a false positive (crying wolf on a stress event that doesn't materialize) erodes user trust faster than missing a real event. The alert threshold tuning matters enormously.

**Actuation complexity** — telling someone what to do is easy. Actually automating the action across heterogeneous building systems, devices, and ownership structures is genuinely hard engineering.

---

## Comparable Existing Players

Worth knowing who's already in this space so you know where the white space is: **AutoGrid** (utility-side AI), **Voltus** (industrial demand response aggregation), **OhmConnect** (consumer demand response), **EnergyHub** (utility demand response via smart devices), **Uplight** (utility customer engagement). Most of these are B2B or utility-facing — the gap is a clean, developer-accessible API and a modern consumer-facing product that doesn't require a utility partnership to get started.

---

The most tractable MVP would probably be: ingest ERCOT (Texas) real-time pricing + Tomorrow.io weather, build a 24-hour stress prediction model, and expose it as a clean API with a simple dashboard. Texas is ideal because ERCOT is an island grid with dramatic, well-documented stress events and excellent public data. You'd have something demonstrable very quickly.

---

## Prompt

I want to get from 0 to MVP as fast as possible, what would my steps look like now. Say I gave you 1 hour to complete this project, what would you do? Don't code anything just generate me steps again

## Response

Got it. Here's the 1-hour sprint plan:

---

## The 1-Hour MVP Plan

The goal is a working, demonstrable product by the end of the hour — not a finished product, but something real you can put in front of a person and get a reaction from.

---

**Minutes 0-10 — Scaffold**

Bootstrap a single React app with Vite. No backend, no database, no auth. Everything runs in the browser. The entire "backend" is the Claude API called directly from the frontend and a stress scoring function written in JavaScript. This decision eliminates probably 80% of the work that would otherwise kill your timeline.

---

**Minutes 10-25 — The Stress Engine**

Write a pure JavaScript function that takes weather and time inputs and returns a stress score from 0-100. The inputs are: temperature, humidity, hour of day, day of week, wind speed, cloud cover. The logic is deterministic rules — no ML, no API calls, no training data. Hot afternoon on a weekday with no wind = high score. This is the entire "AI" of the system at this stage, and it's enough. You can validate the logic against known events like the 2021 Texas freeze or a summer heat dome and sanity-check the outputs manually.

---

**Minutes 25-40 — The UI**

Build one screen. A weather/time input panel on the left. A stress gauge in the center — a big number with a color (green/yellow/orange/red) that updates live as you move the inputs. A 24-hour forecast bar chart below it showing how stress evolves across the day given the current weather inputs. No routing, no multiple pages, no settings. The entire product is this one screen.

---

**Minutes 40-55 — The Copilot Layer**

Wire in the Claude API. When stress exceeds a threshold, a panel appears with AI-generated action recommendations. The prompt tells Claude the current stress score, inputs, and user type (you hardcode "commercial building operator" for the demo), and asks for 3-5 specific actions ranked by impact. This is what makes it a *copilot* rather than just a calculator. The AI layer takes maybe 15 lines of code to add.

---

**Minutes 55-60 — Smoke Test**

Run through three scenarios manually: a mild spring morning (should show green, no alert), a 102°F Tuesday at 5pm (should show red, trigger Claude recommendations), and a winter freeze night (should show orange/red with different recommendations). If all three behave correctly, you have an MVP.

---

## What You Have at the End of the Hour

A single-page app that takes weather and time as inputs, computes a real-time grid stress score using defensible logic, renders a live visual gauge and 24-hour forecast, and calls Claude to generate specific load-shifting recommendations when stress is elevated. It's demonstrable, it's explainable, and it's a real foundation — not a mockup.

---

## What You Deliberately Punted

Real ERCOT API data, user accounts, push notifications, building system integrations, a mobile app, multi-ISO support, and an actual ML model. None of that matters for the first hour. The question the MVP answers is: *does this concept resonate when someone uses it?* Everything else is version two.

---

Want me to actually build it now?
