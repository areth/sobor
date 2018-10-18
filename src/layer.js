const debug = require('debug')('sobor:layer');

class Layer {
  constructor(step, schema, fn) {
    debug('new %s %o', step, schema);

    this.step = step;
    this.handle = fn;
    this.name = fn.name || '<anonymous>';
    this.schema = schema;
  }

  // handleError(error, context, msg, next) {
  //   if (this.handle.length !== 4) {
  //     // not a standard error handler
  //     next(this.step + 1, context, msg, error);
  //     return;
  //   }

  //   try {
  //     this.handle(error, context, msg);
  //     //next(context, undefined, error); // in case the next() wasn't called in the handler
  //   } catch (err) {
  //     next(this.step + 1, context, msg, err);
  //   }
  // }

  // handleRequest(context, msg, next) {
  //   if (this.handle.length > 3) {
  //     // not a standard request handler
  //     next(this.step + 1, context, msg);
  //     return;
  //   }

  //   try {
  //     debug('handle %o', msg);
  //     this.handle(context, msg);
  //     //next(context); // in case the next() wasn't called in the handler
  //   } catch (err) {
  //     next(this.step + 1, context, msg, err);
  //   }
  // }
}

module.exports = Layer;
