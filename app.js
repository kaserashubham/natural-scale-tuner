(() => {
  const $ = (id) => document.getElementById(id);
  const rootNote = $("rootNote");
  const rootOctave = $("rootOctave");
  const rootFrequency = $("rootFrequency");
  const startButton = $("startButton");
  const stopButton = $("stopButton");
  const message = $("message");
  const statusPill = $("statusPill");
  const noteName = $("noteName");
  const intervalName = $("intervalName");
  const detectedFrequency = $("detectedFrequency");
  const targetFrequency = $("targetFrequency");
  const centsValue = $("centsValue");
  const directionLabel = $("directionLabel");
  const needle = $("needle");
  const ratioRows = $("ratioRows");

  let audioContext = null;
  let analyser = null;
  let stream = null;
  let source = null;
  let rafId = null;
  let sampleBuffer = null;
  let lastGoodFrequency = 0;
  let smoothedFrequency = 0;

  function updateRootFrequency() {
    const value = JustIntonation.equalTemperedFrequency(rootNote.value, Number(rootOctave.value));
    rootFrequency.value = value.toFixed(3);
    renderRatios();
    resetReadout();
  }

  function getRootHz() {
    return Number(rootFrequency.value);
  }

  function renderRatios() {
    const root = getRootHz();
    ratioRows.innerHTML = "";
    if (!(root > 0)) return;
    JustIntonation.RATIOS.forEach((item) => {
      const tr = document.createElement("tr");
      const ratio = item.numerator + "/" + item.denominator;
      const hz = root * item.numerator / item.denominator;
      [item.note + " · " + item.interval, ratio, hz.toFixed(3)].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      ratioRows.appendChild(tr);
    });
  }

  function resetReadout() {
    noteName.textContent = "—";
    intervalName.textContent = "Play a steady note";
    detectedFrequency.textContent = "—";
    targetFrequency.textContent = "—";
    centsValue.textContent = "—";
    directionLabel.textContent = "cents";
    needle.style.left = "50%";
  }

  // YIN-style difference function with cumulative mean normalisation.
  // This estimates periodicity rather than assuming the loudest harmonic is the pitch.
  function detectPitch(buffer, sampleRate) {
    const size = buffer.length;
    let rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.008) return null;

    const minFrequency = 65;
    const maxFrequency = 1200;
    const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
    const maxTau = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(size / 2));
    const difference = new Float32Array(maxTau + 1);
    for (let tau = minTau; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = 0; i < size - maxTau; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }

    const cmnd = new Float32Array(maxTau + 1);
    cmnd[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      runningSum += difference[tau];
      cmnd[tau] = runningSum === 0 ? 1 : difference[tau] * tau / runningSum;
    }

    const threshold = 0.15;
    let tauEstimate = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cmnd[tau] < threshold) {
        while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
        tauEstimate = tau;
        break;
      }
    }
    if (tauEstimate === -1) {
      let bestValue = 1;
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (cmnd[tau] < bestValue) { bestValue = cmnd[tau]; tauEstimate = tau; }
      }
      if (bestValue > 0.35) return null;
    }

    // Parabolic interpolation improves precision between sample lags.
    const left = cmnd[tauEstimate - 1] ?? cmnd[tauEstimate];
    const centre = cmnd[tauEstimate];
    const right = cmnd[tauEstimate + 1] ?? centre;
    const denominator = 2 * (2 * centre - right - left);
    const correction = denominator === 0 ? 0 : (right - left) / denominator;
    const period = tauEstimate + correction;
    const frequency = sampleRate / period;
    return Number.isFinite(frequency) && frequency >= minFrequency && frequency <= maxFrequency ? frequency : null;
  }

  function draw(frequency) {
    const root = getRootHz();
    if (!frequency || !(root > 0)) return;
    smoothedFrequency = smoothedFrequency ? smoothedFrequency * 0.72 + frequency * 0.28 : frequency;
    const match = JustIntonation.nearestTarget(smoothedFrequency, root);
    if (!match) return;
    noteName.textContent = rootNote.value + " · " + match.note;
    intervalName.textContent = match.interval;
    detectedFrequency.textContent = smoothedFrequency.toFixed(2);
    targetFrequency.textContent = match.targetFrequency.toFixed(2);
    const cents = Math.max(-50, Math.min(50, match.cents));
    centsValue.textContent = (match.cents > 0 ? "+" : "") + match.cents.toFixed(1);
    directionLabel.textContent = Math.abs(match.cents) < 1.5 ? "in tune" : match.cents < 0 ? "cents flat" : "cents sharp";
    needle.style.left = ((cents + 50) / 100 * 100) + "%";
    lastGoodFrequency = smoothedFrequency;
  }

  function loop() {
    if (!analyser || !sampleBuffer) return;
    analyser.getFloatTimeDomainData(sampleBuffer);
    const frequency = detectPitch(sampleBuffer, audioContext.sampleRate);
    if (frequency) {
      draw(frequency);
      statusPill.textContent = "Listening";
      statusPill.classList.add("active");
    } else {
      statusPill.textContent = "Listening · no clear pitch";
      statusPill.classList.add("active");
    }
    rafId = requestAnimationFrame(loop);
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      message.textContent = "This browser does not provide microphone access here. Open the app from localhost or an HTTPS website.";
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") await audioContext.resume();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sampleBuffer = new Float32Array(analyser.fftSize);
      smoothedFrequency = 0;
      startButton.disabled = true;
      stopButton.disabled = false;
      statusPill.textContent = "Listening";
      statusPill.classList.add("active");
      message.textContent = "Microphone active. Play or sing one steady note, and keep background noise low.";
      loop();
    } catch (error) {
      message.textContent = error.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access in your browser settings and try again."
        : "Could not start the microphone: " + error.message;
    }
  }

  async function stop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
    stream = null; source = null; analyser = null; audioContext = null; sampleBuffer = null;
    startButton.disabled = false;
    stopButton.disabled = true;
    statusPill.textContent = "Microphone off";
    statusPill.classList.remove("active");
    message.textContent = "Microphone stopped. Audio is processed locally in your browser.";
  }

  rootNote.addEventListener("change", updateRootFrequency);
  rootOctave.addEventListener("change", updateRootFrequency);
  rootFrequency.addEventListener("change", () => { renderRatios(); resetReadout(); });
  startButton.addEventListener("click", start);
  stopButton.addEventListener("click", stop);
  renderRatios();
})();