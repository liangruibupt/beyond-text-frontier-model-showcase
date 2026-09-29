const assert = require("node:assert/strict");
const test = require("node:test");

global.window = {};
require("../assets/actors.js");
require("../characters.js");
const data = window.QINGMING_ACTORS;
const rig = Object.create(window.QingmingCharacters.prototype);
rig.data = data;
const ensembles = data.actors.filter((actor) => actor.surface);
const poses = (time) => rig.inspect(time);

test("the scan includes complete sedan, camel and donkey rigs", () => {
  assert.equal(ensembles.length, 5);
  const camel = ensembles.find((actor) => actor.id === "gate-camel-caravan");
  const donkey = ensembles.find((actor) => actor.id === "country-donkey-party");
  assert.equal(camel.legs.length, 8);
  assert.equal(donkey.legs.length, 12);
  assert.equal(camel.flex.length, 2);
  assert.equal(donkey.flex.length, 5);
  assert.equal(ensembles.filter((actor) => actor.action === "carry").length, 3);
  assert(ensembles.every((actor) => actor.repair === undefined));
});

test("ensemble limbs articulate independently of their shared root", () => {
  const before = poses(0);
  const after = poses(.73);
  for (const actor of ensembles) {
    const a = before.find((pose) => pose.id === actor.id);
    const b = after.find((pose) => pose.id === actor.id);
    const movement = a.feet.map((foot, i) => Math.hypot(...foot.map((value, axis) =>
      b.feet[i][axis] - b.root[axis] - value + a.root[axis])));
    assert(movement.every((distance) => distance > .5), `${actor.id}: fixed foot`);
    assert(Math.hypot(...b.root.map((value, axis) => value - a.root[axis])) > 2);
  }
});

test("all poses remain finite over repeated animation cycles", () => {
  for (const time of [0, .2, .73, 2.5, 8, 16, 32, 120, 3600]) {
    for (const pose of poses(time)) {
      assert([...pose.root, ...pose.hands.flat(), ...pose.feet.flat(), ...pose.flex.flat()]
        .every(Number.isFinite), `${pose.id}: non-finite pose at ${time}`);
    }
  }
});

test("surface boundaries are fixed and the interior can move", () => {
  for (const actor of ensembles) {
    const mesh = rig.mesh(actor);
    const [x, y, w, h] = actor.sprite.bounds;
    for (const vertex of mesh.vertices) {
      if (vertex.point[0] === x || vertex.point[0] === x + w
          || vertex.point[1] === y || vertex.point[1] === y + h) {
        assert.equal(vertex.edgeWeight, 0);
      }
    }
    assert(mesh.vertices.some((vertex) => vertex.edgeWeight === 1));
  }
});
