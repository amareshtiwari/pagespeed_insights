# Frontend Engineer

## Owns

- `frontend/` — HTML, CSS, JS
- Core Web Vitals assessment UI (matches PageSpeed Insights field-data section)
- URL form, strategy toggle, backend selector (Python / Node)

## UI Components

1. **Assessment header** — Pass/Failed with icon and expand affordance
2. **Core Web Vitals row** — LCP, INP, CLS with category color and 3-segment progress bar + marker
3. **Other notable metrics** — FCP, TTFB
4. **Metadata footer** — 28-day period, devices, CrUX, network, Chrome

## Configuration

```html
<script>
  window.PAGESPEED_CONFIG = {
    apiBase: 'http://localhost:5000',  // or :3000 for Node
  };
</script>
```

## KT To QA Lead

- Open `frontend/index.html` via browser or `http://localhost/PageSpeed/frontend/` (XAMPP)
- Verify progress bar marker position for good / needs-improvement / poor values
- Test empty URL, invalid URL, API down states
- **Spacing:** verify **24px** section gaps and **20px/24px** card padding on every page (see QA T31–T40); Brand page is the reference for multi-section rhythm
