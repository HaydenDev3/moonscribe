// 3D book mockup — a little shelf display of your cover, styled to sit
// inside the app's own paper (theme tokens, not hardcoded colours).
// Lazy-loaded so `three` only ships when this preview is opened.
// The cover texture redraws whenever the design changes, so edits to the
// title, colours, ornament, or picture show up on the book in real time.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

function drawText(ctx, W, H, { title, byline, ornament, titleColor }) {
  ctx.textAlign = 'center'
  ctx.fillStyle = titleColor || '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 14

  ctx.font = `600 ${Math.min(W * 0.078, 64)}px 'Cormorant Garamond', Georgia, serif`
  const words = String(title || 'Untitled').split(' ')
  let line = ''
  const lines = []
  for (const w of words) {
    if (ctx.measureText(line + ' ' + w).width > W * 0.82 && line) {
      lines.push(line)
      line = w
    } else {
      line = (line + ' ' + w).trim()
    }
  }
  if (line) lines.push(line)

  let y = H * 0.38 - ((lines.length - 1) * Math.min(W * 0.055, 44)) / 2
  for (const l of lines) {
    ctx.fillText(l, W / 2, y)
    y += Math.min(W * 0.055, 44)
  }

  ctx.shadowBlur = 0
  ctx.font = `${W * 0.05}px 'Cormorant Garamond', Georgia, serif`
  ctx.fillText(ornament || '❦', W / 2, y + Math.min(W * 0.05, 40))

  ctx.font = `italic ${W * 0.036}px 'Cormorant Garamond', Georgia, serif`
  ctx.fillText(byline || 'for Storm', W / 2, H * 0.78)
}

function drawCover(canvas, { title, byline, ornament, titleColor, coverStyle, image }, onDone) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height

  // background — reuse the same gradients as the 2D cover styles
  const bg = {
    moonstone: ['#8fb2d4', '#7ba3c9', '#a6c2dd'],
    rose: ['#e0b9b9', '#d4a5a5', '#e3c2c2'],
    sage: ['#b8d0b8', '#a8c5a8', '#c3d8c3'],
    sand: ['#e3cfa9', '#d8b48f', '#e8d7b8'],
    twilight: ['#5f82a4', '#4a6b8a', '#6f90ae']
  }[coverStyle] || ['#8fb2d4', '#7ba3c9', '#a6c2dd']

  const g = ctx.createLinearGradient(0, 0, W * 0.9, H)
  g.addColorStop(0, bg[0])
  g.addColorStop(0.55, bg[1])
  g.addColorStop(1, bg[2])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(30,40,55,0.28)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)

  const drawImage = (img) => {
    ctx.globalAlpha = 0.55
    const scale = Math.max(W / img.width, H / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
    ctx.globalAlpha = 1
  }

  if (image) {
    const img = new Image()
    img.onload = () => {
      drawImage(img)
      drawText(ctx, W, H, { title, byline, ornament, titleColor })
      onDone?.()
    }
    img.onerror = () => {
      drawText(ctx, W, H, { title, byline, ornament, titleColor })
      onDone?.()
    }
    img.src = image
  } else {
    drawText(ctx, W, H, { title, byline, ornament, titleColor })
    onDone?.()
  }
}

// Read the app's design tokens so the mock always matches the writing page.
function readTokens() {
  const cs = getComputedStyle(document.documentElement)
  const get = (name, fallback) => {
    const v = cs.getPropertyValue(name).trim()
    return v || fallback
  }
  return {
    ivory: get('--ivory', '#fffcf9'),
    charcoal: get('--charcoal', '#3d3a36'),
    moon: get('--moon', '#7ba3c9'),
    rose: get('--rose', '#d4a5a5'),
    accentSoft: get('--accent-soft', '#eef3f8'),
    overlay: get('--overlay', 'rgba(61, 58, 54, 0.35)')
  }
}

function parseCssColor(str) {
  if (!str) return null
  if (str.startsWith('#')) {
    const c = new THREE.Color(str)
    return { r: c.r, g: c.g, b: c.b, a: 1 }
  }
  const m = str.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()))
  return { r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255, a: parts.length > 3 ? parts[3] : 1 }
}

