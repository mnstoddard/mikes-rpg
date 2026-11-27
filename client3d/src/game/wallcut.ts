import * as THREE from "three";
// Inside walls that stand between the camera and you are cut away (with a soft,
// speckled edge) so you can always see yourself and the guide arrow. The camera
// then doesn't have to swoop in close every time you walk along a wall.

/** Shared by every wall material: where the camera is, where you are, and whether cutting is on. */
export const wallCut = {
  uCam: { value: new THREE.Vector3() },
  uFocus: { value: new THREE.Vector3() },
  uCutOn: { value: 0 },
};

/** Teach a material to cut itself away between the camera and you. Returns the same material. */
export function withWallCut<T extends THREE.Material>(mat: T): T {
  // Both sides, so a cut wall looks like a low hollow stub instead of a hole.
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, wallCut);
    shader.vertexShader = "varying vec3 vCutPos;\n" + shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n  vCutPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
    );
    shader.fragmentShader = "varying vec3 vCutPos;\nuniform vec3 uCam;\nuniform vec3 uFocus;\nuniform float uCutOn;\n" + shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
  if (uCutOn > 0.5) {
    vec3 seg = uFocus - uCam;
    float len = length(seg);
    vec3 dir = seg / max(len, 0.001);
    float t = dot(vCutPos - uCam, dir);
    if (t > 0.0 && t < len - 0.4) {
      float r = length(vCutPos - (uCam + dir * t));
      // Wider near you, so the walls round you open up; a speckled edge so it doesn't look like a hole.
      float R = mix(1.6, 3.4, clamp(t / len, 0.0, 1.0));
      float cut = smoothstep(R, R * 0.7, r);
      float n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
      // Cut down to a low stub (not right through), so you can still see where the wall runs.
      if (cut > n && vCutPos.y > 0.3) discard;
    }
  }`,
    );
  };
  mat.customProgramCacheKey = () => "wallcut";
  return mat;
}
