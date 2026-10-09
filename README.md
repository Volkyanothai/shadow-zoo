# Shadow Zoo — The First Duel

เกมต่อสู้สัตว์ 2D แบบแอป Godot เวอร์ชันต้นแบบ 0.2 สำหรับเล่นแนวนอนบนแท็บเล็ต

เล่นเป็น Kai (เสือ) ต่อสู้กับ Fen (หมาป่า AI) ในสนาม Moonlit Shrine มีโจมตีเบา คอมโบสามจังหวะ เตะหนัก ป้องกัน กระโดด และหลบ ใช้พลังในการออกท่า แข่งชนะสองยกจากสามยก ยกละ 60 วินาที เล่นออฟไลน์ได้

เวอร์ชันนี้เปลี่ยน Kai เป็นภาพเสือรายละเอียดสูงที่ประกอบจากภาพโปร่งใส 16 ชิ้น พร้อมท่ายืน เดิน คอมโบสามจังหวะ เตะ ป้องกัน และรับความเสียหาย แตะ **PREVIEW KAI** ในหน้าแรกเพื่อดูตัวละครขยายและสลับท่าได้ หมาป่ายังใช้ภาพต้นแบบเดิม ดู [ภาพและคลิปที่บันทึกจากเกมจริง](docs/visual-study.md) หรือ [ไฟล์ติดตั้ง](downloads/README.md)

## Try the Android build

The test APK is built at `build/shadow-zoo.apk`. Copy it to the tablet, open it, and allow installation from the app opening the file when Android requests it. Launch **Shadow Zoo**, turn the tablet to landscape, and tap **ENTER THE ARENA**.

Target: Android-compatible ARM64 devices, Android 7.0 / API 24 or newer, OpenGL ES 3.0. No Google Play services, account, network connection, or backend is required. HarmonyOS devices must support Android APKs. The build is signed with a local debug key for testing; a production release will need its own release signing configuration.

This is a first playable prototype, not a finished AAA game. Character art and animation are preliminary. Physical MatePad installation, sustained frame rate, thermal performance, and touch ergonomics still need testing on the actual tablet. A 60 Hz combat simulation is configured; it is not a measured 60 FPS guarantee on a tablet.

## Develop

Use Godot **4.6.3**, standard edition, with the Compatibility renderer. Import `project.godot` and press **F6/F5**, or run from this directory:

```sh
godot --headless --editor --import --path . --quit
godot --path .
```

The existing checkout is the working project; do not create a Git worktree unless requested. There are no external game packages, package-manager dependencies, secrets, or services.

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move | Hold left/right arrows | A / D or arrow keys |
| Light attack / three-hit chain | STRIKE | J |
| Heavy kick | HEAVY | K |
| Guard | Hold GUARD | Hold L |
| Jump | JUMP | Space |
| Dodge | DASH; hold a direction to choose it | Shift, with A / D to choose direction |
| Pause | Top-right pause button | Escape |
| Start / next round / rematch | Center button | Enter |
| Restart match | — | R |

Movement and guard support simultaneous touches. Guard reduces frontal damage and consumes stamina; depleted stamina causes a guard break. Dodging grants brief invulnerability, followed by a vulnerable recovery. Jumping can avoid a grounded strike. Switching away from the app pauses the duel.

## Verify

```sh
godot --headless --path . --script tests/smoke.gd
godot --headless --path . --script tests/visual_smoke.gd
```

The suite runs **25 behavioral checks**, covering scene startup, movement, pause, damage timing, combo damage, guarding, guard break, stamina, dodge invulnerability, range, airborne evasion, landing, multitouch, round/match transitions, rematches, timeouts, and AI damage. It exits nonzero on a failure.

The visual suite runs **56 checks** covering the actual transparent atlas, all 16 regions, metadata loading, articulated anatomy, changing walk poses, distinct combo poses, other combat poses, preview entry/exit and Android Back restoration. Both suites exit nonzero on failure.

Native rendered frames can be captured using `tests/visual_capture.gd` on a graphical display; it saves gameplay and pose PNGs to `/workspace/artifacts`. Add `-- --demo` with Godot's `--write-movie` and `--fixed-fps 60` options to record a deterministic animation demonstration. Its recording rate is not a device performance measurement.

## Export Android

Install the matching official Godot export templates. In **Editor Settings → Export → Android**, configure:

- A Java installation with `java` and `keytool` (the verified cloud build uses OpenJDK 21).
- Android SDK `platform-tools` and `build-tools` with a working `apksigner`.
- A debug keystore and its alias/password for test builds.

Then run:

```sh
bash tools/export_android.sh
```

The included preset exports ARM64 using the prebuilt official template, without Gradle or an Android source build. Keep keystores outside the checkout; APKs, caches, and keys are ignored. Release signing keys must be kept private and backed up separately.

The current cloud build used SHA-512-verified official Godot 4.6.3 templates and Android SDK archives verified against checksums in Google's repository manifest. APK v2/v3 signature verification and 16 KB alignment verification passed. Desktop rendering was checked using the native Godot OpenGL renderer; Android execution has not yet been tested on a device.

## Project files

- `scripts/game.gd`: match flow, AI, controls, hit resolution, HUD and menus.
- `scripts/fighter.gd`: fighter state machine, stamina, attacks and the wolf's procedural character art.
- `scripts/tiger_visual.gd`: painted tiger rig, limb articulation and combat animation driven by fighter state.
- `scripts/touch_pad.gd`: independent multitouch controls and movement dragging.
- `scripts/arena.gd`, `scripts/effects.gd`: painted arena, fireflies, impact particles and effects.
- `scripts/audio.gd`: bounded sound playback and mute preferences.
- `assets/`: generated arena and tiger artwork, original synthesized sound and the Rajdhani font.

The original tiger atlas is preserved as a single transparent painting. `assets/fighters/tiger/tiger-atlas.regions.json` stores precomputed alpha bounds so mobile startup does not scan every atlas pixel. The export includes that JSON and excludes tests, tools, docs and delivery files. Optional per-piece/per-pose paintings can be added through the rig's texture override API.

Rajdhani is redistributed under the SIL Open Font License, included in `assets/fonts/OFL.txt`. Arena and tiger art were generated for this project. The rig, wolf drawing and sound synthesis were created for this prototype. No assets from Shadow Fight are included.
