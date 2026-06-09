# Bluetooth kitchen scale — reference & bring-up guide

Groundwork for connecting a Bluetooth food scale so its **live weight drives the amount** when
logging a food (macros update as you add/remove food). Built ahead of the hardware; this doc is the
bench guide for getting the real scale talking + the fallback plan if the documented protocol misses.

**Target scale:** Renpho **ES-SNG01** food scale = rebadged Etekcity **ESN00** (both VeSync brands).
Pairs with the **Gennec** app (not the usual Renpho app).

---

## What's already built

| File | Role |
|---|---|
| `src/lib/scales/types.ts` | `ScaleAdapter` interface — match rule + notify UUIDs + `parse(bytes)→grams` + optional `init`/`tare`. `ScaleReading { grams, stable, displayUnit?, raw? }`. |
| `src/lib/scales/esn00.ts` | **Renpho ES-SNG01 / Etekcity ESN00 driver** — the one to edit if the protocol differs. |
| `src/lib/scales/registry.ts` | List of adapters. Add a new scale = one adapter file + one line here. |
| `src/lib/scales/useScale.ts` | Hook: scan → match → connect → live grams, auto-reconnect, **software tare**, `simulate` mode. |
| `src/lib/scales/ble.ts` | base64↔bytes, hex dump, Android permission request. |
| `src/components/ScaleWeighBar.tsx` | Compact live-weigh strip (status + grams + Tare/Simulate). |
| `src/components/FoodQuantitySheet.tsx` | Scale button → live grams fill the amount → macros update live. |
| `src/app/custom-food.tsx` | "Weigh on scale" → fills a custom food's serving size. |
| `src/app/scale.tsx` | **Settings → Bluetooth scale**: connect/test + live readout + tare + **raw-frame inspector**. |

**Key principle:** every adapter normalizes weight to **grams** inside `parse`, so the rest of the app
never deals with a scale's g/oz/ml display unit. Adding a future scale touches only `src/lib/scales/`.

---

## Documented ESN00 protocol (what `esn00.ts` assumes)

Source: community reverse-engineering (`hertzg/metekcity`).

```
service     00001910-0000-1000-8000-00805f9b34fb   (0x1910)
notify char 00002c12-0000-1000-8000-00805f9b34fb   (0x2c12)   device → app
write char  00002c11-0000-1000-8000-00805f9b34fb   (0x2c11)   app → device (commands)
```

**Measurement frame** = header + type byte `0xD0` + 5-byte payload:

| payload offset | field | notes |
|---|---|---|
| 0 | sign | `0x00` = +, `0x01` = − |
| 1–2 | weight | **big-endian** uint16 |
| 3 | unit | `0`=g `1`=lb:oz `2`=ml `3`=fl-oz `4`=ml(milk) `5`=fl-oz(milk) `6`=oz |
| 4 | stable | `0x00` = measuring, `0x01` = settled |

- **grams = weight ÷ 10** (when unit = g). The unit byte is the scale's **display** unit and the value
  is in that unit, so the adapter converts to grams from whatever the scale is set to.
