/* EC@RT — Zone 04 NWMV — config Unity */
window.addEventListener("load", () => {
  ECARTLoader.init({
    buildPath: "./04_NWMV/Build",
    buildName: "03_NWMV"
  });

  ECARTJoystick.init({
    gameObject: "Main Camera",
    method: "ReceiveJoystick"
  });
});
