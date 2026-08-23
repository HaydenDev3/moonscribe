import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PALETTES = {
  moonstone: ['#8fb2d4', '#5a80a8', '#30435f'], rose: ['#e0b9b9', '#c49090', '#633f48'],
  sage: ['#b8d0b8', '#7eaa7e', '#324c39'], sand: ['#e3cfa9', '#c8a06a', '#654624'], twilight: ['#5f82a4', '#364f6b', '#171e36'],
}
const FONT_MAP = { cormorant: 'Cormorant Garamond, Georgia, serif', playfair: 'Playfair Display, Georgia, serif', cinzel: 'Cinzel, Georgia, serif', lora: 'Lora, Georgia, serif', spectral: 'Spectral, Georgia, serif', garamond: 'EB Garamond, Georgia, serif', crimson: 'Crimson Pro, Georgia, serif', libre: 'Libre Baskerville, Georgia, serif' }
const SIZE_MAP = { sm: 52, md: 68, lg: 88, xl: 108 }

function palette(style, gradient) {
  const hex = gradient?.match(/#[0-9a-fA-F]{3,8}/g)
  return hex?.length >= 2 ? [hex[0], hex[1], hex[1]] : (PALETTES[style] || PALETTES.moonstone)
}
function texture(draw, width = 1024, height = 1536) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4
  draw(canvas.getContext('2d'), width, height, map)
  map.needsUpdate = true
  return map
}
function drawCropped(ctx, image, w, h, crop: any = {}, alpha = 1) {
  const zoom = Math.max(1, Number(crop.zoom) || 1)
  const scale = Math.max(w / image.width, h / image.height) * zoom
  const dw = image.width * scale
  const dh = image.height * scale
  const x = -(dw - w) * ((Number(crop.x) || 50) / 100)
  const y = -(dh - h) * ((Number(crop.y) || 50) / 100)
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(image, x, y, dw, dh); ctx.restore()
}
function loadTextureImage(src, map, draw) {
  if (!src) { draw(null); return }
  const image = new Image()
  image.decoding = 'async'
  if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous'
  image.onload = () => { draw(image); map.needsUpdate = true }
  image.onerror = () => { draw(null); map.needsUpdate = true }
  image.src = src
  draw(null)
}
function frontTexture(settings: any) {
  const colors = palette(settings.coverStyle, settings.gradient)
  return texture((ctx, w, h, map) => {
    const fill = ctx.createLinearGradient(0, 0, w, h); fill.addColorStop(0, colors[0]); fill.addColorStop(.56, colors[1]); fill.addColorStop(1, colors[2]); ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h)
    const draw = image => {
      if (image) drawCropped(ctx, image, w, h, settings.frontCrop, .78)
      const vignette = ctx.createRadialGradient(w / 2, h * .38, w * .1, w / 2, h * .48, h * .8); vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.43)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = `${settings.titleColor || '#fff'}55`; ctx.lineWidth = 2; ctx.strokeRect(54, 54, w - 108, h - 108); ctx.strokeStyle = `${settings.titleColor || '#fff'}22`; ctx.strokeRect(68, 68, w - 136, h - 136)
      if (!settings.showText) return
      let title = settings.title || 'Untitled'; if (settings.titleTransform === 'uppercase') title = title.toUpperCase(); if (settings.titleTransform === 'lowercase') title = title.toLowerCase(); if (settings.titleTransform === 'capitalize') title = title.replace(/\b\w/g, x => x.toUpperCase())
      const typeface = settings.titleFontFamily || FONT_MAP[settings.titleFont] || FONT_MAP.cormorant
      const size = SIZE_MAP[settings.titleSize] || 68; ctx.fillStyle = settings.titleColor || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `italic ${settings.titleWeight || 600} ${size}px ${typeface}`; ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18
      const lines = []; let line = ''; title.split(/\s+/).forEach(word => { const next = `${line} ${word}`.trim(); if (ctx.measureText(next).width > w * .72 && line) { lines.push(line); line = word } else line = next }); if (line) lines.push(line)
      const lineHeight = size * 1.2; const top = h * .48 - (lines.length - 1) * lineHeight / 2; lines.forEach((entry, index) => ctx.fillText(entry, w / 2, top + index * lineHeight)); ctx.shadowBlur = 0
      if (settings.subtitle) { ctx.globalAlpha = .78; ctx.font = `30px ${FONT_MAP.cormorant}`; ctx.fillText(settings.subtitle, w / 2, top + lines.length * lineHeight + 18); ctx.globalAlpha = 1 }
      if (settings.ornament) { ctx.globalAlpha = .68; ctx.font = `42px ${typeface}`; ctx.fillText(settings.ornament, w / 2, top + lines.length * lineHeight + 38); ctx.globalAlpha = 1 }
      ctx.globalAlpha = .78; ctx.font = `italic 27px ${FONT_MAP.cormorant}`; ctx.fillText(settings.byline || 'for Storm', w / 2, h - 118); ctx.globalAlpha = 1
    }
    loadTextureImage(settings.coverImage, map, draw)
  })
}
function spineTexture(settings: any, aspect = .08) {
  const colors = palette(settings.coverStyle, settings.gradient)
  const height = 1536
  // Preserve the physical spine-to-height ratio. A large minimum width made
  // narrow spines look wider than the mesh and caused uploaded wraps/text to
  // appear to spill onto the cover boards.
  const width = Math.max(32, Math.round(height * Math.max(.012, Math.min(.22, aspect))))
  return texture((ctx, w, h, map) => {
    const draw = image => {
      const fill = ctx.createLinearGradient(0, 0, w, h); fill.addColorStop(0, colors[2]); fill.addColorStop(1, colors[1]); ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h)
      if (image) drawCropped(ctx, image, w, h, settings.spineCrop, 1)
      const inset = Math.max(4, Math.min(18, w * .12)); ctx.strokeStyle = `${settings.titleColor || '#fff'}50`; ctx.strokeRect(inset, 55, Math.max(1, w - inset * 2), h - 110)
      if (settings.showSpineText === false) return
      const fontSize = Math.max(18, Math.min(70, w * .58))
      const typeface = settings.titleFontFamily || FONT_MAP[settings.titleFont] || FONT_MAP.cormorant
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = settings.titleColor || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `italic ${settings.titleWeight || 600} ${fontSize}px ${typeface}`; ctx.fillText(settings.title || 'Untitled', 0, 0, h * .82); ctx.restore()
    }
    loadTextureImage(settings.spineImage, map, draw)
  }, width, height)
}
function backTexture(settings: any) {
  const colors = palette(settings.coverStyle, settings.gradient)
  return texture((ctx, w, h, map) => {
    const draw = image => {
      const fill = ctx.createLinearGradient(0, 0, w, h); fill.addColorStop(0, colors[2]); fill.addColorStop(1, colors[1]); ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h)
      if (image) drawCropped(ctx, image, w, h, settings.backCrop, 1)
      const shade = ctx.createLinearGradient(0, 0, 0, h); shade.addColorStop(0, 'rgba(0,0,0,.12)'); shade.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = `${settings.titleColor || '#fff'}48`; ctx.lineWidth = 2; ctx.strokeRect(54, 54, w - 108, h - 108)
      if (settings.showBackText === false) return
      ctx.fillStyle = `${settings.titleColor || '#fff'}cc`; ctx.textAlign = 'center'; ctx.font = `italic 34px ${FONT_MAP.cormorant}`; ctx.fillText(settings.title || 'Untitled', w / 2, 150)
      const words = (settings.backCopy || 'A MoonScribe edition.').split(/\s+/); const lines = []; let line = ''; ctx.font = `28px ${FONT_MAP.lora}`
      words.forEach(word => { const next = `${line} ${word}`.trim(); if (ctx.measureText(next).width > w * .68 && line) { lines.push(line); line = word } else line = next }); if (line) lines.push(line)
      ctx.fillStyle = `${settings.titleColor || '#fff'}b8`; lines.slice(0, 12).forEach((entry, index) => ctx.fillText(entry, w / 2, h * .35 + index * 46)); ctx.globalAlpha = .62; ctx.font = `26px ${FONT_MAP.cormorant}`; ctx.fillText(settings.byline || '', w / 2, h - 120); ctx.globalAlpha = 1
    }
    loadTextureImage(settings.backImage, map, draw)
  })
}
function pageTexture() { return texture((ctx, w, h) => { ctx.fillStyle = '#eee8da'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(119,91,54,.16)'; ctx.lineWidth = 2; for (let y = 12; y < h; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() } }) }
function boardTexture() { return texture((ctx, w, h) => { const gradient = ctx.createLinearGradient(0, 0, w, h); gradient.addColorStop(0, '#202735'); gradient.addColorStop(1, '#0c1119'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h) }) }

export default function CoverMockup3D(props) {
  const mountRef = useRef(null); const sceneRef = useRef(null); const propsRef = useRef(props); propsRef.current = props
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return undefined
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(30, 1, .1, 100); camera.position.set(0, .05, 8.9)
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      mount.dataset.webglUnavailable = 'true'
      return undefined
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; mount.appendChild(renderer.domElement)
    const book = new THREE.Group(); scene.add(book); const width = 2.7, height = width * ((Number(propsRef.current.trimHeightMm) || 228.6) / (Number(propsRef.current.trimWidthMm) || 152.4)); const physicalSpineMm = Number(propsRef.current.spineMm) || 2; const previewSpineMm = Math.max(8, physicalSpineMm); const depth = Math.max(.22, width * (previewSpineMm / (Number(propsRef.current.trimWidthMm) || 152.4))); const pages = pageTexture(); const board = boardTexture(); const material = (map, roughness = .7) => new THREE.MeshStandardMaterial({ map, roughness, metalness: .03 })
    const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), Array.from({ length: 6 }, () => material(pages))); block.castShadow = true; block.receiveShadow = true; book.add(block)
    const boardGeometry = new THREE.BoxGeometry(width + .045, height + .09, .075)
    // BoxGeometry order: +x, -x, +y, -y, +z, -z. Keep artwork on the
    // outward +z face only; edge faces use a neutral board material so cover
    // art and text cannot wrap around the hinge or fore-edge.
    const frontMaterials = Array.from({ length: 6 }, () => material(board, .58)); frontMaterials[4] = material(board, .52)
    const backMaterials = Array.from({ length: 6 }, () => material(board, .58)); backMaterials[4] = material(board, .52)
    const front = new THREE.Mesh(boardGeometry, frontMaterials); front.userData.surface = 'front'; front.position.set(.0225, 0, depth / 2 + .042); front.castShadow = true; book.add(front)
    const back = new THREE.Mesh(boardGeometry, backMaterials); back.userData.surface = 'back'; back.position.set(.0225, 0, -depth / 2 - .042); back.rotation.y = Math.PI; back.castShadow = true; book.add(back)
    const spineBase = material(board, .58)
    const spineFace = material(board, .58)
    // BoxGeometry material order is +x, -x, +y, -y, +z, -z. Only the
    // outward (-x) face receives spine artwork so it cannot wrap onto either
    // cover board when the book is viewed obliquely.
    const spineMaterials = [spineBase, spineFace, spineBase, spineBase, spineBase, spineBase]
    const spine = new THREE.Mesh(new THREE.BoxGeometry(.055, height + .09, depth + .04), spineMaterials); spine.userData.surface = 'spine'; spine.position.x = -width / 2 - .045; spine.castShadow = true; book.add(spine)
    const bandMaterial = new THREE.MeshStandardMaterial({ color: '#9a7a43', roughness: .45 }); const headband = new THREE.Mesh(new THREE.BoxGeometry(.075, .035, depth), bandMaterial); headband.position.set(-width / 2 + .03, height / 2 + .012, 0); book.add(headband); const tailband = headband.clone(); tailband.position.y = -height / 2 - .012; book.add(tailband)
    const key = new THREE.DirectionalLight('#fff0dc', 3.1); key.position.set(-3, 5, 6); key.castShadow = true; scene.add(key); const rim = new THREE.DirectionalLight('#9fb5ff', 1.8); rim.position.set(4, 1, -4); scene.add(rim); const ambient = new THREE.AmbientLight('#90a0c5', 1.35); scene.add(ambient); const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.ShadowMaterial({ opacity: .32 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.45; floor.receiveShadow = true; scene.add(floor)
    const refresh = () => { const settings = propsRef.current; const swap = (mesh, map, materialIndex = null) => { const target = materialIndex === null ? mesh.material : mesh.material[materialIndex]; const old = target.map; target.map = map; target.needsUpdate = true; if (old !== pages) old?.dispose() }; swap(front, frontTexture(settings), 4); swap(back, backTexture(settings), 4); swap(spine, spineTexture(settings, (depth + .04) / (height + .09)), 1) }
    let down = false, lastX = 0, lastY = 0, yaw = -.46, pitch = .08, frame, previous = performance.now()
    let zoomLevel = 1
    let fitCameraDistance = camera.position.z
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDistance = 0
    const applyZoom = () => { camera.position.z = fitCameraDistance / zoomLevel; camera.updateProjectionMatrix() }
    const focusSurface = surface => { yaw = surface === 'back' ? Math.PI : surface === 'spine' ? Math.PI / 2 : -.08; pitch = .04 }
    const applyEnvironment = () => {
      const environment = propsRef.current.environment || 'studio'
      const lighting = {
        studio: ['#fff0dc', '#9fb5ff', '#90a0c5', 3.1, 1.8, 1.35, .32],
        library: ['#ffd29b', '#6f4a34', '#9b6b43', 2.8, 1.1, .9, .46],
        window: ['#fff7e7', '#b9d7ff', '#dce9ff', 4.2, 1.5, 1.45, .24],
        forest: ['#b7d89e', '#4d7891', '#58715d', 2.4, 1.55, 1.05, .38],
        night: ['#8ca8ff', '#c28cff', '#303c68', 1.7, 1.6, .72, .52],
      }[environment] || null
      key.color.set(lighting[0]); rim.color.set(lighting[1]); ambient.color.set(lighting[2])
      key.intensity = lighting[3]; rim.intensity = lighting[4]; ambient.intensity = lighting[5]; floor.material.opacity = lighting[6]
    }
    refresh(); focusSurface(propsRef.current.activeSurface); applyEnvironment(); sceneRef.current = { refresh, focusSurface, applyEnvironment }
    const resize = () => {
      const rect = mount.getBoundingClientRect()
      const aspect = Math.max(.2, rect.width / Math.max(1, rect.height))
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false)
      camera.aspect = aspect
      const verticalFov = THREE.MathUtils.degToRad(camera.fov)
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
      const fitHeight = (height + .45) / (2 * Math.tan(verticalFov / 2))
      const fitWidth = (width + depth + .7) / (2 * Math.tan(horizontalFov / 2))
      fitCameraDistance = Math.max(fitHeight, fitWidth) * 1.12
      applyZoom()
    }; const observer = new ResizeObserver(resize); observer.observe(mount); resize()
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let travel = 0
    const surfaceAt = event => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); return raycaster.intersectObjects([front, spine, back], false)[0]?.object?.userData?.surface }
    const setZoom = (next: number) => { zoomLevel = Math.max(.72, Math.min(1.55, next)); applyZoom() }
    const onZoomStep = (event: any) => setZoom(zoomLevel + Number(event.detail || 0))
    const onDown = event => { pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.size === 2) { const points = [...pointers.values()]; pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); down = false; return } down = true; travel = 0; lastX = event.clientX; lastY = event.clientY; mount.setPointerCapture?.(event.pointerId); mount.style.cursor = 'grabbing' }
    const onMove = event => { if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.size === 2) { const points = [...pointers.values()]; const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); if (pinchDistance > 0) setZoom(zoomLevel * (distance / pinchDistance)); pinchDistance = distance; return } if (!down) return; const dx = event.clientX - lastX; const dy = event.clientY - lastY; travel += Math.abs(dx) + Math.abs(dy); yaw += dx * .009; pitch = Math.max(-.45, Math.min(.45, pitch - dy * .006)); lastX = event.clientX; lastY = event.clientY }
    const onUp = event => { pointers.delete(event.pointerId); if (pointers.size < 2) pinchDistance = 0; if (down && travel < 7) { const surface = surfaceAt(event); if (surface) propsRef.current.onSurfaceSelect?.(surface) } down = false; mount.style.cursor = 'grab' }
    const onWheel = event => { event.preventDefault(); setZoom(zoomLevel * (event.deltaY < 0 ? 1.08 : .92)) }
    const onDouble = () => { yaw = -.46; pitch = .08 }
    const onContext = event => { const surface = surfaceAt(event); if (!surface) return; event.preventDefault(); propsRef.current.onSurfaceContext?.(event, surface) }
    mount.addEventListener('pointerdown', onDown); mount.addEventListener('pointermove', onMove); mount.addEventListener('pointerup', onUp); mount.addEventListener('pointercancel', onUp); mount.addEventListener('wheel', onWheel, { passive: false }); mount.addEventListener('moonscribe:designer-zoom-step', onZoomStep); mount.addEventListener('dblclick', onDouble); mount.addEventListener('contextmenu', onContext)
    const draw = now => { const elapsed = now - previous; previous = now; if (!down && propsRef.current.autoSpin) yaw += elapsed * .00032; book.rotation.set(pitch, yaw, 0); renderer.render(scene, camera); frame = requestAnimationFrame(draw) }; frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); mount.removeEventListener('pointerdown', onDown); mount.removeEventListener('pointermove', onMove); mount.removeEventListener('pointerup', onUp); mount.removeEventListener('pointercancel', onUp); mount.removeEventListener('wheel', onWheel); mount.removeEventListener('moonscribe:designer-zoom-step', onZoomStep); mount.removeEventListener('dblclick', onDouble); mount.removeEventListener('contextmenu', onContext); mount.replaceChildren(); renderer.dispose(); pages.dispose(); board.dispose(); block.geometry.dispose(); boardGeometry.dispose(); frontMaterials.forEach((entry) => entry.dispose()); backMaterials.forEach((entry) => entry.dispose()); spine.geometry.dispose(); spineMaterials.forEach((entry) => entry.dispose()); headband.geometry.dispose(); floor.geometry.dispose() }
  }, [])
  useEffect(() => { sceneRef.current?.refresh() }, [props.title, props.subtitle, props.byline, props.coverStyle, props.gradient, props.coverImage, props.frontCrop, props.backImage, props.backCrop, props.spineImage, props.spineCrop, props.ornament, props.titleColor, props.titleFont, props.titleSize, props.titleWeight, props.titleSpacing, props.titleTransform, props.showText, props.showBackText, props.showSpineText])
  useEffect(() => { sceneRef.current?.focusSurface(props.activeSurface) }, [props.activeSurface])
  useEffect(() => { sceneRef.current?.applyEnvironment() }, [props.environment])
  const stepZoom = (amount: number) => mountRef.current?.dispatchEvent(new CustomEvent('moonscribe:designer-zoom-step', { detail: amount }))
  return <div ref={mountRef} className={`cover-mockup-3d cover-mockup-webgl environment-${props.environment || 'studio'}`} style={{ cursor: 'grab' }}><div className="cover-mockup-zoom" aria-label="Designer zoom controls"><button type="button" onClick={() => stepZoom(.1)} aria-label="Zoom in">+</button><button type="button" onClick={() => stepZoom(-.1)} aria-label="Zoom out">−</button></div><span className="cover-mockup-3d-hint">drag to inspect · pinch or wheel to zoom · double-click to reset</span></div>
}
