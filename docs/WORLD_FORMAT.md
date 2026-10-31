# Blockwalk portable worlds, version 1

A `.blockwalk` file is a ZIP archive with these root entries:

| Entry | Contents |
| --- | --- |
| `manifest.json` | `format: "blockwalk-world"`, `version: 1`, and `info` (title, location, latitude/longitude origin, quality, creation date, source attributions, coverage warnings) |
| `layout.json` | Prepared layout version 3: fixed 720m width, roads, buildings, spawn, optional focus building ID, source count |
| `surface.bin` | 720 × 720 unsigned bytes, row-major north-to-south; 0 ground, 1 shoulder/sidewalk mask, 2 street |
| `ground.bin` | 361 × 361 little-endian Float32 vertices, 2m spacing; relative elevation in metres |
| `roofs.bin` | 720 × 720 little-endian Float32 cell heights, 1m spacing; NaN means missing |
| `canopy.bin` | 720 × 720 little-endian Float32 heights above ground; zero means missing |
| `colors.bin` | 720 × 720 RGB bytes, row-major north-to-south |
| `metadata.json` | Survey dimensions, base elevation, source origin, source services, elevation range, lidar year and sample count |
| `licenses.txt` | Geographic data license notices (optional for compatibility with early version-1 files) |

Coordinates in the prepared layout use metres east (`x`) and south (`z`) of the manifest origin. All rasters cover [-360,360]m. Buildings include their source outlines, one-metre occupancy cells, fitted roof heights per cell, base/eave heights, roof axis, front reference, and sampled roof color. The renderer applies its own facade details and fine display voxels; those meshes are not saved.

Imported archives are never extracted to the filesystem or executed. The loader accepts known entry names only, caps compressed and expanded sizes, validates dimensions/geometry counts/finite values, and checks that the starting point is outside buildings. It does not fetch URLs found in the file. Source attribution and quality warnings travel with the world.

The application ships one demo world. Generated worlds are held in browser memory until downloaded; the static host does not receive or store them. Files include the area's coordinates so they can retain their geographic meaning.
