let audioContext
let ambience = null
let ambienceFadeTimer = null
const audioCache = new Map()

const SOUND_FILES = {
  'ui.click': '/sounds/ui/soundshelfstudio-ui-tap-light-513023.mp3',
  'ui.toggle': '/sounds/ui/liecio-menu_beep_accept_soft-533780.mp3',
  'ui.error': '/sounds/ui/soundshelfstudio-ui-error-pop-515668.mp3',
  'ui.navigation': '/sounds/ui/47313572-ui-navigation-sound-270299.mp3',
  'ui.open': '/sounds/ui/soundshelfstudio-ui-pop-up-open-516939.mp3',
  'ui.close': '/sounds/ui/soundshelfstudio-ui-menu-slide-out-516941.mp3',
  'ui.focus': '/sounds/ui/soundshelfstudio-ui-focus-519789.mp3',
  'ui.drag': '/sounds/ui/soundshelfstudio-ui-drag-drop-518781.mp3',
  'ui.cancel': '/sounds/ui/47313572-ui-sound-off-270300.mp3',
  'ui.trash': '/sounds/ui/litupsubway-ui-trash-518621.mp3',
  'writing.key': '/sounds/ui/liecio-menu_beep_short_snap-533778.mp3',
  'writing.return': '/sounds/ui/soundshelfstudio-ui-swipe-confirm-522221.mp3',
  'notification.normal': '/sounds/ui/soundshelfstudio-ui-notification-pop-minimal-523149.mp3',
  'notification.success': '/sounds/ui/soundshelfstudio-ui-app-notification-524745.mp3',
  'notification.warning': '/sounds/ui/soundshelfstudio-ui-soft-glass-ping-526562.mp3',
  milestone: '/sounds/ui/soundshelfstudio-ui-swipe-navigation-soft-523625.mp3',
  startup: '/sounds/ui/47313572-startup-sound-variation-6-316850.mp3',
}

function playFile(event, volume) {
  if (typeof window === 'undefined' || !volume || !SOUND_FILES[event]) return false
  const source = SOUND_FILES[event]
  let audio = audioCache.get(source)
  if (!audio) { audio = new Audio(source); audio.preload = 'auto'; audioCache.set(source, audio) }
  audio.pause(); audio.currentTime = 0; audio.volume = Math.max(0, Math.min(1, volume))
  audio.play().catch(() => {})
  return true
}

function getContext(create = true) {
  if (typeof window === 'undefined') return null
  if (create && window.navigator?.userActivation && !window.navigator.userActivation.hasBeenActive) return null
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  if (!audioContext && !create) return null
  audioContext ||= new AudioContext()
  return audioContext
}

export function unlockAudio() {
  const ctx = getContext(true)
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
  if (playFile(event, level(masterVolume, 35) * level(channelVolume, 100))) return
  const profile = EFFECTS[event] || EFFECTS['ui.click']
  tone({ ...profile(), volume: level(masterVolume, 35) * level(channelVolume, 100) })
}

// Compatibility wrapper for existing callers while they migrate to semantic events.
export function playAppSound(kind = 'click', volume = 35) {
  const event = { click: 'ui.click', type: 'writing.key', return: 'writing.return', notification: 'notification.normal' }[kind] || 'ui.click'
  playFeedback(event, { masterVolume: volume })
}

const AMBIENCE_TRACKS = {
  moonlit: '/sounds/room-tone.mp3',
  rainglass: '/sounds/rain-on-glass.mp3',
  hearth: '/sounds/fireplace.mp3',
  forest: '/sounds/forest-night.mp3',
  ocean: '/sounds/room-tone.mp3',
  library: '/sounds/library.mp3',
  cafe: '/sounds/room-tone.mp3',
  clockwork: '/sounds/alex_jauk-clock-ticking-ambience-202980.mp3',
  underwater: '/sounds/dragon-studio-deep-sea-underwater-ambience-472383.mp3',
  treetop: '/sounds/traian1984-ambience-wind-blowing-through-trees-01-186986.mp3',
}

export function playStartupSound({ masterEnabled = true, channelEnabled = true, masterVolume = 35, channelVolume = 100 } = {}) {
  if (!masterEnabled || !channelEnabled) return
  playFile('startup', level(masterVolume, 35) * level(channelVolume, 100))
}

function createAmbience(mood, volume) {
  if (typeof window === 'undefined') return null
  const audio = new Audio(AMBIENCE_TRACKS[mood] || AMBIENCE_TRACKS.moonlit)
  audio.loop = true
  audio.addEventListener('ended', () => {
    // Keep looping even when a browser ignores the loop flag after a media
    // suspension or a codec recovery.
    if (ambience?.audio === audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
  })
  audio.preload = 'auto'
  audio.volume = 0
  const play = audio.play()
  if (play?.catch) play.catch(() => {})
  const fadeTimer = window.setTimeout(() => {
    audio.volume = Math.max(0, Math.min(1, volume * 0.8))
  }, 50)
  return { audio, fadeTimer }
}

export function startAmbientSound(volume = 35, mood = 'moonlit') {
  const target = level(volume, 35)
  if (!target) return stopAmbientSound()
  const next = createAmbience(mood, target)
  if (!next) return
  const previous = ambience
  ambience = next
  unlockAudio()
  if (!previous) return
  window.clearTimeout(ambienceFadeTimer)
  previous.audio.volume = 0
  previous.audio.pause()
  previous.audio.currentTime = 0
  window.clearTimeout(previous.fadeTimer)
}

export function resumeAmbientSound() {
  if (!ambience?.audio) return
  unlockAudio()
  if (ambience.audio.paused) ambience.audio.play().catch(() => {})
}

export function stopAmbientSound() {
  if (!ambience) return
  const current = ambience
  ambience = null
  window.clearTimeout(ambienceFadeTimer)
  window.clearTimeout(current.fadeTimer)
  current.audio.pause()
  current.audio.currentTime = 0
}
