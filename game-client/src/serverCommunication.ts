// higher level server communication for packet parsing, ticksIDs, deltas, snapshots, auth, ...

import webTransportCommunication from "./WebTransportCommunication";

export default class serverCommunication {
  // Create new low-level web transport connection
  private webT = new webTransportCommunication();
  public connected = false;
  public gameServerURl: null | string = null;

  async initConnection(gameServerURL: string) {
    const response = await this.webT.connectToGameServer(gameServerURL);
    if (response !== true)
      throw new Error("Could not connect to game: " + response);
    this.connected = true;
    this.gameServerURl = gameServerURL;
  }
}
