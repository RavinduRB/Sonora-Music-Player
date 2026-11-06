# Sonora Widget

Sonora is a compact premium music player widget for the Windows desktop. It uses a glassmorphism/liquid-glass interface with comfortable blue, mint, and ice colors. The widget can play local audio files and YouTube music as audio-only playback without opening an external browser window.

The widget is designed to stay small, remain above other applications, and provide quick access to a personal music library.

## Technology stack

- **Electron** - Windows desktop window, always-on-top behavior, transparent frameless widget, native save dialog, and persistent app storage
- **HTML5** - Accessible player structure and controls
- **CSS3** - Glassmorphism, liquid-glass layers, responsive widget layout, disc animation, and custom controls
- **Vanilla JavaScript** - Playback state, queue management, local files, YouTube integration, metadata loading, JSON handling, and persistence
- **HTML5 Audio API** - Local audio playback
- **YouTube IFrame Player API** - Embedded audio-only YouTube playback
- **YouTube oEmbed API** - Song title, channel/artist, and thumbnail metadata
- **Node.js HTTPS and filesystem APIs** - Metadata requests and library persistence
- **Electron Packager** - Windows executable packaging

## Key features

- Compact desktop widget interface
- Frameless transparent Electron window
- Always-on-top desktop pinning
- Click-through transparent area so other applications remain usable
- Local MP3, WAV, OGG, and other browser-supported audio files
- Drag-and-drop audio importing
- YouTube URL importing
- Audio-only YouTube playback inside the widget
- No external browser window for YouTube playback
- YouTube title and channel/artist metadata extraction
- Play, pause, previous, next, shuffle, and repeat controls
- Seek bar with current time and duration
- Local and YouTube volume control
- Mute and unmute button
- Rotating disc animation while music is playing
- Favorite button
- Expandable music library
- Remove songs from the library
- JSON library save dialog
- JSON library import and export
- Local audio files remain playable after restarting the widget
- Automatic library restoration after closing and reopening the application
- Portable Windows executable build

## Project structure

```text
.
├── app.js             Renderer logic and player behavior
├── index.html         Widget markup and controls
├── styles.css         Glassmorphism styling and animations
├── main.js            Electron main process and local app server
├── preload.js         Secure renderer-to-main IPC bridge
├── package.json       Scripts and dependencies
├── package-lock.json  Locked dependency versions
└── release-packaged/  Generated Windows application output
```

## Requirements

- Windows 10 or later
- Node.js and npm
- Internet access for:
  - YouTube audio playback
  - YouTube title and artist/channel metadata
  - Initial dependency installation

Local audio playback does not require an internet connection after the files have been added to the library.

## Run the widget from source

Open PowerShell in the project folder:

```powershell
cd C:\Users\ASUS\Desktop\Babe
```

Install dependencies:

```powershell
npm install
```

Start the desktop widget:

```powershell
npm start
```

The Sonora widget opens as a small desktop window. It does not open as a normal browser tab.

## Run the packaged Windows executable

The packaged executable is located at:

```text
release-packaged\Sonora-win32-x64\Sonora.exe
```

Double-click `Sonora.exe` to open the widget.

Keep the complete `Sonora-win32-x64` folder together. The executable requires the Electron runtime files stored beside it.

## Build a new Windows executable

From the project folder, run:

```powershell
npm run build
```

The generated application is written to:

```text
release-packaged\Sonora-win32-x64\
```

The executable is:

```text
release-packaged\Sonora-win32-x64\Sonora.exe
```

## Manual user guide

### 1. Start Sonora

1. Double-click `Sonora.exe`, or run `npm start` from the project folder.
2. The widget appears near the top-right of the desktop.
3. The widget is pinned above other windows by default.

### 2. Move the widget

1. Move the pointer over the Sonora header.
2. Drag the header to another position.
3. The widget can be placed over another application without opening a separate browser window.

The transparent area around the widget lets clicks pass through to other applications. The visible widget remains interactive.

### 3. Pin or unpin the widget

Click the pin icon in the header:

- Highlighted pin: widget stays above other windows
- Unhighlighted pin: widget behaves like a normal window

### 4. Add local music

1. Click the library icon in the header.
2. Click **Local audio**.
3. Select one or more audio files.

You can also drag audio files onto the **Drop audio files here to add them** area.

Supported files depend on the audio formats supported by the browser engine, including common formats such as:

- MP3
- WAV
- OGG
- M4A

Imported local audio is stored in the Sonora library data so it can be played again after restarting the widget.

### 5. Add a YouTube song

1. Click the library icon.
2. Click **YouTube link**.
3. Paste a YouTube URL.
4. Click **Add song**.

Supported URL styles include:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- YouTube Shorts links
- YouTube embed links
- YouTube live links

Sonora retrieves the YouTube title and channel/artist name. YouTube playback runs through an invisible embedded player, so no external browser window opens and no video is shown in the widget.

### 6. Select a song

1. Open the library.
2. Click any song in the song list.
3. The selected song becomes the current track.
4. Click the play button to start it.

### 7. Use playback controls

- **Play/Pause**: Start or pause the current track
- **Previous**: Go to the previous song
- **Next**: Go to the next song
- **Shuffle**: Select songs in random order
- **Repeat**: Replay the current song after it ends
- **Seek bar**: Jump to another position in the track
- **Volume slider**: Change playback volume
- **Speaker button**: Mute or restore the previous volume
- **Favorite**: Toggle the favorite visual state

When music is playing, the cover changes into a rotating disc. The disc stops when playback is paused.

### 8. Remove a song

1. Open the library.
2. Find the song in the list.
3. Click the `×` button on the right side of the song.

The song is removed from the current library and persistent storage.

### 9. Save the library as JSON

1. Click the save icon in the widget header, or open the library and click **Export JSON**.
2. Choose a location in the save dialog.
3. Save the file as `sonora-library.json`.

The JSON file contains the library entries, including:

- Song title
- Artist or YouTube channel
- Song type
- YouTube URL or local audio data
- Metadata information

### 10. Import a JSON library

1. Open the library.
2. Click **Import JSON**.
3. Select a previously exported Sonora JSON file.
4. The imported songs appear in the library.

Only valid Sonora song entries are accepted. Invalid JSON or unsupported entries show an error message.

### 11. Close and reopen the widget

Click the `×` button in the header to close the widget. Reopen it with the executable or `npm start`.

The previous library is restored automatically. Local audio and YouTube songs remain available for playback.

## Data and privacy

- Library data is stored locally on the computer.
- Local audio data is stored in the Electron application user-data directory.
- The Save button creates a JSON copy at the location selected by the user.
- YouTube links use YouTube services for audio playback and public metadata.
- No account login is required by Sonora.

## Troubleshooting

### The widget does not start

Run:

```powershell
npm install
npm start
```

If the packaged executable does not start, confirm that the complete `Sonora-win32-x64` folder has not been separated.

### YouTube metadata does not appear

Confirm that the computer is connected to the internet and that the URL is a valid YouTube link. The video ID remains as a fallback if metadata cannot be retrieved.

### YouTube audio does not play

Confirm that internet access is available and press play again. YouTube playback requires the embedded YouTube player to load.

### A local song does not play

Confirm that the file is a supported audio format and import it again through the library.