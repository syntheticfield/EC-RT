window.addEventListener("load", () => {

  // 1. Lance Unity
  ECARTLoader.init({
    buildPath: "../../unity/zone02-V2/Build",
    buildName: "build-mamco_compress"
  });

  // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });

});