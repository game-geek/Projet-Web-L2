import { saveGameServerURL, start } from "./main";

// HTML UI to connect to backend game server via URL
const connectionSection = document.getElementById(
  "prestart",
) as HTMLScriptElement;
const connectionForm = document.getElementById("connection") as HTMLFormElement;

connectionForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const form = new FormData(connectionForm);
  // @ts-ignore
  const gameServerURL: string = form.get("game-server-url");

  saveGameServerURL(gameServerURL);
  start(gameServerURL);
});

export function closeConnectionUI() {
  connectionSection.classList.add("hidden");
}
export function openConnectionUI() {
  connectionSection.classList.remove("hidden");
}
