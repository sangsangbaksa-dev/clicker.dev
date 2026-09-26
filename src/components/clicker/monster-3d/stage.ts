import * as THREE from "three"
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import type { Field, MonsterKind } from "@/domain/services/clicker-monster"

/**
 * Real-time 3D Monster Hunt stage. Renders the Blender-built GLBs from
 * scripts/clicker-monsters-3d.py and animates their named parts:
 *   plate_<n> (armor, in break order) · eye_L/R (+pupil) · core · body
 *   specter: tent_<i>_<seg> chains   golem: head · arm_L/R · leg_L/R
 *
 * Field units map onto the z=0 plane of a perspective camera sized so the plane exactly fills
 * the canvas — a monster at field (x, y) draws where the 2D overlay expects it.
 */

const UNIT = 0.01 // metres per field unit

export type StageFrame = {
  t: number
  dt: number
  phase: "spawn" | "alive" | "dying"
  phaseT: number
  spawnS: number
  pos: { x: number; y: number; facing: 1 | -1 }
  platesBroken: number
  /** Field-space target of the laser (null when not firing). */
  aim: { x: number; y: number } | null
  burning: boolean
  burnT: number
  enraged: boolean
  /** 0..1 white-hot flash after a hit / plate break. */
  flash: number
  /** 0..1 recoil after a plate breaks. */
  punch: number
  blink: number
  jitter: { x: number; y: number }
  /** Movement clock (drives the golem's gait). */
  pathT: number
  /** A monster died this frame — shatter it. */
  killed: boolean
}

type Debris = {
  obj: THREE.Object3D
  vel: THREE.Vector3
  spin: THREE.Vector3
  life: number
  max: number
  bounced: boolean
}

const TINT: Record<MonsterKind, { key: number; rim: number; sky: number; ground: number; core: number; rage: number; ore: number }> = {
  specter: { key: 0xdff4ff, rim: 0x4fd8ff, sky: 0x2a5566, ground: 0x05080c, core: 0x6ff0ff, rage: 0xff4a3c, ore: 0x2fb6ff },
  golem: { key: 0xf3e9ff, rim: 0xa77bff, sky: 0x3b2d55, ground: 0x07050c, core: 0xc08cff, rage: 0xff4a3c, ore: 0x8a4dff },
}

export class MonsterStage {
  readonly ready: Promise<void>
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  private field: Field = { w: 1000, h: 600 }
  private root = new THREE.Group() // position/scale driven per frame
  private model: THREE.Object3D | null = null
  private parts = new Map<string, THREE.Object3D>()
  private plates: THREE.Object3D[] = []
  private rockMats: THREE.MeshStandardMaterial[] = []
  private eyeMats: THREE.MeshStandardMaterial[] = []
  private coreMat: THREE.MeshStandardMaterial | null = null
  private oreMat: THREE.MeshStandardMaterial | null = null
  private debris: Debris[] = []
  private coreLight: THREE.PointLight
  private laserLight: THREE.PointLight
  private raycaster = new THREE.Raycaster()
  private disposed = false
  private eyeBase = new Map<THREE.Object3D, THREE.Vector3>()

  constructor(
    private canvas: HTMLCanvasElement,
    private kind: MonsterKind,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15

    const tint = TINT[kind]
    this.scene.add(new THREE.HemisphereLight(tint.sky, tint.ground, 1.4))
    const key = new THREE.DirectionalLight(tint.key, 2.6)
    key.position.set(4, 6, 8)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(tint.rim, 3.2)
    rim.position.set(-5, 4, -6)
    this.scene.add(rim)
    this.coreLight = new THREE.PointLight(tint.core, 6, 5, 2)
    this.laserLight = new THREE.PointLight(0xffc88a, 0, 4, 2)
    this.scene.add(this.root, this.laserLight)

    // Models are Draco-compressed (~0.2 MB each); the wasm decoder is served from /clicker/draco/.
    const draco = new DRACOLoader().setDecoderPath("/clicker/draco/").setDecoderConfig({ type: "wasm" })
    const loader = new GLTFLoader().setDRACOLoader(draco)
    this.ready = loader.loadAsync(`/clicker/monster/${kind}.glb`).then((gltf) => {
      draco.dispose()
      if (this.disposed) return
      this.adopt(gltf.scene)
    })
  }

