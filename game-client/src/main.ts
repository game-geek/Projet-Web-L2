import ServerCommunication from "./prestart/connection";
import { attemptAutoConnect } from "./prestart/serverCommunication";
import "./prestart/connectionUI";

// Create new low-level web transport connection
export const webT = new ServerCommunication();

// auto connect to server for debug purposes: until auth is implemented
attemptAutoConnect();
