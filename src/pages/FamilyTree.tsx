import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { listCharacters } from '../db/characters'
import { listRelationships, createRelationship } from '../db/relationships'
import { useNavigate, useParams } from 'react-router-dom'

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
const relationKind = (description = '') => /parent|mother|father|son|daughter|child|sister|brother|family|grand/i.test(description) ? 'family' : /married|partner|lover|romance|wife|husband/i.test(description) ? 'partner' : 'connection'

function RelationshipUniverse({ nodes, relationships, selected, onSelect, onConnect }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [frozen, setFrozen] = useState(false)
  const frozenRef = useRef(false)
  frozenRef.current = frozen
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 100)
    camera.position.set(0, 1.2, 13)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); mount.appendChild(renderer.domElement)
    const group = new THREE.Group(); scene.add(group)
    const positions = new Map<string, THREE.Vector3>()
    nodes.forEach((node, index) => {
      const angle = index * Math.PI * (3 - Math.sqrt(5))
      const radius = 1.5 + Math.sqrt(index + 1) * .7
      positions.set(node.id, new THREE.Vector3(Math.cos(angle) * radius, (index % 3 - 1) * .85, Math.sin(angle) * radius * .55))
    })
    const nodeMeshes: THREE.Mesh[] = []
    nodes.forEach((node) => {
      const portraitCanvas = document.createElement('canvas'); portraitCanvas.width = 128; portraitCanvas.height = 128
      const portraitContext = portraitCanvas.getContext('2d')!
      portraitContext.fillStyle = node.color || '#d7ad67'; portraitContext.fillRect(0, 0, 128, 128)
      portraitContext.fillStyle = '#fff8ee'; portraitContext.font = '700 38px Arial'; portraitContext.textAlign = 'center'; portraitContext.textBaseline = 'middle'; portraitContext.fillText(initials(node.name), 64, 64)
      const texture = new THREE.CanvasTexture(portraitCanvas); texture.colorSpace = THREE.SRGBColorSpace
      if (node.portrait) { const image = new Image(); image.onload = () => { portraitContext.clearRect(0, 0, 128, 128); portraitContext.drawImage(image, 0, 0, 128, 128); texture.needsUpdate = true }; image.src = node.portrait }
      const material = new THREE.MeshStandardMaterial({ map: texture, color: '#ffffff', emissive: node.color || '#d7ad67', emissiveIntensity: .1, roughness: .32, metalness: .2 })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(.27, 24, 16), material)
      mesh.position.copy(positions.get(node.id)!); mesh.userData.node = node; group.add(mesh); nodeMeshes.push(mesh)
    })
    relationships.forEach((link) => {
      const a = positions.get(link.a), b = positions.get(link.b); if (!a || !b) return
      const geometry = new THREE.BufferGeometry().setFromPoints([a, b])
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: relationKind(link.description) === 'family' ? '#d7ad67' : '#7897aa', transparent: true, opacity: .48 }))
      group.add(line)
    })
    const starfield = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#c7a66b', size: .025, transparent: true, opacity: .65 }))
    const stars = new Float32Array(180 * 3); for (let i = 0; i < stars.length; i += 3) { stars[i] = (Math.random() - .5) * 18; stars[i + 1] = (Math.random() - .5) * 10; stars[i + 2] = (Math.random() - .5) * 8 }
    starfield.geometry.setAttribute('position', new THREE.BufferAttribute(stars, 3)); scene.add(starfield)
    scene.add(new THREE.AmbientLight('#d8c29b', 1.7)); const light = new THREE.PointLight('#d7ad67', 14, 18); light.position.set(0, 4, 5); scene.add(light)
    const resize = () => { const rect = mount.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / Math.max(1, rect.height); camera.updateProjectionMatrix() }; resize()
    const observer = new ResizeObserver(resize); observer.observe(mount)
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2()
    let dragging = false; let dragged = false; let lastX = 0; let lastY = 0; let dragNode: any = null
    const nodeAt = (event: any) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); return raycaster.intersectObjects(nodeMeshes)[0]?.object?.userData?.node }
    const click = (event: MouseEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(nodeMeshes)[0]; if (hit?.object.userData.node) onSelect(hit.object.userData.node) }
    const zoom = (event: any) => { event.preventDefault(); camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * .008, 5, 24) }
    const pointerDown = (event: any) => { dragging = true; dragged = false; dragNode = nodeAt(event); lastX = event.clientX; lastY = event.clientY; renderer.domElement.setPointerCapture(event.pointerId) }
    const pointerMove = (event: any) => { if (!dragging) return; const dx = event.clientX - lastX; const dy = event.clientY - lastY; if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true; group.rotation.y += dx * .008; group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + dy * .005, -.8, .8); lastX = event.clientX; lastY = event.clientY }
    const pointerUp = (event: any) => { const target = nodeAt(event); if (dragNode && target && target.id !== dragNode.id && dragged) onConnect(dragNode, target); dragging = false; dragNode = null; renderer.domElement.releasePointerCapture?.(event.pointerId) }
    renderer.domElement.addEventListener('click', (event) => { if (!dragged) click(event) })
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('wheel', zoom, { passive: false })
    let frame = 0; const animate = () => { frame = requestAnimationFrame(animate); if (!frozenRef.current && !dragging) group.rotation.y += .0008; nodeMeshes.forEach((mesh) => { const active = selectedRef.current?.id === mesh.userData.node.id; mesh.scale.lerp(new THREE.Vector3(active ? 1.45 : 1, active ? 1.45 : 1, active ? 1.45 : 1), .12) }); renderer.render(scene, camera) }; animate()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('wheel', zoom); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.dispose(); mount.removeChild(renderer.domElement) }
  }, [nodes, relationships, onConnect, onSelect])
  const person = selected
  return <div ref={mountRef} className="family-tree-universe" role="application" aria-label="Interactive three dimensional relationship map"><div className="family-tree-universe-tools"><button type="button" onClick={() => onConnect()}><i className="fa-solid fa-link" /> Connect nodes</button><span>Scroll to zoom</span></div><span className="family-tree-universe-hint">Select a node to inspect · connect two people from the tooltip</span>{person && <div className="family-tree-tooltip" role="dialog" aria-label={`${person.name || 'Character'} details`}><button type="button" className="family-tree-tooltip-close" onClick={() => onSelect(null)} aria-label="Close character details">×</button><div className="family-tree-detail-head"><span className="family-tree-avatar" style={{ background: person.color || 'var(--accent)' }}>{initials(person.name)}</span><div><h3>{person.name || 'Unnamed character'}</h3><p>{person.role || 'Character'}</p></div></div><p className="family-tree-bio">{person.bio || person.notes || 'No character summary yet.'}</p><div className="family-tree-tooltip-stats"><span><b>{person.links.length}</b> relationships</span><span><b>{person.aliases?.length || 0}</b> aliases</span></div><button type="button" className="button button-secondary family-tree-connect-button" onClick={() => onConnect(person)}>＋ Connect this character</button><h4>Relationship threads</h4>{person.links.length ? person.links.map((link) => { const other = nodes.find((node) => node.id === (link.a === person.id ? link.b : link.a)); return <button type="button" className="family-tree-link" key={link.id} onClick={() => onSelect(other)}><strong>{other?.name || 'Unknown character'}</strong><span>{link.description || 'Story relationship'}</span></button> }) : <p className="muted">No relationships recorded.</p>}</div>}</div>
}

