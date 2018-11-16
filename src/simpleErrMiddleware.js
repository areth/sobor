module.exports = fn => (handle, next) => {
  handle((context, msg, err) => {
    fn(context, msg, err, next);
  });
};
