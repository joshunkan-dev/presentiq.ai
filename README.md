# PresentIQ

PresentIQ is a starter AI-first presentation app inspired by Google Slides and Microsoft PowerPoint, with an earthy green visual identity.

## Current MVP Features

- Slide deck editing with add/duplicate/delete slide actions.
- Per-slide content editing (title + body).
- **Required vocal cue per slide**.
- Presentation mode overlay.
- Voice-triggered slide advancement using the browser Speech Recognition API (`SpeechRecognition` / `webkitSpeechRecognition`).
- Manual fallback controls (previous/next buttons and arrow keys).

## Run locally

This project is plain HTML/CSS/JavaScript.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Notes

- Voice recognition support depends on browser support and microphone permissions.
- The app validates that every slide has a vocal cue before presenting.
