/* EC@RT — Zone 03 Anthropomorph — config Unity */
window.addEventListener("load", () => {
  ECARTLoader.init({
    buildPath: "./03_ANT/Build",
    buildName: "03_ANT"
  });

  // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });
  
});
