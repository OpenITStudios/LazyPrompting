import {createHmac, timingSafeEqual} from "node:crypto";
import {once} from "node:events";
import {createConnection} from "node:net";

const MAX_FRAME = 16 * 1024;
const DEADLINE_MS = 8_000;

function readFrame(stream) {
  return new Promise((resolve, reject) => {
    let size;
    const timer = setTimeout(fail, DEADLINE_MS);
    function cleanup() {
      clearTimeout(timer);
      stream.off("readable", read).off("end", fail).off("close", fail).off("error", fail);
    }
    function fail() {
      cleanup();
      reject(new Error("NATIVE_IPC_READ_FAILED"));
    }
    function read() {
      try {
        if (size === undefined) {
          const header = stream.read(5);
          if (!header) return;
          size = header.readUInt32BE(1);
          if (header[0] !== 1 || size < 1 || size > MAX_FRAME) return fail();
        }
        const bytes = stream.read(size);
        if (!bytes) return;
        const message = JSON.parse(bytes.toString("utf8"));
        if (!message || typeof message !== "object" || Array.isArray(message)) return fail();
        cleanup();
        resolve(message);
      } catch {
        fail();
      }
    }
    stream.on("readable", read).once("end", fail).once("close", fail).once("error", fail);
    read();
  });
}

function writeFrame(socket, message) {
  const payload = Buffer.from(JSON.stringify(message));
  if (payload.length > MAX_FRAME) throw new Error("NATIVE_IPC_FRAME_TOO_LARGE");
  const header = Buffer.alloc(5);
  header[0] = 1;
  header.writeUInt32BE(payload.length, 1);
  socket.write(Buffer.concat([header, payload]));
}

export async function invokeNativeLightpanda(socket, capability, args, grantId) {
  if (typeof grantId !== "string" || !/^[a-f0-9]{64}$/.test(grantId))
    return {status: "ERROR", code: "NATIVE_ADMISSION_REQUIRED"};
  writeFrame(socket, {
    type: "authorize", grantId, capability, workspaceId: args.workspaceId, url: args.url ?? null
  });
  const reply = await readFrame(socket);
  if (reply.type !== "admission" || reply.grantId !== grantId || reply.allowed !== true)
    return {status: "ERROR", code: "NATIVE_ADMISSION_DENIED"};
  return reply.error
    ? {status: "ERROR", code: reply.error}
    : {status: "OK", structuredContent: reply.result};
}

function bytes(value, length) {
  if (typeof value !== "string" || value.length !== length * 2 || !/^[a-f0-9]+$/.test(value))
    throw new Error("NATIVE_IPC_INVALID_PROOF");
  return Buffer.from(value, "hex");
}

export async function connectNativeHost(input) {
  const bootstrap = await readFrame(input);
  if (bootstrap.type !== "bootstrap" ||
      bootstrap.pipe !== String.raw`\\.\pipe\lazyprompting-` + bootstrap.session)
    throw new Error("NATIVE_IPC_INVALID_BOOTSTRAP");
  const session = bytes(bootstrap.session, 16);
  const secret = bytes(bootstrap.secret, 32);
  delete bootstrap.secret;
  const socket = createConnection(bootstrap.pipe);
  socket.on("error", () => socket.destroy());
  socket.setTimeout(DEADLINE_MS, () => socket.destroy(new Error("NATIVE_IPC_TIMEOUT")));
  try {
    await once(socket, "connect");
    const challenge = await readFrame(socket);
    if (challenge.type !== "challenge") throw new Error("NATIVE_IPC_INVALID_CHALLENGE");
    const nonce = bytes(challenge.nonce, 32);
    const pid = Buffer.alloc(4);
    pid.writeUInt32BE(process.pid);
    const proof = direction => createHmac("sha256", secret)
      .update("lazyprompting-ipc-v1\0" + direction + "\0")
      .update(pid).update(session).update(nonce).digest();
    writeFrame(socket, {type: "childProof", proof: proof("child-to-host").toString("hex")});
    const host = await readFrame(socket);
    if (host.type !== "hostProof" || !timingSafeEqual(bytes(host.proof, 32), proof("host-to-child")))
      throw new Error("NATIVE_IPC_INVALID_HOST_PROOF");
    writeFrame(socket, {type: "authenticated"});
    socket.setTimeout(0);
    socket.once("close", () => input.destroy());
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  } finally {
    secret.fill(0);
  }
}