// Repaint every material and light from the current theme tokens. Called on
// mount and whenever `data-theme` changes, so Daylight/Moonlight/Amoled all
// restyle the book in place.
function applyTheme(s) {
  const t = readTokens()
  s.pagesMat.color.set(t.ivory)
  s.boardMat.color.set(t.charcoal)
  s.spineMat.color.set(t.charcoal).multiplyScalar(0.82)
  s.roseMat.color.set(t.rose)
  s.ambient.color.set(t.accentSoft)
  s.rim.color.set(t.moon)
  const ov = parseCssColor(t.overlay) || { r: 0.24, g: 0.23, b: 0.21, a: 0.35 }
  s.ground.material.color.setRGB(ov.r, ov.g, ov.b)
  s.ground.material.opacity = Math.min(0.28, Math.max(0.05, ov.a * 0.55))
}

export default function CoverMockup3D({ title, byline, coverStyle, coverImage, ornament, titleColor }) {
  const mountRef = useRef(null)
  const stateRef = useRef(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch (err) {
      setUnsupported(true)
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 0.6, 6.4)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // moonstone lighting — the app's quiet blue, not a harsh studio rig
    const ambient = new THREE.AmbientLight(0xffffff, 0.75)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xfff3e6, 1.05)
    key.position.set(3, 5, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6)
    rim.position.set(-4, -2, -3)
    scene.add(rim)

    const group = new THREE.Group()
    scene.add(group)

    // the book — pages follow --ivory, boards follow --charcoal
    const W = 2.0
    const H = 3.0
    const THICK = 0.34
    const pagesMat = new THREE.MeshStandardMaterial({ color: 0xfbf6ee, roughness: 0.9 })
    const pages = new THREE.Mesh(new THREE.BoxGeometry(W, H, THICK), pagesMat)
    group.add(pages)

    const boardMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.05 })
    const front = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, H + 0.04, 0.035), boardMat)
    front.position.z = THICK / 2 + 0.018
    group.add(front)
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, H + 0.04, 0.035), boardMat)
    back.position.z = -THICK / 2 - 0.018
    group.add(back)

    const spineMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 })
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.09, H + 0.04, THICK + 0.07), spineMat)
    spine.position.x = -(W / 2) - 0.01
    group.add(spine)

    // a thin rose ribbon along the fore-edge, like the scene-break marks
    const roseMat = new THREE.MeshStandardMaterial({ color: 0xd4a5a5, roughness: 0.6 })
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, THICK), roseMat)
    fore.position.x = W / 2 + 0.02
    group.add(fore)

    // front cover texture — redrawn live whenever the design changes
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 768
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const cover = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 0.04, H + 0.04),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })
    )
    cover.position.z = THICK / 2 + 0.02
    group.add(cover)

    // soft ground shadow
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -H / 2 - 0.25
    group.add(ground)

    const state = { ambient, key, rim, pagesMat, boardMat, spineMat, roseMat, ground, renderer, group, canvas, tex }
    stateRef.current = state
    applyTheme(state)

    // slow auto-rotate, drag to spin
    let dragging = false
    let lastX = 0
    let rotY = -0.5
    let rotX = 0.12
    let raf = 0
    let last = performance.now()

    const onDown = (e) => {
      dragging = true
      lastX = e.clientX
      mount.style.cursor = 'grabbing'
    }
    const onMove = (e) => {
      if (!dragging) return
      rotY += (e.clientX - lastX) * 0.008
      lastX = e.clientX
    }
    const onUp = () => {
      dragging = false
      mount.style.cursor = 'grab'
    }

    mount.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    const loop = (now) => {
      if (!dragging) rotY += (now - last) * 0.00012
      last = now
      group.rotation.y = rotY
      group.rotation.x = rotX
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onResize = () => {
      if (!mount.clientWidth) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    if (ro) ro.observe(mount)

    // restyle in place when the app theme changes
    const observer = new MutationObserver(() => {
      if (stateRef.current) applyTheme(stateRef.current)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
      observer.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      mount.removeEventListener('pointerdown', onDown)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      stateRef.current = null
    }
  }, [])

  // Redraw the cover texture the moment any design choice changes.
  useEffect(() => {
    const s = stateRef.current
    if (!s) return
    drawCover(s.canvas, { title, byline, ornament, titleColor, coverStyle, image: coverImage }, () => {
      if (stateRef.current) stateRef.current.tex.needsUpdate = true
    })
  }, [title, byline, ornament, titleColor, coverStyle, coverImage])

  if (unsupported) {
    return (
      <div className="cover-mockup-3d" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)', textAlign: 'center', color: 'var(--grey)', fontStyle: 'italic' }}>
        3D preview needs WebGL — try the flat cover.
      </div>
    )
  }

  return (
    <div className="cover-mockup-3d" ref={mountRef} style={{ cursor: 'grab' }}>
      <span className="cover-mockup-3d-hint">drag to spin</span>
    </div>
  )
}
