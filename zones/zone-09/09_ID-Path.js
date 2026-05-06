/* EC@RT — Zone 09 Irène Dogmatic — config Unity */
window.addEventListener("load", () => {
  ECARTLoader.init({
    buildPath: "./09_ID/Build",
    buildName: "09_ID"
  });
     // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });

});
