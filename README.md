# Copilot for macOS

Live hints for interviews and meetings. The app listens to the conversation, transcribes speech on your Mac, spots questions, and shows a short answer in a small always-on-top window.

This is a fork of [Magerko/copilot](https://github.com/Magerko/copilot), which was built for Windows. This fork ports it to Apple Silicon Macs and adds new features. The Windows build is still in the code, but it has not been tested in this fork.

The interface is mostly in Russian. Choosing English in the settings translates only part of it. Questions and answers can be in Russian, Ukrainian, or English.

## Features
- **On-device speech recognition.** whisper.cpp runs locally on Metal. Audio never leaves your Mac and is never written to disk.
- **Your choice of model:** local (Ollama, LM Studio), cloud with an API key (OpenAI, Anthropic, Gemini, any OpenAI-compatible service), or Claude with your subscription.
- **Answers based on your documents.** Upload your resume and the job description. Anything missing from them is marked instead of being made up.
- **Solve a task from your screen.** One key captures the screen, then the model writes a solution and reviews any code it can see. You can also capture just a selected area.
- **Work from the small window.** Answer buttons, the auto-answer switch, and pause are all there, and the main window collapses during a session.
- **Usage tracking** for paid models, spending limits, and an offline mode that blocks external requests.

## What this fork adds
- macOS port: Apple Silicon build, code signing, whisper.cpp from Homebrew, system audio through ScreenCaptureKit.
- Claude with your subscription through the official Claude Code CLI, no API key needed.
- API key pool: when one key hits a limit, the request moves to the next key right away.
- One-key solving of tasks from the screen.
- Buttons and auto-answer in the hint window, plus a collapsing main window.
- Better pickup of quiet and short speech, with less CPU and GPU load.
- Number-based hotkeys that work with one hand on any keyboard layout.
- The answer hotkey answers the question being asked right now, even mid-sentence.
- macOS-style window buttons in the hint window.

## Screenshots
The data in these screenshots is fictional.

![Home screen](docs/screenshots/dashboard.png)

![Session](docs/screenshots/session.png)

| Hint window | Solving a task from the screen |
|---|---|
| ![Hint window](docs/screenshots/overlay-answer.png) | ![Solving a task](docs/screenshots/overlay-solve.png) |

![Semi-transparent hint window](docs/screenshots/overlay-transparent.png)

| First launch | Consent |
|---|---|
| ![First launch](docs/screenshots/onboarding.png) | ![Consent](docs/screenshots/consent.png) |

| Providers | Privacy |
|---|---|
| ![Providers](docs/screenshots/settings-providers.png) | ![Privacy](docs/screenshots/settings-privacy.png) |

## Install on a Mac
You need macOS 13 or later, Apple Silicon, and [Homebrew](https://brew.sh), which the app uses to install speech recognition.

### Download
1. Download the `.dmg` from [Releases](https://github.com/filooww/copilot/releases) and drag Copilot to Applications. In Activity Monitor its processes are named Audio Monitor.
2. Open the app. macOS will block it because it is not notarized by Apple.
3. Go to System Settings → Privacy & Security and click **Open Anyway**. Or run this command once:

```bash
xattr -cr /Applications/Copilot.app
```

4. Allow access to the microphone and screen recording. Without screen recording, the app can't hear the other person.

### Build from source
You also need [Node.js](https://nodejs.org). If you plan to rebuild the app more than once, [create a signing certificate](#if-you-dont-have-a-signing-certificate) first.

```bash
git clone https://github.com/filooww/copilot.git
```

```bash
cd copilot && npm install
```

```bash
brew install whisper-cpp
```

```bash
npm run install:mac
```

The app appears in Applications. On first launch, allow access to the microphone and screen recording. Without screen recording, the app can't hear the other person.

### If you don't have a signing certificate
You don't need one to build and run the app. Without it, `scripts/sign-mac.sh` prints a warning and uses an ad-hoc signature instead. The app works normally, and macOS remembers the permissions you grant.

The catch comes when you rebuild. macOS ties privacy permissions to the app's signature, and an ad-hoc signature changes with every build. Each new build counts as a different app, so macOS asks again, or the toggle in System Settings looks on while the app still can't hear anything.

If you only build once, you can ignore this. If you plan to rebuild or update the app, create a free self-signed certificate. You only do this once:

1. Open Keychain Access. On recent macOS versions it is at `/System/Library/CoreServices/Applications/Keychain Access.app`.
2. Choose **Keychain Access → Certificate Assistant → Create a Certificate**.
3. Set the name to `Copilot Dev`, the identity type to **Self Signed Root**, and the certificate type to **Code Signing**.
4. Run `npm run install:mac` again.

The script finds the certificate by name, so permissions now carry over between builds.

If permissions are already stuck, reset them and launch the app again:

```bash
tccutil reset ScreenCapture app.copilot
```

```bash
tccutil reset Microphone app.copilot
```

### Claude with your subscription
Install Claude Code, then sign in from the app's settings:

```bash
brew install --cask claude-code
```

Requests count toward your subscription limits. Models that require usage credits won't respond without them.

## First launch
1. Choose your microphone and system audio.
2. Download a speech recognition model, from 160 MB to 1.3 GB.
3. Connect a model for answers.
4. Upload your resume and the job description (PDF, DOCX, TXT).

To send text to a cloud model, turn that on in Settings → Privacy. It is off by default.

## Modes
- **Interview / call** answers only the other person's voice from system audio.
- **Practice** also answers the voice from your microphone, so use it when the other person is sitting next to you.

## Hotkeys
| | macOS | Windows |
|---|---|---|
| Answer | `⌃1` | `Ctrl+Alt+Enter` |
| Solve a task from the screen | `⌃2` | `Ctrl+Alt+X` |
| More detail | `⌃3` | `Ctrl+Alt+E` |
| Capture a screen area | `⌃4` | `Ctrl+Alt+S` |
| Auto-answer | `⌃5` | `Ctrl+Alt+Q` |
| Show or hide hints | `⌃6` | `Ctrl+Alt+H` |
| Start a session, pause | `⌃7` | `Ctrl+Alt+L` |
| Emergency stop | `⌃⌥⌫` | `Ctrl+Alt+Backspace` |

Pressing Answer while someone is still talking answers the question they are asking right now. The app cuts the current phrase and waits for its transcript, which takes a second or two.

You can change hotkeys in the settings.

## Limitations
- The hint window is flagged as hidden from screen capture, but that is not a guarantee: apps using ScreenCaptureKit on macOS 15 and later can still see it. Check for yourself before sharing your screen.
- Screen captures go to the model you selected, which means the cloud if that model is a cloud one. **Solve** sends the whole screen right away, so clear anything private first.
- Only record conversations and use AI hints where that is allowed, and tell the other participants. The app does not bypass proctoring or monitoring tools.

## For developers
```bash
npm install
```

```bash
npm test
```

```bash
npm run dev
```

Architecture and design decisions are in `docs/pipeline/`.

## Author and license
Original author: [Magerko](https://github.com/Magerko), Telegram [@magerdev1](https://t.me/magerdev1). MIT license, see [LICENSE](LICENSE).
