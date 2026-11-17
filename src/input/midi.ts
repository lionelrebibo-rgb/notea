import { emitNoteOff, emitNoteOn } from './hub';

/**
 * Web MIDI connection to the digital piano (e.g. Clavinova via USB TO HOST + OTG cable).
 * Works in Chrome on Android / Windows / macOS. Not available in Safari on iPad.
 */
export type MidiStatus = 'unsupported' | 'idle' | 'denied' | 'no-device' | 'connected';

interface MidiState {
  status: MidiStatus;
  inputs: string[];
  outputs: string[];
  error?: string;
  /** name of the piano connected over Bluetooth (Web Bluetooth BLE-MIDI) */
  ble?: string | null;
  bleError?: string | null;
}

let access: MIDIAccess | null = null;
let state: MidiState = { status: supportsMidi() ? 'idle' : 'unsupported', inputs: [], outputs: [] };
const listeners = new Set<(s: MidiState) => void>();
let lastActivity = 0;

export function supportsMidi(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

export function midiState() {
  return state;
}

export function onMidiState(fn: (s: MidiState) => void) {
  listeners.add(fn);
  fn(state);
  return () => { listeners.delete(fn); };
}

function setState(s: Partial<MidiState>) {
  state = { ...state, ...s };
  for (const l of listeners) l(state);
}

export function lastMidiActivity() {
  return lastActivity;
}

function handleMessage(ev: MIDIMessageEvent) {
  const data = ev.data;
  if (!data || data.length < 2) return;
  const cmd = data[0] & 0xf0;
  const note = data[1];
  const vel = data.length > 2 ? data[2] : 0;
  // MIDI timestamps share the performance.now() clock
  const time = ev.timeStamp || performance.now();
  lastActivity = performance.now();
  if (cmd === 0x90 && vel > 0) {
    emitNoteOn({ midi: note, velocity: vel / 127, time, source: 'midi' });
  } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
    emitNoteOff({ midi: note, velocity: 0, time, source: 'midi' });
  }
}

function refresh() {
  if (!access) return;
  const inputs: string[] = [];
  const outputs: string[] = [];
  access.inputs.forEach((input) => {
    inputs.push(input.name || 'Clavier MIDI');
    input.onmidimessage = handleMessage;
  });
  access.outputs.forEach((o) => outputs.push(o.name || 'Sortie MIDI'));
  setState({ inputs, outputs, status: inputs.length || state.ble ? 'connected' : 'no-device' });
}

function setBle(name: string | null, error: string | null = null) {
  const usb = state.inputs.length > 0;
  let status: MidiStatus = state.status;
  if (name || usb) status = 'connected';
  else if (status === 'connected') status = access ? 'no-device' : supportsMidi() ? 'idle' : 'unsupported';
  setState({ ble: name, bleError: error, status });
}

/* ---------------- Bluetooth LE MIDI (Web Bluetooth, Chrome on Android) ---------------- */

const BLE_MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
const BLE_MIDI_CHAR = '7772e5db-3868-4112-a1a9-f2669d106bf3';
let bleChar: BluetoothRemoteGATTCharacteristic | null = null;
let bleDevice: BluetoothDevice | null = null;
let bleQueue: Promise<void> = Promise.resolve();

export function supportsBluetooth(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

function dispatch(status: number, d1: number, d2: number, time: number) {
  const cmd = status & 0xf0;
  lastActivity = performance.now();
  if (cmd === 0x90 && d2 > 0) emitNoteOn({ midi: d1, velocity: d2 / 127, time, source: 'midi' });
  else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) emitNoteOff({ midi: d1, velocity: 0, time, source: 'midi' });
}

/**
 * Decode a BLE-MIDI packet: [header][timestamp][status][data…]([timestamp][status][data…])…
 * Running status is allowed, and a timestamp byte always precedes a new status byte.
 */
export function parseBleMidi(d: Uint8Array, onMsg: (status: number, d1: number, d2: number) => void) {
  if (d.length < 3 || !(d[0] & 0x80)) return;
  let i = 1;
  let status = 0;
  let inSysex = false;
  while (i < d.length) {
    let b = d[i];
    if (inSysex) {
      // skip until end of sysex (F7 is preceded by a timestamp byte)
      if (b === 0xf7) inSysex = false;
      i++;
      continue;
    }
    if (b & 0x80) {
      // timestamp byte
      i++;
      if (i >= d.length) break;
      b = d[i];
      if (b & 0x80) {
        if (b === 0xf0) {
          inSysex = true;
          i++;
          continue;
        }
        if (b >= 0xf8) {
          i++; // real-time message (clock, active sensing…)
          continue;
        }
        if (b >= 0xf0) {
          status = 0;
          i++;
          continue;
        }
        status = b;
        i++;
      }
    }
    if (!status) {
      i++;
      continue;
    }
    const cmd = status & 0xf0;
    const len = cmd === 0xc0 || cmd === 0xd0 ? 1 : 2;
    if (i + len > d.length) break;
    onMsg(status, d[i], len === 2 ? d[i + 1] : 0);
    i += len;
  }
}

