import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { BookRecord } from './Book3D'
import './books-large.css'

type NativePointerEvent = globalThis.PointerEvent

type Props = { books: BookRecord[]; activeId: string | null; onHover: (id: string | null) => void; onSelect: (book: BookRecord) => void }
const COLORS: Record<string, string> = { moonstone: '#5a80a8', rose: '#c49090', sage: '#7eaa7e', sand: '#c8a06a', twilight: '#364f6b' }

function texture(text: string, color: string, spine = false) {
  const canvas = document.createElement('canvas'); canvas.width = spine ? 512 : 1024; canvas.height = 1536
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff7e8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${spine ? 42 : 66}px Georgia`; ctx.save()
  if (spine) { ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(text.slice(0, 28), 0, 0) } else ctx.fillText(text.slice(0, 22), canvas.width / 2, canvas.height * .48, canvas.width * .8)
  ctx.restore(); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter; return map
}

function imageMap(src: string | undefined) { if (!src) return null; const map = new THREE.TextureLoader().load(src); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter; return map }
function coverMap(book: BookRecord, fallback: string) { return imageMap(book.coverDesign?.frontImage) || imageMap(book.cover) || texture(book.title || 'Untitled', book.coverDesign?.frontColor || fallback) }

function createBook(book: BookRecord, index: number) {
  const root = new THREE.Group(); root.userData.book = book
  const height = 3.55, width = 2.32, words = Number(book.words || 0)
  const thickness = THREE.MathUtils.clamp(.26 + words / 220000, .26, .72); const color = COLORS[book.coverStyle || ''] || book.coverDesign?.frontColor || '#334452'
  const page = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), new THREE.MeshStandardMaterial({ color: '#e8dfcf', roughness: .92 })); page.castShadow = page.receiveShadow = true; root.add(page)
  const cover = coverMap(book, color); const board = new THREE.BoxGeometry(width + .06, height + .1, .08)
  const front = new THREE.Mesh(board, new THREE.MeshStandardMaterial({ map: cover, roughness: .8 })); front.position.z = thickness / 2 + .045; front.castShadow = true; root.add(front)
  const back = new THREE.Mesh(board, new THREE.MeshStandardMaterial({ map: imageMap(book.coverDesign?.backImage) || undefined, color: book.coverDesign?.backColor || color, roughness: .85 })); back.rotation.y = Math.PI; back.position.z = -thickness / 2 - .045; root.add(back)
  const spine = new THREE.Mesh(new THREE.BoxGeometry(.06, height + .1, thickness + .04), new THREE.MeshStandardMaterial({ map: imageMap(book.coverDesign?.spineImage) || texture(book.title || 'Untitled', book.coverDesign?.spineColor || color, true), roughness: .82 })); spine.position.x = -width / 2 - .05; spine.castShadow = true; root.add(spine)
  // Upright shelf orientation: the Designer-style book is turned so its
  // spine faces the viewer. Books remain vertical and sit beside one another.
  root.rotation.y = Math.PI / 2; root.position.set(0, 0, (index % 3 - 1) * .025); const bounds = new THREE.Box3().setFromObject(root); const size = bounds.getSize(new THREE.Vector3()); root.userData.spineWidth = size.x; root.userData.bookDepth = size.z; root.userData.baseX = 0; root.userData.baseY = root.position.y; root.userData.baseZ = root.position.z
  return root
}

export default function BookShelf3D({ books, activeId, onHover, onSelect }: Props) {
  const mount = useRef<HTMLDivElement>(null); const state = useRef({ books, activeId, onHover, onSelect }); state.current = { books, activeId, onHover, onSelect }
  useEffect(() => {
    const el = mount.current; if (!el) return
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(32, 1, .1, 100); camera.position.set(0, 1.45, 10.8); camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.domElement.style.display = 'block'; renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; el.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight('#c9c0ae', 1.25)); const key = new THREE.DirectionalLight('#fff0dc', 3); key.position.set(-4, 7, 5); key.castShadow = true; scene.add(key); const rim = new THREE.DirectionalLight('#9fb5ff', 1.1); rim.position.set(5, 3, -4); scene.add(rim)
    const visibleBooks = books.slice(0, el.clientWidth < 700 ? 4 : 6); const group = new THREE.Group(); scene.add(group); const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), new THREE.ShadowMaterial({ opacity: .16 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.84; floor.receiveShadow = true; scene.add(floor)
    const meshes = visibleBooks.map(createBook); const gap = .025; const totalWidth = meshes.reduce((sum, book) => sum + Number(book.userData.spineWidth || .3), 0) + Math.max(0, meshes.length - 1) * gap; let cursor = -totalWidth / 2; meshes.forEach((book) => { const width = Number(book.userData.spineWidth || .3); book.position.x = cursor + width / 2; book.userData.baseX = book.position.x; cursor += width + gap; group.add(book) });
    // Verify the packed idle geometry, including covers, pages, spine and all
    // child meshes. A small gap is preferable to a hidden intersection.
    const idleBoxes = meshes.map((book) => new THREE.Box3().setFromObject(book)); idleBoxes.forEach((box, index) => { for (let next = index + 1; next < idleBoxes.length; next += 1) { if (box.intersectsBox(idleBoxes[next])) { const correction = gap + .02; for (let move = next; move < meshes.length; move += 1) { meshes[move].position.x += correction; meshes[move].userData.baseX += correction } } } }); const ray = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let hovered: THREE.Group | null = null
    const hit = (event: NativePointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); ray.setFromCamera(pointer, camera); return ray.intersectObjects(meshes.flatMap((book) => book.children), false)[0]?.object.parent as THREE.Group | undefined }
    const move = (event: NativePointerEvent) => { const next = hit(event) || null; if (next !== hovered) { hovered = next; state.current.onHover(next?.userData.book?.id || next?.userData.book?.novelId || null) } }
    const click = (event: NativePointerEvent) => { const next = hit(event); if (next) state.current.onSelect(next.userData.book) }
    renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerleave', () => { hovered = null; state.current.onHover(null) }); renderer.domElement.addEventListener('pointerup', click)
    const resize = () => { const rect = el.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = rect.width / Math.max(1, rect.height); camera.position.x = 0; camera.position.y = rect.width < 700 ? 1.45 : 1.45; camera.position.z = rect.width < 700 ? 10.8 : 10.8; camera.lookAt(0, 0, 0); camera.updateProjectionMatrix() }; const ro = new ResizeObserver(resize); ro.observe(el); resize()
    let frame = 0; const tick = () => { let anyFocus = false; meshes.forEach((book) => { const id = book.userData.book?.id || book.userData.book?.novelId; const focus = state.current.activeId === id || hovered === book; anyFocus ||= focus; const mobile = el.clientWidth < 700; const baseX = Number(book.userData.baseX || 0); const baseZ = Number(book.userData.baseZ || 0); const bookDepth = Number(book.userData.bookDepth || 2.4); const targetPull = focus ? (mobile ? Math.max(2.7, bookDepth + .35) : Math.max(3.2, bookDepth + .7)) : 0; book.position.x = THREE.MathUtils.lerp(book.position.x, baseX, .1); book.position.z = THREE.MathUtils.lerp(book.position.z, baseZ + targetPull, .1); book.position.y = THREE.MathUtils.lerp(book.position.y, Number(book.userData.baseY || 0) + (focus ? .04 : 0), .1); // Pull clear of the row before turning the cover.
      const pullProgress = THREE.MathUtils.clamp(Math.abs(book.position.z - baseZ) / Math.max(.01, targetPull), 0, 1); const rotationProgress = THREE.MathUtils.clamp((pullProgress - .4) / .6, 0, 1); const shelfRotation = Math.PI / 2; const presentationRotation = 0; const targetRotation = focus ? THREE.MathUtils.lerp(shelfRotation, presentationRotation, rotationProgress) : shelfRotation; book.rotation.y = THREE.MathUtils.lerp(book.rotation.y, targetRotation, .12); if (focus && rotationProgress > .995 && Math.abs(book.rotation.y - presentationRotation) < .008) book.rotation.y = presentationRotation; const activeScale = focus ? (mobile ? 1.03 : 1.08) : 1; book.scale.lerp(new THREE.Vector3(activeScale, activeScale, activeScale), .1) }); const targetCameraZ = anyFocus ? (el.clientWidth < 700 ? 10.8 : 10.8) : (el.clientWidth < 700 ? 7.1 : 6.2); camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraZ, .08); camera.lookAt(0, 0, 0); renderer.render(scene, camera); frame = requestAnimationFrame(tick) }; tick()
    return () => { cancelAnimationFrame(frame); ro.disconnect(); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', click); renderer.dispose(); scene.traverse((object: any) => { object.geometry?.dispose?.(); const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []; materials.forEach((material: any) => { material.map?.dispose?.(); material.dispose?.() }) }); el.replaceChildren() }
  }, [books])
  return <div ref={mount} className="book-shelf-3d" role="application" aria-label="Interactive three dimensional stack of books" />
}
