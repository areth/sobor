module.exports = (fn) => {
  return (handle, next) => {
    handle((context, msg) => {
      fn(context, msg, next);
    });
  };
};
