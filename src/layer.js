const debug = require('debug')('sobor:layer');

class Layer {
  constructor(step, schema, fn) {
    debug('new %s %o', step, schema);

    this.step = step;
    this.handle = fn;
    this.name = fn.name || '<anonymous>';
    this.schema = schema;
  }
}

module.exports = Layer;
