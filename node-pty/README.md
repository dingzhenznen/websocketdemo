# node-pty demo

## Install

```bash
npm install
```

## Run interactive PTY

```bash
npm start
```

## Run smoke test

```bash
npm run smoke
```

On macOS, this demo also repairs `node-pty`'s bundled `spawn-helper` permission if it was
installed without execute bits. Without that fix, PTY creation can fail with
`posix_spawnp failed`.

## Run web terminal

```bash
npm run web
```

Open `http://127.0.0.1:3000`.

## Run web smoke test

```bash
npm run web:smoke
```
