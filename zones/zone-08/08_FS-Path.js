/* EC@RT — Zone 08 Futurist Sound — config Unity */
window.addEventListener("load", () => {
  ECARTLoader.init({
    buildPath: "./08_FS/Build",
    buildName: "08_FS"
    
  });
    // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });

});
