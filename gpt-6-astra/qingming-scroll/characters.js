/* Continuous painted silhouettes skinned to their original anatomical joints. */
(() => {
  "use strict";
  const TAU = Math.PI * 2;
  const MIN_SURFACE_AREA = .25;
  const MAX_SURFACE_STRETCH = 1.8;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const length = (v) => Math.hypot(...v);
  const polar = (p, angle, distance) => [
    p[0] + Math.sin(angle) * distance, p[1] + Math.cos(angle) * distance,
  ];
  const angle = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
  const smooth = (v) => {
    const t = Math.max(0, Math.min(1, v));
    return t * t * (3 - 2 * t);
  };
  function firstPositiveRoot(a, b, c) {
    if (Math.abs(a) < 1e-10) return b && -c / b > 0 ? -c / b : Infinity;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return Infinity;
    const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
    const roots = [q / a, c / q].filter((value) => value > 0);
    return Math.min(...roots);
  }

  function constrainSurface(vertices, data) {
    let amount = Infinity;
    // The signed triangle area is quadratic in the applied displacement.
    // Stop at its first unsafe value, and bound edge stretch at the same time.
    for (let i = 0; i < vertices.length; i += 3) {
      const a = vertices[i].point, b = vertices[i + 1].point, c = vertices[i + 2].point;
      const ux = b[0] - a[0], uy = b[1] - a[1];
      const vx = c[0] - a[0], vy = c[1] - a[1];
      const offset = i * 4;
      const dux = data[offset + 4] - data[offset] - ux;
      const duy = data[offset + 5] - data[offset + 1] - uy;
      const dvx = data[offset + 8] - data[offset] - vx;
      const dvy = data[offset + 9] - data[offset + 1] - vy;
      const area = ux * vy - uy * vx;
      amount = Math.min(amount, firstPositiveRoot(
        dux * dvy - duy * dvx,
        ux * dvy + dux * vy - uy * dvx - duy * vx,
        area * (1 - MIN_SURFACE_AREA),
      ));
      for (const [ex, ey, dx, dy] of [
        [ux, uy, dux, duy], [vx, vy, dvx, dvy],
        [vx - ux, vy - uy, dvx - dux, dvy - duy],
      ]) {
        amount = Math.min(amount, firstPositiveRoot(
          dx * dx + dy * dy, 2 * (ex * dx + ey * dy),
          (1 - MAX_SURFACE_STRETCH ** 2) * (ex * ex + ey * ey),
        ));
      }
    }
    amount = Math.min(1, amount * .98);
    if (amount >= 1) return;
    for (let i = 0; i < vertices.length; i++) {
      const [x, y] = vertices[i].point;
      data[i * 4] = x + (data[i * 4] - x) * amount;
      data[i * 4 + 1] = y + (data[i * 4 + 1] - y) * amount;
    }
  }

  function project(point, a, b) {
    const d = sub(b, a);
    const t = Math.max(0, Math.min(1,
      ((point[0] - a[0]) * d[0] + (point[1] - a[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2)));
    return length(sub(point, [a[0] + t * d[0], a[1] + t * d[1]]));
  }

  function surfaceWeight(point, contours) {
    let distance = Infinity;
    for (const polygon of contours) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a[1] > point[1]) !== (b[1] > point[1])
            && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) {
          inside = !inside;
        }
        distance = Math.min(distance, project(point, a, b));
      }
      if (inside) return 1;
    }
    return smooth(1 - distance / 18);
  }

  function knee(hip, foot, upper, lower, bend) {
    const delta = sub(foot, hip);
    const distance = Math.max(.01, Math.min(length(delta), upper + lower - .01));
    const aim = Math.atan2(delta[1], delta[0]);
    const cosine = Math.max(-1, Math.min(1, (upper ** 2 + distance ** 2 - lower ** 2) / (2 * upper * distance)));
    const angle = aim + bend * Math.acos(cosine);
    return [hip[0] + Math.cos(angle) * upper, hip[1] + Math.sin(angle) * upper];
  }

  function pose(actor, time) {
    let displacement = [0, 0];
    let facing = 1;
    const offset = actor.root[0] * .17;
    let gait = time * 3.5 + offset;
    let walking = false;
    const procession = ["carry", "ride", "amble"].includes(actor.action);
    if (actor.action === "walk" || procession) {
      walking = true;
      const distance = length(actor.path);
      const travel = time * actor.speed / distance;
      if (procession) {
        // The complete painted group deforms in place, with no cutout or loop reset.
        displacement = actor.path.map((value) => value * .22 * Math.sin(travel * TAU));
      } else {
        const cycle = travel % 2;
        const progress = cycle <= 1 ? cycle : 2 - cycle;
        displacement = actor.path.map((value) => value * progress);
        const direction = Math.sign(actor.path[0]) * (cycle <= 1 ? 1 : -1);
        facing = direction / actor.nativeDirection;
      }
      const legLength = actor.legs[0].upper.length + actor.legs[0].lower.length;
      gait = procession ? time * (actor.cadence || 3.2) + (actor.phase || 0)
        : time * actor.speed / Math.max(17, legLength * .85) * TAU + offset;
    }
    const bob = walking ? -Math.abs(Math.sin(gait)) * (actor.bob || 1.6) : Math.sin(time * 2) * .5;
    const tilt = walking ? Math.sin(gait) * (procession ? .003 : .012) : Math.sin(time * 1.7 + offset) * .016;
    const local = (point) => {
      const p = sub(point, actor.root);
      return [p[0], p[1] + bob];
    };
    const transform = (point) => {
      const x = point[0] * facing;
      const angle = tilt * facing;
      return [
        actor.root[0] + displacement[0] + Math.cos(angle) * x - Math.sin(angle) * point[1],
        actor.root[1] + displacement[1] + Math.sin(angle) * x + Math.cos(angle) * point[1],
      ];
    };
    const legs = actor.legs.map((leg, index) => {
      const hip = local(leg.joints[0]);
      let foot = sub(leg.joints[2], actor.root);
      if (walking) {
        const phase = gait + (actor.legPhases?.[index] ?? index * Math.PI);
        const stride = Math.min(actor.stride || 12, (leg.upper.length + leg.lower.length) * .40);
        foot = [procession ? foot[0] + Math.cos(phase) * stride / 2 : hip[0] + Math.cos(phase) * stride / 2,
          foot[1] - Math.max(0, Math.sin(phase)) * Math.min(4, stride * .3)];
      }
      const joint = knee(hip, foot, leg.upper.length, leg.lower.length,
        actor.legBends?.[index] ?? (-actor.nativeDirection || -1));
      return [hip, joint, foot].map(transform);
    });
    const arms = actor.arms.map((arm, index) => {
      const shoulder = local(arm.joints[0]);
      let upperAngle = angle(arm.joints[0], arm.joints[1]);
      let lowerAngle = angle(arm.joints[1], arm.joints[2]);
      if (procession) {
        // Hands holding a carrying pole or reins move with their shared torso.
      } else if (walking) {
        const swing = Math.sin(gait + index * Math.PI);
        upperAngle += swing * .34;
        lowerAngle += swing * .48;
      } else if (actor.action === "pull") {
        const stroke = Math.sin(time * 2.3 + offset);
        upperAngle += stroke * .24;
        lowerAngle += stroke * .45;
      } else if (index === 0) {
        upperAngle += Math.sin(time * 2.0 + offset) * .22;
        lowerAngle += Math.sin(time * 3.1 + offset) * .48;
      } else {
        upperAngle += Math.sin(time * 1.8 + offset) * .10;
        lowerAngle += Math.sin(time * 1.8 + offset) * .16;
      }
      const elbow = polar(shoulder, upperAngle, arm.upper.length);
      const hand = polar(elbow, lowerAngle, arm.lower.length);
      return [shoulder, elbow, hand].map(transform);
    });
    const flex = (actor.flex || []).map((bone) => {
      const pivot = local(bone.a);
      const native = sub(bone.b, bone.a);
      const turn = Math.sin(time * bone.frequency + (bone.phase || 0)) * bone.amplitude;
      return [pivot, [pivot[0] + Math.cos(turn) * native[0] - Math.sin(turn) * native[1],
        pivot[1] + Math.sin(turn) * native[0] + Math.cos(turn) * native[1]]].map(transform);
    });
    return {
      root: [actor.root[0] + displacement[0], actor.root[1] + displacement[1]],
      facing, walking, legs, arms, flex,
      point: (point) => transform(local(point)),
      groundPoint: (point) => transform(sub(point, actor.root)),
    };
  }

  class Characters {
    constructor(gl, onReady) {
      this.gl = gl;
      this.data = window.QINGMING_ACTORS;
      this.ready = false;
      this.error = null;
      this.meshes = this.data.actors.map((actor) => this.mesh(actor));
      this.initialize();
      this.image = new Image();
      this.image.onload = () => {
        this.upload();
        onReady();
      };
      this.image.onerror = () => {
        this.error = new Error("Could not decode character atlas");
        console.error(this.error);
        onReady();
      };
      this.image.src = this.data.image;
    }

    initialize() {
      const gl = this.gl;
      const sources = [
        [gl.VERTEX_SHADER, `
          attribute vec2 a_position;
          attribute vec2 a_uv;
          uniform vec2 u_camera;
          uniform vec2 u_view;
          varying vec2 v_uv;
          void main() {
            vec2 screen = (a_position - u_camera) / u_view;
            gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);
            v_uv = a_uv;
          }
        `],
        [gl.FRAGMENT_SHADER, `
          precision mediump float;
          uniform sampler2D u_atlas;
          varying vec2 v_uv;
          void main() { gl_FragColor = texture2D(u_atlas, v_uv); }
        `],
      ];
      this.program = gl.createProgram();
      for (const [type, source] of sources) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        gl.attachShader(this.program, shader);
        gl.deleteShader(shader);
      }
      gl.bindAttribLocation(this.program, 0, "a_position");
      gl.bindAttribLocation(this.program, 1, "a_uv");
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
      this.uniforms = {};
      for (const name of ["camera", "view", "atlas"]) {
        this.uniforms[name] = gl.getUniformLocation(this.program, `u_${name}`);
      }
      this.buffer = gl.createBuffer();
    }

    upload() {
      const gl = this.gl;
      this.texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
      this.ready = true;
    }

    vertices(part, cellSize) {
      const [x, y, w, h] = part.bounds;
      const [sx, sy, sw, sh] = part.src;
      const [aw, ah] = this.data.size;
      const cols = Math.ceil(w / cellSize);
      const rows = Math.ceil(h / cellSize);
      const vertices = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]]) {
            const u = (col + dx) / cols;
            const v = (row + dy) / rows;
            vertices.push({ point: [x + u * w, y + v * h], uv: [(sx + u * sw) / aw, (sy + v * sh) / ah] });
          }
        }
      }
      return vertices;
    }

    mesh(actor) {
      const bones = [];
      for (const kind of ["arms", "legs"]) {
        actor[kind].forEach((limb, limbIndex) => {
          [limb.upper, limb.lower].forEach((bone, index) => {
            bones.push({ kind, limbIndex, index, width: bone.width,
              a: limb.joints[index], b: limb.joints[index + 1] });
          });
        });
      }
      (actor.flex || []).forEach((bone, limbIndex) =>
        bones.push({ ...bone, kind: "flex", limbIndex, index: 0 }));
      const vertices = this.vertices(actor.sprite, actor.cellSize || 3);
      for (const vertex of vertices) {
        if (actor.surface) {
          const [x, y, w, h] = actor.sprite.bounds;
          vertex.edgeWeight = smooth(Math.min(vertex.point[0] - x, x + w - vertex.point[0],
            vertex.point[1] - y, y + h - vertex.point[1]) / 24)
            * surfaceWeight(vertex.point, actor.contours);
        }
        const influences = bones.map((bone, index) => {
          const distance = project(vertex.point, bone.a, bone.b);
          const weight = smooth(1 - distance / (bone.width * 2.2 + 10));
          return { index, weight };
        }).filter((item) => item.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 2);
        const strength = influences[0]?.weight || 0;
        const total = influences.reduce((sum, item) => sum + item.weight, 0) || 1;
        vertex.influences = influences.map((item) => ({ index: item.index, weight: item.weight / total * strength }));
        vertex.baseWeight = 1 - strength;
      }
      return {
        actor, bones, vertices, repair: actor.repair ? this.vertices(actor.repair, 1000) : [],
        buffer: new Float32Array(vertices.length * 4),
      };
    }

    paint(vertices, transform, data = new Float32Array(vertices.length * 4), surface = false) {
      vertices.forEach((vertex, index) => {
        const point = transform(vertex);
        const offset = index * 4;
        data[offset] = point[0];
        data[offset + 1] = point[1];
        data[offset + 2] = vertex.uv[0];
        data[offset + 3] = vertex.uv[1];
      });
      if (surface) constrainSurface(vertices, data);
      const gl = this.gl;
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length);
    }

    draw(camera, time) {
      if (!this.ready) return;
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(this.uniforms.atlas, 2);
      gl.uniform2f(this.uniforms.camera, camera.left, camera.top);
      gl.uniform2f(this.uniforms.view, camera.w, camera.h);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.enableVertexAttribArray(0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const meshes = this.meshes.filter(({ actor }) => {
        const [x, y, w, h] = actor.sprite.bounds;
        const travel = Math.abs(actor.path?.[0] || 0);
        return x + w + travel > camera.left && x - travel < camera.left + camera.w
          && y + h + 100 > camera.top && y - 100 < camera.top + camera.h;
      });
      for (const mesh of meshes) if (mesh.repair.length) this.paint(mesh.repair, (vertex) => vertex.point);
      meshes.sort((a, b) => pose(a.actor, time).root[1] - pose(b.actor, time).root[1]);
      for (const mesh of meshes) {
        const { actor } = mesh;
        const p = pose(actor, time);
        const transforms = mesh.bones.map((bone) => {
          const start = p[bone.kind][bone.limbIndex][bone.index];
          const end = p[bone.kind][bone.limbIndex][bone.index + 1];
          const native = sub(bone.b, bone.a);
          const delta = sub(end, start);
          const size = length(native);
          return (point) => {
            const offset = sub(point, bone.a);
            const along = (offset[0] * native[0] + offset[1] * native[1]) / size ** 2;
            const across = (offset[0] * native[1] - offset[1] * native[0]) / size ** 2 * p.facing;
            return [start[0] + along * delta[0] + across * delta[1],
              start[1] + along * delta[1] - across * delta[0]];
          };
        });
        this.paint(mesh.vertices, (vertex) => {
          const base = p.point(vertex.point);
          const point = [...base];
          for (const influence of vertex.influences) {
            const local = transforms[influence.index](vertex.point);
            const delta = sub(local, base);
            // Limit local strain so the ink and silk remain continuous at a joint.
            const limit = Math.min(1, (actor.strain || 7) / Math.max(.01, length(delta)));
            point[0] += delta[0] * influence.weight * limit;
            point[1] += delta[1] * influence.weight * limit;
          }
          return actor.surface ? point.map((value, axis) =>
            vertex.point[axis] + (value - vertex.point[axis]) * vertex.edgeWeight) : point;
        }, mesh.buffer, actor.surface);
      }
      gl.disable(gl.BLEND);
      gl.disableVertexAttribArray(1);
    }

    inspect(time) {
      return this.data.actors.map((actor) => {
        const p = pose(actor, time);
        return { id: actor.id, action: actor.action, root: p.root, members: actor.members || [actor.id],
          hands: p.arms.map((arm) => arm[2]), feet: p.legs.map((leg) => leg[2]),
          flex: p.flex.map((bone) => bone[1]) };
      });
    }
  }
  window.QingmingCharacters = Characters;
})();
