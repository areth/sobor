const defaultOptions = {
  connectionsCount: { min: 80, max: 110 },
};

class NetworkManager {
  constructor(options) {
    this.options = Object.assign({}, defaultOptions, options);
  }

  incomeConnection() {

  }

  connectionLost() {

  }

  // in(context, msg, done) {

  //   done(msg);
  // }

  // out(context, msg, done) {

  //   done(msg);
  // }

  in(context, msg) {
    return new Promise(resolve => resolve(msg));
  }

  out(context, msg) {
    return new Promise(resolve => resolve(msg));
  }

  prepareContext(context, peer, msg) {

  }
}

module.exports = NetworkManager;
