/* Musical reference logic, independent from the UI/audio engine. */
(() => {
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  // A practical five-limit chromatic mapping relative to the root.
  // Chromatic spellings are simplified; advanced versions can expose alternate tunings.
  const RATIOS = [
    { note: "Sa", semitone: 0, numerator: 1, denominator: 1, interval: "Unison" },
    { note: "komal Re", semitone: 1, numerator: 16, denominator: 15, interval: "Minor second" },
    { note: "shuddha Re", semitone: 2, numerator: 9, denominator: 8, interval: "Major second" },
    { note: "komal Ga", semitone: 3, numerator: 6, denominator: 5, interval: "Minor third" },
    { note: "shuddha Ga", semitone: 4, numerator: 5, denominator: 4, interval: "Major third" },
    { note: "Ma", semitone: 5, numerator: 4, denominator: 3, interval: "Perfect fourth" },
    { note: "Tivra Ma", semitone: 6, numerator: 45, denominator: 32, interval: "Augmented fourth" },
    { note: "Pa", semitone: 7, numerator: 3, denominator: 2, interval: "Perfect fifth" },
    { note: "komal Dha", semitone: 8, numerator: 8, denominator: 5, interval: "Minor sixth" },
    { note: "shuddha Dha", semitone: 9, numerator: 5, denominator: 3, interval: "Major sixth" },
    { note: "komal Ni", semitone: 10, numerator: 9, denominator: 5, interval: "Minor seventh" },
    { note: "shuddha Ni", semitone: 11, numerator: 15, denominator: 8, interval: "Major seventh" }
  ];

  function equalTemperedFrequency(noteName, octave) {
    const midi = (octave + 1) * 12 + NOTE_NAMES.indexOf(noteName);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function getTargets(rootFrequency) {
    const targets = [];
    for (const item of RATIOS) {
      targets.push({
        ...item,
        ratio: item.numerator / item.denominator,
        ratioText: item.numerator + "/" + item.denominator,
        frequency: rootFrequency * item.numerator / item.denominator
      });
      // Repeat all ratios in the next octave to cover a wider useful range.
      targets.push({
        ...item,
        note: item.note + "′",
        semitone: item.semitone + 12,
        ratio: 2 * item.numerator / item.denominator,
        ratioText: (2 * item.numerator) + "/" + item.denominator,
        frequency: rootFrequency * 2 * item.numerator / item.denominator
      });
    }
    return targets.sort((a, b) => a.frequency - b.frequency);
  }

  function nearestTarget(frequency, rootFrequency) {
    if (!(frequency > 0) || !(rootFrequency > 0)) return null;
    const targets = getTargets(rootFrequency);
    let best = null;
    for (const target of targets) {
      // Compare octave-equivalent versions so low/high notes remain usable.
      for (const octaveShift of [-2, -1, 0, 1, 2]) {
        const adjustedFrequency = target.frequency * Math.pow(2, octaveShift);
        const cents = 1200 * Math.log2(frequency / adjustedFrequency);
        if (!best || Math.abs(cents) < Math.abs(best.cents)) {
          best = { ...target, targetFrequency: adjustedFrequency, cents };
        }
      }
    }
    return best;
  }

  window.JustIntonation = { NOTE_NAMES, RATIOS, equalTemperedFrequency, getTargets, nearestTarget };
})();