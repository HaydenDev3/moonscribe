let audioContext
let ambientNodes = null

function context() {
  if (typeof window === 'undefined') return null
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  audioContext ||= new AudioContext()
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  return audioContext
}

export function playAppSound(kind = 'click', volume = 35) {
  const ctx = context()
  if (!ctx) return
  const level = Math.max(0, Math.min(100, Number(volume) || 0)) / 100
  if (!level) return
  const profiles = {
    click: [520, 0.025, 0.018, 'sine'],
    type: [760 + Math.random() * 90, 0.018, 0.009, 'triangle'],
    return: [420, 0.045, 0.018, 'triangle'],
    notification: [660, 0.18, 0.035, 'sine'],
  }
  const [frequency, duration, gain, wave] = profiles[kind] || profiles.click
  const oscillator = ctx.createOscillator()
  const envelope = ctx.createGain()
  oscillator.type = wave
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
  if (kind === 'notification') oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + duration)
  envelope.gain.setValueAtTime(gain * level, ctx.currentTime)
  envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
  oscillator.connect(envelope).connect(ctx.destination)
  oscillator.start()
  oscillator.stop(ctx.currentTime + duration)
}

export function startAmbientSound(volume = 35, mood = 'moonlit') {
  const ctx = context()
  if (!ctx) return
  stopAmbientSound()
  const level = Math.max(0, Math.min(100, Number(volume) || 0)) / 100
  if (!level) return

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, ctx.currentTime)
  master.gain.exponentialRampToValueAtTime(0.035 * level, ctx.currentTime + 1.6)
  master.connect(ctx.destination)

  const bed = ctx.createOscillator()
  const shimmer = ctx.createOscillator()
  const pulse = ctx.createOscillator()
  const bedFilter = ctx.createBiquadFilter()
  const shimmerFilter = ctx.createBiquadFilter()
  const pulseGain = ctx.createGain()
  const shimmerGain = ctx.createGain()
  const bedGain = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()

  const presets = {
    moonlit: { bed: 164.81, shimmer: 329.63, pulse: 82.41 },
    hearth: { bed: 146.83, shimmer: 293.66, pulse: 73.42 },
    rainglass: { bed: 174.61, shimmer: 392.0, pulse: 98.0 },
  }
  const preset = presets[mood] || presets.moonlit

  bed.type = 'sine'
  shimmer.type = 'triangle'
  pulse.type = 'sine'
  lfo.type = 'sine'

  bed.frequency.setValueAtTime(preset.bed, ctx.currentTime)
  shimmer.frequency.setValueAtTime(preset.shimmer, ctx.currentTime)
  pulse.frequency.setValueAtTime(preset.pulse, ctx.currentTime)
  lfo.frequency.setValueAtTime(0.07, ctx.currentTime)

  bedFilter.type = 'lowpass'
  bedFilter.frequency.setValueAtTime(780, ctx.currentTime)
  bedFilter.Q.value = 0.25

  shimmerFilter.type = 'bandpass'
  shimmerFilter.frequency.setValueAtTime(740, ctx.currentTime)
  shimmerFilter.Q.value = 0.45

  bedGain.gain.setValueAtTime(0.55, ctx.currentTime)
  shimmerGain.gain.setValueAtTime(0.018, ctx.currentTime)
  pulseGain.gain.setValueAtTime(0.011, ctx.currentTime)
  lfoGain.gain.setValueAtTime(120, ctx.currentTime)

  lfo.connect(lfoGain)
  lfoGain.connect(shimmerFilter.frequency)

  bed.connect(bedFilter).connect(bedGain).connect(master)
  shimmer.connect(shimmerFilter).connect(shimmerGain).connect(master)
  pulse.connect(pulseGain).connect(master)

  bed.start()
  shimmer.start()
  pulse.start()
  lfo.start()

  ambientNodes = { ctx, master, nodes: [bed, shimmer, pulse, lfo] }
}

export function stopAmbientSound() {
  if (!ambientNodes) return
  const { ctx, master, nodes } = ambientNodes
  try {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
    nodes.forEach((node) => node.stop(ctx.currentTime + 0.5))
  } catch {}
  ambientNodes = null
}
