# Blockwalk · Portable voxel worlds

A static browser app that turns real locations into walkable voxel neighborhoods. Search an address or enter coordinates, generate an area, download it as a portable `.blockwalk` world, and load saved worlds locally. The default demo is centered at 1250 Turner Street, Auburn, Maine: Central Maine Community College. Its 720m area is centered at 44.1336, -70.2357 to favor campus grounds, woods, fields, and Lake Auburn. The spawn is the apex of the front drop-off loop (44.1340722, -70.2348581), facing the entrance. It loads from the bundled `public/data/demo.blockwalk` world file; the original Russell Street survey remains as a regression-test fixture.

## Run

```sh
npm ci
npm run dev
```

Open the printed localhost URL. `npm run build` creates `dist/`; `npm test` runs geographic, survey, roof-fitting, and physics checks.

WASD/arrow keys walk; Shift runs; Space hops. Mouse look uses pointer lock where available, with drag-to-look as fallback. V toggles bird's-eye view; WASD/arrow keys pan relative to the camera, Shift pans faster, and drag/scroll orbits/zooms. The overview starts centered on the whole area. The sun button changes the lighting. M expands the map; Escape pauses. “Back to house” returns to the starting location in the current world. Touch devices have a movement stick, drag-to-look, and hop button.

## Street-level detail pass (003)

Facades now follow the source polygon edges instead of staircase-shaped voxel walls. Siding, framed divided windows, door glass and handles, eave trim, and low entrance steps improve scale at eye level. Their specific appearance and placement are inferred. Forty roofs within 115m of the center use half-metre display voxels, with roof edges tapered to meet the eaves; the underlying lidar fit remains unchanged. Distant roofs retain one-metre sampling. Source terrain, aerial colors, vegetation positions, and world extent are preserved.

Street-name signs are placed near mapped junctions as navigation aids. Their text comes from OpenStreetMap; the sign objects/positions are inferred. They appear only in walking mode and fade with distance. The sun button cycles Daylight, Golden hour, and Overcast. These are artistic lighting presets, not date/time or weather simulations; shadows already baked into the aerial imagery remain.

The fitted geographic layout is now prepared at build time (`scripts/bake-world.mjs` via `prebuild`) and loaded directly by the browser. `world-layout.json` and `world-surface.bin` contain the generated layout and street mask. This removes repeated roof fitting from startup. Source snapshots remain available and rebuildable.

## Survey foundation (002)

- One-metre footprint grid instead of two metres: 420 deduplicated buildings.
- Real USGS elevation, with roughly 24m of relief; collision follows the same heightfield.
- Approximately 2.5 million sampled 2020 lidar points. 417 buildings have sufficient roof coverage. Robust gable/hip/flat fitting uses those samples to recover coherent roof profiles and reject isolated high returns.
- Actual aerial ground colors preserve driveways, paved lots, lawns, and roof tones. Pixelated to one metre. Trees are selected from elevated lidar canopy candidates corroborated by vegetation-colored aerial pixels, rather than scattered randomly.
- Separate wall and roof volumes, facade details, foundation offsets, and a starting view from Russell Street toward the address footprint.
- Instancing in 64m spatial chunks allows culling in the walking view.

## Accuracy limits

The scene remains a stylized reconstruction, not a surveyed model. Building footprints, aerial imagery, lidar, and DEM have different collection dates and may disagree. Lidar ground vs non-ground classification does not distinguish roofs from trees; footprint masks, height limits, and geometric roof fitting reduce but do not eliminate that ambiguity. Complex roofs are simplified to coherent gable, hip, or flat surfaces. Facade paint, doors, and windows are inferred. Trees are reconstructed canopy clusters, not individually verified stems; some baked aerial shadows remain on the ground. No interiors, live traffic, Google imagery, or private property records are included.

## Source data and licenses

Retrieved October 31, 2026:

