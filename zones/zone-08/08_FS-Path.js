/* EC@RT — Zone 08 Futurist Sound — config Unity */
window.addEventListener("load", () => {
  ECARTLoader.init({
    buildPath: "../../unity/zone08/Build",
    buildName: "08_FS"
  });
    // 2. Active le joystick HTML → Unity
  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });

});
