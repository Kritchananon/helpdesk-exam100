import { io } from "socket.io-client";

const socket = io("ws://localhost:3000/notifications", {
  query: { token: "<JWT_TOKEN>" },
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
});

socket.on("connection_success", (data) => {
  console.log("📡 Connection success:", data);
});

socket.on("new_notification", (data) => {
  console.log("🔔 New notification:", data);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected");
});