- `public/data/neighborhood.json`: OpenStreetMap Overpass snapshot, bbox `44.0978,-70.1930,44.1041,-70.1824`. © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright).
- `public/data/buildings.json`: local subset of Microsoft [Global ML Building Footprints](https://github.com/microsoft/GlobalMLBuildingFootprints), quadkey `030233102`, [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/). Index: `https://bfppub.blob.core.windows.net/$web/2026-08-13/dataset-links.csv`.
- `public/data/survey/ground.bin`: USGS [3DEP elevation service](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer), 361 × 361 Float32 little-endian vertices, 2m spacing. Values in metres relative to `metadata.json`'s base elevation. Row-major, west to east and north to south.
- `public/data/survey/roofs.bin` and `canopy.bin`: derived from public-domain USGS 3DEP [ME_SouthCoastal_1_2020](https://usgs-lidar-public.s3.amazonaws.com/ME_SouthCoastal_1_2020/ept.json), EPT samples through depth 11 (about 0.6m nominal horizontal sampling). 720 × 720 Float32 little-endian cells at 1m. Roof raster is non-ground return elevation relative to the base; missing values are NaN. Canopy is non-ground height above DEM, missing values zero. The roof raster can also contain vegetation; roof fitting applies footprint and height filters.
- `public/data/survey/aerial.jpg` and `colors.bin`: USDA NAIP imagery distributed by [USGS NAIP Imagery service](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer), public domain. Raster cropped and averaged to 720 × 720 RGB cells, 1m spacing. `colors.bin` is RGB bytes, row-major north-to-south.
- `public/data/survey/metadata.json`: provenance, elevation range, dimensions, source project, and processed point count.

All survey rasters cover [-360,360] metres in the same local projection. OSM-derived geographic data remains subject to ODbL; this does not automatically put application code under ODbL. Source snapshots are downloadable from the app's About dialog.

## Rebuilding survey assets

The compact derived assets are checked in. Large source lidar files are not. To regenerate, install Python `numpy`, `Pillow`, `scipy`, `tifffile`, `pyproj`, and `laspy[lazrs]` in a temporary environment, then run from the project root:

```sh
python scripts/fetch-survey.py
python scripts/fetch-lidar.py
python scripts/process-survey.py
```

Sources are cached under `/tmp/blockwalk-survey`. The lidar fetcher intersects a local 3D bounding box with the public EPT hierarchy instead of downloading entire regional tiles. The reconstruction performs no network geodata requests at runtime.

## Code boundaries

- `src/world.ts`: projection, footprint rasterization, road mask, deterministic generation, prepared-layout hydration, focus and spawn.
- `src/architecture.ts`: source-aligned facades, display roof sampling, inferred details, entrance colliders.
- `src/signs.ts`: junction-based street-name navigation aids.
- `src/survey.ts`: compact raster loading and aligned sampling.
- `src/roof.ts`: robust roof model fitting.
- `src/render.ts`: terrain, aerial texture, instanced buildings/vegetation, lighting.
- `src/physics.ts`: Rapier heightfield, merged building colliders, tree trunks, player controller.
- `src/main.ts`: input, cameras, minimap, pause, and DOM UI.

## Verification

Tests cover the source-address footprint, safe road spawn, source elevation range, measured roofs, non-overlapping voxels, roof fitting with outliers, ground collision at asymmetric coordinates, hopping, building collision, and world bounds. Browser QA checks walking, drag-to-look, view switching, pause, and reset. Pointer lock may be denied in the embedded browser; use drag-to-look. Controller support is not implemented; touch hardware has not been verified.

## World Explorer 004: portable files and custom places

The Worlds button searches explicit user queries through Photon, accepts latitude/longitude directly, generates a fixed 720m area in a Web Worker, and imports/exports `.blockwalk` ZIP files. No generation server or central world storage is required. Generation contacts public third-party data services and depends on their availability, rate limits, CORS configuration, and geographic coverage. Endpoints can be changed in `public/services.json`; there are no API secrets in the browser.

- Search is submitted by a button, with local query caching and a delay between requests. The shared Photon demo API permits reasonable project usage without an availability guarantee. For a larger audience, configure an appropriate geocoder. No autocomplete or public Nominatim integration is used.
- Streets, footprints, and land features come from OpenStreetMap via Overpass. Where footprint coverage is sparse, the worker tries a bounded Microsoft Global ML Building Footprints tile download.
- Best-available generation in the contiguous US tries USGS 3DEP terrain, USDA NAIP aerial colors, and compatible public USGS EPT lidar. Lidar is decoded locally using laz-perf WebAssembly. Point counts, hierarchy size, download size, and dense-building output are bounded. Coverage failures are listed in the world information instead of presented as measured data.
- Outside that coverage, Map-based generation uses real mapped streets/footprints with flat terrain, generated ground colors, and inferred roof/vegetation details. It cannot promise the detailed Lewiston result everywhere. Unmapped locations may yield few or no buildings. Map data is not invented to fill missing streets/houses.
- Cancel terminates the worker. A world is activated only after generation and physics setup succeed. Replacing worlds disposes old graphics resources and physics state.
- World files include the layout, street mask, terrain, colors, roof/canopy rasters, location, quality notes, and attribution. They open without contacting geographic services. The application itself must be available locally or from a static host. Files are parsed locally; importing does not upload them.
- The versioned ZIP format allows only known entries, bounds compressed/uncompressed sizes and geometry counts, validates heights and layout, and never executes file content or fetches URLs supplied by a world file.

## GitHub Pages

The application builds to static files with relative asset paths, including the generation worker and lidar WASM. `.github/workflows/pages.yml` builds, tests, and deploys `dist` when the repository's Pages source is set to **GitHub Actions**. It supports both account-root and `/repository/` URLs without a backend or API keys. The current Sites sign-in layer is hosting-specific and does not carry into GitHub Pages.

New user worlds stay on their device unless they explicitly download/share the file. The repository includes one prepared Lewiston demo; it does not collect generated neighborhoods. Public service limits still apply independently of static hosting.