- `parse()` currently **signature-scans for the `0xD0` type byte** (the header magic/length/checksum
  isn't confirmed) and validates the payload (unit ≤ 6, stable ≤ 1, |grams| ≤ 6000).

### Not yet confirmed on hardware (the gaps)
- The **frame header** (magic / length / checksum) — hence the signature-scan instead of a fixed offset.
- The **tare command** (`0xC1 SET_TARE`) and **unit command** (`0xC0 SET_UNIT`) framing → `tare` is left
  off the adapter, so the app uses **software tare** (subtract a captured offset) for now.
- **oz / ml / fl-oz scaling** — the g and ml paths (÷10) are solid; oz/lb-oz/fl-oz use a best-guess ÷100.
  You'll likely keep the scale in grams, where this doesn't matter.

---

## Test it TODAY (no hardware)

Open a food → quantity sheet → tap the **scale icon** → **Simulate**. A mock weight ramps and settles;
the amount + macros update live. Works in Expo Go. (Also Settings → Bluetooth scale → "Simulator".)

---

## Tomorrow — happy path (needs a dev build; BLE doesn't work in Expo Go or a simulator)

1. Build a dev build to a physical phone (`npm run ios` / dev build).
2. Power on the scale, then **Settings → Bluetooth scale**.
3. If it auto-connects and the grams match a known weight → **done**. Try Tare; try a food log.

---

## Tomorrow — if it does NOT connect

The Settings → Bluetooth scale screen tells you which failure it is:

| Symptom | Meaning | Fix area |
|---|---|---|
| Stuck on **"Searching…"** | never *matched* (advertised name unknown, no `0x1910` in advert) | `esn00.ts` → `matches()` |
| **"Connected"** but readout `– –` | connected, **no notifications** → wrong notify char, or needs a handshake write | `esn00.ts` → `notify` / `init()` |
| **"Connected"** + numbers, but **wrong** | frame layout/scaling differs from the doc above | `esn00.ts` → `parse()` |

### Step 1 — capture the real GATT + frames (fastest: nRF Connect)
Nordic **nRF Connect** (free, iOS/Android) is a better GATT explorer than the in-app one. Connect to the
scale, expand its services, enable notifications on the candidate characteristic(s), then put **known
weights** on and read the hex.

**Capture this and the fix is usually a one-line edit:**
- [ ] exact **advertised device name**
- [ ] the **service UUID** + the **notify characteristic UUID** that actually streams
- [ ] **4 raw frames** (hex): **0 g** (empty), exactly **100 g**, **200 g**, then toggle the scale unit
      **g → oz** and grab one more
- [ ] does data flow **immediately on connect**, or only after the official app does something?

From those frames: find the bytes that change between 100 g and 200 g → that's the weight field. 100 g as
`0x03E8` (1000) ⇒ ÷10 scaling; as `0x0064` (100) ⇒ ÷1. Big-endian if it reads `03 E8`, little-endian if
`E8 03`. The byte that flips 0→1 when it settles is `stable`; the byte that changes on unit toggle is `unit`.

### Step 2 — apply the fix (one file)
- Wrong name → broaden `matches()` in `esn00.ts`.
- Wrong notify char → update `notify: { service, characteristic }`.
- Different frame → rewrite `parseEsn00Packet()` (or add a new adapter file + register it).
- The **in-app raw inspector** (Settings → Bluetooth scale → "Protocol inspector") shows the last hex frame
  from the matched char to confirm the change live.

### Step 3 — handshake / tare command (only if needed) → HCI snoop + Wireshark
If the scale connects but stays silent (needs a "start streaming" write), or to wire **hardware tare**:
1. Android **Developer options → enable Bluetooth HCI snoop log**.
2. Use the official **Gennec** app: connect, weigh, **tare**.
3. Pull `btsnoop_hci.log` (`adb pull` / bug report) and open in **Wireshark**.
4. Find the **writes** the app sends to `0x2c11` (or whatever the write char is): the one **before
   notifications begin** → `init()`; the one **on tare** → `tare()`.
5. Implement `init`/`tare` on the adapter (write bytes via `bytesToBase64` from `ble.ts`).

Until then, **software tare** works (the in-app "Tare" zeroes the reading), and the scale's own **TARE
button** always works.

---

## Optional groundwork: in-app GATT explorer
The current inspector only watches the *matched* characteristic, so it's blind when matching fails. A
full **in-app GATT explorer** (list all devices → dump all services/chars → subscribe to all notifiable →
live hex) would make bring-up self-contained (no nRF Connect) and pay off for every future scale. Not yet
built — ask if you want it. (Handshake/tare commands still need HCI snoop regardless.)

---

## Adding a future scale (the whole point of the abstraction)
1. New file `src/lib/scales/<scale>.ts` exporting a `ScaleAdapter` (match + notify UUIDs + `parse`→grams).
2. Add it to `SCALE_ADAPTERS` in `registry.ts`.
3. Done — the hook, the weigh bar, the quantity-sheet integration, and the Settings screen all just work.
