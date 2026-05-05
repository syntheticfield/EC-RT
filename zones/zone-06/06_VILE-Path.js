window.addEventListener("load", () => {

  // 1. Lance Unity
  ECARTLoader.init({
    buildPath: "./06_VILE/Build",
    buildName: "06_VILE"
  });

  // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });

});