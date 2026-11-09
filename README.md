# Sonora Music Player

Sonora is a compact music player with a glassmorphism interface. It runs as a
frameless, always-on-top Windows widget and can also be packaged as an Android
APK with Capacitor.

The player supports local audio files, YouTube videos and playlists, and
Spotify track links that are matched to YouTube playback. Local audio is
stored in the application library so it remains available after restarting
the app.

## Features

### Playback

- Local MP3, WAV, OGG, OGA, M4A, AAC, FLAC, Opus, WebM, and other
  browser-supported audio formats
- YouTube video and playlist playback through the YouTube IFrame API
- Spotify track metadata lookup followed by YouTube matching
- Play, pause, previous, next, shuffle, and repeat
- Repeat modes: off, repeat all, and repeat one
- Track seeking, volume control, and mute/unmute
- Current track metadata, duration, and playback progress
- Optional YouTube video panel for supported tracks

### Library

- Import multiple local audio files
- Drag and drop audio files on Windows
- Add YouTube video, playlist, Shorts, embed, live, and `youtu.be` links
- Add Spotify track links
- Favorite tracks and keep favorites at the top
- Rename tracks
- Remove tracks
- Export the library as JSON
- Import a previously exported JSON library
- Restore the library automatically after restarting

### Desktop experience

- Frameless transparent Electron window
- Compact 300 px widget that opens near the top-right of the primary display
- Always-on-top pinning
- Drag the widget by its header
- Automatic light/dark theme based on the background behind the widget
- Manual automatic, light, and dark theme modes
- Minimize and close controls

### Android experience

- Same player interface packaged in an Android WebView
- Responsive full-screen layout on phone-sized screens
- Local audio import through the Android file picker
- Library persistence through browser storage
- YouTube and Spotify features when internet access is available

The Android target is the Sonora app itself. It does not currently include an
Android home-screen playback widget or background media-service integration.

## Technology

- **Electron** - Windows desktop window, native IPC, persistent file storage,
  screen sampling, and window controls
- **Capacitor Android** - Android WebView packaging
- **HTML5 and CSS3** - Accessible player structure and responsive styling
- **Vanilla JavaScript** - Playback state, library management, metadata, and
  persistence
- **HTML5 Audio API** - Local audio playback
- **YouTube IFrame Player API** - YouTube video and playlist playback
- **YouTube oEmbed API** - YouTube title, channel, and thumbnail metadata
- **Spotify oEmbed API** - Public Spotify track metadata
- **Node.js** - Electron main-process HTTPS, filesystem, and library APIs
- **electron-packager** - Windows folder-based packaging
- **electron-builder** - Windows portable executable packaging
- **Capacitor CLI and Android** - Android project generation and APK builds

## Project structure

```text
.
├── app.js                  Renderer logic and player behavior
├── index.html              Player markup and controls
├── styles.css              Glassmorphism styling and responsive layout
├── main.js                 Electron process, local server, storage, and IPC
├── preload.js              Secure Electron renderer-to-main bridge
├── package.json             Scripts, dependencies, and Electron settings
├── package-lock.json        Locked npm dependency versions
├── capacitor.config.json    Capacitor Android configuration
├── scripts/
│   └── prepare-android.js   Copies web assets into www/
├── icon.ico                 Windows application icon
├── icon.svg                 Web and Android icon source
├── Sonora-debug.apk        Locally generated Android debug APK
└── README.md               This documentation
```

The following paths are generated and intentionally ignored by Git:

```text
node_modules/               npm dependencies
www/                        Capacitor web asset staging directory
android/                    Generated Capacitor Android project
dist/                       electron-builder output
release/                    Build output
release-packaged/           electron-packager output
*.apk                       Locally generated APK files
```

## Requirements

### Windows development

- Windows 10 or later
- Node.js and npm
- Internet access for the initial dependency installation and online playback

### Android APK builds

