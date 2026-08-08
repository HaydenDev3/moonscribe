// 3D constellation map of a novel's characters and relationships.
// Custom lightweight 3D force simulation (repulsion + link springs +
// centering), rendered with three. Lazy-loaded.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const REPULSION = 4.5
const SPRING = 0.012
const REST = 2.4
const CENTER = 0.02
const DAMPING = 0.86
const ITERATIONS = 300

function simulate(count, links) {
  const pos = new Float32Array(count * 3)
  const vel = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 1 + Math.random() * 2.5
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    pos[i * 3 + 2] = r * Math.cos(phi)
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const fx = new Float32Array(count)
    const fy = new Float32Array(count)
    const fz = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        let dx = pos[j * 3] - pos[i * 3]
        let dy = pos[j * 3 + 1] - pos[i * 3 + 1]
        let dz = pos[j * 3 + 2] - pos[i * 3 + 2]
        let d2 = dx * dx + dy * dy + dz * dz
        if (d2 < 0.01) d2 = 0.01
        const f = REPULSION / d2
        const d = Math.sqrt(d2)
        dx /= d
        dy /= d
        dz /= d
        fx[i] -= dx * f
        fy[i] -= dy * f
        fz[i] -= dz * f
        fx[j] += dx * f
        fy[j] += dy * f
        fz[j] += dz * f
      }
    }

    for (const [a, b] of links) {
      const dx = pos[b * 3] - pos[a * 3]
      const dy = pos[b * 3 + 1] - pos[a * 3 + 1]
      const dz = pos[b * 3 + 2] - pos[a * 3 + 2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001
      const f = SPRING * (d - REST)
      const ux = dx / d
      const uy = dy / d
      const uz = dz / d
      fx[a] += ux * f
      fy[a] += uy * f
      fz[a] += uz * f
      fx[b] -= ux * f
      fy[b] -= uy * f
      fz[b] -= uz * f
    }

    for (let i = 0; i < count; i++) {
      fx[i] -= pos[i * 3] * CENTER
      fy[i] -= pos[i * 3 + 1] * CENTER
      fz[i] -= pos[i * 3 + 2] * CENTER
      vel[i * 3] = (vel[i * 3] + fx[i]) * DAMPING
      vel[i * 3 + 1] = (vel[i * 3 + 1] + fy[i]) * DAMPING
      vel[i * 3 + 2] = (vel[i * 3 + 2] + fz[i]) * DAMPING
      pos[i * 3] += vel[i * 3]
      pos[i * 3 + 1] += vel[i * 3 + 1]
      pos[i * 3 + 2] += vel[i * 3 + 2]
    }
  }
  return pos
}

