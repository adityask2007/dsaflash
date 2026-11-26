import * as THREE from 'three'

/* Procedural canvas textures – no external image files are needed. */

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d') as CanvasRenderingContext2D]
}

function tex(c: HTMLCanvasElement, repeat?: [number, number], wrap = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (wrap) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (repeat) t.repeat.set(repeat[0], repeat[1])
  }
  t.anisotropy = 8
  return t
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${g},${b})`
}

/** polished plank floor */
export function makeFloorTexture(): THREE.CanvasTexture {
  const [c, g] = mk(1024, 1024)
  const r = rng(77)
  const rows = 10
  const rh = 1024 / rows
  for (let row = 0; row < rows; row++) {
    let x = -r() * 400
    while (x < 1024) {
      const len = 260 + r() * 420
      const base = shade('#8b5a33', Math.floor((r() - 0.5) * 36))
      const grad = g.createLinearGradient(0, row * rh, 0, (row + 1) * rh)
      grad.addColorStop(0, base)
      grad.addColorStop(1, shade('#6f4526', Math.floor((r() - 0.5) * 26)))
      g.fillStyle = grad
      g.fillRect(x, row * rh, len, rh)
      // grain
      for (let i = 0; i < 26; i++) {
        const y = row * rh + r() * rh
        g.strokeStyle = `rgba(${r() < 0.5 ? '40,22,10' : '190,130,80'},${0.05 + r() * 0.1})`
        g.lineWidth = 0.6 + r() * 1.2
        g.beginPath()
        g.moveTo(x, y)
        for (let k = 0; k <= len; k += 24) g.lineTo(x + k, y + Math.sin(k * 0.02 + i) * 1.6)
        g.stroke()
      }
      // seam
      g.fillStyle = 'rgba(25,12,5,0.7)'
      g.fillRect(x, row * rh, 2, rh)
      x += len
    }
    g.fillStyle = 'rgba(25,12,5,0.65)'
    g.fillRect(0, row * rh, 1024, 2)
  }
  return tex(c, [5, 6])
}

/** generic wood grain (furniture) */
export function makeWoodTexture(base: string, seed = 5, grain = 60): THREE.CanvasTexture {
  const [c, g] = mk(512, 512)
  const r = rng(seed)
  g.fillStyle = base
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < grain; i++) {
    const y = r() * 512
    g.strokeStyle = r() < 0.6 ? `rgba(20,10,4,${0.06 + r() * 0.12})` : `rgba(255,220,170,${0.03 + r() * 0.06})`
    g.lineWidth = 0.6 + r() * 2.4
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.015 + i * 1.7) * (2 + r() * 2))
    g.stroke()
  }
  return tex(c, [1, 1])
}

export function makeRugTexture(): THREE.CanvasTexture {
  const [c, g] = mk(512, 768)
  g.fillStyle = '#5b1a1c'
  g.fillRect(0, 0, 512, 768)
  const border = (inset: number, color: string, w: number) => {
    g.strokeStyle = color
    g.lineWidth = w
    g.strokeRect(inset, inset, 512 - inset * 2, 768 - inset * 2)
  }
  border(14, '#d6b068', 8)
  border(34, '#2b3a55', 18)
  border(62, '#d6b068', 4)
  g.fillStyle = '#6b2124'
  g.fillRect(74, 74, 364, 620)
  // diamond lattice
  g.strokeStyle = 'rgba(214,176,104,0.35)'
  g.lineWidth = 2
  for (let i = -8; i < 20; i++) {
    g.beginPath()
    g.moveTo(74 + i * 46, 74)
    g.lineTo(74 + i * 46 + 620, 694)
    g.moveTo(74 + i * 46 + 620, 74)
    g.lineTo(74 + i * 46, 694)
    g.stroke()
  }
  // medallion
  g.save()
  g.translate(256, 384)
  for (let k = 0; k < 4; k++) {
    g.rotate(Math.PI / 4)
    g.fillStyle = k % 2 ? '#d6b068' : '#2b3a55'
    g.fillRect(-110 + k * 14, -110 + k * 14, 220 - k * 28, 220 - k * 28)
  }
  g.fillStyle = '#5b1a1c'
  g.beginPath()
  g.arc(0, 0, 38, 0, Math.PI * 2)
  g.fill()
  g.restore()
  // fibre noise
  const r = rng(9)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,230,190'},${0.03 + r() * 0.05})`
    g.fillRect(r() * 512, r() * 768, 2, 1)
  }
  return tex(c, undefined, false)
}

export function makePlasterTexture(): THREE.CanvasTexture {
  const [c, g] = mk(256, 256)
  const r = rng(31)
  g.fillStyle = '#d6c4a0'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '90,60,30' : '255,245,220'},${0.02 + r() * 0.05})`
    const s = 1 + r() * 4
    g.fillRect(r() * 256, r() * 256, s, s)
  }
  return tex(c, [5, 2])
}

export function makeSkyTexture(): THREE.CanvasTexture {
  const [c, g] = mk(64, 256)
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#9cc4ee')
  grad.addColorStop(0.55, '#e8f1fb')
  grad.addColorStop(1, '#fff0cf')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 256)
  return tex(c, undefined, false)
}

/** soft beam used for the god-rays (alpha fades along the beam and to the edges) */
export function makeBeamTexture(): THREE.CanvasTexture {
  const w = 32
  const h = 256
  const [c, g] = mk(w, h)
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1)
    const along = Math.pow(1 - v, 1.4) * Math.min(1, v * 14)
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) * 2
      const edge = Math.pow(1 - u, 1.6)
      const a = along * edge
      const i = (y * w + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 236
      img.data[i + 2] = 200
      img.data[i + 3] = Math.floor(a * 255)
    }
  }
  g.putImageData(img, 0, 0)
  return tex(c, undefined, false)
}

export interface LabelOpts {
  w?: number
  h?: number
  bg?: string
  fg?: string
  font?: string
  border?: string
  sub?: string
  subFont?: string
}

/** text plaque / cover / sign */
export function makeLabelTexture(text: string, o: LabelOpts = {}): THREE.CanvasTexture {
  const w = o.w ?? 512
  const h = o.h ?? 128
  const [c, g] = mk(w, h)
  g.fillStyle = o.bg ?? '#2a1a0e'
  g.fillRect(0, 0, w, h)
  if (o.border) {
    g.strokeStyle = o.border
    g.lineWidth = Math.max(3, h * 0.04)
    g.strokeRect(g.lineWidth * 1.6, g.lineWidth * 1.6, w - g.lineWidth * 3.2, h - g.lineWidth * 3.2)
  }
  g.fillStyle = o.fg ?? '#e8c77a'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = o.font ?? `600 ${Math.floor(h * (o.sub ? 0.4 : 0.5))}px Georgia, "Times New Roman", serif`
  g.fillText(text, w / 2, o.sub ? h * 0.38 : h / 2, w * 0.92)
  if (o.sub) {
    g.font = o.subFont ?? `400 ${Math.floor(h * 0.2)}px Georgia, serif`
    g.globalAlpha = 0.8
    g.fillText(o.sub, w / 2, h * 0.74, w * 0.92)
    g.globalAlpha = 1
  }
  return tex(c, undefined, false)
}