async function attach(device: BluetoothDevice) {
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(BLE_MIDI_SERVICE);
  const ch = await service.getCharacteristic(BLE_MIDI_CHAR);
  ch.addEventListener('characteristicvaluechanged', (ev) => {
    const v = (ev.target as BluetoothRemoteGATTCharacteristic).value;
    if (!v) return;
    const now = performance.now();
    parseBleMidi(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), (s, a, b) => dispatch(s, a, b, now));
  });
  await ch.startNotifications();
  bleChar = ch;
  bleDevice = device;
  setBle(device.name || 'Piano Bluetooth');
}

/** Ask Chrome to show nearby Bluetooth MIDI instruments and connect to the chosen one. */
export async function connectBluetooth(): Promise<boolean> {
  if (!supportsBluetooth()) {
    setBle(null, 'Bluetooth non disponible dans ce navigateur (utilise Chrome sur Android).');
    return false;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_MIDI_SERVICE] }] });
    device.addEventListener('gattserverdisconnected', async () => {
      bleChar = null;
      setBle(null, 'Connexion Bluetooth perdue, reconnexion…');
      // one automatic retry (the piano may have gone to sleep for a moment)
      try {
        await new Promise((r) => setTimeout(r, 1000));
        await attach(device);
      } catch {
        setBle(null, 'Piano Bluetooth déconnecté.');
      }
    });
    await attach(device);
    return true;
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/cancel/i.test(msg) || e?.name === 'NotFoundError') {
      setBle(null, 'Aucun piano choisi. Si ton Clavinova n’apparaît pas dans la liste, il ne gère peut-être que le Bluetooth audio.');
    } else {
      setBle(null, 'Connexion Bluetooth impossible : ' + msg);
    }
    return false;
  }
}

export function disconnectBluetooth() {
  const d = bleDevice;
  bleDevice = null;
  bleChar = null;
  try {
    d?.gatt?.disconnect();
  } catch {
    /* ignore */
  }
  setBle(null);
}

function bleSend(bytes: number[]) {
  const ch = bleChar;
  if (!ch) return;
  const ts = Math.floor(performance.now()) & 0x1fff;
  const packet = new Uint8Array([0x80 | ((ts >> 7) & 0x3f), 0x80 | (ts & 0x7f), ...bytes]);
  // GATT operations must not overlap
  bleQueue = bleQueue
    .then(() => (ch.writeValueWithoutResponse ? ch.writeValueWithoutResponse(packet) : ch.writeValue(packet)))
    .catch(() => {});
}

export async function connectMidi(): Promise<MidiStatus> {
  if (!supportsMidi()) {
    setState({ status: 'unsupported' });
    return 'unsupported';
  }
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = () => refresh();
    refresh();
    return state.status;
  } catch (e: any) {
    setState({ status: 'denied', error: String(e?.message || e) });
    return 'denied';
  }
}

/* ---------- output: make the real piano play (Écouter / accompaniment) ---------- */

function outputs(): MIDIOutput[] {
  const list: MIDIOutput[] = [];
  access?.outputs.forEach((o) => list.push(o));
  return list;
}

export function hasMidiOut() {
  return outputs().length > 0 || !!bleChar;
}

export function midiOutNote(midi: number, durMs: number, velocity = 0.6, channel = 0) {
  const outs = outputs();
  const v = Math.max(1, Math.min(127, Math.round(velocity * 127)));
  if (bleChar && !outs.length) {
    bleSend([0x90 | channel, midi, v]);
    setTimeout(() => bleSend([0x80 | channel, midi, 0]), Math.max(60, durMs - 15));
    return;
  }
  if (!outs.length) return;
  const now = performance.now();
  for (const o of outs) {
    try {
      o.send([0x90 | channel, midi, v], now);
      o.send([0x80 | channel, midi, 0], now + Math.max(60, durMs - 15));
    } catch {
      /* port closed */
    }
  }
}

export function midiAllOff() {
  if (bleChar) bleSend([0xb0, 123, 0]);
  for (const o of outputs()) {
    try {
      for (let ch = 0; ch < 2; ch++) o.send([0xb0 | ch, 123, 0]);
    } catch {
      /* ignore */
    }
  }
}
