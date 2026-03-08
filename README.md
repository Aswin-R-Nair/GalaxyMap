# GalaxyMap

A 3D visualization of the Milky Way galaxy using real stellar data from the [ESA Gaia](https://www.cosmos.esa.int/web/gaia) space observatory inspired by the galaxy map aboard the Normandy in the video game Mass Effect!. Every point of light is an actual star plotted at its calculated galactic position.

Built with [Three.js](https://threejs.org/).

## Features

- **Real star data** -- positions, colors, and brightness derived from Gaia DR3 astrometry (right ascension, declination, parallax, G-band magnitude, BP-RP color index)
- **Physically-based rendering** -- star brightness follows the inverse-square law; on-screen size uses perspective projection from a 1 solar-radius physical scale
- **Realistic star colors** -- interpolated along the blackbody radiation sequence from hot blue O-type to cool red M-type stars
- **Galaxy rotation** -- animated differential rotation with adjustable speed and pause controls
- **Explore mode** -- first-person fly controls (WASD/RF + mouse) to navigate the star field at speeds from a few AU/s up to 10,000 pc/s
- **Milky Way overlay** -- blendable artist's-impression image of the galaxy's spiral structure
- **Sun & galactic center markers** -- the Sun shown as a green dot at ~8,200 pc from center; a golden ring marks Sagittarius A*

## Controls

### Orbit Mode (default)

| Input | Action |
|---|---|
| Left Click + Drag | Rotate view |
| Right Click + Drag | Pan view |
| Scroll Wheel | Zoom in / out |

### Explore Mode

| Input | Action |
|---|---|
| W / S | Move forward / backward |
| A / D | Move left / right |
| R / F | Move up / down |
| Arrow Keys | Look up / down / left / right |
| Q / E | Roll counter-clockwise / clockwise |
| Click + Drag | Look around |
| Speed Slider | Adjust movement speed |

### Control Panel

| Control | Description |
|---|---|
| Rotation Speed | Adjusts galaxy rotation time scale (logarithmic) |
| Image Opacity | Blends the Milky Way background image |
| Star Size Scale | Multiplier for star physical radius (1x = true scale) |
| Reset View | Returns camera to top-down view |
| Explore Mode | Toggles first-person fly controls |
| Help | Opens a detailed overview of the simulation |
| Pause Animation | Freezes galaxy rotation |

## Getting Started

This is a static site -- no build step required.

1. Clone the repository:
   ```bash
   git clone https://github.com/aswin-r-nair/GalaxyMap.git
   cd GalaxyMap
   ```

2. Serve the files with any static HTTP server, for example:
   ```bash
   python -m http.server 8000
   ```

3. Open `http://localhost:8000` in the browser.

> **Note:** The `stars.csv` file (~38 MB) contains the full Gaia star catalog used by the visualization. It must be in the project root alongside `index.html`.

## Hosting on GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings > Pages**.
3. Set the source to **Deploy from a branch**, select `main` / root `/`, and save.
4. The site will be live at `https://<your-username>.github.io/GalaxyMap/`.

## Project Structure

```
GalaxyMap/
├── index.html            # HTML, CSS, and UI markup
├── main.js               # Three.js scene, controls, shaders, data loading
├── stars.csv             # Gaia star catalog (RA, Dec, parallax, G mag, BP-RP)
├── milky_way_map.jpg     # Galaxy background image
└── README.md
```

## Data

Star positions are computed from Gaia parallax measurements, converted from equatorial to galactic coordinates using the standard rotation matrix. Colors map the BP-RP index to a blackbody lookup table. Brightness uses absolute magnitude derived from apparent magnitude and distance.

## License

This project uses star data from the ESA Gaia mission. The Milky Way background image is an artist's impression. Three.js is loaded from unpkg CDN under the MIT license.
