# ⚡ Tesla Coil Simulator

An interactive resonant LC circuit visualizer built in the browser — tune the parameters, hit energize, and watch the physics happen in real time.

**[Try it live →](https://samriddha-guragain.github.io/tesla-coil-sim)**

![Tesla Coil Simulator](docs/preview.png)

---

## Why I Built This

In grade 9, I built a Tesla coil from scratch — copper wire, a 2N2222 transistor, PVC pipe, and a battery. First attempt failed. Second attempt involved two AC-powered batteries and enough current to shock me repeatedly. Third attempt — the fluorescent bulb glowed wirelessly across the room.

I understood the physics instinctively before I could write the equations. This simulator is the bridge between those two things.

It's also an attempt to make resonant circuit physics accessible to anyone — no oscilloscope, no lab, no expensive hardware required. Just a browser.

---

## What It Simulates

- **Resonant frequency** — f = 1 / (2π√LC)
- **Voltage multiplication** — V_out = V_in · (Ns/Np) · k
- **Spark gap breakdown** — Paschen curve approximation for air at STP (~3 kV/mm)
- **Quality factor Q** — ωL / R
- **Skin depth δ** — √(ρ / πfμ) — how deep AC current penetrates the wire
- **EM field radiation** — the rings you see radiating from the toroid are what I actually observed in the physical build

---

## Parameters You Can Tune

| Parameter | Description |
|---|---|
| Primary Turns | Number of turns in the primary coil |
| Secondary Turns | Number of turns in the secondary coil |
| Top Capacitance | Capacitance of the top terminal (toroid) in pF |
| Coupling k | Magnetic coupling coefficient between coils |
| Input Voltage | Voltage fed into the primary circuit |
| Spark Gap | Distance between spark gap electrodes in mm |
| Wire Gauge | AWG of secondary winding — affects resistance and skin depth |

Arcs only fire when output voltage exceeds the spark gap breakdown threshold. That's not decoration — that's the actual condition.

---

## How to Run

**Easiest — just open the HTML:**
```
git clone https://github.com/samriddha-guragain/tesla-coil-sim
cd tesla-coil-sim
open index.html
```
No installation. No dependencies. Opens in any browser.

**React version:**
```
npm create vite@latest tesla-coil-app -- --template react
cd tesla-coil-app
npm install
# Replace src/App.jsx with src/TeslaCoilSim.jsx
npm run dev
```

---

## Files

```
tesla-coil-sim/
├── index.html          ← standalone, runs in any browser
├── src/
│   └── TeslaCoilSim.jsx  ← React version
├── docs/
│   └── preview.png
└── README.md
```

---

## Built With

- Vanilla HTML/CSS/JavaScript (standalone version)
- React + Canvas API (JSX version)
- No external physics libraries — all equations implemented from scratch

---

## Open Source

Use it, fork it, learn from it. If you're a student trying to understand resonant circuits — this is for you.

If you find a physics error, open an issue. I want this to be accurate.

---

*Built by [Samriddha Guragain](https://github.com/samriddha-guragain) — Jhapa, Nepal*
*"Got shocked too much and too frequently on attempt two. Built it anyway."*
