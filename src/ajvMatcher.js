const Ajv = require('ajv');

const ajv = new Ajv();

module.exports = {
  makeSchema: pattern => ajv.compile(pattern),
  match: (schema, obj) => schema(obj),
};