- Android Studio or an Android SDK installation
- Android SDK configured through `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or
  `android/local.properties`
- Java 21 or newer
- Internet access for Gradle and Android dependency downloads

The Android SDK must include the platform and build-tools versions selected by
the generated Capacitor project. Android Studio can install these components
from **Tools > SDK Manager**.

## Install dependencies

From the repository root:

```powershell
npm install
```

## Run the Windows app from source

```powershell
npm start
```

The widget opens as a desktop window rather than a normal browser tab.

## Build the Windows app

### Folder-based executable

```powershell
npm run build
```

The output is:

```text
release-packaged\Sonora-win32-x64\Sonora.exe
```

Keep the complete `Sonora-win32-x64` directory together. The executable
requires the Electron runtime files beside it.

### Portable executable

```powershell
npm run build:portable
```

The portable executable is written to `dist\` with a name similar to:

```text
Sonora-1.0.0.exe
```

Close running Sonora instances before building. Windows may lock files in
`release-packaged\` or `dist\`.

## Build the Android APK

### One-command debug build

```powershell
npm run android:build
```

This command:

1. Copies `index.html`, `styles.css`, `app.js`, and `icon.svg` to `www/`.
2. Synchronizes the web assets into the generated Capacitor project.
3. Runs Gradle to assemble the debug APK.

The APK is created at:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

The repository root may also contain a manually copied `Sonora-debug.apk`.
That file is a build artifact and is ignored by Git.

### Prepare or synchronize without building

After changing the web app:

```powershell
npm run android:prepare
npm run android:sync
```

`android:prepare` refreshes the `www/` directory. `android:sync` also runs
`npx cap sync android` to copy the files into the native project.

### Open in Android Studio

```powershell
npm run android:open
```

This prepares the web assets, synchronizes Capacitor, and opens the generated
Android project in Android Studio.

### Configure the Android SDK manually

If Gradle cannot find the SDK, create or update this file:

```text
android\local.properties
```

Use an escaped Windows path:

```text
sdk.dir=C:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
```

`android/local.properties` is machine-specific and should not be committed.

## Install the APK on a phone

### Install from the phone

1. Copy `android\app\build\outputs\apk\debug\app-debug.apk` to the phone.
2. Open the APK from the Files or Downloads app.
3. Allow installation from that source if Android asks.
4. Confirm the installation and launch **Sonora**.

### Install with ADB

With USB debugging enabled and the phone connected:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

The debug APK is intended for local testing. A release distribution requires
a signing key and a separate release build configuration.

## Using Sonora

### Add local audio

1. Open the library with the library button.
2. Select **Local audio**.
3. Choose one or more audio files.

On Windows, audio files can also be dropped onto the widget. On Android, use
the system file picker.

Local audio is converted to data URLs in the browser-based Android library.
This keeps the files available after restarting, but large libraries consume
substantial application storage. The Electron desktop build uses its native
file-backed library path when available.

### Add YouTube or Spotify music

1. Open the library.
2. Select **YouTube or Spotify**.
3. Paste a supported URL.
4. Select **Add song**.

Examples:

```text
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/playlist?list=PLAYLIST_ID
https://music.youtube.com/watch?v=VIDEO_ID
https://open.spotify.com/track/TRACK_ID
```

Spotify links use public oEmbed metadata and are matched to YouTube. Sonora
does not provide direct Spotify audio playback and does not require a Spotify
login. Spotify playlists and albums are not supported.

YouTube Mix playlists beginning with `RD` and private playlists cannot be
embedded reliably; a Mix link falls back to its individual video when
possible.

### Playback controls

| Control | Action |
| --- | --- |
| Play/Pause | Start or pause the active track |
| Previous / Next | Move through the library or playlist |
| Shuffle | Play tracks in random order without repeating until the queue is exhausted |
| Repeat | Cycle through off, repeat all, and repeat one |
| Seek bar | Move within the active track |
| Volume | Change playback volume |
| Speaker | Mute or restore the previous volume |
| Heart | Add or remove a favorite |
| Theme | Cycle automatic, light, and dark modes |

Favorites are saved and displayed at the top of the library. Renamed tracks
retain their custom names when online metadata is refreshed.

### Import and export a library

Use **Export JSON** in the library or the save button in the header to create
a `sonora-library.json` file. Use **Import JSON** to replace the current
library with a previously exported file.

The exported data can include:

- Track title and artist
- Track type and URL
- Local audio data
- YouTube metadata and playlist IDs
- Favorite and custom-title state

Export the current library before importing if you want to keep a backup.

## Storage and privacy

### Windows

The Electron main process stores the library and settings in the application
user-data directory, normally under `%APPDATA%`. It uses:

```text
sonora-library.json
sonora-settings.json
```

The browser storage copy allows the renderer to restore state when needed.
The Save button creates an additional JSON export at the location selected by
the user.

### Android

The Capacitor build uses WebView browser storage for the library and settings.
Imported local audio is stored as data in that library. Uninstalling or
clearing Sonora's app data removes the stored library.

### Network access

- Local audio playback does not require an internet connection after import.
- YouTube playback and YouTube metadata require internet access.
- Spotify track matching requires internet access.
- Google Fonts are optional; system fallbacks are used when they are
  unavailable.
- Sonora does not require account login.
- The Windows automatic theme mode samples nearby screen pixels for brightness
  detection. It does not save or transmit screenshots.

## Troubleshooting

### `npm start` does not launch

Run:

```powershell
npm install
npm start
```

If the packaged executable fails, confirm that the complete
`release-packaged\Sonora-win32-x64` directory is present.

### Android build says the SDK location is missing

Check that the Android SDK exists and configure one of:

```powershell
$env:ANDROID_HOME = "C:\Users\YourName\AppData\Local\Android\Sdk"
```

or `android\local.properties`:

```text
sdk.dir=C:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
```

Then run:

```powershell
npm run android:build
```

### Android APK will not install

Confirm that the APK completed downloading, that Android allows installation
from the file manager or browser being used, and that the phone is running a
compatible Android version. For an existing installation, use:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

### YouTube metadata or playback does not work

Confirm internet access and try a direct public YouTube video URL. Removed,
private, age-restricted, or embedding-disabled videos cannot play in the
embedded player.

### A local song does not play

Confirm that the file is a supported audio format and import it again. On
Android, confirm that the file picker granted Sonora access to the selected
file.

### The Android library disappeared

Do not clear Sonora's app data or uninstall the app. Export the library as
JSON regularly if the library is important, especially before changing
devices.

### The theme is not correct on Windows

Automatic theme detection updates after the widget moves or the background
changes. Use the theme button to select Light or Dark manually if screen
capture is unavailable or the background is a mid-tone color.

## Development notes

The Electron renderer is designed to run both with and without the
`window.sonora` preload bridge. Electron uses the bridge for native storage,
dialogs, window controls, and metadata requests. The Android WebView falls
back to browser APIs for local audio, browser storage, and JSON downloads.

When adding or changing web files, run:

```powershell
npm run android:sync
```

before testing in Android Studio. Do not edit generated files under `android/`
as a source-of-truth change; update the web source or Capacitor configuration
instead and regenerate the project.

## License

No license file is currently included in this repository. Add a license
before distributing Sonora outside your own development or testing use.