  private adopt(model: THREE.Object3D) {
    // Centre the model on its bounds and scale it to the hit ellipse's height.
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const targetH = (this.kind === "golem" ? 330 : 250) * UNIT
    const s = targetH / size.y
    model.position.sub(centre.multiplyScalar(s))
    model.scale.setScalar(s)
    this.root.add(model)
    this.model = model

    model.traverse((o) => {
      this.parts.set(o.name, o)
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      // Each instance owns its materials so heat/rage tints never leak between runs.
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone()
        if (c.name === "rock") this.rockMats.push(c)
        else if (c.name === "eye") this.eyeMats.push(c)
        else if (c.name === "core") this.coreMat = c
        else if (c.name === "ore" && !this.oreMat) this.oreMat = c
        return c
      })
      mesh.material = Array.isArray(mesh.material) ? mats : mats[0]
    })
    for (let n = 0; ; n++) {
      const plate = this.parts.get(`plate_${n}`)
      if (!plate) break
      this.plates.push(plate)
    }
    for (const name of ["eye_L", "eye_R"]) {
      const eye = this.parts.get(name)
      if (eye) this.eyeBase.set(eye, eye.scale.clone())
    }
    const core = this.parts.get("core")
    ;(core ?? model).add(this.coreLight)
  }

  get plateCount() {
    return this.plates.length
  }

  resize(cssW: number, cssH: number, field: Field) {
    this.field = field
    this.renderer.setSize(cssW, cssH, false)
    this.camera.aspect = field.w / field.h
    // Distance at which the z=0 plane is exactly field.h tall.
    const planeH = field.h * UNIT
    const dist = planeH / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    this.camera.position.set(0, 0, dist)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
  }

  toWorld(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x - this.field.w / 2) * UNIT, -(y - this.field.h / 2) * UNIT, 0)
  }

  /** True when the laser at field point `aim` actually strikes the monster's mesh. */
  hits(aim: { x: number; y: number }): boolean {
    if (!this.model || !this.model.visible) return false
    const ndc = new THREE.Vector2((aim.x / this.field.w) * 2 - 1, -(aim.y / this.field.h) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    // The raycaster ignores visibility; a plate that already broke off must not block/count.
    return this.raycaster.intersectObject(this.model, true).some((hit) => {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) return false
      return true
    })
  }

  frame(f: StageFrame) {
    if (!this.model) return
    const tint = TINT[this.kind]
    const { t } = f

    // --- placement, spawn rise, squash & stretch ---
    let scale = 1
    let rise = 0
    if (f.phase === "spawn") {
      const p = Math.min(1, f.phaseT / f.spawnS)
      const c = 1.9
      const e = 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
      scale = 0.35 + 0.65 * e
      rise = (1 - e) * -1.4
    }
    const breathe = Math.sin(t * (f.enraged ? 9 : 5)) * 0.03
    const world = this.toWorld(f.pos.x + f.jitter.x, f.pos.y + f.jitter.y)
    this.root.position.set(world.x, world.y + rise, 0)
    const sx = scale * (1 - breathe + f.punch * 0.08)
    const sy = scale * (1 + breathe - f.punch * 0.1)
    this.root.scale.set(sx, sy, sx)
    this.model.visible = !(f.phase === "dying" && f.phaseT >= 0.12)

    // Face the way it moves; square up to the laser while it burns.
    const guard = Math.min(1, f.burnT * 3)
    const walkYaw = this.kind === "golem" ? f.pos.facing * 0.75 : f.pos.facing * 0.35 + Math.sin(t * 0.7) * 0.15
    const yaw = walkYaw * (1 - guard * 0.8)
    this.root.rotation.y += (yaw - this.root.rotation.y) * Math.min(1, f.dt * 6)
    this.root.rotation.z = this.kind === "specter" ? Math.sin(t * 1.3) * 0.06 : 0

    // --- eyes: blink, squint under the beam, follow the laser ---
    const squint = f.burning ? 0.35 : 1 - f.blink * 0.9
    const lookAt = f.aim ? this.toWorld(f.aim.x, f.aim.y) : new THREE.Vector3(0, -this.field.h * UNIT, 6)
    lookAt.z = 3
    for (const [eye, base] of this.eyeBase) {
      eye.scale.set(base.x, base.y * squint, base.z)
      eye.lookAt(lookAt)
    }

    // --- per-kind rigs ---
    if (this.kind === "specter") {
      const speed = f.enraged ? 4.2 : 2.2
      const curl = Math.min(1, f.burnT * 2.5)
      for (let i = 0; i < 8; i++) {
        for (let seg = 0; seg < 4; seg++) {
          const s = this.parts.get(`tent_${i}_${seg}`)
          if (!s) continue
          const amp = (0.18 + seg * 0.08) * (1 + curl)
          s.rotation.x = Math.sin(t * speed + i * 0.9 + seg * 0.7) * amp - curl * 0.25 * (seg + 1)
          s.rotation.z = Math.cos(t * speed * 0.8 + i * 1.3 + seg * 0.5) * amp * 0.7
        }
      }
    } else {
      const gait = f.phase === "alive" ? f.pathT * Math.PI * 2 * 0.9 : 0
      const legL = this.parts.get("leg_L")
      const legR = this.parts.get("leg_R")
      if (legL) legL.rotation.x = Math.sin(gait) * 0.45
      if (legR) legR.rotation.x = -Math.sin(gait) * 0.45
      const body = this.parts.get("body")
      if (body) body.rotation.x = 0.08 + Math.abs(Math.sin(gait)) * 0.03 + guard * 0.12
      // Arms swing against the legs; under the beam they come up to shield the face.
      for (const [name, side] of [["arm_L", -1], ["arm_R", 1]] as const) {
        const arm = this.parts.get(name)
        if (!arm) continue
        const swing = -Math.sin(gait) * 0.35 * side
        arm.rotation.x = swing * (1 - guard) - guard * 1.9
        arm.rotation.z = guard * 0.55 * -side
      }
      const head = this.parts.get("head")
      if (head && f.aim) {
        const dx = (f.aim.x - f.pos.x) / 400
        head.rotation.y = THREE.MathUtils.clamp(dx, -0.5, 0.5) * (1 - guard)
      }
    }

    // --- heat, flash and rage on the materials ---
    const heat = Math.min(1, f.burnT * 1.4)
    // Keep it a tint: strong emissive on the rock flattens the model into a solid blob.
    const hot = f.flash > 0.05 ? new THREE.Color(0xffffff) : f.enraged ? new THREE.Color(tint.rage) : new THREE.Color(0xff7a2a)
    const glow = Math.max(f.flash * 0.55, heat * 0.1 + (f.enraged ? 0.08 + 0.05 * Math.sin(t * 12) : 0))
    for (const m of this.rockMats) {
      m.emissive.copy(hot)
      m.emissiveIntensity = glow
    }
    const eyeColor = new THREE.Color(f.enraged ? tint.rage : tint.core)
    for (const m of this.eyeMats) m.emissive.copy(eyeColor)
    if (this.coreMat) {
      this.coreMat.emissive.set(f.enraged ? tint.rage : tint.core)
      this.coreMat.emissiveIntensity = 3 + Math.sin(t * (f.enraged ? 12 : 4)) * 1.2 + heat * 3
    }
    this.coreLight.color.set(f.enraged ? tint.rage : tint.core)
    this.coreLight.intensity = 4 + heat * 6 + (f.enraged ? 4 : 0)

    // Warm light where the beam lands, so the burn lights up the ore around it.
    if (f.burning && f.aim) {
      const p = this.toWorld(f.aim.x, f.aim.y)
      this.laserLight.position.set(p.x, p.y, 1.2)
      this.laserLight.intensity = 10 + Math.random() * 4
    } else {
      this.laserLight.intensity = 0
    }

    // --- armor: plates that should be gone fly off as debris ---
    this.model.updateMatrixWorld(true)
    this.plates.forEach((plate, i) => {
      const gone = i < f.platesBroken
      if (gone && plate.visible) this.launch(plate, 1)
      plate.visible = !gone
    })
    if (f.killed) this.shatter()

    this.stepDebris(f.dt)
    this.renderer.render(this.scene, this.camera)
  }

  /** Clone `obj` into world space and send it tumbling away from the body. */
  private launch(obj: THREE.Object3D, speed: number) {
    const copy = obj.clone(true)
    obj.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale)
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
        const c = m.clone()
        c.transparent = true
        return c
      })
      mesh.material = Array.isArray(mesh.material) ? mats : mats[0]
    })
    this.scene.add(copy)
    const out = copy.position.clone().sub(this.root.position)
    out.z = Math.abs(out.z) + 0.6
    out.normalize()
    const vel = out.multiplyScalar((2.6 + Math.random() * 1.6) * speed).add(new THREE.Vector3(0, 2.6 + Math.random() * 1.5, 0))
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14)
    this.debris.push({ obj: copy, vel, spin, life: 1.8, max: 1.8, bounced: false })
  }

  /** Death: the body breaks into ore and stone shards that burst outward. */
  private shatter() {
    const tint = TINT[this.kind]
    const ore = new THREE.MeshStandardMaterial({ color: tint.ore, emissive: tint.ore, emissiveIntensity: 1.2, roughness: 0.2, transparent: true })
    const rock = this.rockMats[0]?.clone() ?? new THREE.MeshStandardMaterial({ color: 0x222226, transparent: true })
    rock.transparent = true
    rock.emissiveIntensity = 0
    const size = this.kind === "golem" ? 1.3 : 1
    for (let i = 0; i < 26; i++) {
      const crystal = i % 3 !== 2
      const geo = crystal
        ? new THREE.ConeGeometry(0.07 * size + Math.random() * 0.06, 0.25 + Math.random() * 0.3, 6)
        : new THREE.DodecahedronGeometry(0.1 * size + Math.random() * 0.12, 0)
      const mesh = new THREE.Mesh(geo, crystal ? ore : rock)
      mesh.userData.ownsGeometry = true
      mesh.position.copy(this.root.position).add(new THREE.Vector3((Math.random() - 0.5) * 1.4 * size, (Math.random() - 0.5) * 1.8 * size, 0.3))
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      this.scene.add(mesh)
      const dir = mesh.position.clone().sub(this.root.position).setZ(0.5 + Math.random()).normalize()
      this.debris.push({
        obj: mesh,
        vel: dir.multiplyScalar(3 + Math.random() * 4).add(new THREE.Vector3(0, 2, 0)),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(18),
        life: 1.2 + Math.random() * 0.5,
        max: 1.7,
        bounced: false,
      })
    }
  }

  private stepDebris(dt: number) {
    const floor = this.toWorld(0, this.field.h - 52).y
    this.debris = this.debris.filter((d) => {
      d.life -= dt
      if (d.life <= 0) {
        this.scene.remove(d.obj)
        this.release(d.obj)
        return false
      }
      d.vel.y -= 11 * dt
      d.obj.position.addScaledVector(d.vel, dt)
      if (d.obj.position.y < floor && d.vel.y < 0) {
        // Ore hits the floor with one dull bounce, then skids.
        d.obj.position.y = floor
        d.vel.y = d.bounced ? 0 : -d.vel.y * 0.3
        d.vel.x *= 0.55
        d.vel.z *= 0.55
        d.spin.multiplyScalar(0.5)
        d.bounced = true
      }
      d.obj.rotation.x += d.spin.x * dt
      d.obj.rotation.y += d.spin.y * dt
      d.obj.rotation.z += d.spin.z * dt
      const fade = Math.min(1, d.life / 0.4)
      d.obj.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.opacity = fade
      })
      return true
    })
  }

  private release(obj: THREE.Object3D) {
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      // Plate clones share geometry with the live model; only death shards own theirs.
      if (mesh.userData.ownsGeometry) mesh.geometry.dispose()
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose()
    })
  }

  dispose() {
    this.disposed = true
    for (const d of this.debris) this.scene.remove(d.obj)
    this.debris = []
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose()
    })
    this.renderer.dispose()
  }
}
