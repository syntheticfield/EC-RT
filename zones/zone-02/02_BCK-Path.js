window.addEventListener("load", () => {

  // 1. Lance Unity
  ECARTLoader.init({
    buildPath: "./02_BACK_01/Build",
    buildName: "02_BACK_01"
  });

  // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });

});