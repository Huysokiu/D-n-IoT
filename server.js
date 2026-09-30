void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    String command = String((char*)payload);
    command.trim();

    if (command == "LIGHT_ON")  appLightState = true;
    if (command == "LIGHT_OFF") appLightState = false;
    if (command == "DOOR_OPEN")  appDoorOpen = true;
    if (command == "DOOR_CLOSE") appDoorOpen = false;
  }
}
