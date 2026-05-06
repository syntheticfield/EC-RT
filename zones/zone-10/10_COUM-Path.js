/* EC@RT — Zone 10 COUM — config Unity */
window.addEventListener("load", () => {
  ECARTLoader.init({
    buildPath: "./10_COUM/Build",
    buildName: "10_COUM"
  });
    // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });

});
