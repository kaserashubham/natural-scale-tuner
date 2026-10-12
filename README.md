# Natural Scale Tuner

A lightweight browser-based tuner using plain HTML, CSS, and JavaScript. It estimates a live microphone pitch and compares it against a configurable root frequency using a practical five-limit Just Intonation ratio set.

## Files

- `index.html` — interface
- `style.css` — responsive styling
- `app.js` — microphone lifecycle, pitch detection, and tuning meter
- `justIntonation.js` — musical ratios and target-frequency calculations

## Run locally

Microphone access requires a secure browser context. The most reliable local option is a small local HTTP server:

1. Install Python 3 if it is not already installed.
2. Open a terminal in this folder.
3. Run `python -m http.server 8000`.
4. Open `http://localhost:8000` in your browser.
5. Press **Enable microphone** and grant permission.

You can also deploy these static files to GitHub Pages or another HTTPS static host to use the tuner on Android.

## Notes

- Audio is processed locally; this app does not upload or record audio.
- The root frequency defaults to the selected note's equal-tempered reference, but can be edited for calibration.
- The current five-limit chromatic mapping is one practical option, not a universal definition of every Just Intonation melody. Different contexts may need alternate ratios.
- Initial pitch-detection range is approximately 65–1200 Hz. This can be tuned for specific instruments.
- This is an initial prototype. Test accuracy against known test tones and real instruments before relying on it for critical tuning.
