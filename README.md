<!-- readme-seo: bannysukumar-professional-v4 -->

# Telegram Mini App

Telegram Mini App is a React client for Telegram. `public/index.html` loads `telegram-web-app.js` and TON Connect, and the page title is Telegram-web-app. Screens in `src/pages` cover home, farming, tasks, a game, news, wallet, invites, and profile.

## Overview

The Create React App starter text is not the product. `package.json` names the package `admin-app` and depends on React 19, Firebase, `react-router-dom`, and `@tonconnect/ui`. `src/components/WebAppInitializer.js` and `src/reactContext/TelegramContext.js` are part of the Telegram integration. `src/reactContext/WalletContext.js` sits next to the wallet page.

There is no GitHub homepage on this repository. The topic list should describe a Telegram mini app, not a Telegram bot, because this tree is the web client.

## Features

Confirmed by files under `src/pages` and `public/index.html`:

- Telegram Web App script and TON Connect script in `public/index.html`
- Home, farming, task, game, news, wallet, network invite, and profile pages
- Firebase config in `src/services/FirebaseConfig.js`
- Admin news and admin task pages

## Tech Stack

| Technology | Where it shows up |
|---|---|
| React 19 | `package.json` |
| Create React App scripts | `react-scripts` in `package.json` |
| Firebase | `firebase` dependency and `src/services/FirebaseConfig.js` |
| Telegram Web App | `telegram-web-app.js` in `public/index.html` |
| TON Connect | `@tonconnect/ui` and the TON Connect script |
| Tailwind CSS | `tailwind.config.js` |

## Architecture

Telegram client → this React app → Firebase services, with TON Connect loaded for the wallet screen.

## Project Structure

```text
Telegram-Mini-App/
├── public/index.html
├── src/pages/
├── src/components/WebAppInitializer.js
├── src/reactContext/
├── src/services/FirebaseConfig.js
├── package.json
└── tailwind.config.js
```

## Prerequisites

- Node.js
- npm

## Installation

```bash
git clone https://github.com/Bannysukumar/Telegram-Mini-App.git
cd Telegram-Mini-App
npm install
npm start
```

`npm start` runs `react-scripts start`. `npm test` runs `react-scripts test`.

## Configuration

Firebase settings are read from `src/services/FirebaseConfig.js`. Do not commit a production service-account key.

## Usage

Open the app from a Telegram web-app entry so `telegram-web-app.js` can initialize. The home, farm, task, game, news, and wallet routes are implemented under `src/pages`.

## Testing

`src/App.test.js` and `src/setupTests.js` are present. Run `npm test`.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Licensed under MIT. See [LICENSE](LICENSE).

## Author

Banny Sukumar

GitHub: https://github.com/Bannysukumar
