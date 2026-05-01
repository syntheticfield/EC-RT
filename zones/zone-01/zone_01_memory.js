window.Zone01Memory = (() => {
  let data = {
    points: []
  };

  function addPoint(point) {
    data.points.push(point);
  }

  function updatePoint(index, patch) {
    if (!data.points[index]) return;
    data.points[index] = { ...data.points[index], ...patch };
  }

  function all() {
    return [...data.points];
  }

  function count() {
    return data.points.length;
  }

  function reset() {
    data = { points: [] };
  }

  reset();

  return {
    addPoint,
    updatePoint,
    all,
    count,
    reset
  };
})();