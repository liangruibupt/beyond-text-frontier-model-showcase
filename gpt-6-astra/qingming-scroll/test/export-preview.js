async (page) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  await page.waitForFunction(() => window.qingming?.getState().ready);
  await page.addStyleTag({
    content: ".topbar,.console,.stage-tools,.scene-caption{display:none!important}.gallery{height:100vh;min-height:0}.stage{min-height:0}",
  });
  await page.waitForFunction(() => document.getElementById("painting").clientHeight === 1080);
  return await page.evaluate(async () => {
    const config = {
      codec: "avc1.640028", width: 1920, height: 1080, bitrate: 14000000,
      framerate: 30, avc: { format: "annexb" }, latencyMode: "quality",
    };
    if (typeof VideoEncoder === "undefined" || !(await VideoEncoder.isConfigSupported(config)).supported) {
      throw new Error("This export needs a browser with H.264 WebCodecs support");
    }
    const duration = 120;
    const frames = duration * config.framerate;
    const progress = window.qingmingExport = { status: "encoding", frame: 0, frames, duration, samples: [] };
    const output = document.createElement("canvas");
    output.width = config.width;
    output.height = config.height;
    const context = output.getContext("2d", { alpha: false });
    const painting = document.getElementById("painting");
    const chunks = [];
    let error = null;
    const encoder = new VideoEncoder({
      output(chunk) {
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);
        chunks.push(bytes);
      },
      error(problem) { error = problem; },
    });
    encoder.configure(config);
    window.qingmingExportTask = (async () => {
      try {
        for (let index = 0; index < frames; index++) {
          if (error) throw error;
          const time = index / config.framerate;
          const state = await window.qingming.renderTourFrame(time, duration);
          if (!state.ready) throw new Error(`Painting not ready at frame ${index}`);
          context.drawImage(painting, 0, 0, output.width, output.height);
          if (state.reveal > 0 && state.reveal < 1) {
            const x = output.width * (1 - state.reveal);
            const roll = context.createLinearGradient(x - 7, 0, x + 7, 0);
            roll.addColorStop(0, "#696049");
            roll.addColorStop(.45, "#d9c392");
            roll.addColorStop(.8, "#9e8964");
            roll.addColorStop(1, "#4e483b");
            context.fillStyle = roll;
            context.fillRect(x - 7, 0, 14, output.height);
          }
          const frame = new VideoFrame(output, { timestamp: Math.round(time * 1000000) });
          try { encoder.encode(frame, { keyFrame: index % 60 === 0 }); }
          finally { frame.close(); }
          if (encoder.encodeQueueSize > 6) await encoder.flush();
          progress.frame = index + 1;
          if (index % 300 === 0) progress.samples.push({ time, x: state.x, reveal: state.reveal });
          if (index % 12 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        }
        await encoder.flush();
        if (error) throw error;
        progress.url = URL.createObjectURL(new Blob(chunks, { type: "video/h264" }));
        progress.bytes = chunks.reduce((total, bytes) => total + bytes.length, 0);
        progress.status = "complete";
      } catch (problem) {
        progress.status = "error";
        progress.error = String(problem.stack || problem);
      } finally {
        if (encoder.state !== "closed") encoder.close();
      }
    })();
    return { status: progress.status, frames, duration };
  });
}
