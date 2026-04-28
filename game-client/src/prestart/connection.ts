const URL = "https://127.0.0.1:4433/wt";

// class that only handle webtransport packet communication
export default class ServerCommunication {
  private transport: null | WebTransport;
  constructor() {}

  public async connectToGameServer(gameServerUrl: string) {
    // Initialize transport connection
    this.transport = new WebTransport(gameServerUrl);

    // The connection can be used once ready fulfills
    await this.transport.ready;
    console.log(`Successfully connected to ${gameServerUrl} !`);
  }

  public async closeConnection() {
    // Respond to connection closing

    try {
      await this.transport.closed;
      console.log(`The HTTP/3 connection closed gracefully.`);
    } catch (error) {
      console.error(`The HTTP/3 connection closed due to ${error}.`);
    }
  }
}
