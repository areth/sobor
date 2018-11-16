const ajvMatcher = require('../src/ajvMatcher');
const chai = require('chai');
// const debug = require('debug')('sobor:test:ajvMatcher');

chai.should();

const initMessage = {
  txt: 'generic text',
  date: Date.now(),
};

describe('ajv matcher', () => {
  it('should match', () => {
    const schema = ajvMatcher.makeSchema({});
    ajvMatcher.match(schema, initMessage).should.to.be.true;
  });

  it('shouldn`t match', () => {
    const schema = ajvMatcher.makeSchema({
      type: 'object',
      required: ['dummy'],
    });
    ajvMatcher.match(schema, initMessage).should.to.be.false;
  });
});
