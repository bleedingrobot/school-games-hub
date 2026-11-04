/** The camera: drag, zoom and keys (OrbitControls), smooth flights to a planet that then follow it, and the cinematic tour. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Pose { pos: THREE.Vector3; target: THREE.Vector3 }
export interface Shot { dur: number; at(u: number, out: Pose): void }

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pose = (): Pose => ({ pos: new THREE.Vector3(), target: new THREE.Vector3() });

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** Gives the followed thing's position now (a planet as it goes round). */
  private follow: (() => THREE.Vector3) | null = null;
  private lastFollow = new THREE.Vector3();
  private flight: { from: Pose; to: (out: Pose) => void; t: number; dur: number } | null = null;
  private shots: Shot[] = [];
  private shotIdx = 0;
  private shotT = 0;
  private blendFrom: Pose | null = null;
  touring = false;
  /** Called when the pupil takes over (drags), so the tour can say it stopped. */
  onTakeOver: (() => void) | null = null;
  private tmp = pose();

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement, interactive: boolean) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.9;
    this.controls.enabled = interactive;
    this.controls.addEventListener('start', () => {
      this.flight = null;
      if (this.touring) {
        this.touring = false;
        this.follow = null;
        this.onTakeOver?.();
      }
    });
  }

  /** Fly (or jump, with `instant`) to a pose given live, then keep following `follow` if given. */
  flyTo(to: (out: Pose) => void, follow: (() => THREE.Vector3) | null, dur: number, minDist: number) {
    this.touring = false;
    this.follow = null;
    this.controls.minDistance = minDist;
    const from = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    if (dur <= 0) {
      to(this.tmp);
      this.camera.position.copy(this.tmp.pos);
      this.controls.target.copy(this.tmp.target);
      this.startFollow(follow);
      return;
    }
    this.flight = { from, to, t: 0, dur };
    this.pendingFollow = follow;
  }
  private pendingFollow: (() => THREE.Vector3) | null = null;

  private startFollow(f: (() => THREE.Vector3) | null) {
    this.follow = f;
    if (f) this.lastFollow.copy(f());
  }

  startTour(shots: Shot[]) {
    if (!shots.length) return;
    this.shots = shots;
    this.shotIdx = 0;
    this.shotT = 0;
    this.flight = null;
    this.follow = null;
    this.blendFrom = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    this.touring = true;
    this.controls.minDistance = 0.5;
  }

  stopTour() {
    if (!this.touring) return;
    this.touring = false;
  }

  /** Turn round the target (radians) and zoom (factor), for the keys. */
  nudge(dTheta: number, dPhi: number, zoom: number) {
    this.flight = null;
    if (this.touring) { this.touring = false; this.onTakeOver?.(); }
    const off = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dTheta;
    sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi, 0.05, Math.PI - 0.05);
    sph.radius = THREE.MathUtils.clamp(sph.radius * zoom, this.controls.minDistance, this.controls.maxDistance);
    off.setFromSpherical(sph);
    this.camera.position.copy(this.controls.target).add(off);
  }

  update(dt: number) {
    if (this.touring && this.shots.length) {
      let shot = this.shots[this.shotIdx];
      this.shotT += dt;
      if (this.shotT > shot.dur) {
        this.blendFrom = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
        this.shotT = 0;
        this.shotIdx = (this.shotIdx + 1) % this.shots.length;
        shot = this.shots[this.shotIdx];
      }
      shot.at(this.shotT / shot.dur, this.tmp);
      if (this.blendFrom) {
        const b = ease(Math.min(1, this.shotT / 3));
        this.tmp.pos.lerpVectors(this.blendFrom.pos, this.tmp.pos, b);
        this.tmp.target.lerpVectors(this.blendFrom.target, this.tmp.target, b);
      }
      this.camera.position.copy(this.tmp.pos);
      this.controls.target.copy(this.tmp.target);
      this.camera.lookAt(this.tmp.target);
      return;
    }
    if (this.flight) {
      const f = this.flight;
      f.t += dt;
      const k = ease(Math.min(1, f.t / f.dur));
      f.to(this.tmp);
      // arc a little on the way so long flights don't pass through the sun
      const lift = Math.sin(k * Math.PI) * f.from.pos.distanceTo(this.tmp.pos) * 0.15;
      this.camera.position.lerpVectors(f.from.pos, this.tmp.pos, k);
      this.camera.position.y += lift;
      this.controls.target.lerpVectors(f.from.target, this.tmp.target, Math.min(1, k * 1.3));
      if (f.t >= f.dur) {
        this.flight = null;
        this.startFollow(this.pendingFollow);
      }
      this.camera.lookAt(this.controls.target);
      return;
    }
    if (this.follow) {
      const now = this.follow();
      const d = now.clone().sub(this.lastFollow);
      this.camera.position.add(d);
      this.controls.target.add(d);
      this.lastFollow.copy(now);
    }
    this.controls.update();
  }

  dispose() {
    this.controls.dispose();
  }
}
