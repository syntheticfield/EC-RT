window.Zone01Memory = (() => {
  let points = [];

  const MAX_POINTS = 10;

  function addPoint(point) {
    points.push(point);

    if (points.length > MAX_POINTS) {
      points = points.slice(points.length - MAX_POINTS);
    }
  }

  function all() {
    return points;
  }

  function count() {
    return points.length;
  }

  function reset() {
    points = [];
  }

  return {
    addPoint,
    all,
    count,
    reset
  };
})();