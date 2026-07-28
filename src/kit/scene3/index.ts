/** Wireframe 3D: the scene system with a camera instead of a fit. */

export {
  Scene3D,
  Layer3,
  WireMesh,
  WireGrid,
  WireBox,
  WireSphere,
  WireTerrain,
  WireFrustum,
  Tag3,
  Dot3,
  useSpace3,
  type Scene3DProps,
  type WireProps,
  type Tag3Props,
} from './Scene3D';

export {
  makeSpace3,
  boxWire,
  sphereWire,
  gridWire,
  terrainWire,
  frustumWire,
  type Vec3,
  type Camera,
  type Space3,
  type Wire,
  type Projected,
} from './project';
