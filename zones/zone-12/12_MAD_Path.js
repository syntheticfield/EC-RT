/* EC@RT — Zone 12 MAD — config Unity */
window.addEventListener("load", () => {
  ECARTLoader.init({
    buildPath: "./12_MAD/Build",
    buildName: "12_MAD"
  });
    // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });

});
