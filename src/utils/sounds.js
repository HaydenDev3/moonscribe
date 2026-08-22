let audioContext
let ambience = null

function getContext() {
  if (typeof window === 'undefined') return null
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  audioContext ||= new AudioContext()
  return audioContext
}

export function unlockAudio() {
  const ctx = getContext()
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
}

function level(value, fallback) {
  return Math.max(0, Math.min(100, Number(value ?? fallback))) / 100
}

function tone({ frequency, duration, gain, type = 'sine', glide, volume }) {
  const ctx = getContext()
  if (!ctx || !volume) return
  unlockAudio()
  const oscillator = ctx.createOscillator()
  const envelope = ctx.createGain()
  const now = ctx.currentTime
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  if (glide) oscillator.frequency.exponentialRampToValueAtTime(glide, now + duration)
  envelope.gain.setValueAtTime(Math.max(0.0001, gain * volume), now)
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  oscillator.connect(envelope).connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + duration)
}

const EFFECTS = {
  'ui.click': () => ({ frequency: 540, duration: 0.025, gain: 0.035, type: 'sine' }),
  'ui.toggle': () => ({ frequency: 680, duration: 0.04, gain: 0.035, type: 'triangle', glide: 820 }),
  'ui.error': () => ({ frequency: 250, duration: 0.12, gain: 0.05, type: 'sawtooth', glide: 190 }),
  'writing.key': () => ({ frequency: 690 + Math.random() * 220, duration: 0.017, gain: 0.022, type: Math.random() > 0.5 ? 'triangle' : 'square' }),
  'writing.return': () => ({ frequency: 400, duration: 0.05, gain: 0.04, type: 'triangle', glide: 510 }),
  'notification.normal': () => ({ frequency: 600, duration: 0.2, gain: 0.065, type: 'sine', glide: 880 }),
  'notification.success': () => ({ frequency: 520, duration: 0.24, gain: 0.065, type: 'sine', glide: 1040 }),
  'notification.warning': () => ({ frequency: 360, duration: 0.28, gain: 0.075, type: 'triangle', glide: 280 }),
  milestone: () => ({ frequency: 520, duration: 0.32, gain: 0.075, type: 'sine', glide: 1260 }),
}

export function playFeedback(event, {
  masterEnabled = true,
  channelEnabled = true,
  masterVolume = 35,
  channelVolume = 100,
} = {}) {
  if (!masterEnabled || !channelEnabled) return
  const profile = EFFECTS[event] || EFFECTS['ui.click']
  tone({ ...profile(), volume: level(masterVolume, 35) * level(channelVolume, 100) })
}

// Compatibility wrapper for existing callers while they migrate to semantic events.
export function playAppSound(kind = 'click', volume = 35) {
  const event = { click: 'ui.click', type: 'writing.key', return: 'writing.return', notification: 'notification.normal' }[kind] || 'ui.click'
  playFeedback(event, { masterVolume: volume })
}

const AMBIENCE = {
  moonlit: { bed: 164.81, shimmer: 329.63, pulse: 82.41, filter: 780 },
  rainglass: { bed: 174.61, shimmer: 392, pulse: 98, filter: 1100 },
  hearth: { bed: 146.83, shimmer: 293.66, pulse: 73.42, filter: 600 },
  forest: { bed: 130.81, shimmer: 261.63, pulse: 65.41, filter: 920 },
  ocean: { bed: 110, shimmer: 220, pulse: 55, filter: 720 },
  library: { bed: 155.56, shimmer: 311.13, pulse: 77.78, filter: 680 },
  cafe: { bed: 146.83, shimmer: 349.23, pulse: 87.31, filter: 860 },
}

function createAmbience(mood, volume) {
  const ctx = getContext()
  if (!ctx) return null
  const preset = AMBIENCE[mood] || AMBIENCE.moonlit
  const master = ctx.createGain()
  const bed = ctx.createOscillator()
  const shimmer = ctx.createOscillator()
  const pulse = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const shimmerGain = ctx.createGain()
  const pulseGain = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  const now = ctx.currentTime

  master.gain.setValueAtTime(0.0001, now)
  master.gain.linearRampToValueAtTime(0.11 * volume, now + 1.1)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(preset.filter, now)
  filter.Q.value = 0.3
  bed.type = 'sine'
  shimmer.type = 'triangle'
  pulse.type = 'sine'
  lfo.type = 'sine'
  bed.frequency.setValueAtTime(preset.bed, now)
  shimmer.frequency.setValueAtTime(preset.shimmer, now)
  pulse.frequency.setValueAtTime(preset.pulse, now)
  lfo.frequency.setValueAtTime(mood === 'ocean' ? 0.045 : 0.075, now)
  shimmerGain.gain.setValueAtTime(0.028, now)
  pulseGain.gain.setValueAtTime(0.018, now)
  lfoGain.gain.setValueAtTime(120, now)

  lfo.connect(lfoGain).connect(filter.frequency)
  bed.connect(filter).connect(master)
  shimmer.connect(shimmerGain).connect(master)
  pulse.connect(pulseGain).connect(master)
  master.connect(ctx.destination)
  ;[bed, shimmer, pulse, lfo].forEach((node) => node.start(now))
  return { ctx, master, nodes: [bed, shimmer, pulse, lfo] }
}

export function startAmbientSound(volume = 35, mood = 'moonlit') {
  const ctx = getContext()
  if (!ctx) return
  const target = level(volume, 35)
  if (!target) return stopAmbientSound()
  const next = createAmbience(mood, target)
  if (!next) return
  const previous = ambience
  ambience = next
  unlockAudio()
  if (!previous) return
  const now = previous.ctx.currentTime
  previous.master.gain.cancelScheduledValues(now)
  previous.master.gain.setValueAtTime(Math.max(previous.master.gain.value, 0.0001), now)
  previous.master.gain.linearRampToValueAtTime(0.0001, now + 0.9)
  setTimeout(() => previous.nodes.forEach((node) => {
    try { node.stop() } catch {
      // Already-stopped oscillator nodes are safe to ignore.
    }
  }), 1000)
}

export function stopAmbientSound() {
  if (!ambience) return
  const current = ambience
  ambience = null
  const now = current.ctx.currentTime
  try {
    current.master.gain.cancelScheduledValues(now)
    current.master.gain.setValueAtTime(Math.max(current.master.gain.value, 0.0001), now)
    current.master.gain.linearRampToValueAtTime(0.0001, now + 0.45)
    setTimeout(() => current.nodes.forEach((node) => {
      try { node.stop() } catch {
        // Already-stopped oscillator nodes are safe to ignore.
      }
    }), 550)
  } catch {
    // Audio contexts may be suspended or closed by the browser.
  }
}