export default function ConstellationMap({ characters, relationships, onSelect, selectedId }) {
  const mountRef = useRef(null)
  const groupRef = useRef(null)
  const nodesRef = useRef([])
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const chars = characters || []
    if (!chars.length) return

    const dark = document.documentElement.dataset.theme !== 'light'
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 1.5, 9)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(3, 6, 5)
    scene.add(key)

    const group = new THREE.Group()
    scene.add(group)
    groupRef.current = group

    // links first (behind nodes)
    const links = (relationships || [])
      .map((r) => {
        const ai = chars.findIndex((c) => c.id === r.a)
        const bi = chars.findIndex((c) => c.id === r.b)
        return ai >= 0 && bi >= 0 ? [ai, bi] : null
      })
      .filter(Boolean)

    const positions = simulate(chars.length, links)
    const lineGeo = new THREE.BufferGeometry()
    if (links.length) {
      const verts = new Float32Array(links.length * 6)
      links.forEach(([a, b], i) => {
        verts[i * 6] = positions[a * 3]
        verts[i * 6 + 1] = positions[a * 3 + 1]
        verts[i * 6 + 2] = positions[a * 3 + 2]
        verts[i * 6 + 3] = positions[b * 3]
        verts[i * 6 + 4] = positions[b * 3 + 1]
        verts[i * 6 + 5] = positions[b * 3 + 2]
      })
      lineGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
      const lineMat = new THREE.LineBasicMaterial({
        color: dark ? 0x7f8a94 : 0xb3ada4,
        transparent: true,
        opacity: 0.5
      })
      group.add(new THREE.LineSegments(lineGeo, lineMat))
    }

    // nodes + labels
    nodesRef.current = chars.map((c, i) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 24, 24),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(c.color || '#D4A5A5'), roughness: 0.4, metalness: 0.15, emissive: new THREE.Color(c.color || '#D4A5A5'), emissiveIntensity: 0.18 })
      )
      mesh.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      mesh.userData = { char: c, index: i }

      const label = makeLabel(c.name, c.color || '#D4A5A5', dark)
      label.position.set(0, 0.55, 0)
      mesh.add(label)

      group.add(mesh)
      return mesh
    })

    // interaction
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let dragging = false
    let lastX = 0
    let lastY = 0
    let rotY = -0.4
    let rotX = 0.25
    let auto = true
    let raf = 0

    const onDown = (e) => {
      dragging = true
      auto = false
      lastX = e.clientX
      lastY = e.clientY
    }
    const onMove = (e) => {
      if (!dragging) return
      rotY += (e.clientX - lastX) * 0.005
      rotX += (e.clientY - lastY) * 0.005
      rotX = Math.max(-1.2, Math.min(1.2, rotX))
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = (e) => {
      dragging = false
      const rect = mount.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hit = raycaster.intersectObjects(nodesRef.current)
      if (hit.length) {
        const { char } = hit[0].object.userData
        setInfo({ char, rels: (relationships || []).filter((r) => r.a === char.id || r.b === char.id) })
        onSelect?.(char.id)
      } else {
        setInfo(null)
        onSelect?.(null)
      }
    }
    const onWheel = (e) => {
      camera.position.z = Math.max(4.5, Math.min(14, camera.position.z + e.deltaY * 0.004))
    }

    mount.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    mount.addEventListener('wheel', onWheel, { passive: true })

    let last = performance.now()
    const loop = (now) => {
      if (!dragging && auto) rotY += (now - last) * 0.00015
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
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    // highlight selection
    const paint = () => {
      nodesRef.current.forEach((m, i) => {
        const selected = m.userData.char.id === selectedId
        m.material.emissiveIntensity = selected ? 0.6 : 0.18
        m.scale.setScalar(selected ? 1.45 : 1)
      })
    }
    paint()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      mount.removeEventListener('pointerdown', onDown)
      mount.removeEventListener('wheel', onWheel)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
      lineGeo.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters, relationships])

  useEffect(() => {
    nodesRef.current.forEach((m) => {
      const selected = m.userData.char.id === selectedId
      m.material.emissiveIntensity = selected ? 0.6 : 0.18
      m.scale.setScalar(selected ? 1.45 : 1)
    })
  }, [selectedId])

  if (!characters || !characters.length) return null

  return (
    <div className="constellation-wrap">
      <div className="constellation" ref={mountRef} />
      {info && (
        <div className="constellation-info">
          <div className="ci-head">
            <span className="character-avatar" style={{ background: info.char.color || '#D4A5A5' }}>{(info.char.name || '?').slice(0, 2).toUpperCase()}</span>
            <div>
              <b>{info.char.name}</b>
              {info.char.role && <span className="muted small"> · {info.char.role}</span>}
            </div>
          </div>
          {info.char.personality && <p className="small" style={{ margin: '8px 0' }}>{info.char.personality}</p>}
          {info.rels.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {info.rels.map((r) => {
                const otherId = r.a === info.char.id ? r.b : r.a
                const other = characters.find((c) => c.id === otherId)
                return (
                  <div key={r.id} className="ci-rel">
                    <span className="dot" style={{ background: other?.color || 'var(--grey-soft)' }} />
                    {other?.name || 'Someone'} — {r.description || 'linked'}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <div className="constellation-hint">drag to turn · click a star</div>
    </div>
  )
}

function makeLabel(text, color, dark) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  ctx.font = "600 52px 'Inter', sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 18
  ctx.fillStyle = dark ? '#e6e2da' : '#3d3a36'
  const label = String(text || '').slice(0, 24)
  ctx.fillText(label, 256, 50)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.9, 0.36, 1)
  return sprite
}
