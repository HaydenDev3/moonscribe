import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function LandingAtmosphere() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const mount = ref.current
    if (!mount || !window.WebGLRenderingContext || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(55, 1, .1, 100); camera.position.z = 8
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); mount.appendChild(renderer.domElement)
    const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xd9a74e, size: .035, transparent: true, opacity: .65 })); const positions = new Float32Array(180 * 3); for (let i=0;i<positions.length;i++) positions[i]=(Math.random()-.5)*12; points.geometry.setAttribute('position', new THREE.BufferAttribute(positions,3)); scene.add(points)
    const resize=()=>{const r=mount.getBoundingClientRect(); renderer.setSize(r.width,r.height,false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix()}; resize(); window.addEventListener('resize',resize); let frame=0; const animate=()=>{points.rotation.y+=.00035; renderer.render(scene,camera); frame=requestAnimationFrame(animate)}; animate()
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);points.geometry.dispose();(points.material as THREE.Material).dispose();renderer.dispose();mount.replaceChildren()}
  }, [])
  return <div ref={ref} className="landing-atmosphere" aria-hidden="true" />
}
