# Two simulators on one machine

When you run **evaluator on one simulator** and **client on another** (same Mac), both need to reach the server. The server runs on the Mac; from each simulator, `localhost` is the simulator itself, not the Mac. So you must point the app to your **Mac’s IP**.

## 1. Find your Mac’s IP

```bash
# macOS: look for your LAN IP (e.g. 192.168.1.5 or 10.0.0.x)
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Use the address that looks like `192.168.x.x` or `10.x.x.x` (not `127.0.0.1`).

## 2. Point the app to that IP

Edit **`src/constants/config.ts`** and set the default for `HOST_IP` to your Mac’s IP:

```ts
const HOST_IP = getEnv('HOST_IP', '192.168.1.5');  // use your IP instead of localhost
```

Or, if you inject config at runtime (e.g. via `global.__CONFIG__`), set `HOST_IP` there.

## 3. Run server and both simulators

1. **Terminal 1:** Start the server on the Mac (both simulators will use your Mac IP to reach it).

   ```bash
   yarn server
   ```

2. **Terminal 2:** Start Metro.

   ```bash
   yarn start
   ```

3. **Simulator 1 (evaluator):**  
   `yarn ios` (or pick a device), then log in as evaluator, choose WebRTC, start a session with the client.

4. **Simulator 2 (client):**  
   Open a second simulator (e.g. `yarn ios:device2` or run from Xcode on another simulator), log in as client, choose WebRTC. You should see the client in the evaluator’s list; start the session.

Both simulators will use `http://<your-mac-ip>:3001` for API and Socket.io, so they both talk to the same server and can establish the WebRTC session.

## 4. Firewall

If the client simulator can’t connect, ensure your Mac allows incoming connections on port 3001 (or temporarily disable the firewall for testing).