export default function FamilyTree({ novelId, embedded = false }) {
  const { id } = useParams(); const navigate = useNavigate(); const nid = novelId || id
  const [characters, setCharacters] = useState<any[]>([]); const [relationships, setRelationships] = useState<any[]>([]); const [selected, setSelected] = useState<any>(null)
  useEffect(() => { if (!nid) return; Promise.all([listCharacters(nid), listRelationships(nid)]).then(([people, links]) => { setCharacters(people); setRelationships(links) }) }, [nid])
  const nodes = useMemo(() => characters.map((character, index) => ({ ...character, index, links: relationships.filter((link) => link.a === character.id || link.b === character.id) })), [characters, relationships])
  const groups = useMemo(() => { const family = nodes.filter((node) => node.links.some((link) => relationKind(link.description) === 'family')); const partners = nodes.filter((node) => !family.includes(node) && node.links.some((link) => relationKind(link.description) === 'partner')); const other = nodes.filter((node) => !family.includes(node) && !partners.includes(node)); return [{ label: 'Family threads', items: family }, { label: 'Partners & alliances', items: partners }, { label: 'Wider story connections', items: other }].filter((group) => group.items.length) }, [nodes])
  const connect = async (from = selected, target = null) => { if (!from) return; const chosen = target || characters.find((character) => character.id === window.prompt('Enter the character name to connect')?.trim()); if (!chosen || chosen.id === from.id) return; const description = window.prompt('Describe their relationship', 'Story relationship')?.trim(); if (!description) return; await createRelationship(nid, { a: from.id, b: chosen.id, description }); setRelationships(await listRelationships(nid)); setSelected(from) }
  return <div className={embedded ? undefined : 'app'}><main className="family-tree-page page page-wide"><header className="family-tree-header"><div><span className="settings-panel-kicker">World &amp; story</span><h2>Family tree</h2><p>Explore the people who shape one another, from blood ties to chosen family.</p></div><button className="button button-ghost" onClick={() => navigate(`/novel/${nid}/relationships`)}>Manage relationships</button></header>{!characters.length ? <div className="family-tree-empty">Add characters and relationships to grow your story tree.</div> : <RelationshipUniverse nodes={nodes} relationships={relationships} selected={selected} onSelect={setSelected} onConnect={connect} />}</main></div>
}
