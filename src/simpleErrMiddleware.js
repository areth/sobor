module.exports = (fn) => {
  return (handle, next) => {
    handle((context, msg, err) => {
      fn(context, msg, err, next);
    });
  };
};
