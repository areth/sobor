module.exports = fn => (handle, next) => {
  handle((context, msg) => {
    fn(context, msg, next);
  });
};
