const W = 720;
const H = 1280;
const palettes = {
  mint: ["#101e1d", "#8be5b5", "#e7fff0"],
  rose: ["#241627", "#ffa995", "#ffedea"],
  amber: ["#241b13", "#ffd288", "#fff5df"],
};
const sample = {
  title: "Mỡ kể chuyện",
  scenes: [
    { headline: "Sen hết pin rồi.", caption: "Mỡ nghe cửa mở, mà sen chẳng nói gì.", seconds: 3, color: "mint" },
    { headline: "Để tớ kiếm sen.", caption: "Mỡ đẩy quả bóng sang, rồi nằm cạnh.", seconds: 3, color: "rose" },
    { headline: "Nghỉ một chút nha.", caption: "Hôm nay không cần làm gì giỏi hết.", seconds: 3, color: "amber" },
  ],
};

export function parseStoryboard(raw) {
  const source = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const value = JSON.parse(source);
  if (typeof value?.title !== "string" || !value.title.trim() ||
      !Array.isArray(value.scenes) || value.scenes.length < 2 || value.scenes.length > 6) {
    throw new Error("Cần một tiêu đề và 2–6 cảnh.");
  }
  const scenes = value.scenes.map((scene) => {
    if (typeof scene?.headline !== "string" || !scene.headline.trim() ||
        typeof scene.caption !== "string" || !Number.isInteger(scene.seconds) ||
        scene.seconds < 2 || scene.seconds > 6) {
      throw new Error("Mỗi cảnh cần tiêu đề, lời trên màn hình và thời lượng 2–6 giây.");
    }
    return {
      headline: scene.headline.trim().slice(0, 76),
      caption: scene.caption.trim().slice(0, 126),
      seconds: scene.seconds,
      color: Object.hasOwn(palettes, scene.color) ? scene.color : "mint",
    };
  });
  return { title: value.title.trim().slice(0, 60), scenes };
}

function paintLines(ctx, content, y, width, size, weight, color) {
  ctx.font = weight + " " + size + "px system-ui, sans-serif";
  ctx.fillStyle = color;
  let line = "";
  for (const word of content.split(/\s+/)) {
    const candidate = line ? line + " " + word : word;
    if (line && ctx.measureText(candidate).width > width) {
      ctx.fillText(line, 62, y, width);
      y += size * 1.19;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, 62, y, width);
}

function draw(ctx, storyboard, elapsed) {
  let cursor = 0;
  let scene = storyboard.scenes.at(-1);
  for (const item of storyboard.scenes) {
    scene = item;
    if (elapsed < cursor + scene.seconds) break;
    cursor += scene.seconds;
  }
  const t = Math.max(0, elapsed - cursor);
  const [background, accent, ink] = palettes[scene.color];
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(62, 70, 65, 6);
  paintLines(ctx, storyboard.title, 124, 590, 30, 650, ink);

  const cx = 360 + Math.sin(t * 1.35) * 28;
  const cy = 460 + Math.cos(t * 1.5) * 20;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * .35);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = i % 2 ? 4 : 9;
    ctx.globalAlpha = 1 - i * .18;
    ctx.beginPath();
    ctx.ellipse(0, 0, 108 + i * 41, 80 + i * 30, i * .5, .24 + i, 5.7 + i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, 23 + Math.sin(t * 2) * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  paintLines(ctx, scene.headline, 785, 596, 62, 800, ink);
  paintLines(ctx, scene.caption, 1030, 596, 34, 500, accent);
  ctx.fillStyle = "#ffffff35";
  ctx.fillRect(62, 1190, 596, 5);
  const total = storyboard.scenes.reduce((sum, item) => sum + item.seconds, 0);
  ctx.fillStyle = accent;
  ctx.fillRect(62, 1190, 596 * Math.min(1, elapsed / total), 5);
}

function recorderFor(stream) {
  for (const mimeType of ["video/mp4", "video/webm;codecs=vp8", "video/webm"]) {
    if (!MediaRecorder.isTypeSupported(mimeType)) continue;
    try {
      return new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2600000 });
    } catch {
      // Try another supported encoder if hardware setup is unavailable.
    }
  }
  return new MediaRecorder(stream);
}

export function attachStudio(root) {
  if (!root) return null;
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const play = root.querySelector("video");
  const message = root.querySelector("#studio-status");
  const loadSample = root.querySelector("#studio-sample");
  const exportButton = root.querySelector("#studio-export");
  const download = root.querySelector("#studio-download");
  let storyboard;
  let url;
  let recording = false;

  function clearExport() {
    if (url) URL.revokeObjectURL(url);
    url = undefined;
    play.pause();
    play.removeAttribute("src");
    play.load();
    play.hidden = true;
    download.hidden = true;
  }

  function load(next, source) {
    storyboard = next;
    clearExport();
    canvas.hidden = false;
    draw(ctx, next, 0);
    message.textContent = source + " · " + next.scenes.length + " cảnh. Có thể xuất video.";
    exportButton.disabled = recording;
  }

  loadSample.addEventListener("click", () => load(sample, "Mẫu Mỡ kể chuyện"));
  exportButton.addEventListener("click", async () => {
    if (!storyboard || recording) return;
    if (!globalThis.MediaRecorder || typeof canvas.captureStream !== "function") {
      message.textContent = "Trình duyệt chưa hỗ trợ xuất video từ canvas.";
      return;
    }
    const input = storyboard;
    const duration = input.scenes.reduce((sum, scene) => sum + scene.seconds, 0);
    recording = true;
    exportButton.disabled = true;
    loadSample.disabled = true;
    clearExport();
    let stream;
    let timer;
    let frame;
    try {
      draw(ctx, input, 0);
      stream = canvas.captureStream(30);
      const recorder = recorderFor(stream);
      const chunks = [];
      const blob = await new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error("Trình duyệt không mã hóa được clip."));
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type }));
        recorder.start();
        const started = performance.now();
        function tick(now) {
          draw(ctx, input, (now - started) / 1000);
          frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
        timer = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, duration * 1000);
        message.textContent = "Đang dựng " + duration + " giây. Giữ trang này mở.";
      });
      if (!blob.size) throw new Error("Trình duyệt trả về file rỗng.");
      if (storyboard !== input) return;
      url = URL.createObjectURL(blob);
      play.src = url;
      play.hidden = false;
      canvas.hidden = true;
      download.href = url;
      download.download = "multi-ai-house." + (blob.type.includes("mp4") ? "mp4" : "webm");
      download.hidden = false;
      message.textContent = "Đã xuất clip dọc 720 × 1280. Video minh họa không có âm thanh.";
    } catch (error) {
      message.textContent = error.message || "Không xuất được video.";
    } finally {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      recording = false;
      loadSample.disabled = false;
      exportButton.disabled = !storyboard;
    }
  });

  return {
    reset() {
      storyboard = undefined;
      clearExport();
      canvas.hidden = true;
      message.textContent = "";
      exportButton.disabled = true;
    },
    loadPlan(raw) {
      load(parseStoryboard(raw), "Phân cảnh của hai phòng");
    },
  };
}
