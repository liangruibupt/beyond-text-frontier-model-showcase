const assert = require("node:assert/strict");
const test = require("node:test");

global.window = {};
require("../assets/actors.js");
require("../characters.js");
const rig = Object.create(window.QingmingCharacters.prototype);
rig.data = window.QINGMING_ACTORS;
rig.uniforms = {};
rig.ready = true;
rig.gl = new Proxy({}, { get: () => () => {} });
const meshes = rig.data.actors.filter((actor) => actor.surface).map((actor) => rig.mesh(actor));
const area = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const camera = { left: 0, top: 0, w: 25609, h: 1200 };

test("painted ensemble surfaces do not fold or collapse during a complete cycle", () => {
  for (const mesh of meshes) {
    rig.meshes = [mesh];
    const cycle = Math.hypot(...mesh.actor.path) / mesh.actor.speed;
    for (let step = 0; step <= 12; step++) {
      const time = cycle * step / 12;
      rig.draw(camera, time);
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const original = mesh.vertices.slice(i, i + 3).map((v) => v.point);
        const moved = [0, 1, 2].map((offset) =>
          [...mesh.buffer.subarray((i + offset) * 4, (i + offset) * 4 + 2)]);
        const ratio = area(...moved) / area(...original);
        assert(ratio >= .24,
          `${mesh.actor.id}: triangle ${i / 3} at ${time.toFixed(2)}s has area ratio ${ratio}`);
        for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
          const stretch = Math.hypot(moved[b][0] - moved[a][0], moved[b][1] - moved[a][1])
            / Math.hypot(original[b][0] - original[a][0], original[b][1] - original[a][1]);
          assert(stretch < 1.81, `${mesh.actor.id}: overstretched painted edge`);
        }
      }
    }
  }
});

test("surface constraints handle reflection, extreme stretch and an unchanged pose", () => {
  const vertices = [[0, 0], [3, 0], [0, 3]].map((point) => ({ point, uv: [0, 0] }));
  for (const transform of [
    ([x, y]) => [-x, y],
    ([x, y]) => [-x, -y],
    ([x, y]) => [100 * x, y],
    ([x, y]) => [x, y],
  ]) {
    const buffer = new Float32Array(12);
    rig.paint(vertices, (vertex) => transform(vertex.point), buffer, true);
    const points = [0, 4, 8].map((index) => [...buffer.subarray(index, index + 2)]);
    assert(area(...points) / 9 >= .24);
    assert([...buffer].every(Number.isFinite));
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      assert(Math.hypot(points[b][0] - points[a][0], points[b][1] - points[a][1])
        <= 1.81 * Math.hypot(...vertices[b].point.map((v, axis) => v - vertices[a].point[axis])));
    }
  }
});

test("entering the surface limit does not introduce a visible pose jump", () => {
  const vertices = [[0, 0], [3, 0], [0, 3]].map((point) => ({ point, uv: [0, 0] }));
  const before = new Float32Array(12);
  const after = new Float32Array(12);
  rig.paint(vertices, ({ point: [x, y] }) => [x * .250001, y], before, true);
  rig.paint(vertices, ({ point: [x, y] }) => [x * .249999, y], after, true);
  assert(Math.max(...before.map((value, index) => Math.abs(value - after[index]))) < .001);
});

test("rendered ensemble boundaries stay fixed while painted interiors move", () => {
  for (const mesh of meshes) {
    rig.meshes = [mesh];
    rig.draw(camera, .73);
    let movement = 0;
    for (let i = 0; i < mesh.vertices.length; i++) {
      const vertex = mesh.vertices[i];
      const distance = Math.hypot(
        mesh.buffer[i * 4] - vertex.point[0],
        mesh.buffer[i * 4 + 1] - vertex.point[1],
      );
      if (vertex.edgeWeight === 0) assert(distance < .002, `${mesh.actor.id}: moving boundary`);
      movement = Math.max(movement, distance);
      assert(Math.abs(mesh.buffer[i * 4 + 2] - vertex.uv[0]) < 1e-6);
      assert(Math.abs(mesh.buffer[i * 4 + 3] - vertex.uv[1]) < 1e-6);
    }
    assert(movement > 1, `${mesh.actor.id}: motion was lost`);
  }
});
